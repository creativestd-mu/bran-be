import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { WORK_STATUSES } from "./work.constants";

export type ExtractedStep = {
  description: string;
  deadline: string | null;
  assigneeName?: string | null;
  sourceExcerpt?: string | null;
};
export type ExtractedWorkUnit = {
  title: string;
  context: string;
  status: "OPEN" | "CLOSED";
  projectName?: string | null;
  assigneeName?: string | null;
  sourceExcerpt?: string | null;
  steps: ExtractedStep[];
};

let anthropicClient: Anthropic | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    if (!env.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    anthropicClient = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return anthropicClient;
}

function getGemini(): GoogleGenerativeAI {
  if (!geminiClient) {
    if (!env.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    geminiClient = new GoogleGenerativeAI(env.geminiApiKey);
  }
  return geminiClient;
}

function getAiProvider(): "anthropic" | "gemini" {
  return env.aiProvider.toLowerCase() === "gemini" ? "gemini" : "anthropic";
}

// Treat empty strings the same as null — LLMs frequently return "" instead of null.
const nullableText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const extractedResponseSchema = z.object({
  workUnits: z.array(
    z.object({
      title: z.string().trim().min(1),
      // LLM sometimes returns an empty context when there's nothing beyond the title.
      context: z
        .string()
        .trim()
        .nullish()
        .transform((v) => v ?? ""),
      status: z.enum(WORK_STATUSES).optional(),
      projectName: nullableText,
      assigneeName: nullableText,
      sourceExcerpt: nullableText,
      steps: z
        .array(
          z.object({
            description: z.string().trim().min(1),
            deadline: z.string().nullable().optional(),
            assigneeName: nullableText,
            sourceExcerpt: nullableText
          })
        )
        .optional()
    })
  )
});

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function parseDeadlineToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

async function callLlm(systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = getAiProvider();

  if (provider === "gemini") {
    const model = getGemini().getGenerativeModel({
      model: env.geminiModel,
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens: 2048, temperature: 0.2 }
    });
    const result = await model.generateContent(userPrompt);
    return result.response.text() || "";
  }

  const response = await getAnthropic().messages.create({
    model: env.anthropicModel,
    max_tokens: 2048,
    temperature: 0.2,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }]
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text ?? "";
}

export function isWorkExtractionAiConfigured(): boolean {
  const provider = env.aiProvider.toLowerCase() === "gemini" ? "gemini" : "anthropic";
  return provider === "gemini" ? Boolean(env.geminiApiKey) : Boolean(env.anthropicApiKey);
}

export type WorkExtractionTextKind = "transcript" | "email" | "slack";

function buildExtractionSystemPrompt(options: {
  kind: WorkExtractionTextKind;
  projectHint: string;
  teamHint: string;
}): string {
  const kindLabel =
    options.kind === "email"
      ? "email messages"
      : options.kind === "slack"
        ? "Slack channel/thread messages"
        : "spoken meeting notes or voice memos";

  return (
    "You extract structured work units from " +
    kindLabel +
    ". Return STRICT JSON only (no markdown, no prose) with shape: " +
    '{ "workUnits": [ { "title": string, "context": string, "status": "OPEN"|"CLOSED", "projectName": string|null, "assigneeName": string|null, "sourceExcerpt": string|null, "steps": [ { "description": string, "deadline": string|null, "assigneeName": string|null, "sourceExcerpt": string|null } ] } ] }. ' +
    "SCOPE: Extract ONLY genuine org/business/student work — concrete tasks, commitments, deliverables, follow-ups, approvals needed for projects, launches, campaigns, student programs, vendor/client work. " +
    "Return an EMPTY workUnits array for: newsletters, marketing, receipts, OTPs, login alerts, social notifications, greetings, OOO/auto-replies, calendar invites, meeting scheduling, chit-chat, attendance/ETA/WFH/leave, pure status pings with no action item. " +
    "Rules: one input may contain MULTIPLE work units; status must be OPEN unless clearly finished; " +
    options.projectHint +
    "projectName must be null unless clearly mentioned; never invent a project name; " +
    options.teamHint +
    "assigneeName at the work unit level means the whole task is for that person; assigneeName on a step means only that step is for them; set to null if unclear; only use exact names from the team members list; " +
    "sourceExcerpt must be a verbatim quote from the source that this work unit or step was derived from; use null only if no specific phrase can be identified; " +
    "deadline must be ISO-8601 resolved relative to the provided current date-time: use full datetime when a time is mentioned, otherwise date-only, or null if none mentioned; " +
    "the first step should capture the action already taken when relevant, and follow-up actions become subsequent steps."
  );
}

