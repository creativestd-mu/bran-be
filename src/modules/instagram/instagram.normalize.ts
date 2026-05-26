import { NormalizedInstagramRecord, Sentiment } from "./instagram.types";

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDate(value: unknown): Date {
  const date = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  return date;
}

function normalizeSentiment(value: unknown): Sentiment {
  const sentiment = String(value ?? "unknown").trim().toLowerCase();
  if (sentiment === "positive") {
    return "positive";
  }
  if (sentiment === "neutral") {
    return "neutral";
  }
  if (sentiment === "negative") {
    return "negative";
  }
  return "unknown";
}

function extractItems(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const objectPayload = payload as Record<string, unknown>;
  // Meltwater payloads vary by endpoint: generic/listening often uses items/results/data,
  // while owned social top posts uses posts.
  const candidateKeys = ["items", "results", "data", "mentions", "posts"];

  for (const key of candidateKeys) {
    const nestedValue = objectPayload[key];
    const nestedItems = extractItems(nestedValue);
    if (nestedItems.length > 0) {
      return nestedItems;
    }
  }

  return [];
}

export function normalizeMeltwaterInstagramPayload(payload: unknown): NormalizedInstagramRecord[] {
  const items = extractItems(payload);

  return items.map((item, index) => {
    const metrics =
      item.metrics && typeof item.metrics === "object"
        ? (item.metrics as Record<string, unknown>)
        : undefined;
    const sourceItemId = String(
      item.id ?? item.post_id ?? item.postId ?? item.externalId ?? `meltwater-${Date.now()}-${index}`
    );
    const fallbackEngagementCount = toNumber(
      metrics?.engagements ??
        metrics?.comment_count ??
        metrics?.comments_count ??
        metrics?.like_count ??
        metrics?.likes_count ??
        metrics?.share_count ??
        metrics?.shares_count
    );
    const engagementRate = toNumber(item.engagementRate ?? item.engagement_rate ?? metrics?.engagement_rate);

    return {
      sourceItemId,
      mentionCount: toNumber(item.mentions, 1),
      estimatedViews: toNumber(
        item.impressions ??
          item.estimatedViews ??
          metrics?.post_impressions ??
          metrics?.impression_count ??
          metrics?.impressions ??
          metrics?.view_count ??
          metrics?.video_view
      ),
      estimatedReach: toNumber(
        item.reach ??
          item.estimatedReach ??
          metrics?.post_impressions_organic_unique ??
          metrics?.reach ??
          metrics?.unique_viewers
      ),
      engagementCount: toNumber(item.engagement ?? item.totalEngagement ?? fallbackEngagementCount),
      engagementRate,
      sentiment: normalizeSentiment(item.sentiment),
      mentionedAt: toDate(
        item.mentionedAt ?? item.publishedAt ?? item.timestamp ?? item.createdAt ?? item.created_at
      ),
      rawPayload: item
    };
  });
}
