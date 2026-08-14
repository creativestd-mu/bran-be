import type { MeltwaterEarnedTotals, SentimentCounts } from "../meltwater-earned/meltwater-earned.types";

export type SentimentPreset = "7d" | "14d" | "30d" | "this_week" | "this_month";

export type SentimentShare = SentimentCounts;

export type SentimentDashboardTotals = MeltwaterEarnedTotals & {
  sentimentShare: SentimentShare;
  netSentiment: number;
  dominant: keyof SentimentCounts | "none";
};

export type SentimentSeriesPoint = {
  date: string;
  mentionCount: number;
  reach: number;
  estimatedViews: number;
  sentiment: SentimentCounts;
  sentimentShare: SentimentShare;
  netSentiment: number;
};

export type SentimentDashboard = {
  timezone: string;
  range: { from: string; to: string };
  totals: SentimentDashboardTotals;
  series: SentimentSeriesPoint[];
  searches: Array<{ searchId: string; searchName: string | null }>;
};
