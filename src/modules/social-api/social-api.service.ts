import type { ContentStats, ContentItem } from "./social-api.types";
import {
  getYoutubeChannelStats,
  getYoutubeVideoStats,
  getYoutubeChannelVideos,
  extractVideoIdFromUrl
} from "./youtube.client";
import {
  getInstagramAccountStats,
  getInstagramMedia,
  getInstagramMediaInsights
} from "./instagram.client";

export async function getAccountStats(
  platform: string,
  accountId: string
): Promise<ContentStats> {
  switch (platform.toUpperCase()) {
    case "YOUTUBE":
      return getYoutubeChannelStats(accountId);
    case "INSTAGRAM":
      return getInstagramAccountStats(accountId);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export async function getRecentContent(
  platform: string,
  accountId: string,
  limit: number = 10
): Promise<ContentStats> {
  switch (platform.toUpperCase()) {
    case "YOUTUBE":
      return getYoutubeChannelVideos(accountId, limit);
    case "INSTAGRAM":
      return getInstagramMedia(accountId, limit);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export async function getContentItemStats(
  platform: string,
  contentId: string
): Promise<ContentItem> {
  switch (platform.toUpperCase()) {
    case "YOUTUBE": {
      const videoId = extractVideoIdFromUrl(contentId) ?? contentId;
      return getYoutubeVideoStats(videoId);
    }
    case "INSTAGRAM":
      return getInstagramMediaInsights(contentId);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
