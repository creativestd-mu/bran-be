import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import {
  getSlackUserInfo,
  listChannelMemberIds,
  resolveChannelId as resolveAttendanceChannelId,
  type SlackMessage
} from "../attendance/attendance.slack";
import {
  resolveEscalationChannelId,
  resolveSlackMentionsInText
} from "../escalation/escalation.slack";
import { prisma } from "../../lib/prisma";
import {
  DEFAULT_WORK_INGEST_LOOKBACK_DAYS,
  DEFAULT_WORK_INGEST_MAX_PER_SOURCE,
  type WorkIngestSourceType
} from "./work.constants";
import { findWorkUnitSource, loadProcessedSourceKeys } from "./work.source-ledger";
import type { WorkIngestCandidate } from "./work.sources";

const MIN_SLACK_WORK_TEXT_LENGTH = 40;
const DEFAULT_SLACK_WORK_CHANNEL = "tech-team";
const ALLOWED_CHANNEL_CACHE_TTL_MS = 5 * 60 * 1000;

let allowedWorkChannelIdsCache: { ids: Set<string>; expiresAt: number } | null = null;
let workChannelMemberEmailsCache: { emails: Set<string>; expiresAt: number } | null = null;

/** Slack mention markup: <@U123> or <@U123|display>. */
const SLACK_MENTION_RE = /<@([UW][A-Z0-9]+)(?:\|[^>]+)?>/g;

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

function collectMentionedSlackUserIds(messages: SlackMessage[]): string[] {
  const ids = new Set<string>();
  for (const message of messages) {
    if (shouldSkipSlackMessage(message)) continue;
    const text = message.text ?? "";
    for (const match of text.matchAll(SLACK_MENTION_RE)) {
      ids.add(match[1]);
    }
  }
  return [...ids];
}

type MentionAssigneeResolution =
  | { kind: "none" }
  | { kind: "unmapped" } // @mention present but no Bran user match
  | { kind: "assignee"; userId: string }
  | { kind: "ambiguous" }; // multiple distinct Bran users mentioned

/**
 * Resolve @mentions to Bran users only. Non-Bran Slack users are ignored for assignment.
 */
async function resolvePreferredAssigneeFromMentions(
  messages: SlackMessage[],
  authorSlackId: string
): Promise<MentionAssigneeResolution> {
  const mentioned = collectMentionedSlackUserIds(messages).filter((id) => id !== authorSlackId);
  if (mentioned.length === 0) return { kind: "none" };

  const branIds: string[] = [];
  for (const slackUserId of mentioned) {
    const branUserId = await resolveBranUserIdForSlackUser(slackUserId);
    if (branUserId && !branIds.includes(branUserId)) {
      branIds.push(branUserId);
    }
  }

  if (branIds.length === 0) return { kind: "unmapped" };
  if (branIds.length === 1) return { kind: "assignee", userId: branIds[0] };
  return { kind: "ambiguous" };
}

