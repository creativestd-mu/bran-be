import { HttpError } from "../../utils/httpError";
import {
  getEarnedDaily,
  getEarnedSearches,
  syncEarnedMentions
} from "../meltwater-earned/meltwater-earned.service";
import { enrichTotals, rollupSeries } from "./sentiment.metrics";
import type { SentimentDashboard, SentimentPreset } from "./sentiment.types";

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

function mondayOfWeek(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const weekday = date.getUTCDay(); // 0 Sun
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return addUtcDays(dateKey, delta);
}

export function resolveSentimentRange(input: {
  from?: string;
  to?: string;
  preset?: SentimentPreset;
}): { from: string; to: string } {
  const today = toDateKey(new Date());
  if (input.from || input.to) {
    const to = input.to ? toDateKey(new Date(input.to)) : today;
    const from = input.from ? toDateKey(new Date(input.from)) : addUtcDays(to, -29);
    if (Number.isNaN(new Date(from).getTime()) || Number.isNaN(new Date(to).getTime())) {
      throw new HttpError(400, "Invalid date range");
    }
    if (from > to) {
      throw new HttpError(400, "`from` must be on or before `to`");
    }
    return { from, to };
  }

  switch (input.preset) {
    case "7d":
      return { from: addUtcDays(today, -6), to: today };
    case "14d":
      return { from: addUtcDays(today, -13), to: today };
    case "this_week":
      return { from: mondayOfWeek(today), to: today };
    case "this_month":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "30d":
    default:
      return { from: addUtcDays(today, -29), to: today };
  }
}

export async function getSentimentDashboard(input: {
  from?: string;
  to?: string;
  searchId?: string;
  preset?: SentimentPreset;
}): Promise<SentimentDashboard> {
  const range = resolveSentimentRange(input);
  const daily = await getEarnedDaily({
    from: range.from,
    to: range.to,
    searchId: input.searchId
  });
  const { series, searches } = rollupSeries(daily.items);
  const totals = enrichTotals(
    daily.totals.mentionCount,
    daily.totals.reach,
    daily.totals.estimatedViews,
    daily.totals.sentiment
  );

  return {
    timezone: daily.timezone,
    range,
    totals,
    series,
    searches
  };
}

export async function listSentimentSearches() {
  return getEarnedSearches();
}

export async function syncSentimentData(input: {
  from?: string;
  to?: string;
  searchIds?: string[];
}) {
  return syncEarnedMentions(input);
}
