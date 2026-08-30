import { env } from "../../config/env";
import { generateEmbedding } from "../ai/ai.gemini-embeddings";
import { isQdrantConfigured, queryVectors, upsertVectors } from "../ai/ai.qdrant";
import { callClassifierLlm, isClassifierAiConfigured } from "../work/work.extraction";
import {
  getSlackIntent,
  isSlackIntentId,
  SLACK_INTENT_CATALOG,
  slackIntentLabel,
  type SlackIntentId
} from "./slack-intents.catalog";
import {
  catalogVectorPointId,
  listRecentSlackIntentExamples,
  normalizeSlackIntentQuery
} from "./slack-intents.repository";

export const SLACK_INTENTS_COLLECTION = "slack-intents";

export type IntentCandidate = {
  intent: SlackIntentId;
  label: string;
  score: number;
  source: "catalog" | "confirmed" | "llm";
};

export type IntentMatchDecision =
  | {
      mode: "auto";
      intent: SlackIntentId;
      confidence: number;
      top3: IntentCandidate[];
    }
  | {
      mode: "suggest";
      top3: IntentCandidate[];
      confidence: number;
    }
  | {
      mode: "generic";
      top3: IntentCandidate[];
      confidence: number;
    };

let catalogSeedPromise: Promise<void> | null = null;

function embeddingsAvailable(): boolean {
  return isQdrantConfigured() && Boolean(env.geminiApiKey);
}

async function seedCatalogVectors(): Promise<void> {
  if (!embeddingsAvailable()) return;

  const points: Array<{
    id: string;
    values: number[];
    metadata: Record<string, string | number | boolean>;
  }> = [];

  for (const entry of SLACK_INTENT_CATALOG) {
    for (const example of entry.examples) {
      const values = await generateEmbedding(example, "RETRIEVAL_DOCUMENT");
      points.push({
        id: catalogVectorPointId(entry.id, example),
        values,
        metadata: {
          intent: entry.id,
          source: "catalog",
          example,
          ownerBranUserId: ""
        }
      });
    }
  }

  if (points.length > 0) {
    await upsertVectors(SLACK_INTENTS_COLLECTION, points);
  }
}

export async function ensureSlackIntentCatalogSeeded(): Promise<void> {
  if (!embeddingsAvailable()) return;
  if (!catalogSeedPromise) {
    catalogSeedPromise = seedCatalogVectors().catch((error) => {
      catalogSeedPromise = null;
      throw error;
    });
  }
  await catalogSeedPromise;
}

function aggregateIntentScores(
  matches: Array<{ score: number; metadata?: Record<string, unknown> }>
): IntentCandidate[] {
  const best = new Map<
    SlackIntentId,
    { score: number; source: "catalog" | "confirmed" | "llm" }
  >();

  for (const match of matches) {
    const intentRaw = match.metadata?.intent;
    if (typeof intentRaw !== "string" || !isSlackIntentId(intentRaw)) continue;
    const sourceRaw = match.metadata?.source;
    // Auto-learned examples stay provisional — never get confirmed fast-path.
    const source: "catalog" | "confirmed" | "llm" =
      sourceRaw === "confirmed" ? "confirmed" : sourceRaw === "auto" ? "catalog" : "catalog";
    const prev = best.get(intentRaw);
    if (!prev || match.score > prev.score) {
      best.set(intentRaw, { score: match.score, source });
    } else if (source === "confirmed" && prev.source !== "confirmed" && match.score >= prev.score) {
      best.set(intentRaw, { score: match.score, source });
    }
  }

  return [...best.entries()]
    .map(([intent, info]) => ({
      intent,
      label: slackIntentLabel(intent),
      score: info.score,
      source: (info.source === "confirmed" ? "confirmed" : "catalog") as IntentCandidate["source"]
    }))
    .sort((a, b) => b.score - a.score);
}

