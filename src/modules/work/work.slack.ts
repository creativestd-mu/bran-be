import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { getSlackUserInfo, resolveChannelId as resolveAttendanceChannelId, type SlackMessage } from "../attendance/attendance.slack";
import { resolveEscalationChannelId } from "../escalation/escalation.slack";
import { prisma } from "../../lib/prisma";
import {
  DEFAULT_WORK_INGEST_LOOKBACK_DAYS,
  DEFAULT_WORK_INGEST_MAX_PER_SOURCE,
  type WorkIngestSourceType
} from "./work.constants";
import { loadProcessedSourceKeys } from "./work.source-ledger";
import type { WorkIngestCandidate } from "./work.sources";

const SLACK_API = "https://slack.com/api";

type SlackApiResponse = { ok: boolean; error?: string; [key: string]: unknown };

async function slackApi<T extends SlackApiResponse>(
  method: string,
  params: Record<string, string | undefined> = {}
): Promise<T> {
  if (!env.slackBotToken) {
    throw new HttpError(500, "SLACK_BOT_TOKEN is not configured");
  }

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") body.set(key, value);
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

type SlackConversation = { id: string; name?: string };

async function listViaUsersConversations(): Promise<SlackConversation[]> {
  const channels: SlackConversation[] = [];
  let cursor: string | undefined;

  do {
    const data = await slackApi<{
      ok: boolean;
      channels?: Array<{ id: string; name?: string }>;
      response_metadata?: { next_cursor?: string };
    }>("users.conversations", {
      types: "public_channel,private_channel",
      exclude_archived: "true",
      limit: "200",
      cursor
    });

    for (const channel of data.channels ?? []) {
      channels.push({ id: channel.id, name: channel.name });
    }
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return channels;
}

/** Fallback when users.conversations is empty or missing scope. */
async function listViaConversationsListMember(): Promise<SlackConversation[]> {
  const channels: SlackConversation[] = [];
  let cursor: string | undefined;

  do {
    const data = await slackApi<{
      ok: boolean;
      channels?: Array<{ id: string; name?: string; is_member?: boolean }>;
      response_metadata?: { next_cursor?: string };
    }>("conversations.list", {
      types: "public_channel,private_channel",
      exclude_archived: "true",
      limit: "200",
      cursor
    });

    for (const channel of data.channels ?? []) {
      if (channel.is_member) {
        channels.push({ id: channel.id, name: channel.name });
      }
    }
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return channels;
}

async function listBotMemberChannels(): Promise<SlackConversation[]> {
  try {
    const viaUsers = await listViaUsersConversations();
    if (viaUsers.length > 0) return viaUsers;
  } catch (error) {
    console.warn("[work.slack] users.conversations failed, trying conversations.list:", error);
  }

  return listViaConversationsListMember();
}

async function fetchChannelHistory(channelId: string, oldest: string): Promise<SlackMessage[]> {
  const messages: SlackMessage[] = [];
  let cursor: string | undefined;

  do {
    const data = await slackApi<{
      ok: boolean;
      messages?: SlackMessage[];
      response_metadata?: { next_cursor?: string };
    }>("conversations.history", {
      channel: channelId,
      oldest,
      limit: "200",
      cursor
    });

    for (const message of data.messages ?? []) {
      if (message.ts) messages.push(message);
    }
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return messages;
}

async function fetchThreadReplies(channelId: string, threadTs: string): Promise<SlackMessage[]> {
  const data = await slackApi<{ ok: boolean; messages?: SlackMessage[] }>("conversations.replies", {
    channel: channelId,
    ts: threadTs,
    limit: "200"
  });
  return data.messages ?? [];
}

function shouldSkipSlackMessage(message: SlackMessage): boolean {
  if (message.bot_id) return true;
  if (message.subtype && message.subtype !== "thread_broadcast") return true;
  if (!message.user) return true;
  if (!message.text?.trim()) return true;
  return false;
}

function buildThreadText(messages: SlackMessage[]): string {
  return messages
    .filter((message) => !shouldSkipSlackMessage(message))
    .map((message) => message.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");
}

async function resolveExcludedChannelIds(): Promise<Set<string>> {
  const excluded = new Set<string>();

  const fromEnv = env.slackWorkExcludeChannels
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  for (const entry of fromEnv) {
    if (/^[CGD][A-Z0-9]+$/i.test(entry)) {
      excluded.add(entry);
    }
  }

  try {
    excluded.add(await resolveAttendanceChannelId());
  } catch {
    // attendance channel optional
  }

  try {
    excluded.add(await resolveEscalationChannelId());
  } catch {
    // escalation channel optional
  }

  return excluded;
}

const branUserByEmailCache = new Map<string, string | null>();

async function resolveBranUserIdForSlackUser(slackUserId: string): Promise<string | null> {
  const cachedMember = await prisma.slackMember.findUnique({
    where: { slackUserId },
    select: { email: true }
  });
  const memberEmail = cachedMember?.email?.trim().toLowerCase();
  if (memberEmail) {
    if (branUserByEmailCache.has(memberEmail)) {
      return branUserByEmailCache.get(memberEmail) ?? null;
    }
    const fromMember = await prisma.user.findFirst({
      where: { email: { equals: memberEmail, mode: "insensitive" }, isActive: true },
      select: { id: true }
    });
    branUserByEmailCache.set(memberEmail, fromMember?.id ?? null);
    if (fromMember) return fromMember.id;
  }

  const profile = await getSlackUserInfo(slackUserId);
  const email = profile.profile?.email?.trim().toLowerCase();
  if (!email) return null;

  if (branUserByEmailCache.has(email)) {
    return branUserByEmailCache.get(email) ?? null;
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, isActive: true },
    select: { id: true }
  });

  branUserByEmailCache.set(email, user?.id ?? null);
  return user?.id ?? null;
}

export async function loadSlackWorkIngestCandidates(options?: {
  days?: number;
  maxPerRun?: number;
}): Promise<WorkIngestCandidate[]> {
  if (!env.slackBotToken) {
    console.warn("[work.slack] SLACK_BOT_TOKEN is not set — skipping Slack work ingest");
    return [];
  }

  const days = options?.days ?? env.workIngestLookbackDays ?? DEFAULT_WORK_INGEST_LOOKBACK_DAYS;
  const maxPerRun = options?.maxPerRun ?? env.workIngestMaxPerSource ?? DEFAULT_WORK_INGEST_MAX_PER_SOURCE;
  const oldest = String(Math.floor(Date.now() / 1000) - days * 24 * 60 * 60);

  const processed = await loadProcessedSourceKeys("SLACK" as WorkIngestSourceType);
  const excludedChannels = await resolveExcludedChannelIds();
  const candidates: WorkIngestCandidate[] = [];

  const channels = await listBotMemberChannels();
  console.log(`[work.slack] Scanning ${channels.length} member channel(s) for work tasks`);

  for (const channel of channels) {
    if (candidates.length >= maxPerRun) break;
    if (excludedChannels.has(channel.id)) continue;

    let history: SlackMessage[];
    try {
      history = await fetchChannelHistory(channel.id, oldest);
    } catch (error) {
      console.warn(`[work.slack] Skip channel ${channel.id}:`, error);
      continue;
    }

    const threads = new Map<string, SlackMessage[]>();

    for (const message of history) {
      if (shouldSkipSlackMessage(message)) continue;

      const threadKey = message.thread_ts ?? message.ts;
      const bucket = threads.get(threadKey) ?? [];
      bucket.push(message);
      threads.set(threadKey, bucket);
    }

    for (const [threadTs, rootMessages] of threads) {
      if (candidates.length >= maxPerRun) break;

      const sourceId = `${channel.id}:${threadTs}`;
      if (processed.has(sourceId)) continue;

      let messages = rootMessages;
      if (threadTs !== rootMessages[0]?.ts) {
        try {
          messages = await fetchThreadReplies(channel.id, threadTs);
        } catch {
          messages = rootMessages;
        }
      } else if (rootMessages.some((message) => message.thread_ts)) {
        try {
          messages = await fetchThreadReplies(channel.id, threadTs);
        } catch {
          messages = rootMessages;
        }
      }

      const text = buildThreadText(messages);
      if (text.length < 40) continue;

      const authorSlackId = messages.find((message) => message.user)?.user;
      if (!authorSlackId) continue;

      const ownerUserId = await resolveBranUserIdForSlackUser(authorSlackId);
      if (!ownerUserId) continue;

      const title =
        channel.name && messages[0]?.text
          ? `#${channel.name}: ${messages[0].text.slice(0, 120)}`
          : messages[0]?.text?.slice(0, 120) ?? "Slack thread";

      const occurredAt = new Date(Number(threadTs.split(".")[0]) * 1000);

      candidates.push({
        sourceType: "SLACK",
        sourceId,
        ownerUserId,
        title,
        text,
        occurredAt
      });
    }
  }

  console.log(`[work.slack] Found ${candidates.length} unattached thread candidate(s)`);
  return candidates;
}
