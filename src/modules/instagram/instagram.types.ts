export type MeltwaterFetchParams = {
  source: MeltwaterSource;
  from?: string;
  to?: string;
  keyword?: string;
};

export type MeltwaterSource = "instagram" | "linkedin" | "youtube" | "facebook";

export type Sentiment = "positive" | "neutral" | "negative" | "unknown";

export type NormalizedInstagramRecord = {
  sourceItemId: string;
  mentionCount: number;
  estimatedViews: number;
  estimatedReach: number;
  engagementCount: number;
  engagementRate: number;
  sentiment: Sentiment;
  mentionedAt: Date;
  rawPayload: unknown;
};

export type AggregatedInstagramMetrics = {
  mentions: number;
  estimatedViews: number;
  estimatedReach: number;
  engagementCount: number;
  engagementRateAvg: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    unknown: number;
  };
  range: {
    from?: string;
    to?: string;
  };
};
