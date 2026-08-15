import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import {
  listMeltwaterSearches,
  searchMeltwaterMentions
} from "../meltwater-earned/meltwater-earned.client";
import type { MeltwaterSearch } from "../meltwater-earned/meltwater-earned.types";
import {
  COMPETITOR_CONTENT_BACKFILL_DAYS,
  COMPETITOR_CONTENT_DAILY_LOOKBACK_DAYS,
  COMPETITOR_CONTENT_PAGE_SIZE,
  COMPETITOR_CONTENT_WINDOW_DAYS
} from "./competitor-content.constants";
import {
  isRelevantBrandContent,
  isRelevantCompetitorContent,
  normalizeCompetitorDocuments,
  type ContentRelevance
} from "./competitor-content.normalize";
import {
  listCompetitorContentSearches,
  listTopCompetitorContent,
  upsertCompetitorContentRecords
} from "./competitor-content.repository";
import type {
  CompetitorContentImpact,
  CompetitorContentRecord,
  CompetitorSentiment
} from "./competitor-content.types";

function toDateKey(value?: string, fallback?: Date): string {
  const date = value ? new Date(value) : (fallback ?? new Date());
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `Invalid date provided: ${value}`);
  }
  return date.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function chunkWindows(
  from: string,
  toExclusive: string,
  maxDays: number
): Array<{ start: string; end: string }> {
  const windows: Array<{ start: string; end: string }> = [];
  let cursor = from;
  while (cursor < toExclusive) {
    const next = addDays(cursor, maxDays);
    const end = next < toExclusive ? next : toExclusive;
    windows.push({ start: `${cursor}T00:00:00`, end: `${end}T00:00:00` });
    cursor = end;
  }
  return windows;
}

function documentSearchIds(): string[] {
  return [...new Set([...env.meltwaterSearchIds, ...env.meltwaterCompetitorSearchIds])];
}

function relevanceForSearch(searchId: string): ContentRelevance {
  return env.meltwaterSearchIds.includes(searchId) ? "brand" : "competitor";
}

function resolveSearchIds(requested?: string[]): string[] {
  const fromRequest = (requested ?? []).map((id) => id.trim()).filter(Boolean);
  if (fromRequest.length > 0) {
    return [...new Set(fromRequest)];
  }
  return documentSearchIds();
}

async function resolveSearches(requested?: string[]): Promise<MeltwaterSearch[]> {
  const configured = resolveSearchIds(requested);
  if (configured.length === 0) {
    throw new HttpError(
      422,
      "No Meltwater document searches configured. Set MELTWATER_SEARCH_IDS or MELTWATER_COMPETITOR_SEARCH_IDS."
    );
  }

  const listed = await listMeltwaterSearches().catch(() => [] as MeltwaterSearch[]);
  const byId = new Map(listed.map((search) => [search.id, search]));
  return configured.map((id) => byId.get(id) ?? { id, name: id });
}

async function fetchSentimentWindow(
  search: MeltwaterSearch,
  window: { start: string; end: string },
  timezone: string,
  sentiment: CompetitorSentiment
): Promise<CompetitorContentRecord[]> {
  const payload = await searchMeltwaterMentions(search.id, {
    start: window.start,
    end: window.end,
    tz: timezone,
    page: 1,
    page_size: COMPETITOR_CONTENT_PAGE_SIZE,
    sort_by: "engagement",
    sort_order: "desc",
    sentiments: [sentiment],
    template: { name: "api.json" }
  });

  return normalizeCompetitorDocuments(payload, {
    searchId: search.id,
    searchName: search.name,
    timezone,
    sentiment,
    relevance: relevanceForSearch(search.id)
  });
}

