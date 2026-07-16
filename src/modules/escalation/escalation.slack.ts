import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { slackTsToDate } from "../attendance/attendance.dates";
import { getSlackUserInfo } from "../attendance/attendance.slack";

const SLACK_API = "https://slack.com/api";

type SlackApiResponse = {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
};

export type SlackFile = {
  id: string;
  name?: string;
  title?: string;
  mimetype?: string;
  filetype?: string;
  url_private?: string;
  url_private_download?: string;
  permalink?: string;
  thumb_360?: string;
};

export type SlackAttachmentMeta = {
  id: string;
  name: string;
  mimetype: string;
  urlPrivate: string;
  permalink: string | null;
};

export type SlackImageBytes = {
  id: string;
  name: string;
  mimetype: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  buffer: Buffer;
};

export type SlackMessage = {
  type?: string;
  user?: string;
  text?: string;
  ts: string;
  bot_id?: string;
  subtype?: string;
  thread_ts?: string;
  files?: SlackFile[];
};

const IMAGE_MIME_PREFIX = "image/";
const SUPPORTED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

export function extractSlackImageAttachments(
  files: SlackFile[] | undefined
): SlackAttachmentMeta[] {
  if (!files?.length) return [];

  return files
    .filter((file) => {
      const mime = (file.mimetype ?? "").toLowerCase();
      return mime.startsWith(IMAGE_MIME_PREFIX) && Boolean(file.url_private || file.url_private_download);
    })
    .slice(0, 8)
    .map((file) => ({
      id: file.id,
      name: file.name || file.title || file.id,
      mimetype: (file.mimetype ?? "image/png").toLowerCase(),
      urlPrivate: file.url_private_download || file.url_private || "",
      permalink: file.permalink ?? null
    }))
    .filter((file) => file.urlPrivate);
}

export async function downloadSlackImage(
  attachment: SlackAttachmentMeta
): Promise<SlackImageBytes | null> {
  if (!env.slackBotToken) return null;
  const mime = attachment.mimetype.toLowerCase();
  if (!SUPPORTED_IMAGE_MIME.has(mime)) return null;

  try {
    const response = await fetch(attachment.urlPrivate, {
      headers: { Authorization: `Bearer ${env.slackBotToken}` }
    });
    if (!response.ok) {
      console.error("[escalation.slack] image download failed", {
        id: attachment.id,
        status: response.status
      });
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > 8 * 1024 * 1024) return null;
    return {
      id: attachment.id,
      name: attachment.name,
      mimetype: mime as SlackImageBytes["mimetype"],
      buffer
    };
  } catch (error) {
    console.error("[escalation.slack] image download error", { id: attachment.id, error });
    return null;
  }
}

export async function downloadSlackImages(
  attachments: SlackAttachmentMeta[]
): Promise<SlackImageBytes[]> {
  const images = await Promise.all(attachments.slice(0, 6).map((file) => downloadSlackImage(file)));
  return images.filter((image): image is SlackImageBytes => Boolean(image));
}

async function slackApi<T extends SlackApiResponse>(
  method: string,
  params: Record<string, string | undefined> = {}
): Promise<T> {
  if (!env.slackBotToken) {
    throw new HttpError(500, "SLACK_BOT_TOKEN is not configured");
  }

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") {
      body.set(key, value);
    }
  }

  const response = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.slackBotToken}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const data = (await response.json()) as T;
  if (!data.ok) {
    throw new HttpError(502, `Slack API ${method} failed: ${data.error ?? "unknown_error"}`);
  }
  return data;
}

let cachedEscalationChannelId: string | null = null;

export function isEscalationConfigured(): boolean {
  return Boolean(env.slackEscalationChannelId || env.slackEscalationChannelName);
}

