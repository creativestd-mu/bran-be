import { EMPTY_SENTIMENT } from "../meltwater-earned/meltwater-earned.constants";
import type { SentimentCounts } from "../meltwater-earned/meltwater-earned.types";
import type { SentimentDashboardTotals, SentimentSeriesPoint } from "./sentiment.types";

export function sentimentShare(counts: SentimentCounts): SentimentCounts {
  const total =
    counts.positive + counts.neutral + counts.negative + counts.unknown;
  if (total <= 0) {
    return { ...EMPTY_SENTIMENT };
  }
  const pct = (value: number) => Math.round((value / total) * 1000) / 10;
  return {
    positive: pct(counts.positive),
    neutral: pct(counts.neutral),
    negative: pct(counts.negative),
    unknown: pct(counts.unknown)
  };
}

/** (positive − negative) / all mentions, from -1 to 1. */
export function netSentiment(counts: SentimentCounts, mentionCount: number): number {
  const denom = mentionCount > 0 ? mentionCount : 0;
  if (denom <= 0) {
    return 0;
  }
  return Math.round(((counts.positive - counts.negative) / denom) * 1000) / 1000;
}

export function dominantSentiment(counts: SentimentCounts): keyof SentimentCounts | "none" {
  const entries = Object.entries(counts) as Array<[keyof SentimentCounts, number]>;
  const scored = entries.filter(([, value]) => value > 0);
  if (scored.length === 0) {
    return "none";
  }
  scored.sort((a, b) => b[1] - a[1]);
  return scored[0][0];
}

export function enrichTotals(
  mentionCount: number,
  reach: number,
  estimatedViews: number,
  sentiment: SentimentCounts
): SentimentDashboardTotals {
  return {
    mentionCount,
    reach,
    estimatedViews,
    sentiment,
    sentimentShare: sentimentShare(sentiment),
    netSentiment: netSentiment(sentiment, mentionCount),
    dominant: dominantSentiment(sentiment)
  };
}

export function rollupSeries(
  items: Array<{
    date: string;
    searchId: string;
    searchName: string | null;
    mentionCount: number;
    reach: number;
    estimatedViews: number;
    sentiment: SentimentCounts;
  }>
): { series: SentimentSeriesPoint[]; searches: Array<{ searchId: string; searchName: string | null }> } {
  const byDate = new Map<string, SentimentSeriesPoint>();
  const searches = new Map<string, string | null>();

  for (const item of items) {
    searches.set(item.searchId, item.searchName);
    const existing = byDate.get(item.date);
    if (!existing) {
      byDate.set(item.date, {
        date: item.date,
        mentionCount: item.mentionCount,
        reach: item.reach,
        estimatedViews: item.estimatedViews,
        sentiment: { ...item.sentiment },
        sentimentShare: sentimentShare(item.sentiment),
        netSentiment: netSentiment(item.sentiment, item.mentionCount)
      });
      continue;
    }

    existing.mentionCount += item.mentionCount;
    existing.reach += item.reach;
    existing.estimatedViews += item.estimatedViews;
    existing.sentiment.positive += item.sentiment.positive;
    existing.sentiment.neutral += item.sentiment.neutral;
    existing.sentiment.negative += item.sentiment.negative;
    existing.sentiment.unknown += item.sentiment.unknown;
    existing.sentimentShare = sentimentShare(existing.sentiment);
    existing.netSentiment = netSentiment(existing.sentiment, existing.mentionCount);
  }

  return {
    series: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    searches: [...searches.entries()].map(([searchId, searchName]) => ({ searchId, searchName }))
  };
}
