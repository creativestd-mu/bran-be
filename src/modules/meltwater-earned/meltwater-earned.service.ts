import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { MELTWATER_DAY_WINDOW_DAYS } from "./meltwater-earned.constants";
import {
  fetchMeltwaterCustomAnalytics,
  listMeltwaterSearches
} from "./meltwater-earned.client";
import { mergeEarnedDailyRecords } from "./meltwater-earned.normalize";
import {
  aggregateEarnedDaily,
  listEarnedDaily,
  upsertEarnedDailyRecords
} from "./meltwater-earned.repository";
import { MeltwaterSearch, NormalizedEarnedDaily } from "./meltwater-earned.types";

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

function chunkWindows(from: string, toExclusive: string, maxDays: number): Array<{ start: string; end: string }> {
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

function resolveSearchIds(requested?: string[]): string[] {
  const fromRequest = (requested ?? []).map((id) => id.trim()).filter(Boolean);
  if (fromRequest.length > 0) {
    return [...new Set(fromRequest)];
  }
  return [...new Set(env.meltwaterSearchIds)];
}

async function resolveSearches(requested?: string[]): Promise<MeltwaterSearch[]> {
  const configured = resolveSearchIds(requested);
  const listed = await listMeltwaterSearches().catch((error) => {
    if (configured.length === 0) {
      throw error;
    }
    return [] as MeltwaterSearch[];
  });

  if (configured.length === 0) {
    if (listed.length === 0) {
      throw new HttpError(
        422,
        "No Meltwater saved searches found. Set MELTWATER_SEARCH_IDS or create a search in Meltwater."
      );
    }
    return listed;
  }

  const byId = new Map(listed.map((search) => [search.id, search]));
  return configured.map((id) => byId.get(id) ?? { id, name: id });
}

async function fetchWindow(
  search: MeltwaterSearch,
  window: { start: string; end: string },
  timezone: string
): Promise<NormalizedEarnedDaily[]> {
  const volumePayload = await fetchMeltwaterCustomAnalytics(search.id, {
    start: window.start,
    end: window.end,
    tz: timezone,
    analysis: {
      type: "date_histogram",
      granularity: "day",
      analysis: {
        type: "top_terms",
        dimension: "sentiment",
        limit: 10
      }
    }
  });

  let reachPayload: unknown = { result: { analysis: [] } };
  try {
    reachPayload = await fetchMeltwaterCustomAnalytics(search.id, {
      start: window.start,
      end: window.end,
      tz: timezone,
      analysis: {
        type: "date_histogram",
        granularity: "day",
        analysis: {
          type: "measure_statistics",
          measures: ["reach", "estimated_views"]
        }
      }
    });
  } catch (error) {
    console.warn("[meltwater-earned] Reach analysis failed; storing volume/sentiment only", {
      searchId: search.id,
      start: window.start,
      end: window.end,
      error: error instanceof Error ? error.message : error
    });
  }

  return mergeEarnedDailyRecords(volumePayload, reachPayload, {
    searchId: search.id,
    searchName: search.name,
    timezone
  });
}

export async function syncEarnedMentions(input: {
  from?: string;
  to?: string;
  searchIds?: string[];
}) {
  const timezone = env.meltwaterEarnedTimezone;
  const toKey = toDateKey(input.to);
  const fromKey = input.from ? toDateKey(input.from) : addDays(toKey, -MELTWATER_DAY_WINDOW_DAYS);
  const toExclusive = addDays(toKey, 1);

  if (fromKey >= toExclusive) {
    throw new HttpError(400, "`from` must be before `to`");
  }

  const searches = await resolveSearches(input.searchIds);
  const windows = chunkWindows(fromKey, toExclusive, MELTWATER_DAY_WINDOW_DAYS);
  const storedBySearch: Array<{ searchId: string; searchName: string; days: number }> = [];
  let stored = 0;

  for (const search of searches) {
    const records: NormalizedEarnedDaily[] = [];
    for (const window of windows) {
      const windowRecords = await fetchWindow(search, window, timezone);
      records.push(...windowRecords);
    }
    stored += await upsertEarnedDailyRecords(records);
    storedBySearch.push({
      searchId: search.id,
      searchName: search.name,
      days: records.length
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

function readSearchFilter(searchId?: string): { searchId?: string; searchIds?: string[] } {
  if (searchId) {
    return { searchId };
  }
  return { searchIds: env.meltwaterSearchIds };
}

export async function getEarnedDaily(input: {
  from?: string;
  to?: string;
  searchId?: string;
}) {
  const timezone = env.meltwaterEarnedTimezone;
  const searchFilter = readSearchFilter(input.searchId);
  const items = await listEarnedDaily({
    ...searchFilter,
    from: input.from ? toDateKey(input.from) : undefined,
    to: input.to ? toDateKey(input.to) : undefined,
    timezone
  });
  const totals = await aggregateEarnedDaily({
    ...searchFilter,
    from: input.from ? toDateKey(input.from) : undefined,
    to: input.to ? toDateKey(input.to) : undefined,
    timezone
  });

  return {
    timezone,
    range: { from: input.from, to: input.to },
    totals,
    items
  };
}

export async function getEarnedAggregate(input: {
  from?: string;
  to?: string;
  searchId?: string;
}) {
  const timezone = env.meltwaterEarnedTimezone;
  const totals = await aggregateEarnedDaily({
    ...readSearchFilter(input.searchId),
    from: input.from ? toDateKey(input.from) : undefined,
    to: input.to ? toDateKey(input.to) : undefined,
    timezone
  });

  return {
    timezone,
    range: { from: input.from, to: input.to },
    ...totals
  };
}

export async function getEarnedSearches() {
  const configured = new Set(env.meltwaterSearchIds);
  const searches = await listMeltwaterSearches();
  return {
    configuredSearchIds: env.meltwaterSearchIds,
    searches: searches.map((search) => ({
      ...search,
      configured: configured.size === 0 || configured.has(search.id)
    }))
  };
}
