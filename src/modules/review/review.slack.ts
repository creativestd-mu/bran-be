import { env } from "../../config/env";
import {
  getSlackBotUserId,
  lookupSlackUserByEmail,
  openSlackModal,
  postSlackMessage,
  sendDmWithBlocks,
  updateSlackMessage
} from "../attendance/attendance.slack";
import { isSlackDmChannel } from "../work/work.slack-voice";
import { resolveBranUserIdForSlackUser } from "../work/work.slack";
import {
  stripSlackUserMentions,
  textMentionsSlackUser
} from "../work/work.slack-tasks";
import {
  REVIEW_ACCEPT_ACTION,
  REVIEW_COMMENT_ACTION_ID,
  REVIEW_COMMENT_BLOCK_ID,
  REVIEW_CREATE_CALLBACK_ID,
  REVIEW_CREATE_CONTEXT_ACTION_ID,
  REVIEW_CREATE_CONTEXT_BLOCK_ID,
  REVIEW_CREATE_FILE_ACTION_ID,
  REVIEW_CREATE_FILE_BLOCK_ID,
  REVIEW_CREATE_USER_ACTION_ID,
  REVIEW_CREATE_USER_BLOCK_ID,
  REVIEW_REJECT_ACTION,
  REVIEW_RESPONSE_CALLBACK_ID
} from "./review.constants";
import type { ReviewWithUsers } from "./review.repository";
import { listPendingIncoming } from "./review.repository";

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function appReviewUrl(reviewId?: string): string {
  const base = (env.appUrl || "").replace(/\/$/, "");
  if (!base) return reviewId ? `/reviews?id=${reviewId}` : "/reviews";
  return reviewId ? `${base}/reviews?id=${reviewId}` : `${base}/reviews`;
}

function fileLine(review: ReviewWithUsers): string | null {
  if (review.fileUrl) {
    return `*<${review.fileUrl}|Open file link>*`;
  }
  if (review.storagePath && review.fileName) {
    return `📎 Uploaded file: *${review.fileName}* (open in Bran to download)`;
  }
  return null;
}

export function buildReviewRequestBlocks(review: ReviewWithUsers): unknown[] {
  const file = fileLine(review);
  const contextLines = [
    `*From:* ${review.requestedBy.name}`,
    `*To:* ${review.requestedTo.name}`,
    `*Status:* ${review.status}`,
    "",
    truncate(review.context, 2800)
  ];
  if (file) {
    contextLines.push("", file);
  }

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "Review request", emoji: true }
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: contextLines.join("\n") }
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<${appReviewUrl(review.id)}|Open in Bran>`
        }
      ]
    }
  ];

  if (review.status === "pending") {
    blocks.push({
      type: "actions",
      block_id: `review:${review.id}`,
      elements: [
        {
          type: "button",
          action_id: `${REVIEW_ACCEPT_ACTION}:${review.id}`,
          text: { type: "plain_text", text: "Accept", emoji: true },
          style: "primary",
          value: review.id
        },
        {
          type: "button",
          action_id: `${REVIEW_REJECT_ACTION}:${review.id}`,
          text: { type: "plain_text", text: "Reject", emoji: true },
          style: "danger",
          value: review.id
        }
      ]
    });
  } else {
    const label = review.status === "accepted" ? "Accepted" : "Rejected";
    const comment = review.responseComment
      ? truncate(review.responseComment, 500)
      : "(no comment)";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${label}*\n>${comment}`
      }
    });
  }

  return blocks;
}

export function buildReviewRequestFallbackText(review: ReviewWithUsers): string {
  return `Review request from ${review.requestedBy.name}: ${truncate(review.context, 120)}`;
}