export function decideIntentMatchMode(
  ranked: IntentCandidate[],
  options?: {
    autoThreshold?: number;
    suggestThreshold?: number;
    margin?: number;
    confirmedFastPath?: number;
  }
): IntentMatchDecision {
  const autoThreshold = options?.autoThreshold ?? env.slackIntentAutoThreshold;
  const suggestThreshold = options?.suggestThreshold ?? env.slackIntentSuggestThreshold;
  const margin = options?.margin ?? env.slackIntentAutoMargin;
  const confirmedFastPath = options?.confirmedFastPath ?? env.slackIntentConfirmedFastPath;

  const top3 = ranked.slice(0, 3);
  const top = top3[0];
  const second = top3[1];
  const confidence = top?.score ?? 0;

  if (!top) {
    return { mode: "generic", top3: [], confidence: 0 };
  }

  if (top.source === "confirmed" && top.score >= confirmedFastPath) {
    // Still require a margin so poisoned near-ties cannot auto-run.
    const confirmedGap = top.score - (second?.score ?? 0);
    const confirmedMargin = Math.min(margin, 0.05);
    if (confirmedGap >= confirmedMargin) {
      return { mode: "auto", intent: top.intent, confidence: top.score, top3 };
    }
  }

  const gap = top.score - (second?.score ?? 0);
  if (top.score >= autoThreshold && gap >= margin) {
    return { mode: "auto", intent: top.intent, confidence: top.score, top3 };
  }

  if (top.score >= suggestThreshold) {
    return { mode: "suggest", top3, confidence: top.score };
  }

  return { mode: "generic", top3, confidence: top.score };
}

async function refineWithDeepSeek(
  query: string,
  candidates: IntentCandidate[]
): Promise<{ intent: SlackIntentId | null; confidence: number; top3: SlackIntentId[] } | null> {
  if (!isClassifierAiConfigured()) return null;

  const catalogLines = SLACK_INTENT_CATALOG.map(
    (entry) => `- ${entry.id}: ${entry.label} — ${entry.description}`
  ).join("\n");

  const candidateLines =
    candidates.length > 0
      ? candidates
          .slice(0, 5)
          .map((c) => `- ${c.intent} (score=${c.score.toFixed(3)}, source=${c.source})`)
          .join("\n")
      : "(none from embeddings)";

  let fewShot = "";
  try {
    const examples = await listRecentSlackIntentExamples(12);
    if (examples.length > 0) {
      fewShot =
        "Confirmed examples:\n" +
        examples.map((ex) => `- "${ex.normalizedQuery}" → ${ex.intent}`).join("\n");
    }
  } catch {
    // DB may be unavailable in tests; ignore.
  }

  const systemPrompt = [
    "You classify Slack messages directed at Bran into one supported intent.",
    "Return STRICT JSON only:",
    '{ "intent": "<id or null>", "confidence": 0-1, "top3": ["id", ...] }',
    "Use only these intent ids:",
    catalogLines,
    "If none fit, set intent to null and confidence below 0.4.",
    "Prefer intents that match the user's goal, not just shared nouns."
  ].join("\n");

  const userPrompt = [
    `Message:\n"""${query.slice(0, 2000)}"""`,
    "",
    "Embedding candidates:",
    candidateLines,
    fewShot ? `\n${fewShot}` : ""
  ].join("\n");

  try {
    const raw = await callClassifierLlm(systemPrompt, userPrompt);
    const stripped = raw
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/^```(?:json)?\s*|\s*```$/gi, "")
      .trim();
    const start = stripped.search(/{/);
    const jsonText = start >= 0 ? stripped.slice(start) : stripped;
    const parsed = JSON.parse(jsonText) as {
      intent?: unknown;
      confidence?: unknown;
      top3?: unknown;
    };

    const intent =
      typeof parsed.intent === "string" && isSlackIntentId(parsed.intent)
        ? parsed.intent
        : null;
    const confidence =
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : intent
          ? 0.7
          : 0.2;
    const top3 = Array.isArray(parsed.top3)
      ? parsed.top3.filter((id): id is SlackIntentId => typeof id === "string" && isSlackIntentId(id))
      : intent
        ? [intent]
        : [];

    return { intent, confidence, top3 };
  } catch (error) {
    console.warn("[slack-intents] intent refine failed:", error);
    return null;
  }
}

