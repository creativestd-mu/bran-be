import { google } from "googleapis";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import type { ContentStats, ContentItem } from "./social-api.types";

const youtube = google.youtube({
  version: "v3",
  auth: env.youtubeApiKey || undefined
});

export async function getYoutubeChannelStats(channelId: string): Promise<ContentStats> {
  if (!env.youtubeApiKey) {
    throw new HttpError(503, "YouTube API key is not configured");
  }

  const response = await youtube.channels.list({
    part: ["statistics", "snippet"],
    id: [channelId]
  });

  const channel = response.data.items?.[0];
  if (!channel) {
    throw new HttpError(404, `YouTube channel not found: ${channelId}`);
  }

  const stats = channel.statistics;
  return {
    platform: "YOUTUBE",
    accountId: channelId,
    metrics: {
      subscribers: Number(stats?.subscriberCount ?? 0),
      views: Number(stats?.viewCount ?? 0),
      videoCount: Number(stats?.videoCount ?? 0)
    },
    fetchedAt: new Date().toISOString()
  };
}

export async function getYoutubeVideoStats(videoId: string): Promise<ContentItem> {
  if (!env.youtubeApiKey) {
    throw new HttpError(503, "YouTube API key is not configured");
  }

  const response = await youtube.videos.list({
    part: ["statistics", "snippet"],
    id: [videoId]
  });

  const video = response.data.items?.[0];
  if (!video) {
    throw new HttpError(404, `YouTube video not found: ${videoId}`);
  }

  const stats = video.statistics;
  return {
    id: videoId,
    title: video.snippet?.title ?? undefined,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    publishedAt: video.snippet?.publishedAt ?? undefined,
    metrics: {
      views: Number(stats?.viewCount ?? 0),
      likes: Number(stats?.likeCount ?? 0),
      comments: Number(stats?.commentCount ?? 0)
    }
  };
}

export async function getYoutubeChannelVideos(
  channelId: string,
  maxResults: number = 10
): Promise<ContentStats> {
  if (!env.youtubeApiKey) {
    throw new HttpError(503, "YouTube API key is not configured");
  }

  const searchResponse = await youtube.search.list({
    part: ["id"],
    channelId,
    maxResults,
    order: "date",
    type: ["video"]
  });

  const videoIds = (searchResponse.data.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id));

  if (videoIds.length === 0) {
    return {
      platform: "YOUTUBE",
      accountId: channelId,
      metrics: {},
      items: [],
      fetchedAt: new Date().toISOString()
    };
  }

  const videosResponse = await youtube.videos.list({
    part: ["statistics", "snippet"],
    id: videoIds
  });

  const items: ContentItem[] = (videosResponse.data.items ?? []).map((video) => ({
    id: video.id!,
    title: video.snippet?.title ?? undefined,
    url: `https://www.youtube.com/watch?v=${video.id}`,
    publishedAt: video.snippet?.publishedAt ?? undefined,
    metrics: {
      views: Number(video.statistics?.viewCount ?? 0),
      likes: Number(video.statistics?.likeCount ?? 0),
      comments: Number(video.statistics?.commentCount ?? 0)
    }
  }));

  const totalViews = items.reduce((s, i) => s + (i.metrics.views ?? 0), 0);
  const totalLikes = items.reduce((s, i) => s + (i.metrics.likes ?? 0), 0);
  const totalComments = items.reduce((s, i) => s + (i.metrics.comments ?? 0), 0);

  return {
    platform: "YOUTUBE",
    accountId: channelId,
    metrics: {
      views: totalViews,
      likes: totalLikes,
      comments: totalComments
    },
    items,
    fetchedAt: new Date().toISOString()
  };
}

export function extractVideoIdFromUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
