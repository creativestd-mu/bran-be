import type { Request, Response } from "express";

import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/httpError";
import { decryptSecret, encryptSecret } from "../gmail/gmail.crypto";
import { openDmChannel, postSlackMessage } from "../attendance/attendance.slack";
import {
  replacePendingRepliesForUser,
  type PendingReplyCandidate
} from "../pending-replies/pending-replies.repository";
import {
  getUserProfile,
  listConversationHistory,
  listThreadReplies,
  listUserConversations,
  revokeSlackToken,
  type ReplySlackMessage
} from "./slack-replies.client";
import {
  buildSlackAuthorizationUrl,
  buildSlackOAuthState,
  exchangeSlackCode,
  verifySlackOAuthState
} from "./slack-replies.oauth";

function redirect(res: Response, query: string): void {
  const base = (env.appUrl || "http://localhost:3000").replace(/\/$/, "");
  res.redirect(`${base}/?${query}`);
}

function messageDate(ts: string): Date {
  const seconds = Number.parseFloat(ts);
  return Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date();
}

function usefulMessage(message: ReplySlackMessage): boolean {
  return Boolean(message.user && message.text?.trim() && !message.bot_id && (!message.subtype || message.subtype === "thread_broadcast"));
}

const SLACK_RESPONSE_CUE_RE = /\?|\b(please|could you|can you|would you|will you|let me know|your thoughts|your feedback|need your|waiting for|confirm|approve|review|respond|reply|send|share|take a look|follow up|when can|what do you|how should|are you|do you)\b/i;
const SLACK_ACTIONABLE_UPDATE_RE = /\b(blocked|blocking|need(?:ed)?|waiting|deadline|due|moved|changed|ready for|requires?|pending|assigned|decision|feedback|approval)\b/i;
const SLACK_WORK_CONTEXT_RE = /\b(work|team|project|client|campaign|deck|brief|review|approval|deadline|meeting|call|schedule|task|deliverable|content|shoot|edit|design|document|proposal|contract|budget|report|analytics|launch|brand|social|post|creative|script|video|website|app|invoice|ticket|issue|release|production)\b/i;
const SLACK_CLOSURE_RE = /^\s*(thanks|thank you|thx|noted|got it|sounds good|okay|ok|will do|received|perfect|great|done|cool|awesome)[.!\s🙏👍✅]*$/iu;
const SLACK_NON_ACTIONABLE_RE = /^\s*(fyi|for your information|for visibility|no action needed|just sharing|sharing for awareness)\b/i;
const SLACK_AUTOMATED_RE = /\b(automated message|do not reply|notification|daily digest|weekly digest|reminder from|workflow)\b/i;

/**
 * Conservative reply-intent filter. Slack being a work workspace is not enough:
 * the latest human message must be work-related and either ask for a response or
 * continue an active exchange with an actionable update.
 */
export function shouldRecommendSlackReply(
  latest: ReplySlackMessage,
  conversationMessages: ReplySlackMessage[],
  ownSlackUserId: string,
  kind: "DM" | "THREAD"
): boolean {
  if (!usefulMessage(latest) || latest.user === ownSlackUserId) return false;

  const text = latest.text?.replace(/<https?:\/\/[^|>]+\|([^>]+)>/g, "$1").trim() ?? "";
  if (!text || SLACK_CLOSURE_RE.test(text) || SLACK_NON_ACTIONABLE_RE.test(text) || SLACK_AUTOMATED_RE.test(text)) {
    return false;
  }

  const directlyMentionsUser = text.includes(`<@${ownSlackUserId}>`);
  const asksForResponse = SLACK_RESPONSE_CUE_RE.test(text);
  const actionableUpdate = SLACK_ACTIONABLE_UPDATE_RE.test(text);
  const workContext = SLACK_WORK_CONTEXT_RE.test(text);
  const userParticipated = conversationMessages.some((message) => message.user === ownSlackUserId);

  if (kind === "THREAD") {
    return workContext && (
      (directlyMentionsUser && (asksForResponse || actionableUpdate)) ||
      (userParticipated && asksForResponse)
    );
  }

  return workContext && (asksForResponse || (userParticipated && actionableUpdate));
}