function parseSlackChannelEntries(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim().replace(/^#/, ""))
    .filter(Boolean);
}

function isSlackChannelId(value: string): boolean {
  return /^[CGD][A-Z0-9]+$/i.test(value);
}

function workChannelAllowlist(): string[] {
  const parsed = parseSlackChannelEntries(env.slackWorkChannels);
  return parsed.length > 0 ? parsed : [DEFAULT_SLACK_WORK_CHANNEL];
}

/**
 * Resolve SLACK_WORK_CHANNELS (names or IDs) to channel IDs the bot is in.
 * Cached briefly so webhook events do not hit Slack on every message.
 */
export async function resolveAllowedWorkChannelIds(): Promise<Set<string>> {
  const now = Date.now();
  if (allowedWorkChannelIdsCache && allowedWorkChannelIdsCache.expiresAt > now) {
    return allowedWorkChannelIdsCache.ids;
  }

  const allow = workChannelAllowlist();
  const memberChannels = await listBotMemberChannels();
  const ids = new Set<string>();

  for (const entry of allow) {
    if (isSlackChannelId(entry)) {
      ids.add(entry);
      continue;
    }
    const name = entry.toLowerCase();
    for (const channel of memberChannels) {
      if ((channel.name ?? "").toLowerCase() === name) {
        ids.add(channel.id);
      }
    }
  }

  allowedWorkChannelIdsCache = { ids, expiresAt: now + ALLOWED_CHANNEL_CACHE_TTL_MS };
  return ids;
}

export async function isAllowedSlackWorkChannel(channelId: string): Promise<boolean> {
  const allowed = await resolveAllowedWorkChannelIds();
  return allowed.has(channelId);
}

/**
 * Emails of people currently in SLACK_WORK_CHANNELS (default #tech-team).
 * Used to gate work-assignment SMTP so only that Slack group gets mail.
 */
export async function loadSlackWorkChannelMemberEmails(): Promise<Set<string>> {
  const now = Date.now();
  if (workChannelMemberEmailsCache && workChannelMemberEmailsCache.expiresAt > now) {
    return workChannelMemberEmailsCache.emails;
  }

  const channelIds = await resolveAllowedWorkChannelIds();
  const slackUserIds = new Set<string>();

  for (const channelId of channelIds) {
    try {
      const members = await listChannelMemberIds(channelId);
      for (const id of members) slackUserIds.add(id);
    } catch (error) {
      console.warn(`[work.slack] Failed to list members for ${channelId}:`, error);
    }
  }

  const emails = new Set<string>();
  if (slackUserIds.size === 0) {
    workChannelMemberEmailsCache = { emails, expiresAt: now + ALLOWED_CHANNEL_CACHE_TTL_MS };
    return emails;
  }

  const cachedMembers = await prisma.slackMember.findMany({
    where: { slackUserId: { in: [...slackUserIds] } },
    select: { slackUserId: true, email: true, isBot: true, isDeleted: true }
  });
  const cachedById = new Map(cachedMembers.map((member) => [member.slackUserId, member]));

  for (const slackUserId of slackUserIds) {
    const cached = cachedById.get(slackUserId);
    if (cached?.isBot || cached?.isDeleted) continue;

    let email = cached?.email?.trim().toLowerCase() ?? "";
    if (!email) {
      try {
        const profile = await getSlackUserInfo(slackUserId);
        if (profile.is_bot || profile.deleted) continue;
        email = profile.profile?.email?.trim().toLowerCase() ?? "";
      } catch {
        continue;
      }
    }
    if (email) emails.add(email);
  }

  workChannelMemberEmailsCache = { emails, expiresAt: now + ALLOWED_CHANNEL_CACHE_TTL_MS };
  return emails;
}

export async function isEmailInSlackWorkChannel(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const members = await loadSlackWorkChannelMemberEmails();
  return members.has(normalized);
}

async function resolveExcludedChannelIds(): Promise<Set<string>> {
  const excluded = new Set<string>();

  const fromEnv = parseSlackChannelEntries(env.slackWorkExcludeChannels);

  for (const entry of fromEnv) {
    if (isSlackChannelId(entry)) {
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

export async function resolveBranUserIdForSlackUser(slackUserId: string): Promise<string | null> {
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

async function resolveChannelName(channelId: string): Promise<string | undefined> {
  try {
    const data = await slackApi<{
      ok: boolean;
      channel?: { name?: string };
    }>("conversations.info", { channel: channelId });
    return data.channel?.name;
  } catch {
    return undefined;
  }
}

async function buildCandidateFromMessages(input: {
  channelId: string;
  channelName?: string;
  threadTs: string;
  messages: SlackMessage[];
}): Promise<WorkIngestCandidate | null> {
  const rawText = buildThreadText(input.messages);
  if (rawText.length < MIN_SLACK_WORK_TEXT_LENGTH) return null;

  // Expand <@U…> mentions to display names so AI can match Bran team members.
  const text = await resolveSlackMentionsInText(rawText);
  if (text.length < MIN_SLACK_WORK_TEXT_LENGTH) return null;

  const authorSlackId = input.messages.find((message) => message.user)?.user;
  if (!authorSlackId) return null;

  // Author must be an active Bran user (matched via Slack email).
  const authorBranUserId = await resolveBranUserIdForSlackUser(authorSlackId);
  if (!authorBranUserId) {
    console.warn(
      `[work.slack] Skip ${input.channelId}:${input.threadTs}: author is not a Bran user`
    );
    return null;
  }

  const mentionResolution = await resolvePreferredAssigneeFromMentions(
    input.messages,
    authorSlackId
  );

  // Tagged people must also map to Bran users — never assign to unknown Slack accounts.
  if (mentionResolution.kind === "unmapped") {
    console.warn(
      `[work.slack] Skip ${input.channelId}:${input.threadTs}: @mention is not a Bran user`
    );
    return null;
  }

  const preferredAssigneeUserId =
    mentionResolution.kind === "assignee" ? mentionResolution.userId : null;

  const titleSource = await resolveSlackMentionsInText(input.messages[0]?.text ?? "");
  const title =
    input.channelName && titleSource
      ? `#${input.channelName}: ${titleSource.slice(0, 120)}`
      : titleSource.slice(0, 120) || "Slack thread";

  return {
    sourceType: "SLACK",
    sourceId: `${input.channelId}:${input.threadTs}`,
    ownerUserId: authorBranUserId,
    preferredAssigneeUserId,
    title,
    text,
    occurredAt: new Date(Number(input.threadTs.split(".")[0]) * 1000)
  };
}

/**
 * Near-real-time path: build one work-ingest candidate from a Slack Events API message.
 */
export async function loadSlackWorkIngestCandidateFromEvent(input: {
  channelId: string;
  userId: string;
  text: string;
  ts: string;
  botId?: string;
  subtype?: string;
  threadTs?: string;
}): Promise<WorkIngestCandidate | null> {
  if (!env.slackBotToken) {
    console.warn("[work.slack] SLACK_BOT_TOKEN is not set — skipping Slack work event");
    return null;
  }

  const eventMessage: SlackMessage = {
    user: input.userId,
    text: input.text,
    ts: input.ts,
    bot_id: input.botId,
    subtype: input.subtype,
    thread_ts: input.threadTs
  };

  if (shouldSkipSlackMessage(eventMessage)) return null;

  if (!(await isAllowedSlackWorkChannel(input.channelId))) {
    return null;
  }

  const excludedChannels = await resolveExcludedChannelIds();
  if (excludedChannels.has(input.channelId)) {
    return null;
  }

  const threadTs = input.threadTs ?? input.ts;
  const sourceId = `${input.channelId}:${threadTs}`;
  const existing = await findWorkUnitSource("SLACK", sourceId);
  if (existing && (existing.status === "PROCESSED" || existing.status === "SKIPPED")) {
    return null;
  }

  // Prefer full thread context when available (parent + replies).
  let messages: SlackMessage[] = [eventMessage];
  try {
    const replies = await fetchThreadReplies(input.channelId, threadTs);
    if (replies.length > 0) messages = replies;
  } catch {
    messages = [eventMessage];
  }

  const channelName = await resolveChannelName(input.channelId);
  return buildCandidateFromMessages({
    channelId: input.channelId,
    channelName,
    threadTs,
    messages
  });
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
  const allowedChannelIds = await resolveAllowedWorkChannelIds();
  const excludedChannels = await resolveExcludedChannelIds();
  const candidates: WorkIngestCandidate[] = [];

  if (allowedChannelIds.size === 0) {
    console.warn(
      `[work.slack] No channels matched SLACK_WORK_CHANNELS=${workChannelAllowlist().join(",")}. Invite the bot to those channels.`
    );
    return [];
  }

  const memberChannels = await listBotMemberChannels();
  const channels = memberChannels.filter(
    (channel) => allowedChannelIds.has(channel.id) && !excludedChannels.has(channel.id)
  );
  console.log(
    `[work.slack] Scanning ${channels.length} allowed channel(s) for work tasks (${workChannelAllowlist().join(",")})`
  );

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

      const candidate = await buildCandidateFromMessages({
        channelId: channel.id,
        channelName: channel.name,
        threadTs,
        messages
      });
      if (candidate) candidates.push(candidate);
    }
  }

  console.log(`[work.slack] Found ${candidates.length} unattached thread candidate(s)`);
  return candidates;
}
