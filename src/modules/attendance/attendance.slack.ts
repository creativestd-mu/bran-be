import crypto from "crypto";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { istDayBounds } from "./attendance.dates";

const SLACK_API = "https://slack.com/api";

type SlackApiResponse = {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
};

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

export type SlackChannel = {
  id: string;
  name: string;
  is_private?: boolean;
};

export type SlackUserProfile = {
  id: string;
  name?: string;
  real_name?: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: {
    email?: string;
    real_name?: string;
    display_name?: string;
  };
};

export type SlackMessage = {
  type?: string;
  user?: string;
  text?: string;
  ts: string;
  bot_id?: string;
  subtype?: string;
  thread_ts?: string;
};

let cachedChannelId: string | null = null;

export async function resolveChannelId(): Promise<string> {
  if (env.slackChannelId) {
    return env.slackChannelId;
  }
  if (cachedChannelId) {
    return cachedChannelId;
  }

  const targetName = env.slackChannelName.replace(/^#/, "").toLowerCase();
  let cursor: string | undefined;

  do {
    const data = await slackApi<{
      ok: boolean;
      channels?: SlackChannel[];
      response_metadata?: { next_cursor?: string };
    }>("conversations.list", {
      types: "public_channel,private_channel",
      exclude_archived: "true",
      limit: "200",
      cursor
    });

    const match = (data.channels ?? []).find((c) => c.name.toLowerCase() === targetName);
    if (match) {
      cachedChannelId = match.id;
      return match.id;
    }

    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  throw new HttpError(
    404,
    `Slack channel "${env.slackChannelName}" not found. Invite the bot and check SLACK_CHANNEL_NAME.`
  );
}

export async function listChannelMemberIds(channelId?: string): Promise<string[]> {
  const channel = channelId ?? (await resolveChannelId());
  const members: string[] = [];
  let cursor: string | undefined;

  do {
    const data = await slackApi<{
      ok: boolean;
      members?: string[];
      response_metadata?: { next_cursor?: string };
    }>("conversations.members", {
      channel,
      limit: "200",
      cursor
    });

    members.push(...(data.members ?? []));
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return members;
}

export async function getSlackUserInfo(userId: string): Promise<SlackUserProfile> {
  const data = await slackApi<{ ok: boolean; user?: SlackUserProfile }>("users.info", {
    user: userId
  });
  if (!data.user) {
    throw new HttpError(404, `Slack user not found: ${userId}`);
  }
  return data.user;
}

export async function lookupSlackUserByEmail(email: string): Promise<SlackUserProfile | null> {
  try {
    const data = await slackApi<{ ok: boolean; user?: SlackUserProfile }>("users.lookupByEmail", {
      email
    });
    return data.user ?? null;
  } catch (error) {
    if (error instanceof HttpError && error.message.includes("users_not_found")) {
      return null;
    }
    throw error;
  }
}

export async function fetchChannelMessagesForDate(dateStr: string): Promise<SlackMessage[]> {
  const channel = await resolveChannelId();
  const { oldest, latest } = istDayBounds(dateStr);
  const messages: SlackMessage[] = [];
  let cursor: string | undefined;

  do {
    const data = await slackApi<{
      ok: boolean;
      messages?: SlackMessage[];
      response_metadata?: { next_cursor?: string };
      has_more?: boolean;
    }>("conversations.history", {
      channel,
      oldest,
      latest,
      inclusive: "true",
      limit: "200",
      cursor
    });

    messages.push(...(data.messages ?? []));
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return messages;
}

export async function openConversation(userIds: string[]): Promise<string> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) {
    throw new HttpError(400, "At least one Slack user is required to open a conversation");
  }

  const data = await slackApi<{ ok: boolean; channel?: { id: string } }>("conversations.open", {
    users: unique.join(",")
  });
  if (!data.channel?.id) {
    throw new HttpError(502, `Failed to open conversation with Slack users ${unique.join(",")}`);
  }
  return data.channel.id;
}

export async function openDmChannel(userId: string): Promise<string> {
  return openConversation([userId]);
}

export async function postSlackMessage(
  channel: string,
  text: string,
  options?: { threadTs?: string }
): Promise<{ channel: string; ts: string }> {
  const data = await slackApi<{ ok: boolean; channel?: string; ts?: string }>("chat.postMessage", {
    channel,
    text,
    thread_ts: options?.threadTs
  });
  if (!data.ts) {
    throw new HttpError(502, "Slack chat.postMessage did not return a message ts");
  }
  return { channel: data.channel ?? channel, ts: data.ts };
}

export async function sendDm(
  userId: string,
  text: string
): Promise<{ channel: string; ts: string }> {
  const channel = await openDmChannel(userId);
  return postSlackMessage(channel, text);
}

export async function authTest(): Promise<{ ok: boolean; user?: string; team?: string }> {
  return slackApi("auth.test");
}

export function verifySlackSignature(params: {
  signingSecret: string;
  signature: string | undefined;
  timestamp: string | undefined;
  rawBody: string;
}): boolean {
  const { signingSecret, signature, timestamp, rawBody } = params;
  if (!signingSecret || !signature || !timestamp) {
    return false;
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - ts);
  if (ageSeconds > 60 * 5) {
    return false;
  }

  const base = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto.createHmac("sha256", signingSecret).update(base).digest("hex");
  const computed = `v0=${hmac}`;

  try {
    const a = Buffer.from(computed);
    const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
