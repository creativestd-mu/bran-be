export interface ContentStats {
  platform: string;
  accountId: string;
  metrics: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    reach?: number;
    impressions?: number;
    engagement?: number;
    subscribers?: number;
    followers?: number;
    videoCount?: number;
  };
  items?: ContentItem[];
  fetchedAt: string;
}

export interface ContentItem {
  id: string;
  title?: string;
  url?: string;
  publishedAt?: string;
  metrics: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    reach?: number;
    impressions?: number;
  };
}
