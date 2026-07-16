import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

import { env } from "../../config/env";
import {
  ESCALATION_PRIORITIES,
  ESCALATION_STATUSES,
  type EscalationPriority,
  type EscalationStatus
} from "./escalation.constants";

export type EscalationAiAnalysis = {
  summary: string;
  status: EscalationStatus;
  priority: EscalationPriority;
  blockers: string[];
  reasoning: string | null;
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

export function isEscalationAiConfigured(): boolean {
  const provider = getAiProvider();
  return provider === "gemini" ? Boolean(env.geminiApiKey) : Boolean(env.anthropicApiKey);
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

const analysisSchema = z.object({
  summary: z.string().trim().min(1),
  status: z.enum(ESCALATION_STATUSES),
  priority: z.enum(ESCALATION_PRIORITIES),
  blockers: z
    .array(z.string().trim().min(1))
    .max(5)
    .optional()
    .transform((value) => value ?? []),
  reasoning: z
    .string()
    .trim()
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null))
});

async function callLlm(systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = getAiProvider();

  if (provider === "gemini") {
    const model = getGemini().getGenerativeModel({
      model: env.geminiModel,
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.2 }
    });
    const result = await model.generateContent(userPrompt);
    return result.response.text() || "";
  }

  const response = await getAnthropic().messages.create({
    model: env.anthropicModel,
    max_tokens: 1024,
    temperature: 0.2,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }]
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text ?? "";
}

function formatTimeline(
  updates: Array<{
    authorName: string | null;
    body: string;
    createdAt: Date;
    isManual: boolean;
  }>
): string {
  return updates
    .map((update, index) => {
      const author = update.authorName ?? "Unknown";
      const source = update.isManual ? "admin" : "slack";
      const at = update.createdAt.toISOString();
      return `${index + 1}. [${at}] ${author} (${source}): ${update.body}`;
    })
    .join("\n");
}

/**
 * Analyze an escalation thread with the configured LLM.
 * Returns a concise "where it stands" summary.
 */
export async function analyzeEscalationWithAi(input: {
  title: string;
  problemContext: string;
  currentStatus: EscalationStatus;
  currentPriority: EscalationPriority;
  reporterName?: string | null;
  updates: Array<{
    authorName: string | null;
    body: string;
    createdAt: Date;
    isManual: boolean;
  }>;
}): Promise<EscalationAiAnalysis | null> {
  if (!isEscalationAiConfigured()) {
    return null;
  }

  const systemPrompt =
    "You are an operations escalation analyst for a customer-success team. " +
    "Read the original problem and the full update timeline, then return STRICT JSON only (no markdown) with shape: " +
    '{ "summary": string, "status": "open"|"in_progress"|"waiting"|"resolved"|"closed", ' +
    '"priority": "low"|"medium"|"high"|"urgent", "blockers": string[], "reasoning": string|null }. ' +
    "Rules: " +
    "summary = 2-4 sentences on current state and impact; " +
    "blockers = current blockers or waiting-on items (empty array if none); " +
    "status = best fit from timeline (open=new/unassigned, in_progress=actively worked, waiting=blocked/pending external, resolved=fixed, closed=no further action); " +
    "priority = severity/urgency based on customer impact and SLA risk; " +
    "reasoning = brief note on status/priority choice (1 sentence max); " +
    "Do not invent facts not present in the messages. Prefer waiting when blocked on someone else.";

  const userPrompt = [
    `Title: ${input.title}`,
    input.reporterName ? `Reporter: ${input.reporterName}` : null,
    `Current status (system): ${input.currentStatus}`,
    `Current priority (system): ${input.currentPriority}`,
    `Original problem:\n"""${input.problemContext}"""`,
    `Timeline (${input.updates.length} updates):\n${formatTimeline(input.updates)}`
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await callLlm(systemPrompt, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch (error) {
    console.error("[escalation.ai] LLM returned non-JSON", {
      preview: raw.slice(0, 300),
      error
    });
    return null;
  }

  const result = analysisSchema.safeParse(parsed);
  if (!result.success) {
    console.error("[escalation.ai] LLM JSON failed schema", result.error.flatten());
    return null;
  }

  return result.data;
}
