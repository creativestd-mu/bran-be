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

export async function extractWorkUnitsFromTranscript(
  transcript: string,
  options?: {
    now?: Date;
    availableProjects?: Array<{ id: string; name: string }>;
    availableUsers?: Array<{ id: string; name: string }>;
  }
): Promise<ExtractedWorkUnit[]> {
  const now = options?.now ?? new Date();
  const availableProjects = options?.availableProjects ?? [];
  const availableUsers = options?.availableUsers ?? [];

  const projectHint =
    availableProjects.length > 0
      ? `Available projects for this user (use projectName only when the transcript clearly refers to one): ${availableProjects
          .map((project) => project.name)
          .join(", ")}. `
      : "";

  const teamHint =
    availableUsers.length > 0
      ? `Team members (use assigneeName only when the transcript clearly mentions a person by name for a task or step): ${availableUsers
          .map((u) => u.name)
          .join(", ")}. `
      : "";

  const systemPrompt =
    "You extract structured work units from spoken meeting notes or voice memos. " +
    "Return STRICT JSON only (no markdown, no prose) with shape: " +
    '{ "workUnits": [ { "title": string, "context": string, "status": "OPEN"|"CLOSED", "projectName": string|null, "assigneeName": string|null, "sourceExcerpt": string|null, "steps": [ { "description": string, "deadline": string|null, "assigneeName": string|null, "sourceExcerpt": string|null } ] } ] }. ' +
    "Rules: one transcript may contain MULTIPLE work units; status must be OPEN unless clearly finished; " +
    projectHint +
    "projectName must be null unless the transcript clearly mentions one of the available projects; never invent a project name; " +
    teamHint +
    "assigneeName at the work unit level means the whole task is for that person; assigneeName on a step means only that step is for them; set to null if unclear; only use exact names from the team members list; " +
    "sourceExcerpt must be a verbatim quote (one sentence or phrase) from the transcript that this work unit or step was derived from; use null only if no specific phrase can be identified; " +
    "deadline must be ISO-8601 resolved relative to the provided current date-time: use full datetime (YYYY-MM-DDTHH:mm:ss.sssZ) when a time is mentioned, otherwise date-only (YYYY-MM-DD), or null if none mentioned; " +
    "the first step should capture the action already taken or meeting held when relevant, and follow-up actions become subsequent steps.";

  const userPrompt = `Current date-time: ${now.toISOString()}\n\nTranscript:\n"""${transcript}"""`;

  const raw = await callLlm(systemPrompt, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch (err) {
    console.error("[work.extraction] LLM returned non-JSON", {
      rawLength: raw.length,
      rawPreview: raw.slice(0, 500),
      error: err instanceof Error ? err.message : String(err)
    });
    throw new HttpError(502, "Could not extract work units from audio");
  }

  const validated = extractedResponseSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("[work.extraction] LLM JSON failed schema validation", {
      issues: validated.error.flatten(),
      rawPreview: raw.slice(0, 500)
    });
    throw new HttpError(502, "Could not extract work units from audio");
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
