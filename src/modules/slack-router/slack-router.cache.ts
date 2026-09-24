import { createHash } from "crypto";

import { normalizeSlackIntentQuery } from "../slack-intents/slack-intents.repository";
import type { SlackRouterResult } from "./slack-router";

const MAX_ENTRIES = 2000;
const TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = {
  value: SlackRouterResult;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

export function istDateKey(now: Date = new Date(), timeZone = "Asia/Kolkata"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function buildSlackRouterCacheKey(input: {
  text: string;
  isDm: boolean;
  now?: Date;
}): string {
  const normalized = normalizeSlackIntentQuery(input.text);
  const date = istDateKey(input.now);
  const channel = input.isDm ? "dm" : "ch";
  return createHash("sha1").update(`${normalized}|${date}|${channel}`).digest("hex");
}

function pruneExpired(nowMs: number): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= nowMs) {
      cache.delete(key);
    }
  }
}

function evictOldestIfNeeded(): void {
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function getSlackRouterCache(key: string): SlackRouterResult | null {
  const nowMs = Date.now();
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= nowMs) {
    cache.delete(key);
    return null;
  }
  // Refresh LRU order.
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

export function setSlackRouterCache(key: string, value: SlackRouterResult): void {
  const nowMs = Date.now();
  pruneExpired(nowMs);
  if (cache.has(key)) cache.delete(key);
  cache.set(key, { value, expiresAt: nowMs + TTL_MS });
  evictOldestIfNeeded();
}

/** Test helpers */
export function clearSlackRouterCache(): void {
  cache.clear();
}

export function slackRouterCacheSize(): number {
  return cache.size;
}

export function setSlackRouterCacheEntryForTest(
  key: string,
  value: SlackRouterResult,
  expiresAt: number
): void {
  cache.set(key, { value, expiresAt });
}