export async function resolveEscalationChannelId(): Promise<string> {
  if (!isEscalationConfigured()) {
    throw new HttpError(500, "SLACK_ESCALATION_CHANNEL_NAME or SLACK_ESCALATION_CHANNEL_ID is not configured");
  }
  if (env.slackEscalationChannelId) {
    return env.slackEscalationChannelId;
  }
  if (cachedEscalationChannelId) {
    return cachedEscalationChannelId;
  }

  const targetName = env.slackEscalationChannelName.replace(/^#/, "").toLowerCase();
  let cursor: string | undefined;

  do {
    const data = await slackApi<{
      ok: boolean;
      channels?: Array<{ id: string; name: string }>;
      response_metadata?: { next_cursor?: string };
    }>("conversations.list", {
      types: "public_channel,private_channel",
      exclude_archived: "true",
      limit: "200",
      cursor
    });

    const match = (data.channels ?? []).find((c) => c.name.toLowerCase() === targetName);
    if (match) {
      cachedEscalationChannelId = match.id;
      return match.id;
    }
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  throw new HttpError(
    404,
    `Slack escalation channel "${env.slackEscalationChannelName}" not found. Invite the bot to the channel.`
  );
}

export async function fetchEscalationChannelHistory(options: {
  oldest?: string;
  latest?: string;
  limit?: number;
} = {}): Promise<SlackMessage[]> {
  const channel = await resolveEscalationChannelId();
  const messages: SlackMessage[] = [];
  let cursor: string | undefined;

  do {
    const data = await slackApi<{
      ok: boolean;
      messages?: SlackMessage[];
      response_metadata?: { next_cursor?: string };
    }>("conversations.history", {
      channel,
      oldest: options.oldest,
      latest: options.latest,
      inclusive: "true",
      limit: String(options.limit ?? 200),
      cursor
    });

    messages.push(...(data.messages ?? []));
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return messages;
}

export async function fetchEscalationThreadReplies(
  channelId: string,
  threadTs: string
): Promise<SlackMessage[]> {
  const messages: SlackMessage[] = [];
  let cursor: string | undefined;

  do {
    const data = await slackApi<{
      ok: boolean;
      messages?: SlackMessage[];
      response_metadata?: { next_cursor?: string };
    }>("conversations.replies", {
      channel: channelId,
      ts: threadTs,
      inclusive: "true",
      limit: "200",
      cursor
    });

    messages.push(...(data.messages ?? []));
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return messages;
}

export function slackMessageInstant(ts: string): Date {
  return slackTsToDate(ts);
}

const slackMentionCache = new Map<string, string>();

/** Slack user IDs look like U0B8MRPU2AG / W0123456789. */
const SLACK_USER_ID_RE = /\b([UW][A-Z0-9]{8,})\b/g;
const SLACK_MENTION_RE = /<@([UW][A-Z0-9]+)(?:\|[^>]+)?>/g;

async function resolveSlackUserDisplayName(userId: string): Promise<string> {
  const cached = slackMentionCache.get(userId);
  if (cached) return cached;

  try {
    const user = await getSlackUserInfo(userId);
    const name =
      user.profile?.real_name ||
      user.real_name ||
      user.profile?.display_name ||
      user.name ||
      userId;
    slackMentionCache.set(userId, name);
    return name;
  } catch {
    slackMentionCache.set(userId, userId);
    return userId;
  }
}

/**
 * Replace Slack mention markup and bare user IDs with display names
 * so AI summaries / UI never show codes like U0B8MRPU2AG.
 */
export async function resolveSlackMentionsInText(text: string): Promise<string> {
  if (!text) return text;

  const ids = new Set<string>();
  for (const match of text.matchAll(SLACK_MENTION_RE)) {
    ids.add(match[1]);
  }
  for (const match of text.matchAll(SLACK_USER_ID_RE)) {
    ids.add(match[1]);
  }

  await Promise.all([...ids].map((id) => resolveSlackUserDisplayName(id)));

  return text
    .replace(SLACK_MENTION_RE, (_full, id: string) => slackMentionCache.get(id) ?? id)
    .replace(SLACK_USER_ID_RE, (id) => slackMentionCache.get(id) ?? id);
}
