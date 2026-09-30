import { postSlackMessage } from "../attendance/attendance.slack";
import { isSlackDmChannel } from "../work/work.slack-voice";
import { resolveBranUserIdForSlackUser } from "../work/work.slack";
import { rebuildGmailPendingReplies } from "./pending-replies.gmail";
import { formatPendingRepliesForUser } from "./pending-replies.service";

export function looksLikePendingRepliesQuery(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  return (
    /^(?:show\s+)?my\s*repl(?:y|ies)$/.test(normalized) ||
    /\b(who|what)\b.{0,35}\b(reply|respond|follow up|follow-up)\b/.test(normalized) ||
    /\b(reply|respond)\b.{0,20}\b(pending|waiting|owe|need|have to|should)\b/.test(normalized) ||
    /\b(pending|unanswered)\b.{0,15}\b(messages?|replies|emails?)\b/.test(normalized) ||
    /\b(messages?|emails?|threads?)\b.{0,25}\b(waiting on me|should i (reply|respond)|need (a )?(reply|response))\b/.test(normalized) ||
    /\bwhich\b.{0,20}\b(messages?|emails?|threads?)\b.{0,20}\b(reply|respond)\b/.test(normalized) ||
    /\bwho('?s| is) waiting on me\b/.test(normalized)
  );
}

export async function processSlackPendingRepliesMessage(input: {
  channelId: string;
  userId: string;
  text?: string;
  ts: string;
  channelType?: string;
  threadTs?: string;
  force?: boolean;
}): Promise<{ handled: boolean; reason?: string }> {
  if (!input.force && !looksLikePendingRepliesQuery(input.text ?? "")) {
    return { handled: false, reason: "not_pending_replies_query" };
  }
  if (!isSlackDmChannel(input.channelId, input.channelType)) {
    await postSlackMessage(input.channelId, "That list is private. DM me and ask who you need to reply to.", {
      threadTs: input.threadTs ?? input.ts
    });
    return { handled: true, reason: "dm_only" };
  }

  const branUserId = await resolveBranUserIdForSlackUser(input.userId);
  if (!branUserId) {
    await postSlackMessage(input.channelId, "I couldn’t match your Slack account to an active Bran account.", {
      threadTs: input.threadTs ?? input.ts
    });
    return { handled: true, reason: "unlinked_user" };
  }

  // Backfills/upgrades the private ledger from already-synced Gmail rows. No
  // cross-user lookup is possible because the Bran user id is mandatory.
  await rebuildGmailPendingReplies(branUserId);
  const text = await formatPendingRepliesForUser(branUserId);
  await postSlackMessage(input.channelId, text, { threadTs: input.threadTs });
  return { handled: true };
}
