export type CompetitorSentiment = "positive" | "negative";

export type CompetitorContentRecord = {
  searchId: string;
  searchName?: string;
  documentId: string;
  url?: string;
  title?: string;
  snippet?: string;
  source?: string;
  sourceName?: string;
  author?: string;
  publishedAt?: string;
  sentiment: CompetitorSentiment;
  engagement: number;
  reach: number;
  estimatedViews: number;
  timezone: string;
  rawPayload: unknown;
};

export type CompetitorContentImpact = {
  timezone: string;
  range: { from: string; to: string };
  topN: number;
  positive: CompetitorContentRecord[];
  negative: CompetitorContentRecord[];
  searches: Array<{ searchId: string; searchName?: string }>;
};
