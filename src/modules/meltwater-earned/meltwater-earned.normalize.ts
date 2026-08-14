import { EMPTY_SENTIMENT } from "./meltwater-earned.constants";
import { NormalizedEarnedDaily, SentimentCounts } from "./meltwater-earned.types";

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDateKey(value: unknown): string | null {
  if (!value) {
    return null;
  }
  const raw = String(value);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function emptySentiment(): SentimentCounts {
  return { ...EMPTY_SENTIMENT };
}

function normalizeSentimentKey(value: unknown): keyof SentimentCounts {
  const key = String(value ?? "unknown").trim().toLowerCase();
  if (key === "positive" || key === "neutral" || key === "negative") {
    return key;
  }
  return "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function extractHistogramBuckets(payload: unknown): Record<string, unknown>[] {
  if (!isRecord(payload)) {
    return [];
  }

  const result = isRecord(payload.result) ? payload.result : payload;
  const analysis = result.analysis;
  if (Array.isArray(analysis)) {
    return analysis.filter(isRecord);
  }
  return [];
}

function sentimentFromNested(analysis: unknown): SentimentCounts {
  const sentiment = emptySentiment();
  if (!Array.isArray(analysis)) {
    return sentiment;
  }

  for (const item of analysis) {
    if (!isRecord(item)) {
      continue;
    }
    const key = normalizeSentimentKey(item.key ?? item.label);
    sentiment[key] += toNumber(item.document_count ?? item.count);
  }
  return sentiment;
}

function measureSum(analysis: unknown, measure: string): number {
  if (isRecord(analysis)) {
    const direct = analysis[measure];
    if (isRecord(direct)) {
      return toNumber(direct.sum ?? direct.total ?? direct.value);
    }
  }

  if (Array.isArray(analysis)) {
    for (const item of analysis) {
      if (!isRecord(item)) {
        continue;
      }
      const key = String(item.key ?? item.measure ?? "").toLowerCase();
      if (key === measure) {
        return toNumber(item.sum ?? item.total ?? item.value);
      }
    }
  }

  return 0;
}

export function mergeEarnedDailyRecords(
  volumePayload: unknown,
  reachPayload: unknown,
  meta: { searchId: string; searchName?: string; timezone: string }
): NormalizedEarnedDaily[] {
  const byDate = new Map<string, NormalizedEarnedDaily>();

  const ensure = (date: string): NormalizedEarnedDaily => {
    const existing = byDate.get(date);
    if (existing) {
      return existing;
    }
    const created: NormalizedEarnedDaily = {
      searchId: meta.searchId,
      searchName: meta.searchName,
      date,
      timezone: meta.timezone,
      mentionCount: 0,
      reach: 0,
      estimatedViews: 0,
      sentiment: emptySentiment(),
      rawPayload: {}
    };
    byDate.set(date, created);
    return created;
  };

  for (const bucket of extractHistogramBuckets(volumePayload)) {
    const date = toDateKey(bucket.key ?? bucket.date);
    if (!date) {
      continue;
    }
    const row = ensure(date);
    row.mentionCount = toNumber(bucket.document_count ?? bucket.count);
    row.sentiment = sentimentFromNested(bucket.analysis);
    row.rawPayload = {
      ...(isRecord(row.rawPayload) ? row.rawPayload : {}),
      volume: bucket
    };
  }

  for (const bucket of extractHistogramBuckets(reachPayload)) {
    const date = toDateKey(bucket.key ?? bucket.date);
    if (!date) {
      continue;
    }
    const row = ensure(date);
    const nested = bucket.analysis ?? bucket;
    row.reach = measureSum(nested, "reach");
    row.estimatedViews = measureSum(nested, "estimated_views");
    row.rawPayload = {
      ...(isRecord(row.rawPayload) ? row.rawPayload : {}),
      reach: bucket
    };
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
