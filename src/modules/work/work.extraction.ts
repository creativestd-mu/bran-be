import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { previewWorkText, WORK_STATUSES } from "./work.constants";
import { workDeadlineAtEndOfDay } from "./work.due-fields";

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

type WorkAiProvider = "anthropic" | "gemini" | "openrouter";

function getAiProvider(): WorkAiProvider {
  const requested = (env.workExtractionProvider || env.aiProvider || "").toLowerCase();
  if (requested === "openrouter") {
    if (env.openrouterApiKey) return "openrouter";
    console.warn("[work.extraction] OPENROUTER_API_KEY missing; falling back to AI_PROVIDER");
  } else if (requested === "gemini" || requested === "anthropic") {
    return requested;
  }

  if (env.aiProvider.toLowerCase() === "openrouter" && env.openrouterApiKey) {
    return "openrouter";
  }
  return env.aiProvider.toLowerCase() === "gemini" ? "gemini" : "anthropic";
}

function getAiModel(provider: WorkAiProvider): string {
  if (provider === "gemini") return env.geminiModel;
  if (provider === "openrouter") return env.openrouterModel;
  return env.anthropicModel;
}

function describeLlmError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { error: String(error) };
  const extra = error as Error & { status?: unknown; code?: unknown };
  return {
    error: error.message,
    name: error.name,
    status: extra.status ?? null,
    code: extra.code ?? null
  };
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
  const trimmed = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function recoverTruncatedWorkUnitsJson(text: string): unknown {
  const key = text.search(/"workUnits"\s*:\s*\[/);
  if (key < 0) {
    throw new SyntaxError("no workUnits array");
  }

  const bracket = text.indexOf("[", key);
  let depth = 0;
  let inString = false;
  let escape = false;
  let lastCompleteObjectEnd = -1;

  for (let i = bracket + 1; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) lastCompleteObjectEnd = i;
    }
  }

  if (lastCompleteObjectEnd < 0) {
    throw new SyntaxError("no complete work unit object");
  }

  return JSON.parse(`{"workUnits":${text.slice(bracket, lastCompleteObjectEnd + 1)}]}`);
}

/** Parse LLM JSON, including markdown fences and truncated workUnits arrays. */
export function parseLlmWorkUnitsJson(raw: string): unknown {
  const stripped = stripCodeFences(raw);
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.search(/[{\[]/);
    if (start < 0) {
      throw new SyntaxError("LLM output contained no JSON");
    }
    const slice = stripped.slice(start);
    try {
      return JSON.parse(slice);
    } catch {
      return recoverTruncatedWorkUnitsJson(slice);
    }
  }
}

export function parseDeadlineToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const noonUtc = new Date(`${trimmed}T12:00:00.000Z`);
    return workDeadlineAtEndOfDay(noonUtc).toISOString();
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return workDeadlineAtEndOfDay(parsed).toISOString();
}

async function callOpenRouter(systemPrompt: string, userPrompt: string, model: string): Promise<string> {
  if (!env.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openrouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.appUrl || "https://bran.app",
      "X-Title": "Bran"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  const body = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  };

  if (!response.ok) {
    throw new HttpError(
      response.status >= 400 && response.status < 600 ? response.status : 502,
      body.error?.message || `OpenRouter returned status ${response.status}`
    );
  }

  const content = body.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "string" ? part : part.text || "")).join("");
  }
  return "";
}

