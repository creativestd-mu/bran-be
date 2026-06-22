import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";

export const EMBEDDING_DIMENSION = 768;

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

const MAX_EMBED_TEXT_CHARS = 8000;

type EmbedContentResponse = {
  embedding?: {
    values?: number[];
  };
  error?: {
    message?: string;
  };
};

function truncateForEmbedding(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new HttpError(400, "Cannot embed empty text");
  }
  return trimmed.length > MAX_EMBED_TEXT_CHARS
    ? trimmed.slice(0, MAX_EMBED_TEXT_CHARS)
    : trimmed;
}

export async function generateEmbedding(
  text: string,
  taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT"
): Promise<number[]> {
  if (!env.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model = env.geminiEmbeddingModel;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.geminiApiKey
      },
      body: JSON.stringify({
        model: `models/${model}`,
        content: {
          parts: [{ text: truncateForEmbedding(text) }]
        },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSION
      })
    }
  );

  const payload = (await response.json()) as EmbedContentResponse;

  if (!response.ok) {
    const message = payload.error?.message ?? `Gemini embedding failed (${response.status})`;
    throw new HttpError(502, message);
  }

  const values = payload.embedding?.values;
  if (!values || values.length !== EMBEDDING_DIMENSION) {
    throw new HttpError(502, "Gemini embedding returned an invalid vector");
  }

  return values;
}