function mergeLlmIntoCandidates(
  embeddingRanked: IntentCandidate[],
  llm: { intent: SlackIntentId | null; confidence: number; top3: SlackIntentId[] }
): IntentCandidate[] {
  const scores = new Map<SlackIntentId, IntentCandidate>();

  for (const entry of embeddingRanked) {
    scores.set(entry.intent, { ...entry });
  }

  for (let i = 0; i < llm.top3.length; i++) {
    const intent = llm.top3[i];
    const llmScore = Math.max(0, llm.confidence - i * 0.05);
    const prev = scores.get(intent);
    const blended = prev ? Math.max(prev.score, (prev.score + llmScore) / 2 + 0.05) : llmScore;
    scores.set(intent, {
      intent,
      label: slackIntentLabel(intent),
      score: Math.min(1, blended),
      source: prev?.source === "confirmed" ? "confirmed" : "llm"
    });
  }

  if (llm.intent) {
    const prev = scores.get(llm.intent);
    scores.set(llm.intent, {
      intent: llm.intent,
      label: slackIntentLabel(llm.intent),
      score: Math.min(1, Math.max(prev?.score ?? 0, llm.confidence)),
      source: prev?.source === "confirmed" ? "confirmed" : "llm"
    });
  }

  return [...scores.values()].sort((a, b) => b.score - a.score);
}

function filterDmOnly(candidates: IntentCandidate[], isDm: boolean): IntentCandidate[] {
  if (isDm) return candidates;
  return candidates.filter((c) => !getSlackIntent(c.intent)?.dmOnly);
}

/**
 * Classify an unrecognized directed Slack query into a Bran intent.
 * Embedding retrieval + DeepSeek ranking with cosine-only fallback.
 */
export async function matchSlackIntent(input: {
  text: string;
  isDm: boolean;
}): Promise<IntentMatchDecision> {
  const query = input.text.trim();
  if (!query) {
    return { mode: "generic", top3: [], confidence: 0 };
  }

  let embeddingRanked: IntentCandidate[] = [];

  if (embeddingsAvailable()) {
    try {
      await ensureSlackIntentCatalogSeeded();
      const vector = await generateEmbedding(
        normalizeSlackIntentQuery(query) || query,
        "RETRIEVAL_QUERY"
      );
      const results = await queryVectors(SLACK_INTENTS_COLLECTION, vector, 12);
      embeddingRanked = filterDmOnly(aggregateIntentScores(results.matches ?? []), input.isDm);
    } catch (error) {
      console.warn("[slack-intents] embedding match failed:", error);
    }
  }

  const llm = await refineWithDeepSeek(query, embeddingRanked);
  const ranked = filterDmOnly(
    llm ? mergeLlmIntoCandidates(embeddingRanked, llm) : embeddingRanked,
    input.isDm
  );

  // Pure DeepSeek path when embeddings unavailable.
  if (ranked.length === 0 && llm?.intent) {
    const top3: IntentCandidate[] = (llm.top3.length ? llm.top3 : [llm.intent])
      .filter((id) => isSlackIntentId(id))
      .filter((id) => input.isDm || !getSlackIntent(id)?.dmOnly)
      .map((intent, index) => ({
        intent,
        label: slackIntentLabel(intent),
        score: Math.max(0, llm.confidence - index * 0.05),
        source: "llm" as const
      }));
    return decideIntentMatchMode(top3);
  }

  return decideIntentMatchMode(ranked);
}
