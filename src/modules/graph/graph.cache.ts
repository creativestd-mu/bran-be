import { GRAPH_CACHE_TTL_MS } from "./graph.constants";
import type { BrainGraphPayload } from "./graph.schemas";

type CacheEntry = {
  expiresAt: number;
  payload: Omit<BrainGraphPayload, "cached">;
};

const cache = new Map<string, CacheEntry>();

export function buildBrainGraphCacheKey(parts: {
  userId: string;
  from?: string;
  to?: string;
  limitMeetings: number;
  includeSteps: boolean;
}): string {
  return [
    parts.userId,
    parts.from ?? "",
    parts.to ?? "",
    String(parts.limitMeetings),
    parts.includeSteps ? "1" : "0"
  ].join("|");
}

export function getBrainGraphCache(key: string): Omit<BrainGraphPayload, "cached"> | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.payload;
}

export function setBrainGraphCache(
  key: string,
  payload: Omit<BrainGraphPayload, "cached">,
  ttlMs = GRAPH_CACHE_TTL_MS
): void {
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    payload
  });
}

export function invalidateBrainGraphCache(userId?: string): void {
  if (!userId) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.startsWith(`${userId}|`)) {
      cache.delete(key);
    }
  }
}
