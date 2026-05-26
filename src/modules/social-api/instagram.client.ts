import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import type { ContentStats, ContentItem } from "./social-api.types";

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

async function igFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!env.instagramAccessToken) {
    throw new HttpError(503, "Instagram access token is not configured");
  }

  const url = new URL(`${GRAPH_API_BASE}${path}`);
  url.searchParams.set("access_token", env.instagramAccessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.text();
    throw new HttpError(
      response.status,
      `Instagram Graph API error: ${body}`
    );
  }
  return response.json() as Promise<T>;
}

interface IgAccountResponse {
  id: string;
  username?: string;
  name?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
}

interface IgMediaListResponse {
  data: Array<{
    id: string;
    caption?: string;
    media_type?: string;
    permalink?: string;
    timestamp?: string;
    like_count?: number;
    comments_count?: number;
  }>;
  paging?: { cursors: { after?: string }; next?: string };
}

interface IgMediaInsightsResponse {
  data: Array<{
    name: string;
    values: Array<{ value: number }>;
  }>;
}

export async function getInstagramAccountStats(accountId: string): Promise<ContentStats> {
  const account = await igFetch<IgAccountResponse>(`/${accountId}`, {
    fields: "id,username,name,followers_count,follows_count,media_count"
  });

  return {
    platform: "INSTAGRAM",
    accountId,
    metrics: {
      followers: account.followers_count ?? 0,
      videoCount: account.media_count ?? 0
    },
    fetchedAt: new Date().toISOString()
  };
}

export async function getInstagramMedia(
  accountId: string,
  limit: number = 10
): Promise<ContentStats> {
  const mediaList = await igFetch<IgMediaListResponse>(`/${accountId}/media`, {
    fields: "id,caption,media_type,permalink,timestamp,like_count,comments_count",
    limit: String(limit)
  });

  const items: ContentItem[] = mediaList.data.map((media) => ({
    id: media.id,
    title: media.caption?.slice(0, 100) ?? undefined,
    url: media.permalink ?? undefined,
    publishedAt: media.timestamp ?? undefined,
    metrics: {
      likes: media.like_count ?? 0,
      comments: media.comments_count ?? 0
    }
  }));

  const totalLikes = items.reduce((s, i) => s + (i.metrics.likes ?? 0), 0);
  const totalComments = items.reduce((s, i) => s + (i.metrics.comments ?? 0), 0);

  return {
    platform: "INSTAGRAM",
    accountId,
    metrics: {
      likes: totalLikes,
      comments: totalComments,
      engagement: totalLikes + totalComments
    },
    items,
    fetchedAt: new Date().toISOString()
  };
}

export async function getInstagramMediaInsights(
  mediaId: string
): Promise<ContentItem> {
  const [mediaData, insights] = await Promise.all([
    igFetch<{ id: string; caption?: string; permalink?: string; timestamp?: string }>(
      `/${mediaId}`,
      { fields: "id,caption,permalink,timestamp" }
    ),
    igFetch<IgMediaInsightsResponse>(`/${mediaId}/insights`, {
      metric: "impressions,reach,saved,shares"
    }).catch(() => ({ data: [] } as IgMediaInsightsResponse))
  ]);

  const insightMap: Record<string, number> = {};
  for (const metric of insights.data) {
    insightMap[metric.name] = metric.values[0]?.value ?? 0;
  }

  return {
    id: mediaId,
    title: mediaData.caption?.slice(0, 100) ?? undefined,
    url: mediaData.permalink ?? undefined,
    publishedAt: mediaData.timestamp ?? undefined,
    metrics: {
      impressions: insightMap.impressions ?? 0,
      reach: insightMap.reach ?? 0,
      saves: insightMap.saved ?? 0,
      shares: insightMap.shares ?? 0
    }
  };
}
