import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { slackTsToDate } from "../attendance/attendance.dates";

const SLACK_API = "https://slack.com/api";

type SlackApiResponse = {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
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
