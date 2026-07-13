import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

import { env } from "../../config/env";

export type WfhApprovalDecision = "approved" | "denied" | "unclear";

export type WfhApprovalClassification = {
  decision: WfhApprovalDecision;
  reason: string | null;
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

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

const classificationSchema = z.object({
  decision: z.enum(["approved", "denied", "unclear"]),
  reason: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null))
});

async function callLlm(systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = getAiProvider();

  if (provider === "gemini") {
    const model = getGemini().getGenerativeModel({
      model: env.geminiModel,
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens: 256, temperature: 0.1 }
    });
    const result = await model.generateContent(userPrompt);
    return result.response.text() || "";
  }

  const response = await getAnthropic().messages.create({
    model: env.anthropicModel,
    max_tokens: 256,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }]
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text ?? "";
}

/**
 * Use the AI layer only to decide whether a Slack reply is a WFH approval,
 * a denial, or unclear. Attendance parsing itself stays regex-based.
 */
export async function classifyWfhApprovalReply(input: {
  replyText: string;
  employeeName?: string | null;
  entryDate?: string | null;
  originalMessage?: string | null;
}): Promise<WfhApprovalClassification> {
  const systemPrompt =
    "You classify whether a Slack reply is a manager approving an employee's work-from-home (WFH) request. " +
    "Return STRICT JSON only (no markdown) with shape: " +
    '{ "decision": "approved"|"denied"|"unclear", "reason": string|null }. ' +
    "Rules: " +
    "approved = clear yes / ok / approved / fine / go ahead / all good / sure for WFH or being out; " +
    "denied = clear no / not approved / come to office / rejected; " +
    "unclear = anything else, questions, unrelated chat, or ambiguous. " +
    "Do not invent intent. Prefer unclear when unsure.";

  const userPrompt = [
    input.employeeName ? `Employee: ${input.employeeName}` : null,
    input.entryDate ? `Date: ${input.entryDate}` : null,
    input.originalMessage ? `Original attendance message: ${input.originalMessage}` : null,
    `Manager/employee reply:\n"""${input.replyText}"""`
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await callLlm(systemPrompt, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch (error) {
    console.error("[attendance.approval] LLM returned non-JSON", {
      preview: raw.slice(0, 200),
      error
    });
    return { decision: "unclear", reason: "llm_non_json" };
  }

  const result = classificationSchema.safeParse(parsed);
  if (!result.success) {
    console.error("[attendance.approval] LLM JSON failed schema", result.error.flatten());
    return { decision: "unclear", reason: "llm_schema_mismatch" };
  }

  return result.data;
}
