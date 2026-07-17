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
import {
  downloadSlackImages,
  resolveSlackMentionsInText,
  type SlackAttachmentMeta,
  type SlackImageBytes
} from "./escalation.slack";

export type EscalationAiAnalysis = {
  title: string;
  summary: string;
  issueDescription: string;
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
  title: z.string().trim().min(3).max(120),
  summary: z.string().trim().min(1),
  issueDescription: z.string().trim().min(1),
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

/** Keep list titles short and readable. */
export function normalizeEscalationTitle(title: string, fallback: string): string {
  const cleaned = title
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
  const value = cleaned.length >= 3 ? cleaned : fallback;
  if (value.length <= 100) return value;
  return `${value.slice(0, 97).trimEnd()}...`;
}

async function callLlm(
  systemPrompt: string,
  userPrompt: string,
  images: SlackImageBytes[]
): Promise<string> {
  const provider = getAiProvider();

  if (provider === "gemini") {
    const model = getGemini().getGenerativeModel({
      model: env.geminiModel,
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens: 1536, temperature: 0.2 }
    });
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: userPrompt },
      ...images.map((image) => ({
        inlineData: {
          mimeType: image.mimetype,
          data: image.buffer.toString("base64")
        }
      }))
    ];
    const result = await model.generateContent(parts);
    return result.response.text() || "";
  }

  const imageBlocks = images.map((image) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: image.mimetype,
      data: image.buffer.toString("base64")
    }
  }));

  const response = await getAnthropic().messages.create({
    model: env.anthropicModel,
    max_tokens: 1536,
    temperature: 0.2,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [...imageBlocks, { type: "text", text: userPrompt }]
      }
    ]
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
    attachmentCount: number;
  }>
): string {
  return updates
    .map((update, index) => {
      const author = update.authorName ?? "Unknown";
      const source = update.isManual ? "admin" : "slack";
      const at = update.createdAt.toISOString();
      const media =
        update.attachmentCount > 0
          ? ` [${update.attachmentCount} image attachment${update.attachmentCount === 1 ? "" : "s"}]`
          : "";
      return `${index + 1}. [${at}] ${author} (${source})${media}: ${update.body || "(image only)"}`;
    })
    .join("\n");
}

/**
 * Analyze an escalation thread with the configured LLM (text + Slack images).
 * Returns a concise "where it stands" summary and a richer issue description.
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
    attachments?: SlackAttachmentMeta[];
  }>;
}): Promise<EscalationAiAnalysis | null> {
  if (!isEscalationAiConfigured()) {
    return null;
  }

  const attachmentMetas = input.updates.flatMap((update) => update.attachments ?? []);
  const images = await downloadSlackImages(attachmentMetas);

  const systemPrompt =
    "You are an operations escalation analyst for a customer-success team. " +
    "Read the original problem, the full update timeline, and any attached screenshot/images, then return STRICT JSON only (no markdown) with shape: " +
    '{ "title": string, "summary": string, "issueDescription": string, ' +
    '"status": "open"|"in_progress"|"waiting"|"resolved"|"closed", ' +
    '"priority": "low"|"medium"|"high"|"urgent", "blockers": string[], "reasoning": string|null }. ' +
    "Rules: " +
    "title = a concise, self-explanatory list headline (5-12 words, max ~80 chars) that states the real issue " +
    "(product/project + what is broken or needed). Synthesize from the original message, thread replies, AND images. " +
    "Good: 'Chaar Diwari: urgent Daisy SOS blocking client delivery'. " +
    "Bad: greetings, @mentions, questions like 'Who should respond?', or raw Slack first lines. " +
    "Do not start with Hey/Hi/Hello. Prefer noun phrases over chatty prose. " +
    "issueDescription = a rich problem write-up (3-6 sentences) that combines the Slack text with visual evidence from screenshots " +
    "(error messages, UI state, emails, WhatsApp/chat snippets, product names, dates, customer impact). " +
    "If images are attached, explicitly include what they show. " +
    "summary = 2-4 sentences on current state and where it stands now; " +
    "blockers = current blockers or waiting-on items (empty array if none); " +
    "status = best fit from timeline (open=new/unassigned, in_progress=actively worked, waiting=blocked/pending external, resolved=fixed, closed=no further action); " +
    "priority = severity/urgency based on customer impact and SLA risk; " +
    "reasoning = brief note on status/priority choice (1 sentence max); " +
    "Always use human display names for people — never Slack user IDs like U0B8MRPU2AG or <@U…> mentions. " +
    "Do not invent facts not present in the messages or images. Prefer waiting when blocked on someone else.";

  const [provisionalTitle, problemContext, ...resolvedBodies] = await Promise.all([
    resolveSlackMentionsInText(input.title),
    resolveSlackMentionsInText(input.problemContext),
    ...input.updates.map((update) => resolveSlackMentionsInText(update.body))
  ]);

  const updates = input.updates.map((update, index) => ({
    ...update,
    body: resolvedBodies[index] ?? update.body,
    attachmentCount: update.attachments?.length ?? 0
  }));

  const userPrompt = [
    `Provisional Slack title (often a raw first line — rewrite into a proper title): ${provisionalTitle}`,
    input.reporterName ? `Reporter: ${input.reporterName}` : null,
    `Current status (system): ${input.currentStatus}`,
    `Current priority (system): ${input.currentPriority}`,
    `Attached images provided to the model: ${images.length}`,
    `Original problem:\n"""${problemContext || "(see attached images)"}"""`,
    `Timeline (${updates.length} updates):\n${formatTimeline(updates)}`,
    images.length > 0
      ? "Attached images follow in order. Use them for both the title and issueDescription (errors, UI copy, product names, dates)."
      : null,
    "Return a rewritten title that a busy ops lead can understand without opening the thread."
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await callLlm(systemPrompt, userPrompt, images);

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

  const [title, summary, issueDescription, ...blockers] = await Promise.all([
    resolveSlackMentionsInText(result.data.title),
    resolveSlackMentionsInText(result.data.summary),
    resolveSlackMentionsInText(result.data.issueDescription),
    ...result.data.blockers.map((blocker) => resolveSlackMentionsInText(blocker))
  ]);

  return {
    ...result.data,
    title: normalizeEscalationTitle(title, provisionalTitle),
    summary,
    issueDescription,
    blockers
  };
}
