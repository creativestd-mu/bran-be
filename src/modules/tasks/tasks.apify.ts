import { env } from "../../config/env";

export interface InstagramTaskStats {
  source: "APIFY";
  url: string;
  likes: number | null;
  comments: number | null;
  views: number | null;
  plays: number | null;
  caption: string | null;
  fetchedAt: string;
}

export interface InstagramTaskStatsFetchResult {
  stats: InstagramTaskStats | null;
  error?: string;
}

function normalizeApifyActorId(actorId: string): string {
  return actorId.includes("/") ? actorId.replace("/", "~") : actorId;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

type ApifyInstagramItem = Record<string, unknown>;

function mapApifyItemToInstagramTaskStats(
  contentUrl: string,
  item: ApifyInstagramItem
): InstagramTaskStats {
  return {
    source: "APIFY",
    url: contentUrl,
    likes: toNumber(item.likesCount ?? item.likes ?? item.likeCount),
    comments: toNumber(item.commentsCount ?? item.comments ?? item.commentCount),
    views: toNumber(item.videoViewCount ?? item.videoPlayCount ?? item.views ?? item.viewCount),
    plays: toNumber(item.videoPlayCount ?? item.plays ?? item.playCount),
    caption: toString(item.caption ?? item.latestComments),
    fetchedAt: new Date().toISOString()
  };
}

export function isInstagramUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === "instagram.com" || host.endsWith(".instagram.com") || host === "www.instagram.com";
  } catch {
    return false;
  }
}

export async function fetchInstagramTaskStatsFromApify(
  contentUrl: string
): Promise<InstagramTaskStatsFetchResult> {
  if (!env.apifyToken) {
    return { stats: null };
  }

  const actorId = normalizeApifyActorId(env.apifyInstagramActorId || "apify/instagram-post-scraper");
  const endpoint = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(
    env.apifyToken
  )}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      directUrls: [contentUrl],
      resultsLimit: 1
    })
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      stats: null,
      error: `Apify request failed (${response.status}): ${body.slice(0, 250)}`
    };
  }

  const data = (await response.json()) as unknown;
  const item = Array.isArray(data) && data.length > 0 ? (data[0] as ApifyInstagramItem) : null;
  if (!item) {
    return { stats: null, error: "Apify returned no data for Instagram URL" };
  }

  return {
    stats: mapApifyItemToInstagramTaskStats(contentUrl, item)
  };
}