export function buildReviewResponseModal(input: {
  reviewId: string;
  decision: "accepted" | "rejected";
  requesterName: string;
}): Record<string, unknown> {
  const title = input.decision === "accepted" ? "Accept review" : "Reject review";
  return {
    type: "modal",
    callback_id: REVIEW_RESPONSE_CALLBACK_ID,
    private_metadata: JSON.stringify({
      reviewId: input.reviewId,
      decision: input.decision
    }),
    title: { type: "plain_text", text: title, emoji: true },
    submit: { type: "plain_text", text: "Submit", emoji: true },
    close: { type: "plain_text", text: "Cancel", emoji: true },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Add a comment for *${input.requesterName}* about this review.`
        }
      },
      {
        type: "input",
        block_id: REVIEW_COMMENT_BLOCK_ID,
        label: { type: "plain_text", text: "Comment", emoji: true },
        element: {
          type: "plain_text_input",
          action_id: REVIEW_COMMENT_ACTION_ID,
          multiline: true,
          min_length: 1,
          max_length: 3000,
          placeholder: {
            type: "plain_text",
            text: "Share feedback or reasons…"
          }
        }
      }
    ]
  };
}

export async function notifyReviewerOnSlack(review: ReviewWithUsers): Promise<{
  channel: string;
  ts: string;
} | null> {
  if (!env.slackBotToken) {
    return null;
  }

  const slackUser = await lookupSlackUserByEmail(review.requestedTo.email);
  if (!slackUser?.id) {
    console.warn(
      `[review] No Slack user for reviewer email ${review.requestedTo.email} — skipping DM`
    );
    return null;
  }

  const text = buildReviewRequestFallbackText(review);
  const blocks = buildReviewRequestBlocks(review);
  return sendDmWithBlocks(slackUser.id, text, blocks);
}

export async function updateReviewSlackCard(review: ReviewWithUsers): Promise<void> {
  if (!review.slackChannelId || !review.slackMessageTs) return;
  if (!env.slackBotToken) return;

  await updateSlackMessage(
    review.slackChannelId,
    review.slackMessageTs,
    buildReviewRequestFallbackText(review),
    buildReviewRequestBlocks(review)
  );
}

export async function openReviewResponseModal(input: {
  triggerId: string;
  reviewId: string;
  decision: "accepted" | "rejected";
  requesterName: string;
}): Promise<void> {
  await openSlackModal(
    input.triggerId,
    buildReviewResponseModal({
      reviewId: input.reviewId,
      decision: input.decision,
      requesterName: input.requesterName
    })
  );
}

/** Compact per-review blocks with inline Accept/Reject buttons for list/reminder DMs. */
function pendingReviewBlocks(review: ReviewWithUsers): unknown[] {
  const file = fileLine(review);
  const lines = [
    `*From ${review.requestedBy.name}*`,
    truncate(review.context.replace(/\s+/g, " "), 240)
  ];
  if (file) {
    lines.push(file);
  }

  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: lines.join("\n") }
    },
    {
      type: "actions",
      block_id: `review:${review.id}`,
      elements: [
        {
          type: "button",
          action_id: `${REVIEW_ACCEPT_ACTION}:${review.id}`,
          text: { type: "plain_text", text: "Accept", emoji: true },
          style: "primary",
          value: review.id
        },
        {
          type: "button",
          action_id: `${REVIEW_REJECT_ACTION}:${review.id}`,
          text: { type: "plain_text", text: "Reject", emoji: true },
          style: "danger",
          value: review.id
        }
      ]
    },
    { type: "divider" }
  ];
}

export function buildPendingReviewsReminderMessage(input: {
  name: string;
  reviews: ReviewWithUsers[];
}): { text: string; blocks: unknown[] } {
  const count = input.reviews.length;
  // Slack caps at 50 blocks; each review uses 3, so keep a safe cap.
  const MAX = 10;
  const shown = input.reviews.slice(0, MAX);

  const text = `You have ${count} pending review${count === 1 ? "" : "s"} waiting for you.`;
  const blocks: unknown[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Hey ${input.name} 👋\nYou have *${count}* pending review${count === 1 ? "" : "s"} waiting for your accept/reject. Respond right here:`
      }
    },
    { type: "divider" }
  ];

  for (const review of shown) {
    blocks.push(...pendingReviewBlocks(review));
  }

  if (count > MAX) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `…and ${count - MAX} more. <${appReviewUrl()}|Open all in Bran>`
        }
      ]
    });
  }

  return { text, blocks };
}

export async function sendPendingReviewsReminderDm(input: {
  email: string;
  name: string;
  reviews: ReviewWithUsers[];
}): Promise<boolean> {
  if (!env.slackBotToken || input.reviews.length === 0) return false;

  const slackUser = await lookupSlackUserByEmail(input.email);
  if (!slackUser?.id) return false;

  const { text, blocks } = buildPendingReviewsReminderMessage({
    name: input.name,
    reviews: input.reviews
  });
  await sendDmWithBlocks(slackUser.id, text, blocks);
  return true;
}

const REVIEW_QUERY_RE =
  /\b(pending reviews?|my reviews?|review requests?|reviews? (for me|waiting|pending)|list (my )?reviews?)\b/i;

export function looksLikeReviewQuery(text: string): boolean {
  const trimmed = stripSlackUserMentions(text);
  return Boolean(trimmed && REVIEW_QUERY_RE.test(trimmed));
}

