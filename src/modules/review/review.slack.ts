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

export function buildPendingReviewsReminderMessage(input: {
  name: string;
  reviews: ReviewWithUsers[];
}): { text: string; blocks: unknown[] } {
  const count = input.reviews.length;
  const lines = input.reviews.slice(0, 8).map((r, i) => {
    const from = r.requestedBy.name;
    const snippet = truncate(r.context.replace(/\s+/g, " "), 80);
    return `${i + 1}. From *${from}*: ${snippet}`;
  });
  if (count > 8) {
    lines.push(`…and ${count - 8} more`);
  }

  const text = `You have ${count} pending review${count === 1 ? "" : "s"} waiting for you.`;
  const blocks: unknown[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Hey ${input.name} 👋\nYou have *${count}* pending review${count === 1 ? "" : "s"} waiting for your accept/reject.`
      }
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: lines.join("\n") }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open Reviews", emoji: true },
          url: appReviewUrl()
        }
      ]
    }
  ];

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
