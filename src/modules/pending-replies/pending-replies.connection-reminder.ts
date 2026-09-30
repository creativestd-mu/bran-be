import { prisma } from "../../lib/prisma";
import { postSlackMessage } from "../attendance/attendance.slack";
import { startGmailConnect } from "../gmail/gmail.service";
import { startSlackReplyConnect } from "../slack-replies/slack-replies.service";
import { resolveBranUserIdForSlackUser } from "../work/work.slack";
import { looksLikePendingRepliesQuery } from "./pending-replies.slack";

export const GMAIL_CONNECT_OAUTH_ACTION_ID = "bran_connect_gmail_oauth";

type MissingService = "GMAIL" | "SLACK";

export function connectionReminderThreshold(input: {
  text: string;
  previousMessageAt: Date | null;
  now: Date;
}): number {
  const normalized = input.text.toLowerCase();
  if (
    looksLikePendingRepliesQuery(input.text) ||
    /\b(reply|replies|respond|response|inbox|email|gmail|slack|message|thread)\b/.test(normalized)
  ) {
    return 5;
  }
  if (
    input.previousMessageAt &&
    input.now.getTime() - input.previousMessageAt.getTime() <= 15 * 60_000
  ) {
    return 7;
  }
  return 10;
}

export function buildReplyConnectionPromptBlocks(input: {
  gmailAuthorizationUrl?: string;
  slackAuthorizationUrl?: string;
}): unknown[] {
  const elements: unknown[] = [];
  if (input.slackAuthorizationUrl) {
    elements.push({
      type: "button",
      text: { type: "plain_text", text: "Connect Slack", emoji: true },
      action_id: "bran_connect_slack_reminder",
      url: input.slackAuthorizationUrl,
      style: "primary"
    });
  }
  if (input.gmailAuthorizationUrl) {
    elements.push({
      type: "button",
      text: { type: "plain_text", text: "Connect Gmail", emoji: true },
      action_id: GMAIL_CONNECT_OAUTH_ACTION_ID,
      url: input.gmailAuthorizationUrl,
      style: input.slackAuthorizationUrl ? undefined : "primary"
    });
  }

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `To make your reply list complete and keep it updated, connect the missing account${elements.length === 1 ? "" : "s"}:`
      }
    },
    { type: "actions", elements },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "These private authorization links expire in 15 minutes. Bran only shows your reply data to you."
        }
      ]
    }
  ];
}

function isExplicitConnectionRequest(text: string): boolean {
  return /\b(connect|link|authorize|authorise|reconnect)\b.{0,30}\b(slack|gmail|email)\b/i.test(text);
}

/**
 * Count private DM interactions and send a reminder every 5–10 messages until
 * both reply sources are healthy. Stores cadence metadata only, never content.
 */
export async function maybeSendReplyConnectionReminder(input: {
  channelId: string;
  slackUserId: string;
  text: string;
  now?: Date;
}): Promise<{ sent: boolean; reason: string; threshold?: number; missing?: MissingService[] }> {
  const now = input.now ?? new Date();
  const userId = await resolveBranUserIdForSlackUser(input.slackUserId);
  if (!userId) return { sent: false, reason: "unlinked_user" };

  const [slack, gmail, previous] = await Promise.all([
    prisma.slackConnection.findUnique({ where: { userId }, select: { status: true } }),
    prisma.gmailConnection.findUnique({ where: { userId }, select: { status: true } }),
    prisma.replyConnectionPromptState.findUnique({ where: { userId } })
  ]);
  const missing: MissingService[] = [];
  if (slack?.status !== "CONNECTED") missing.push("SLACK");
  if (gmail?.status !== "CONNECTED") missing.push("GMAIL");

  if (missing.length === 0) {
    if (previous?.messagesSincePrompt) {
      await prisma.replyConnectionPromptState.update({
        where: { userId },
        data: { messagesSincePrompt: 0, lastMessageAt: now }
      });
    }
    return { sent: false, reason: "all_connected", missing };
  }

  const state = await prisma.replyConnectionPromptState.upsert({
    where: { userId },
    create: { userId, messagesSincePrompt: 1, lastMessageAt: now },
    update: { messagesSincePrompt: { increment: 1 }, lastMessageAt: now }
  });
  const threshold = connectionReminderThreshold({
    text: input.text,
    previousMessageAt: previous?.lastMessageAt ?? null,
    now
  });
  if (state.messagesSincePrompt < threshold || isExplicitConnectionRequest(input.text)) {
    return { sent: false, reason: "cadence_not_due", threshold, missing };
  }

  const [slackConnect, gmailConnect] = await Promise.all([
    missing.includes("SLACK") ? startSlackReplyConnect(userId) : null,
    missing.includes("GMAIL") ? startGmailConnect(userId) : null
  ]);
  const claimed = await prisma.replyConnectionPromptState.updateMany({
    where: { userId, messagesSincePrompt: { gte: threshold } },
    data: {
      messagesSincePrompt: 0,
      promptCount: { increment: 1 },
      lastPromptAt: now,
      lastMessageAt: now
    }
  });
  if (claimed.count === 0) return { sent: false, reason: "already_claimed", threshold, missing };

  const services = missing.map((service) => service === "SLACK" ? "Slack" : "Gmail").join(" and ");
  await postSlackMessage(
    input.channelId,
    `Connect ${services} so Bran can include all of your reply conversations.`,
    {
      blocks: buildReplyConnectionPromptBlocks({
        slackAuthorizationUrl: slackConnect?.authorizationUrl,
        gmailAuthorizationUrl: gmailConnect?.authorizationUrl
      })
    }
  );
  return { sent: true, reason: "reminder_sent", threshold, missing };
}
