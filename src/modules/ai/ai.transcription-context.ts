import { prisma } from "../../lib/prisma";
import { listActiveTranscriptionPhrases } from "../transcription-keywords/transcription-keywords.repository";
import { correctTranscriptSpellings } from "./ai.transcript-spellings";

/** Full org-context prompt (tests / docs). Sarvam v3 only gets first names. */
const MAX_PROMPT_CHARS = 1800;
const MAX_SARVAM_FIRST_NAME_CHARS = 500;
const MAX_NAMES_PER_GROUP = 80;

export type TranscriptionOrgContext = {
  people: string[];
  verticals: string[];
  pods: string[];
  projects: string[];
  keywords: string[];
};

function uniqueTrimmed(values: string[], limit = MAX_NAMES_PER_GROUP): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim().replace(/\s+/g, " ");
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function joinGroup(label: string, values: string[]): string | null {
  if (values.length === 0) return null;
  return `${label}: ${values.join(", ")}`;
}

/**
 * Build a Sarvam `prompt` that biases spellings toward org entities + admin keywords.
 */
export function formatTranscriptionPrompt(
  context: TranscriptionOrgContext,
  extra?: string | null
): string {
  const sections = [
    joinGroup("people", uniqueTrimmed(context.people)),
    joinGroup("verticals", uniqueTrimmed(context.verticals)),
    joinGroup("pods", uniqueTrimmed(context.pods)),
    joinGroup("projects", uniqueTrimmed(context.projects)),
    joinGroup("custom keywords", uniqueTrimmed(context.keywords, 120))
  ].filter(Boolean) as string[];

  const parts: string[] = [];
  if (sections.length > 0) {
    parts.push(
      `Prefer these exact spellings for names and terms when heard. ${sections.join("; ")}.`
    );
  }

  const extraTrimmed = extra?.trim();
  if (extraTrimmed) {
    parts.push(extraTrimmed);
  }

  let prompt = parts.join(" ").trim();
  if (prompt.length > MAX_PROMPT_CHARS) {
    prompt = `${prompt.slice(0, MAX_PROMPT_CHARS - 1).trimEnd()}…`;
  }
  return prompt;
}

export function firstNamesFromPeople(people: string[]): string[] {
  return uniqueTrimmed(
    people.map((name) => name.trim().split(/\s+/)[0] ?? "").filter((name) => name.length >= 3)
  );
}

/** Compact first-name list for Sarvam — v2.5 died on the full org prompt. */
export function formatSarvamFirstNamesPrompt(people: string[]): string {
  const names = firstNamesFromPeople(people);
  if (names.length === 0) return "";

  let list = names.join(", ");
  const prefix = "Prefer these teammate first-name spellings: ";
  if (`${prefix}${list}.`.length > MAX_SARVAM_FIRST_NAME_CHARS) {
    const kept: string[] = [];
    for (const name of names) {
      const next = kept.length === 0 ? name : `${kept.join(", ")}, ${name}`;
      if (`${prefix}${next}.`.length > MAX_SARVAM_FIRST_NAME_CHARS) break;
      kept.push(name);
    }
    list = kept.join(", ");
  }
  return list ? `${prefix}${list}.` : "";
}

export async function loadTranscriptionOrgContext(): Promise<TranscriptionOrgContext> {
  const [people, verticals, pods, projects, keywords] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, isPlaceholder: false },
      select: { name: true },
      orderBy: { name: "asc" },
      take: MAX_NAMES_PER_GROUP
    }),
    prisma.vertical.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
      take: MAX_NAMES_PER_GROUP
    }),
    prisma.pod.findMany({
      where: { isActive: true },
      select: { name: true },
      orderBy: { name: "asc" },
      take: MAX_NAMES_PER_GROUP
    }),
    prisma.project.findMany({
      where: { status: "ACTIVE" },
      select: { name: true },
      orderBy: { name: "asc" },
      take: MAX_NAMES_PER_GROUP
    }),
    listActiveTranscriptionPhrases()
  ]);

  return {
    people: people.map((row) => row.name),
    verticals: verticals.map((row) => row.name),
    pods: pods.map((row) => row.name),
    projects: projects.map((row) => row.name),
    keywords
  };
}

/** First names for Sarvam + optional caller extra. */
export async function buildTranscriptionPrompt(extra?: string | null): Promise<string | undefined> {
  try {
    const context = await loadTranscriptionOrgContext();
    const namesPrompt = formatSarvamFirstNamesPrompt(context.people);
    const extraTrimmed = extra?.trim();
    const prompt = [namesPrompt, extraTrimmed].filter(Boolean).join(" ");
    return prompt || undefined;
  } catch (error) {
    console.warn("[transcription-context] failed to build prompt:", error);
    const fallback = extra?.trim();
    return fallback || undefined;
  }
}

export async function applyTranscriptNameCorrections(transcript: string): Promise<string> {
  try {
    const context = await loadTranscriptionOrgContext();
    return correctTranscriptSpellings(transcript, [...context.people, ...context.keywords]);
  } catch (error) {
    console.warn("[transcription-context] name correction failed:", error);
    return transcript;
  }
}
