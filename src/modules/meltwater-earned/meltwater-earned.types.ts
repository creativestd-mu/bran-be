export type MeltwaterSearch = {
  id: string;
  name: string;
  updated?: string;
};

export type MeltwaterEarnedWindow = {
  start: string;
  end: string;
  tz: string;
};

export type MeltwaterCustomAnalysis = {
  type: string;
  granularity?: string;
  dimension?: string;
  limit?: number;
  measures?: string[];
  analysis?: MeltwaterCustomAnalysis;
};

export type MeltwaterCustomAnalyticsRequest = MeltwaterEarnedWindow & {
  analysis: MeltwaterCustomAnalysis;
};

export type SentimentCounts = {
  positive: number;
  neutral: number;
  negative: number;
  unknown: number;
};

export type NormalizedEarnedDaily = {
  searchId: string;
  searchName?: string;
  date: string;
  timezone: string;
  mentionCount: number;
  reach: number;
  estimatedViews: number;
  sentiment: SentimentCounts;
  rawPayload: unknown;
};

export type MeltwaterEarnedTotals = {
  mentionCount: number;
  reach: number;
  estimatedViews: number;
  sentiment: SentimentCounts;
};