async function parseExtractedWorkUnits(raw: string): Promise<ExtractedWorkUnit[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch (err) {
    console.error("[work.extraction] LLM returned non-JSON", {
      rawLength: raw.length,
      rawPreview: raw.slice(0, 500),
      error: err instanceof Error ? err.message : String(err)
    });
    throw new HttpError(502, "Could not extract work units from source text");
  }

  const validated = extractedResponseSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("[work.extraction] LLM JSON failed schema validation", {
      issues: validated.error.flatten(),
      rawPreview: raw.slice(0, 500)
    });
    throw new HttpError(502, "Could not extract work units from source text");
  }

  return validated.data.workUnits.map((unit) => ({
    title: unit.title,
    context: unit.context.trim().length > 0 ? unit.context : unit.title,
    status: unit.status ?? "OPEN",
    projectName: unit.projectName ?? null,
    assigneeName: unit.assigneeName ?? null,
    sourceExcerpt: unit.sourceExcerpt ?? null,
    steps: (unit.steps ?? [])
      .filter((step) => step.description.trim().length > 0)
      .map((step) => ({
        description: step.description.trim(),
        deadline: parseDeadlineToIso(step.deadline ?? null),
        assigneeName: step.assigneeName ?? null,
        sourceExcerpt: step.sourceExcerpt ?? null
      }))
  }));
}

export async function extractWorkUnitsFromText(
  text: string,
  options: {
    kind: WorkExtractionTextKind;
    now?: Date;
    availableProjects?: Array<{ id: string; name: string }>;
    availableUsers?: Array<{ id: string; name: string }>;
  }
): Promise<ExtractedWorkUnit[]> {
  const now = options.now ?? new Date();
  const availableProjects = options.availableProjects ?? [];
  const availableUsers = options.availableUsers ?? [];

  const projectHint =
    availableProjects.length > 0
      ? `Available projects (use projectName only when clearly referred to): ${availableProjects
          .map((project) => project.name)
          .join(", ")}. `
      : "";

  const teamHint =
    availableUsers.length > 0
      ? `Team members (use assigneeName only when clearly mentioned): ${availableUsers
          .map((u) => u.name)
          .join(", ")}. `
      : "";

  const systemPrompt = buildExtractionSystemPrompt({
    kind: options.kind,
    projectHint,
    teamHint
  });

  const label =
    options.kind === "email" ? "Email" : options.kind === "slack" ? "Slack thread" : "Transcript";

  const userPrompt = `Current date-time: ${now.toISOString()}\n\n${label}:\n"""${text}"""`;

  const raw = await callLlm(systemPrompt, userPrompt);
  return parseExtractedWorkUnits(raw);
}

export async function extractWorkUnitsFromTranscript(
  transcript: string,
  options?: {
    now?: Date;
    availableProjects?: Array<{ id: string; name: string }>;
    availableUsers?: Array<{ id: string; name: string }>;
  }
): Promise<ExtractedWorkUnit[]> {
  return extractWorkUnitsFromText(transcript, {
    kind: "transcript",
    now: options?.now,
    availableProjects: options?.availableProjects,
    availableUsers: options?.availableUsers
  });
}