export async function processSlackReviewMessage(input: {
  channelId: string;
  userId: string;
  text?: string;
  ts: string;
  channelType?: string;
  eventType?: string;
}): Promise<{ handled: boolean; reason?: string }> {
  const text = input.text ?? "";
  if (!looksLikeReviewQuery(text)) {
    return { handled: false, reason: "not_review_query" };
  }

  const isDm = isSlackDmChannel(input.channelId, input.channelType);
  if (!isDm) {
    const botUserId = await getSlackBotUserId();
    const addressed =
      input.eventType === "app_mention" ||
      (botUserId ? textMentionsSlackUser(text, botUserId) : false);
    if (!addressed) {
      return { handled: false, reason: "not_addressed" };
    }
  }

  const branUserId = await resolveBranUserIdForSlackUser(input.userId);
  if (!branUserId) {
    await postSlackMessage(
      input.channelId,
      "I couldn't match your Slack account to a Bran user. Ask an admin to add your email in Bran."
    );
    return { handled: true, reason: "no_bran_user" };
  }

  const pending = await listPendingIncoming(branUserId);
  if (pending.length === 0) {
    await postSlackMessage(
      input.channelId,
      "You have no pending review requests. Nice inbox zero ✨"
    );
    return { handled: true, reason: "none_pending" };
  }

  const { text: replyText, blocks } = buildPendingReviewsReminderMessage({
    name: pending[0]?.requestedTo.name ?? "there",
    reviews: pending
  });
  await postSlackMessage(input.channelId, replyText, { blocks });
  return { handled: true, reason: "listed" };
}

export function parseReviewActionId(
  actionId: string
): { decision: "accepted" | "rejected"; reviewId: string } | null {
  if (actionId.startsWith(`${REVIEW_ACCEPT_ACTION}:`)) {
    return { decision: "accepted", reviewId: actionId.slice(REVIEW_ACCEPT_ACTION.length + 1) };
  }
  if (actionId.startsWith(`${REVIEW_REJECT_ACTION}:`)) {
    return { decision: "rejected", reviewId: actionId.slice(REVIEW_REJECT_ACTION.length + 1) };
  }
  return null;
}

/**
 * Extract a leading Slack user mention from slash-command text.
 * Slack sends escaped mentions like `<@U12345|name>` when the command has
 * "Escape channels, users, and links" enabled.
 */
export function parseSlashCommandInput(text: string): {
  initialSlackUserId?: string;
  context: string;
} {
  const trimmed = (text ?? "").trim();
  const match = trimmed.match(/^<@([A-Z0-9]+)(?:\|[^>]+)?>\s*/i);
  if (match) {
    return {
      initialSlackUserId: match[1],
      context: trimmed.slice(match[0].length).trim()
    };
  }
  return { context: trimmed };
}

export function buildReviewCreateModal(input: {
  initialSlackUserId?: string;
  context?: string;
}): Record<string, unknown> {
  const userElement: Record<string, unknown> = {
    type: "users_select",
    action_id: REVIEW_CREATE_USER_ACTION_ID,
    placeholder: { type: "plain_text", text: "Pick a teammate", emoji: true }
  };
  if (input.initialSlackUserId) {
    userElement.initial_user = input.initialSlackUserId;
  }

  const contextElement: Record<string, unknown> = {
    type: "plain_text_input",
    action_id: REVIEW_CREATE_CONTEXT_ACTION_ID,
    multiline: true,
    min_length: 1,
    max_length: 3000,
    placeholder: { type: "plain_text", text: "What should they review? Any notes…" }
  };
  if (input.context) {
    contextElement.initial_value = input.context.slice(0, 3000);
  }

  return {
    type: "modal",
    callback_id: REVIEW_CREATE_CALLBACK_ID,
    title: { type: "plain_text", text: "Request a review", emoji: true },
    submit: { type: "plain_text", text: "Send", emoji: true },
    close: { type: "plain_text", text: "Cancel", emoji: true },
    blocks: [
      {
        type: "input",
        block_id: REVIEW_CREATE_USER_BLOCK_ID,
        label: { type: "plain_text", text: "Request review from", emoji: true },
        element: userElement
      },
      {
        type: "input",
        block_id: REVIEW_CREATE_CONTEXT_BLOCK_ID,
        label: { type: "plain_text", text: "Context", emoji: true },
        element: contextElement
      },
      {
        type: "input",
        block_id: REVIEW_CREATE_FILE_BLOCK_ID,
        label: { type: "plain_text", text: "File link", emoji: true },
        element: {
          type: "plain_text_input",
          action_id: REVIEW_CREATE_FILE_ACTION_ID,
          placeholder: { type: "plain_text", text: "https://… (Drive, Notion, etc.)" }
        }
      }
    ]
  };
}

export async function openReviewCreateModal(input: {
  triggerId: string;
  initialSlackUserId?: string;
  context?: string;
}): Promise<void> {
  await openSlackModal(
    input.triggerId,
    buildReviewCreateModal({
      initialSlackUserId: input.initialSlackUserId,
      context: input.context
    })
  );
}
