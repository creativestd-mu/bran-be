import { env } from "../../config/env";
import { listPendingRepliesForUser } from "./pending-replies.repository";

const TWO_WEEKS_MS = 14 * 86_400_000;
const SUMMARY_MAX_LENGTH = 140;

type ReplySummaryInput = {
  source: string;
  subject: string | null;
  snippet: string | null;
};

export function formatMessageTimestamp(date: Date, timeZone = env.appTimezone): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short"
  }).format(date);
}

function cleanSlackText(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<@([A-Z0-9]+)>/g, "@$1")
    .replace(/<https?:\/\/[^|>]+\|([^>]+)>/g, "$1")
    .replace(/<((?:https?:\/\/)[^>]+)>/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(value: string, max = SUMMARY_MAX_LENGTH): string {
  const compact = value.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/** Turn raw message content into a short description of the response needed. */
export function summarizeReplyNeed(reply: ReplySummaryInput): string {
  const subject = cleanSlackText(reply.subject)?.replace(/^(?:re|fwd?):\s*/i, "") ?? null;
  if (reply.source === "GMAIL" && subject) {
    return `Respond about “${shorten(subject, 100)}”.`;
  }

  const raw = cleanSlackText(reply.snippet) ?? "";
  const withoutQuote = raw
    .split(/\bOn .{0,160} wrote:/i)[0]
    .replace(/^@[A-Z0-9]+\s*/i, "")
    .trim();
  const withoutUrls = withoutQuote.replace(/https?:\/\/\S+/g, "").trim();
  if (!withoutUrls && /https?:\/\//i.test(withoutQuote)) {
    return "Review the shared link and respond if needed.";
  }

  const when = withoutUrls.match(/^when (?:will|can|could|would) you\s+(.+?)(?:\?|$)/i);
  if (when?.[1]) return `Confirm when you will ${shorten(when[1], 105).toLowerCase()}.`;

  const request = withoutUrls.match(/^(?:please\s+|(?:can|could|would|will) you\s+)(.+?)(?:\?|$)/i);
  if (request?.[1]) return `Respond to the request to ${shorten(request[1], 105).toLowerCase()}.`;

  const firstThought = withoutUrls.split(/(?:[.!?]\s+|,\s+(?:and\s+)?(?:i need|by|before)\b)/i)[0];
  return firstThought
    ? `Reply about: ${shorten(firstThought)}.`
    : "Review the conversation and respond if needed.";
}

/** Private by construction: callers must supply the authenticated/requesting user's id. */
export async function formatPendingRepliesForUser(userId: string, now = new Date()): Promise<string> {
  const replies = await listPendingRepliesForUser(userId, 10, new Date(now.getTime() - TWO_WEEKS_MS));
  if (replies.length === 0) {
    return "You’re all caught up — I couldn’t find any Slack or Gmail conversations from the last two weeks waiting on your reply.";
  }

  const lines = replies.map((reply, index) => {
    const who = reply.senderName || reply.senderAddress || "Someone";
    const location =
      reply.source === "GMAIL"
        ? `Gmail${reply.subject ? ` — ${reply.subject}` : ""}`
        : reply.conversationKind === "SLACK_DM"
          ? "Slack DM"
          : `Slack thread${reply.channelName ? ` in #${reply.channelName}` : ""}`;
    const summary = summarizeReplyNeed(reply);
    return `${index + 1}. *${who}* — ${location}\n   Sent: ${formatMessageTimestamp(reply.lastMessageAt)}\n   _${summary}_`;
  });

  const suffix = replies.length === 10 ? "\n\nShowing the 10 most recent." : "";
  return `These conversations from the last two weeks look like they’re waiting on you (newest first):\n\n${lines.join("\n")} ${suffix}`.trim();
}
