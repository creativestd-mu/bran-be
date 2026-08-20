import { generateEmbedding } from "../ai/ai.gemini-embeddings";
import { isQdrantConfigured, upsertVectors } from "../ai/ai.qdrant";
import { env } from "../../config/env";
import { isSlackIntentId, type SlackIntentId } from "./slack-intents.catalog";
import { SLACK_INTENTS_COLLECTION } from "./slack-intents.matcher";
import {
  normalizeSlackIntentQuery,
  upsertSlackIntentExample
} from "./slack-intents.repository";

/**
 * Persist a confirmed (or auto-run) query→intent pair and embed it for future retrieval.
 */
export async function learnSlackIntent(input: {
  query: string;
  intent: SlackIntentId | string;
  ownerBranUserId?: string | null;
  source?: "confirmed" | "auto";
}): Promise<void> {
  if (!isSlackIntentId(input.intent)) return;

  const normalizedQuery = normalizeSlackIntentQuery(input.query);
  if (!normalizedQuery) return;

  const row = await upsertSlackIntentExample({
    ownerBranUserId: input.ownerBranUserId ?? null,
    normalizedQuery,
    intent: input.intent,
    source: input.source ?? "confirmed"
  });
  if (!row) return;

  if (!isQdrantConfigured() || !env.geminiApiKey) return;

  try {
    const values = await generateEmbedding(normalizedQuery, "RETRIEVAL_DOCUMENT");
    await upsertVectors(SLACK_INTENTS_COLLECTION, [
      {
        id: row.id,
        values,
        metadata: {
          intent: input.intent,
          source: "confirmed",
          example: normalizedQuery,
          ownerBranUserId: input.ownerBranUserId ?? ""
        }
      }
    ]);
  } catch (error) {
    console.warn("[slack-intents] failed to embed learned example:", error);
  }
}
