import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

import { env } from "../../config/env";
import type { SourceCandidate } from "./events.sources";

const clusterSchema = z.object({
  clusters: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(500),
        description: z.string().trim().max(2000).nullish(),
        summary: z.string().trim().max(4000).nullish(),
        confidence: z.number().min(0).max(1).optional(),
        status: z.enum(["planned", "active", "completed", "cancelled"]).optional(),
        sourceKeys: z.array(z.string().trim().min(1)).min(1)
      })
    )
    .max(20)
});

export type DetectedCluster = {
  title: string;
  description: string | null;
  summary: string | null;
  confidence: number;
  status: "planned" | "active" | "completed" | "cancelled";
  sourceKeys: string[];
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

export function isEventsAiConfigured(): boolean {
  const provider = getAiProvider();
  return provider === "gemini" ? Boolean(env.geminiApiKey) : Boolean(env.anthropicApiKey);
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

async function callLlm(systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = getAiProvider();

  if (provider === "gemini") {
    const model = getGemini().getGenerativeModel({
      model: env.geminiModel,
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens: 4096, temperature: 0.2 }
    });
    const result = await model.generateContent(userPrompt);
    return result.response.text() || "";
  }

  const response = await getAnthropic().messages.create({
    model: env.anthropicModel,
    max_tokens: 4096,
    temperature: 0.2,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }]
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text ?? "";
}

function candidateKey(candidate: SourceCandidate): string {
  return `${candidate.sourceType}:${candidate.sourceId}`;
}

/**
 * Ask the LLM to cluster unattached multi-source activity into org events.
 * sourceKeys must use "SOURCE_TYPE:sourceId" and only reference provided candidates.
 */
export async function clusterSourcesIntoEvents(
  candidates: SourceCandidate[]
): Promise<DetectedCluster[]> {
  if (candidates.length === 0) return [];
  if (!isEventsAiConfigured()) {
    throw new Error("AI provider is not configured for event detection");
  }

  const validKeys = new Set(candidates.map(candidateKey));

  const systemPrompt =
    "You cluster cross-channel workplace activity into real org/business events " +
    "(launches, workshops, campaigns, campus events, major projects). " +
    "Return STRICT JSON only (no markdown) with shape: " +
    '{ "clusters": [ { "title": string, "description": string|null, "summary": string|null, ' +
    '"confidence": number, "status": "planned"|"active"|"completed"|"cancelled", ' +
    '"sourceKeys": string[] } ] }. ' +
    "Rules: " +
    "1) Only create a cluster when 2+ items clearly refer to the same real-world event/topic. " +
    "2) sourceKeys MUST be copied exactly from the provided keys (SOURCE_TYPE:id). " +
    "3) Do not invent keys. Leave noisy/unrelated singles unclustered. " +
    "4) MEETING keys are transcript excerpts only — never treat a bare call as an event. " +
    "5) Prefer precise titles (what/when) over vague ones. " +
    "6) confidence is 0-1. " +
    "7) summary is optional — a short overview only (1–3 sentences). " +
    "Do NOT repeat a dated timeline in summary; dates are added separately from source timestamps.";

  const userPrompt = [
    "Unattached activity candidates:",
    ...candidates.map((candidate) => {
      const key = candidateKey(candidate);
      return [
        `KEY: ${key}`,
        `TITLE: ${candidate.title}`,
        `WHEN: ${candidate.occurredAt.toISOString()}`,
        `ACTOR: ${candidate.actorName ?? "unknown"}`,
        `BODY: ${candidate.body.slice(0, 400)}`
      ].join("\n");
    })
  ].join("\n\n");

  const raw = await callLlm(systemPrompt, userPrompt);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch {
    console.error("[events.ai] Non-JSON LLM response", raw.slice(0, 300));
    return [];
  }

  const result = clusterSchema.safeParse(parsed);
  if (!result.success) {
    console.error("[events.ai] Schema mismatch", result.error.flatten());
    return [];
  }

  return result.data.clusters
    .map((cluster) => {
      const sourceKeys = [...new Set(cluster.sourceKeys)].filter((key) => validKeys.has(key));
      if (sourceKeys.length < 2) return null;
      return {
        title: cluster.title.slice(0, 500),
        description: cluster.description ? cluster.description.slice(0, 2000) : null,
        summary: cluster.summary ? cluster.summary.slice(0, 4000) : null,
        confidence: cluster.confidence ?? 0.6,
        status: cluster.status ?? "active",
        sourceKeys
      } satisfies DetectedCluster;
    })
    .filter((cluster): cluster is DetectedCluster => Boolean(cluster));
}
