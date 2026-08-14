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

export type MeltwaterSearchSortBy =
  | "date"
  | "reach"
  | "engagement"
  | "social_echo"
  | "relevance"
  | "prominence"
  | "country"
  | "sentiment"
  | "language"
  | "title"
  | "views";

export type MeltwaterSearchRequest = MeltwaterEarnedWindow & {
  page?: number;
  page_size?: number;
  sort_by?: MeltwaterSearchSortBy;
  sort_order?: "asc" | "desc";
  sentiments?: Array<"positive" | "negative" | "neutral">;
  sources?: string[];
  languages?: string[];
  template?: { name: string };
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