async function callLlm(systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = getAiProvider();
  const model = getAiModel(provider);
  console.log("[work.extraction] calling LLM", { provider, model, promptChars: userPrompt.length });

  try {
    if (provider === "openrouter") {
      return await callOpenRouter(systemPrompt, userPrompt, model);
    }

    if (provider === "gemini") {
      const gemini = getGemini().getGenerativeModel({
        model,
        systemInstruction: systemPrompt,
        generationConfig: { maxOutputTokens: 8192, temperature: 0.2 }
      });
      const result = await gemini.generateContent(userPrompt);
      return result.response.text() || "";
    }

    const response = await getAnthropic().messages.create({
      model,
      max_tokens: 8192,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock?.text ?? "";
  } catch (error) {
    console.error("[work.extraction] LLM call failed", { provider, model, ...describeLlmError(error) });
    throw error;
  }
}

export async function callWorkLlm(systemPrompt: string, userPrompt: string): Promise<string> {
  return callLlm(systemPrompt, userPrompt);
}

export function isWorkExtractionAiConfigured(): boolean {
  const provider = getAiProvider();
  if (provider === "gemini") return Boolean(env.geminiApiKey);
  if (provider === "openrouter") return Boolean(env.openrouterApiKey);
  return Boolean(env.anthropicApiKey);
}

export function getWorkExtractionAiInfo() {
  const provider = getAiProvider();
  return {
    provider,
    model: getAiModel(provider),
    configured: isWorkExtractionAiConfigured()
  };
}

export type WorkExtractionTextKind = "transcript" | "email" | "slack";

function buildExtractionSystemPrompt(options: {
  kind: WorkExtractionTextKind;
  projectHint: string;
  teamHint: string;
  orgNameHint: string;
}): string {
  const kindLabel =
    options.kind === "email"
      ? "email messages"
      : options.kind === "slack"
        ? "Slack channel/thread messages"
        : "spoken meeting notes or voice memos";

  const slackMentionHint =
    options.kind === "slack"
      ? "In Slack threads, a person named with @ (e.g. @Dhananjay) is usually the assignee for that task — set assigneeName to their exact team-member name. "
      : "";

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
    options.orgNameHint +
    options.teamHint +
    slackMentionHint +
    "assigneeName is who must DO the work, not who is helped, shown something, or receiving a deliverable. If the speaker says I/me need to help/show/create for someone, leave assigneeName null. Set assigneeName only when the source says that person needs to / will / should do it. Use a team-list name when it is clearly the same person (Amisha ≈ Amit Shah, Dhananjay ≈ Dhananjaya/Narayan if context matches). Set to null if unclear; " +
    "sourceExcerpt must be a verbatim quote from the source that this work unit or step was derived from; use null only if no specific phrase can be identified; " +
    "deadline must be ISO-8601 resolved relative to the provided current date-time: date-only is fine when no clock time is mentioned (the system treats it as 20:00 Asia/Kolkata that day); " +
    "if no deadline is mentioned, use the current date — assume the work is due that same day; do not leave deadline null; " +
    "the first step should capture the action already taken when relevant, and follow-up actions become subsequent steps."
  );
}

export function deadlineOrSameDay(
  value: string | null | undefined,
  now: Date = new Date()
): string {
  return parseDeadlineToIso(value) ?? workDeadlineAtEndOfDay(now).toISOString();
}

async function parseExtractedWorkUnits(raw: string, now: Date): Promise<ExtractedWorkUnit[]> {
  let parsed: unknown;
  try {
    parsed = parseLlmWorkUnitsJson(raw);
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

  const sameDayDeadline = workDeadlineAtEndOfDay(now).toISOString();

  return validated.data.workUnits.map((unit) => {
    const steps = (unit.steps ?? [])
      .filter((step) => step.description.trim().length > 0)
      .map((step) => ({
        description: step.description.trim(),
        deadline: deadlineOrSameDay(step.deadline ?? null, now),
        assigneeName: step.assigneeName ?? null,
        sourceExcerpt: step.sourceExcerpt ?? null
      }));

    return {
      title: unit.title,
      context: unit.context.trim().length > 0 ? unit.context : unit.title,
      status: unit.status ?? "OPEN",
      projectName: unit.projectName ?? null,
      assigneeName: unit.assigneeName ?? null,
      sourceExcerpt: unit.sourceExcerpt ?? null,
      steps:
        steps.length > 0
          ? steps
          : [
              {
                description: unit.title,
                deadline: sameDayDeadline,
                assigneeName: unit.assigneeName ?? null,
                sourceExcerpt: unit.sourceExcerpt ?? null
              }
            ]
    };
  });
}

export async function extractWorkUnitsFromText(
  text: string,
  options: {
    kind: WorkExtractionTextKind;
    now?: Date;
    availableProjects?: Array<{ id: string; name: string }>;
    availableUsers?: Array<{ id: string; name: string }>;
    availablePods?: Array<{ id: string; name: string }>;
    availableVerticals?: Array<{ id: string; name: string }>;
  }
): Promise<ExtractedWorkUnit[]> {
  const now = options.now ?? new Date();
  const availableProjects = options.availableProjects ?? [];
  const availableUsers = options.availableUsers ?? [];
  const availablePods = options.availablePods ?? [];
  const availableVerticals = options.availableVerticals ?? [];

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

  const orgParts: string[] = [];
  if (availableVerticals.length > 0) {
    orgParts.push(`verticals: ${availableVerticals.map((v) => v.name).join(", ")}`);
  }
  if (availablePods.length > 0) {
    orgParts.push(`pods: ${availablePods.map((p) => p.name).join(", ")}`);
  }
  const orgNameHint =
    orgParts.length > 0
      ? `Prefer these exact org spellings in title/context when mentioned (${orgParts.join("; ")}). `
      : "";

  const systemPrompt = buildExtractionSystemPrompt({
    kind: options.kind,
    projectHint,
    teamHint,
    orgNameHint
  });

  const label =
    options.kind === "email" ? "Email" : options.kind === "slack" ? "Slack thread" : "Transcript";

  const userPrompt = `Current date-time: ${now.toISOString()}\n\n${label}:\n"""${text}"""`;

  console.log("[work.extraction] start", {
    kind: options.kind,
    ...getWorkExtractionAiInfo(),
    textChars: text.length,
    textPreview: previewWorkText(text),
    teamCount: availableUsers.length,
    projectCount: availableProjects.length,
    podCount: availablePods.length,
    verticalCount: availableVerticals.length
  });

  let raw = await callLlm(systemPrompt, userPrompt);
  console.log("[work.extraction] LLM raw response", {
    kind: options.kind,
    rawChars: raw.length,
    rawPreview: previewWorkText(raw, 400)
  });

  try {
    const units = await parseExtractedWorkUnits(raw, now);
    console.log("[work.extraction] parsed", {
      kind: options.kind,
      count: units.length,
      titles: units.map((unit) => unit.title)
    });
    return units;
  } catch (firstError) {
    console.warn("[work.extraction] first parse failed; retrying compact JSON", {
      kind: options.kind,
      error: firstError instanceof Error ? firstError.message : String(firstError)
    });
    raw = await callLlm(
      `${systemPrompt} Reply with one compact JSON object only. Keep titles short. Omit sourceExcerpt if needed.`,
      userPrompt
    );
    const units = await parseExtractedWorkUnits(raw, now);
    console.log("[work.extraction] parsed after retry", {
      kind: options.kind,
      count: units.length,
      titles: units.map((unit) => unit.title)
    });
    return units;
  }
}

export async function extractWorkUnitsFromTranscript(
  transcript: string,
  options?: {
    now?: Date;
    availableProjects?: Array<{ id: string; name: string }>;
    availableUsers?: Array<{ id: string; name: string }>;
    availablePods?: Array<{ id: string; name: string }>;
    availableVerticals?: Array<{ id: string; name: string }>;
  }
): Promise<ExtractedWorkUnit[]> {
  return extractWorkUnitsFromText(transcript, {
    kind: "transcript",
    now: options?.now,
    availableProjects: options?.availableProjects,
    availableUsers: options?.availableUsers,
    availablePods: options?.availablePods,
    availableVerticals: options?.availableVerticals
  });
}