function truncate(text: string | undefined, max = 360): string | null {
  if (!text) return null;
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`;
}

export function isSkippableSlackConversationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Slack API conversations\.(history|replies) failed: (channel_not_found|not_in_channel|is_archived|thread_not_found)\b/.test(
    message
  );
}

async function confirmSlackConnectionInDm(slackUserId: string): Promise<void> {
  const channel = await openDmChannel(slackUserId);
  await postSlackMessage(
    channel,
    "✅ Your Slack account is connected to Bran. I’m syncing your conversations now. Ask `who do I need to reply to?` anytime."
  );
}

export async function startSlackReplyConnect(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
  if (!user?.isActive) throw new HttpError(403, "Account is deactivated");
  encryptSecret("probe");
  return { authorizationUrl: buildSlackAuthorizationUrl(buildSlackOAuthState(userId)) };
}

export async function handleSlackReplyOAuthCallback(req: Request, res: Response): Promise<void> {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    if (!code || !state) throw new HttpError(400, "Missing Slack OAuth parameters");
    const userId = verifySlackOAuthState(state);
    const grant = await exchangeSlackCode(code);
    const [branUser, slackUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, isActive: true } }),
      getUserProfile(grant.accessToken, grant.slackUserId)
    ]);
    if (!branUser?.isActive) throw new HttpError(403, "Account is deactivated");
    if (!slackUser.email || slackUser.email !== branUser.email.trim().toLowerCase()) {
      await revokeSlackToken(grant.accessToken).catch(() => undefined);
      throw new HttpError(403, "Slack and Bran account emails must match");
    }
    await prisma.slackConnection.upsert({
      where: { userId },
      create: {
        userId,
        slackUserId: grant.slackUserId,
        teamId: grant.teamId,
        teamName: grant.teamName,
        accessToken: encryptSecret(grant.accessToken),
        scopes: grant.scopes
      },
      update: {
        slackUserId: grant.slackUserId,
        teamId: grant.teamId,
        teamName: grant.teamName,
        accessToken: encryptSecret(grant.accessToken),
        scopes: grant.scopes,
        status: "CONNECTED",
        errorMessage: null,
        connectedAt: new Date()
      }
    });
    void confirmSlackConnectionInDm(grant.slackUserId).catch((error) =>
      console.warn("[slack-replies] connection confirmation DM failed", error)
    );
    void syncSlackRepliesForUser(userId).catch((error) => console.error("[slack-replies] initial sync failed", error));
    redirect(res, "slack=connected");
  } catch (error) {
    console.error("[slack-replies] OAuth callback failed", error);
    redirect(res, "slack=error");
  }
}

export async function getSlackReplyConnectionStatus(userId: string) {
  const connection = await prisma.slackConnection.findUnique({ where: { userId } });
  if (!connection) return { connected: false };
  return {
    connected: connection.status === "CONNECTED" || connection.status === "ERROR",
    status: connection.status,
    teamName: connection.teamName,
    lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
    errorMessage: connection.errorMessage
  };
}

export async function disconnectSlackReplies(userId: string) {
  const connection = await prisma.slackConnection.findUnique({ where: { userId } });
  if (!connection) throw new HttpError(404, "No Slack connection found");
  await revokeSlackToken(decryptSecret(connection.accessToken)).catch(() => undefined);
  await prisma.$transaction([
    prisma.pendingReply.deleteMany({ where: { userId, source: "SLACK" } }),
    prisma.slackConnection.delete({ where: { userId } })
  ]);
  return { disconnected: true };
}

export async function syncSlackRepliesForUser(userId: string): Promise<number> {
  const connection = await prisma.slackConnection.findUnique({ where: { userId } });
  if (!connection) throw new HttpError(400, "Connect Slack first");
  const token = decryptSecret(connection.accessToken);
  const oldest = String((Date.now() - Math.max(env.slackReplySyncDays, 1) * 86_400_000) / 1000);
  const nameCache = new Map<string, string | null>();
  const senderName = async (id: string): Promise<string | null> => {
    if (nameCache.has(id)) return nameCache.get(id) ?? null;
    const profile = await getUserProfile(token, id).catch(() => ({ name: null, email: null }));
    nameCache.set(id, profile.name);
    return profile.name;
  };

  try {
    const conversations = await listUserConversations(token, env.slackReplySyncMaxConversations);
    const candidates: PendingReplyCandidate[] = [];
    for (const conversation of conversations) {
      let history: ReplySlackMessage[];
      try {
        history = await listConversationHistory(
          token,
          conversation.id,
          oldest,
          env.slackReplySyncMaxMessages
        );
      } catch (error) {
        if (!isSkippableSlackConversationError(error)) throw error;
        console.warn("[slack-replies] skipped inaccessible conversation");
        continue;
      }
      const messages = history.filter(usefulMessage);
      if (conversation.is_im || conversation.is_mpim) {
        const latest = messages[0];
        if (latest?.user && shouldRecommendSlackReply(latest, messages, connection.slackUserId, "DM")) {
          candidates.push({
            conversationExternalId: conversation.id,
            conversationKind: "SLACK_DM",
            senderExternalId: latest.user,
            senderName: await senderName(latest.user),
            snippet: truncate(latest.text),
            channelId: conversation.id,
            lastMessageAt: messageDate(latest.ts)
          });
        }
        continue;
      }

      for (const root of messages.filter((message) => !message.thread_ts || message.thread_ts === message.ts)) {
        const relevant =
          root.user === connection.slackUserId ||
          root.text?.includes(`<@${connection.slackUserId}>`) ||
          root.reply_users?.includes(connection.slackUserId);
        if (!relevant) continue;
        let thread: ReplySlackMessage[];
        if (root.reply_count) {
          try {
            thread = (await listThreadReplies(token, conversation.id, root.ts)).filter(usefulMessage);
          } catch (error) {
            if (!isSkippableSlackConversationError(error)) throw error;
            console.warn("[slack-replies] skipped inaccessible thread");
            continue;
          }
        } else {
          thread = [root];
        }
        if (!thread.some((message) => message.user === connection.slackUserId || message.text?.includes(`<@${connection.slackUserId}>`))) continue;
        const latest = [...thread].sort((a, b) => Number(b.ts) - Number(a.ts))[0];
        if (!latest?.user || !shouldRecommendSlackReply(latest, thread, connection.slackUserId, "THREAD")) continue;
        candidates.push({
          conversationExternalId: `${conversation.id}:${root.ts}`,
          conversationKind: "SLACK_THREAD",
          senderExternalId: latest.user,
          senderName: await senderName(latest.user),
          snippet: truncate(latest.text),
          channelId: conversation.id,
          channelName: conversation.name ?? null,
          threadTs: root.ts,
          lastMessageAt: messageDate(latest.ts)
        });
      }
    }
    await replacePendingRepliesForUser(userId, "SLACK", candidates);
    await prisma.slackConnection.update({
      where: { userId },
      data: { lastSyncedAt: new Date(), status: "CONNECTED", errorMessage: null }
    });
    return candidates.length;
  } catch (error) {
    await prisma.slackConnection.update({
      where: { userId },
      data: { status: "ERROR", errorMessage: (error instanceof Error ? error.message : String(error)).slice(0, 2000) }
    });
    throw error;
  }
}

export async function syncAllSlackReplyConnections(): Promise<{ accounts: number; replies: number; failures: number }> {
  const connections = await prisma.slackConnection.findMany({ select: { userId: true } });
  let replies = 0;
  let failures = 0;
  for (const connection of connections) {
    try { replies += await syncSlackRepliesForUser(connection.userId); }
    catch { failures += 1; }
  }
  return { accounts: connections.length, replies, failures };
}
