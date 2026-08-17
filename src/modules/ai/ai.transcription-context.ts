import { prisma } from "../../lib/prisma";
import { listActiveTranscriptionPhrases } from "../transcription-keywords/transcription-keywords.repository";

/** Sarvam prompt budget — keep under typical STT context limits. */
const MAX_PROMPT_CHARS = 1800;
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

/** Org spellings + optional caller extra (e.g. meeting speaker hint or client prompt). */
export async function buildTranscriptionPrompt(extra?: string | null): Promise<string | undefined> {
  try {
    const context = await loadTranscriptionOrgContext();
    const prompt = formatTranscriptionPrompt(context, extra);
    return prompt || undefined;
  } catch (error) {
    console.warn("[transcription-context] failed to build prompt:", error);
    const fallback = extra?.trim();
    return fallback || undefined;
  }
}
