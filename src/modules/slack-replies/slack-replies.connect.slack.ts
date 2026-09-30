import { postSlackMessage } from "../attendance/attendance.slack";
import { isSlackDmChannel } from "../work/work.slack-voice";
import { resolveBranUserIdForSlackUser } from "../work/work.slack";
import {
  getSlackReplyConnectionStatus,
  startSlackReplyConnect,
  syncSlackRepliesForUser
} from "./slack-replies.service";

export const SLACK_CONNECT_OAUTH_ACTION_ID = "bran_connect_slack_oauth";

export function looksLikeSlackConnectQuery(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  return (
    /\b(connect|link|authorize|authorise|reconnect)\s+(?:my\s+)?slack(?:\s+account)?\b/.test(
      normalized
    ) ||
    /\b(my\s+)?slack(?:\s+account)?\b.{0,24}\b(connect|linked|authorize|authorise|reconnect)\b/.test(
      normalized
    )
  );
}

export function buildSlackConnectBlocks(authorizationUrl: string): unknown[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Authorize your Slack account so Bran can privately find DMs and threads waiting for your reply."
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Authorize Slack", emoji: true },
          action_id: SLACK_CONNECT_OAUTH_ACTION_ID,
          url: authorizationUrl,
          style: "primary"
        }
      ]
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "This personal link expires in 15 minutes. Your Slack data remains private to your Bran account."
        }
      ]
    }
  ];
}

export async function processSlackConnectMessage(input: {
  channelId: string;
  userId: string;
  text?: string;
  ts: string;
  botId?: string;
  subtype?: string;
  channelType?: string;
  threadTs?: string;
  force?: boolean;
}): Promise<{ handled: boolean; reason?: string }> {
  if (input.botId || (input.subtype && input.subtype !== "thread_broadcast")) {
    return { handled: false, reason: "ignored_subtype" };
  }
  if (!input.force && !looksLikeSlackConnectQuery(input.text ?? "")) {
    return { handled: false, reason: "not_slack_connect_query" };
  }

  // Never create or disclose a user-bound OAuth URL outside a direct message.
  if (!isSlackDmChannel(input.channelId, input.channelType)) {
    return { handled: false, reason: "dm_only" };
  }

  const branUserId = await resolveBranUserIdForSlackUser(input.userId);
  if (!branUserId) {
    await postSlackMessage(
      input.channelId,
      "I couldn’t match your Slack email to an active Bran account. Ask an admin to check that both accounts use the same email."
    );
    return { handled: true, reason: "unlinked_user" };
  }

  const status = await getSlackReplyConnectionStatus(branUserId);
  if (status.connected) {
    if (status.status === "ERROR") {
      void syncSlackRepliesForUser(branUserId).catch((error) =>
        console.warn("[slack-replies] DM-triggered sync retry failed", error)
      );
      await postSlackMessage(
        input.channelId,
        "Your Slack account is already authorized. The last sync hit an inaccessible conversation, so I’m retrying it now—you do not need to authorize again."
      );
      return { handled: true, reason: "sync_retry_started" };
    }
    await postSlackMessage(
      input.channelId,
      "Your Slack account is already connected. Ask `who do I need to reply to?` anytime."
    );
    return { handled: true, reason: "already_connected" };
  }

  const { authorizationUrl } = await startSlackReplyConnect(branUserId);
  await postSlackMessage(
    input.channelId,
    `Authorize Slack using this private link (expires in 15 minutes): ${authorizationUrl}`,
    { blocks: buildSlackConnectBlocks(authorizationUrl) }
  );
  return { handled: true, reason: "authorization_link_sent" };
}
