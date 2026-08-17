import { Prisma } from "@prisma/client";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import type { PodSocialPlatform } from "./pods.constants";
import {
  getPodSocialAccountById,
  listActivePodSocialAccountsForSync,
  updatePodSocialAccount,
  upsertPodSocialPost
} from "./pods.repository";

type ApifyItem = Record<string, unknown>;

export type NormalizedPodPost = {
  platformPostId: string;
  url: string | null;
  title: string | null;
  caption: string | null;
  author: string | null;
  publishedAt: Date | null;
  metrics: Record<string, number | null>;
  rawPayload: string;
};

export type PodAccountSyncResult = {
  accountId: string;
  podId: string;
  platform: string;
  handle: string;
  status: "SUCCESS" | "ERROR" | "SKIPPED";
  upserted: number;
  error?: string;
};

function normalizeApifyActorId(actorId: string): string {
  return actorId.includes("/") ? actorId.replace("/", "~") : actorId;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value < 1_000_000_000_000 ? value * 1000 : value;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function actorIdForPlatform(platform: PodSocialPlatform): string {
  switch (platform) {
    case "INSTAGRAM":
      return env.apifyPodInstagramActorId;
    case "YOUTUBE":
      return env.apifyPodYoutubeActorId;
    case "X":
      return env.apifyPodXActorId;
    case "LINKEDIN":
      return env.apifyPodLinkedinActorId;
    default:
      return "";
  }
}

function buildActorInput(platform: PodSocialPlatform, handle: string, url: string): Record<string, unknown> {
  const resultsLimit = env.apifyPodResultsLimit;
  switch (platform) {
    case "INSTAGRAM":
      return {
        directUrls: [url],
        resultsLimit,
        resultsType: "posts"
      };
    case "YOUTUBE":
      return {
        startUrls: [{ url }],
        maxResults: resultsLimit
      };
    case "X":
      return {
        startUrls: [{ url }],
        maxItems: resultsLimit,
        handle: [handle]
      };
    case "LINKEDIN":
      return {
        urls: [url],
        maxPosts: resultsLimit
      };
    default:
      return { startUrls: [{ url }], resultsLimit };
  }
}

export function normalizeApifyItem(
  platform: PodSocialPlatform,
  item: ApifyItem,
  fallbackAuthor: string
): NormalizedPodPost | null {
  const platformPostId =
    toString(item.id) ||
    toString(item.postId) ||
    toString(item.shortCode) ||
    toString(item.videoId) ||
    toString(item.urn) ||
    toString(item.url) ||
    toString(item.link);

  if (!platformPostId) return null;

  const url =
    toString(item.url) ||
    toString(item.link) ||
    toString(item.postUrl) ||
    toString(item.webVideoUrl) ||
    null;

  const caption =
    toString(item.caption) ||
    toString(item.text) ||
    toString(item.description) ||
    toString(item.commentary) ||
    null;

  const title = toString(item.title) || (caption ? caption.slice(0, 120) : null);

  const author =
    toString(item.ownerUsername) ||
    toString(item.author) ||
    toString(item.username) ||
    toString(item.channelName) ||
    fallbackAuthor;

  const publishedAt =
    toDate(item.timestamp) ||
    toDate(item.createdAt) ||
    toDate(item.date) ||
    toDate(item.publishedAt) ||
    toDate(item.uploadDate) ||
    null;

  const metrics = {
    likes: toNumber(item.likesCount ?? item.likes ?? item.likeCount ?? item.diggCount),
    comments: toNumber(item.commentsCount ?? item.comments ?? item.commentCount ?? item.replyCount),
    views: toNumber(item.videoViewCount ?? item.viewCount ?? item.views ?? item.playCount),
    shares: toNumber(item.shares ?? item.shareCount ?? item.retweetCount),
    plays: toNumber(item.videoPlayCount ?? item.plays ?? item.playCount)
  };

  return {
    platformPostId,
    url,
    title,
    caption,
    author,
    publishedAt,
    metrics,
    rawPayload: JSON.stringify(item)
  };
}

async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>
): Promise<ApifyItem[]> {
  if (!env.apifyToken) {
    throw new HttpError(500, "APIFY_TOKEN is not configured");
  }
  if (!actorId) {
    throw new HttpError(500, "Apify actor id is not configured for this platform");
  }

  const normalizedActorId = normalizeApifyActorId(actorId);
  const endpoint = `https://api.apify.com/v2/acts/${normalizedActorId}/run-sync-get-dataset-items?token=${encodeURIComponent(
    env.apifyToken
  )}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new HttpError(
      502,
      `Apify request failed (${response.status}): ${body.slice(0, 250)}`
    );
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is ApifyItem => Boolean(item) && typeof item === "object");
}

export async function syncPodSocialAccount(accountId: string): Promise<PodAccountSyncResult> {
  const account = await getPodSocialAccountById(accountId);
  if (!account) {
    throw new HttpError(404, "Pod social account not found");
  }

  const platform = account.platform as PodSocialPlatform;
  const actorId = actorIdForPlatform(platform);

  if (!env.apifyToken || !actorId) {
    await updatePodSocialAccount(accountId, {
      lastSyncedAt: new Date(),
      lastSyncStatus: "SKIPPED",
      lastSyncError: !env.apifyToken
        ? "APIFY_TOKEN is not configured"
        : `No Apify actor configured for ${platform}`
    });
    return {
      accountId: account.id,
      podId: account.podId,
      platform: account.platform,
      handle: account.handle,
      status: "SKIPPED",
      upserted: 0,
      error: !env.apifyToken
        ? "APIFY_TOKEN is not configured"
        : `No Apify actor configured for ${platform}`
    };
  }

  try {
    const items = await runApifyActor(
      actorId,
      buildActorInput(platform, account.handle, account.url)
    );

    let upserted = 0;
    for (const item of items) {
      const normalized = normalizeApifyItem(platform, item, account.handle);
      if (!normalized) continue;
      await upsertPodSocialPost({
        accountId: account.id,
        platformPostId: normalized.platformPostId,
        url: normalized.url,
        title: normalized.title,
        caption: normalized.caption,
        author: normalized.author,
        publishedAt: normalized.publishedAt,
        metrics: normalized.metrics as Prisma.InputJsonValue,
        rawPayload: normalized.rawPayload
      });
      upserted += 1;
    }

    await updatePodSocialAccount(accountId, {
      lastSyncedAt: new Date(),
      lastSyncStatus: "SUCCESS",
      lastSyncError: null
    });

    return {
      accountId: account.id,
      podId: account.podId,
      platform: account.platform,
      handle: account.handle,
      status: "SUCCESS",
      upserted
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Apify sync error";
    await updatePodSocialAccount(accountId, {
      lastSyncedAt: new Date(),
      lastSyncStatus: "ERROR",
      lastSyncError: message.slice(0, 1000)
    });
    return {
      accountId: account.id,
      podId: account.podId,
      platform: account.platform,
      handle: account.handle,
      status: "ERROR",
      upserted: 0,
      error: message
    };
  }
}

export async function syncAllPodSocialAccounts(): Promise<{
  total: number;
  success: number;
  error: number;
  skipped: number;
  results: PodAccountSyncResult[];
}> {
  const accounts = await listActivePodSocialAccountsForSync();
  const results: PodAccountSyncResult[] = [];

  for (const account of accounts) {
    const result = await syncPodSocialAccount(account.id);
    results.push(result);
  }

  return {
    total: results.length,
    success: results.filter((r) => r.status === "SUCCESS").length,
    error: results.filter((r) => r.status === "ERROR").length,
    skipped: results.filter((r) => r.status === "SKIPPED").length,
    results
  };
}