export async function syncCompetitorContent(input: {
  from?: string;
  to?: string;
  searchIds?: string[];
  lookbackDays?: number;
}) {
  const timezone = env.meltwaterEarnedTimezone;
  const toKey = toDateKey(input.to);
  const lookback = input.lookbackDays ?? COMPETITOR_CONTENT_DAILY_LOOKBACK_DAYS;
  const fromKey = input.from ? toDateKey(input.from) : addDays(toKey, -lookback);
  const toExclusive = addDays(toKey, 1);

  if (fromKey >= toExclusive) {
    throw new HttpError(400, "`from` must be before `to`");
  }

  const searches = await resolveSearches(input.searchIds);
  const windows = chunkWindows(fromKey, toExclusive, COMPETITOR_CONTENT_WINDOW_DAYS);
  const sentiments: CompetitorSentiment[] = ["positive", "negative"];
  const storedBySearch: Array<{ searchId: string; searchName: string; stored: number }> = [];
  let stored = 0;

  for (const search of searches) {
    const records: CompetitorContentRecord[] = [];
    for (const window of windows) {
      for (const sentiment of sentiments) {
        try {
          const batch = await fetchSentimentWindow(search, window, timezone, sentiment);
          records.push(...batch);
        } catch (error) {
          console.warn("[competitor-content] Window sync failed", {
            searchId: search.id,
            window,
            sentiment,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    // Deduplicate by documentId within this sync (prefer higher engagement)
    const byDoc = new Map<string, CompetitorContentRecord>();
    for (const record of records) {
      const existing = byDoc.get(record.documentId);
      if (!existing || record.engagement > existing.engagement) {
        byDoc.set(record.documentId, record);
      }
    }
    const unique = [...byDoc.values()];
    const count = await upsertCompetitorContentRecords(unique);
    stored += count;
    storedBySearch.push({
      searchId: search.id,
      searchName: search.name,
      stored: count
    });
  }

  return {
    from: fromKey,
    to: toKey,
    timezone,
    searches: storedBySearch,
    stored
  };
}

export async function syncCompetitorContentDaily() {
  return syncCompetitorContent({ lookbackDays: COMPETITOR_CONTENT_DAILY_LOOKBACK_DAYS });
}

export async function syncCompetitorContentMonthlyBackfill() {
  return syncCompetitorContent({ lookbackDays: COMPETITOR_CONTENT_BACKFILL_DAYS });
}

export async function getCompetitorContentImpact(input: {
  from?: string;
  to?: string;
  searchId?: string;
  topN?: number;
  relevance?: ContentRelevance;
}): Promise<CompetitorContentImpact> {
  const timezone = env.meltwaterEarnedTimezone;
  const toKey = toDateKey(input.to);
  const fromKey = input.from
    ? toDateKey(input.from)
    : addDays(toKey, -COMPETITOR_CONTENT_DAILY_LOOKBACK_DAYS);
  const from = new Date(`${fromKey}T00:00:00.000Z`);
  const to = new Date(`${toKey}T23:59:59.999Z`);
  const topN = input.topN ?? env.meltwaterCompetitorTopN;
  const relevance = input.relevance ?? "competitor";
  const searchIds = input.searchId
    ? [input.searchId]
    : relevance === "brand"
      ? env.meltwaterSearchIds
      : env.meltwaterCompetitorSearchIds.length > 0
        ? env.meltwaterCompetitorSearchIds
        : undefined;
  const isRelevant =
    relevance === "brand" ? isRelevantBrandContent : isRelevantCompetitorContent;

  const candidateLimit = Math.max(topN * 20, 100);
  const [positiveCandidates, negativeCandidates, searches] = await Promise.all([
    listTopCompetitorContent({
      from,
      to,
      sentiment: "positive",
      searchIds,
      limit: candidateLimit
    }),
    listTopCompetitorContent({
      from,
      to,
      sentiment: "negative",
      searchIds,
      limit: candidateLimit
    }),
    listCompetitorContentSearches(searchIds)
  ]);
  const positive = positiveCandidates.filter(isRelevant).slice(0, topN);
  const negative = negativeCandidates.filter(isRelevant).slice(0, topN);

  return {
    timezone,
    range: { from: fromKey, to: toKey },
    topN,
    positive,
    negative,
    searches
  };
}

export async function getBrandContentImpact(input: {
  from?: string;
  to?: string;
  topN?: number;
}): Promise<CompetitorContentImpact> {
  return getCompetitorContentImpact({
    from: input.from,
    to: input.to,
    topN: input.topN,
    relevance: "brand"
  });
}
