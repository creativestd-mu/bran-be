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
import { normalizeEscalationTitle } from "./escalation.parser";
import {
  downloadSlackImages,
  resolveSlackMentionsInText,
  type SlackAttachmentMeta,
  type SlackImageBytes
} from "./escalation.slack";

export type EscalationAiAnalysis = {
  title: string;
  subject?: string | null;
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

/**
 * Guarantee the concrete subject (the "what") leads the title. If the model
 * still returned a generic title (e.g. "PM approval needed by Abhishek") and a
 * distinct subject is available, prepend the subject so the title has a "why".
 */
function ensureSubjectInTitle(title: string, subject: string | null): string {
  if (!subject) return title;
  const normalizedSubject = subject.replace(/\s+/g, " ").trim();
  if (normalizedSubject.length < 2) return title;

  const lowerTitle = title.toLowerCase();
  const subjectWords = normalizedSubject
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3);
  const subjectAlreadyPresent =
    subjectWords.length > 0 && subjectWords.some((word) => lowerTitle.includes(word));
  if (subjectAlreadyPresent) return title;

  return `${normalizedSubject} — ${title}`;
}

const analysisSchema = z.object({
  title: z.string().trim().min(3).max(50),
  subject: z
    .string()
    .trim()
    .max(40)
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null)),
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
    '{ "title": string, "subject": string, "summary": string, "issueDescription": string, ' +
    '"status": "open"|"in_progress"|"waiting"|"resolved"|"closed", ' +
    '"priority": "low"|"medium"|"high"|"urgent", "blockers": string[], "reasoning": string|null }. ' +
    "Rules: " +
    "subject = 2-4 words naming the CONCRETE thing this escalation is about — the 'what'. " +
    "It is the topic/deliverable/product/SOP/client/feature at stake (e.g. 'Travel plan SOP', 'Coverage roster', 'Chaar Diwari bug', 'Refund policy', 'Onboarding deck'). " +
    "Extract it from the message, thread, and images. NEVER leave it generic like 'approval', 'request', 'help', or 'response'. " +
    "If the thread truly names no concrete topic, use the closest specific noun phrase you can infer from context — never a bare action word. " +
    "title = ABSOLUTE HARD LIMIT of 50 characters INCLUDING SPACES. This is the most important rule. " +
    "Count the characters and if it is over 50, rewrite shorter before responding. " +
    "title MUST start with the subject, then the action. Structure: '{subject} — {need} by {requester}' (drop 'by {requester}' if over 50). " +
    "The subject (the 'what') must always be visible in the title; never a bare 'PM approval needed by X'. " +
    "Compress aggressively: FIRST NAMES only. If over 50 chars, drop 'by {requester}' then shorten {need}, but KEEP the subject. " +
    "Never truncate mid-word — produce a complete ≤50-char phrase. " +
    "Good (≤50): 'Travel plan SOP — PM approval, Abhishek'. " +
    "Good (≤50): 'Coverage roster sign-off — Daisy'. " +
    "Good (≤50): 'Chaar Diwari bug fix — Ananya'. " +
    "Bad: 'PM approval needed by Abhishek from Divyam' (what approval?). " +
    "Bad: 'Approval needed by Abhishek' (no subject). " +
    "Bad: dumping many names, greetings, questions, raw Slack first lines. " +
    "No 'Hey/Hi'. No lists of 3+ people. " +
    "issueDescription = start with one line matching the title format, then 2-4 sentences of detail. " +
    "Combine Slack text with visual evidence from screenshots (errors, UI, emails, chat snippets, product names, dates, impact). " +
    "Do NOT open with a dump of @mentioned names. Name requester and owner once in the title line. " +
    "If images are attached, explicitly include what they show. " +
    "summary = 2-4 sentences on current state and where it stands now; " +
    "blockers = current blockers or waiting-on items (empty array if none); " +
    "status = open by default. Set closed when the timeline clearly confirms the issue is solved " +
    "(fixed, approved, done, completed, acknowledged, thanks/closed loop). Use closed — not resolved or waiting. " +
    "Do not use waiting or in_progress — map those to open. " +
    "priority = severity/urgency based on customer impact and SLA risk; " +
    "reasoning = brief note on status choice (1 sentence max); " +
    "Always use human display names for people — never Slack user IDs like U0B8MRPU2AG or <@U…> mentions. " +
    "Do not invent facts not present in the messages or images.";

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
    "First decide the subject (2-4 words naming WHAT this is about), then build the title starting with that subject. Never a bare 'PM approval'. Max 50 characters."
  ]
    .filter(Boolean)
    .join("\n\n");

  let raw: string;
  try {
    raw = await callLlm(systemPrompt, userPrompt, images);
  } catch (error) {
    // Slack images sometimes fail Anthropic/Gemini media validation — still title from text.
    if (images.length === 0) throw error;
    console.warn("[escalation.ai] multimodal failed; retrying text-only", {
      imageCount: images.length,
      error
    });
    raw = await callLlm(
      systemPrompt,
      `${userPrompt}\n\n(Images were unavailable to the model; use text timeline only.)`,
      []
    );
  }

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

  const [title, subject, summary, issueDescription, ...blockers] = await Promise.all([
    resolveSlackMentionsInText(result.data.title),
    result.data.subject ? resolveSlackMentionsInText(result.data.subject) : Promise.resolve(null),
    resolveSlackMentionsInText(result.data.summary),
    resolveSlackMentionsInText(result.data.issueDescription),
    ...result.data.blockers.map((blocker) => resolveSlackMentionsInText(blocker))
  ]);

  return {
    ...result.data,
    title: normalizeEscalationTitle(ensureSubjectInTitle(title, subject), provisionalTitle),
    summary,
    issueDescription,
    blockers
  };
}
