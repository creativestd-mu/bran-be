import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

import { env } from "../../../config/env";
import { HttpError } from "../../../utils/httpError";
import { thumbnailAiOutputSchema } from "./thumbnail-generator.schemas";

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

export type ThumbnailReferenceImage = {
  buffer: Buffer;
  mimetype: string;
};

export type ThumbnailAiOutput = z.infer<typeof thumbnailAiOutputSchema>;

const ANALYSIS_SYSTEM_PROMPT =
  "You are a YouTube and social video thumbnail strategist. " +
  "Analyze reference thumbnails and produce a concrete thumbnail plan for new content. " +
  "Return STRICT JSON only (no markdown) with shape: " +
  '{"title": string, "textDescription": string, "context": string, "assets": ' +
  '[{ "name": string, "type": "photo"|"illustration"|"icon"|"logo"|"text"|"background"|"overlay"|"other", ' +
  '"description": string, "placement": string?, "sourcingNotes": string? }], ' +
  '"designBrief": string, "styleFromReferences": string }. ' +
  "Rules: textDescription is the on-thumbnail copy (short, high contrast); context summarizes creative direction; " +
  "assets lists every visual element needed to build the thumbnail; designBrief is layout + composition instructions; " +
  "styleFromReferences explains patterns learned from the 5 references (colors, faces, text placement, emotion).";

async function callVisionLlm(
  systemPrompt: string,
  userPrompt: string,
  references: ThumbnailReferenceImage[]
): Promise<string> {
  const provider = getAiProvider();

  if (provider === "gemini") {
    const model = getGemini().getGenerativeModel({
      model: env.geminiModel,
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens: 4096, temperature: 0.35 }
    });

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: userPrompt },
      ...references.map((ref) => ({
        inlineData: {
          mimeType: ref.mimetype,
          data: ref.buffer.toString("base64")
        }
      }))
    ];

    const result = await model.generateContent(parts);
    return result.response.text() || "";
  }

  const imageBlocks = references.map((ref) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: ref.mimetype as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
      data: ref.buffer.toString("base64")
    }
  }));

  const response = await getAnthropic().messages.create({
    model: env.anthropicModel,
    max_tokens: 4096,
    temperature: 0.35,
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

export async function analyzeThumbnailReferences(input: {
  title: string;
  description: string;
  context?: string;
  references: ThumbnailReferenceImage[];
}): Promise<ThumbnailAiOutput> {
  const userPrompt = [
    `Proposed video title: "${input.title}"`,
    `Text / content description: "${input.description}"`,
    input.context ? `Additional context: "${input.context}"` : "",
    "",
    `${input.references.length} reference thumbnails are attached in order (reference 1 through ${input.references.length}).`,
    "Use them to infer visual style and produce one optimized thumbnail plan for the proposed content."
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await callVisionLlm(ANALYSIS_SYSTEM_PROMPT, userPrompt, input.references);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch {
    throw new HttpError(502, "Could not generate thumbnail plan from references");
  }

  const validated = thumbnailAiOutputSchema.safeParse(parsed);
  if (!validated.success) {
    throw new HttpError(502, "Could not generate thumbnail plan from references");
  }

  return validated.data;
}

export type GeneratedThumbnailImage = {
  buffer: Buffer;
  mimetype: string;
};

export async function generateThumbnailImage(
  plan: ThumbnailAiOutput,
  references: ThumbnailReferenceImage[]
): Promise<GeneratedThumbnailImage | null> {
  if (getAiProvider() !== "gemini") {
    return null;
  }

  const prompt = [
    "Generate a single high-impact social video thumbnail image (1280x720).",
    `Title concept: ${plan.title}`,
    `On-thumbnail text: ${plan.textDescription}`,
    `Creative context: ${plan.context}`,
    `Layout: ${plan.designBrief}`,
    `Style from references: ${plan.styleFromReferences}`,
    "Match the reference thumbnails' visual language. Bold text, clear focal subject, high contrast."
  ].join("\n");

  try {
    const model = getGemini().getGenerativeModel({
      model: env.geminiImageModel,
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.4,
        // @ts-expect-error — supported on image-capable Gemini models
        responseModalities: ["TEXT", "IMAGE"]
      }
    });

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: prompt },
      ...references.slice(0, 3).map((ref) => ({
        inlineData: {
          mimeType: ref.mimetype,
          data: ref.buffer.toString("base64")
        }
      }))
    ];

    const result = await model.generateContent(parts);
    const partsOut = result.response.candidates?.[0]?.content?.parts ?? [];

    for (const part of partsOut) {
      if ("inlineData" in part && part.inlineData?.data) {
        return {
          buffer: Buffer.from(part.inlineData.data, "base64"),
          mimetype: part.inlineData.mimeType || "image/png"
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}
