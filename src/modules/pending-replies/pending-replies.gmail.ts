import { prisma } from "../../lib/prisma";
import {
  replacePendingRepliesForUser,
  type PendingReplyCandidate
} from "./pending-replies.repository";

const AUTOMATED_SENDER_RE = /\b(no[-_. ]?reply|do[-_. ]?not[-_. ]?reply|mailer[-_. ]?daemon|notifications?|newsletter|digest|updates?|alerts?)\b/i;
const AUTOMATED_CONTENT_RE = /\b(unsubscribe|view in browser|email preferences|verification code|one[- ]time pass(?:word|code)|security alert|order confirmation|payment receipt|weekly digest|daily digest)\b/i;
const BULK_LABELS = new Set([
  "CATEGORY_PROMOTIONS",
  "CATEGORY_SOCIAL",
  "CATEGORY_FORUMS",
  "CATEGORY_UPDATES",
  "SPAM",
  "TRASH"
]);
const RESPONSE_CUE_RE = /\?|\b(please|could you|can you|would you|will you|let me know|your thoughts|your feedback|need your|waiting for|confirm|approve|review|respond|reply|send|share|update me|when can|what do you|how should|are you|do you)\b/i;
const CLOSURE_RE = /^\s*(thanks|thank you|noted|got it|sounds good|okay|ok|will do|received|perfect|great)[.!\s🙏👍✅]*$/iu;
const WORK_CONTEXT_RE = /\b(work|team|project|client|campaign|deck|brief|review|approval|deadline|meeting|call|schedule|task|deliverable|content|shoot|edit|design|document|proposal|contract|budget|report|analytics|launch|brand|social|post|creative|script|video|website|app|invoice)\b/i;
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com"
]);

type GmailReplyMessage = {
  gmailMessageId: string;
  threadId: string | null;
  subject: string | null;
  fromAddress: string | null;
  toAddresses: string | null;
  snippet: string | null;
  bodyText: string | null;
  labelIds: string | null;
};

function parseLabels(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function extractEmail(value: string | null): string | null {
  if (!value) return null;
  const bracketed = value.match(/<([^>]+)>/);
  const candidate = (bracketed?.[1] ?? value).trim().toLowerCase();
  const match = candidate.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+/i);
  return match?.[0]?.toLowerCase() ?? null;
}

function emailDomain(email: string | null): string | null {
  if (!email) return null;
  return email.split("@")[1]?.toLowerCase() ?? null;
}

function isSentByUser(message: GmailReplyMessage, ownEmails: Set<string>): boolean {
  const labels = parseLabels(message.labelIds);
  const sender = extractEmail(message.fromAddress);
  return labels.includes("SENT") || Boolean(sender && ownEmails.has(sender));
}

/**
 * Conservative, local-only relevance filter. A latest inbound email must be a
 * direct inbox message from a human, have a response cue, and carry credible
 * work context. Existing thread participation strengthens reply intent but is
 * not enough by itself to turn personal mail into work.
 */
export function shouldRecommendGmailReply(
  message: GmailReplyMessage,
  threadMessages: GmailReplyMessage[],
  ownEmails: Set<string>
): boolean {
  const labels = parseLabels(message.labelIds);
  const senderAddress = extractEmail(message.fromAddress);
  if (isSentByUser(message, ownEmails)) return false;
  if (!labels.includes("INBOX") || labels.some((label) => BULK_LABELS.has(label))) return false;
  if (!senderAddress || AUTOMATED_SENDER_RE.test(message.fromAddress ?? senderAddress)) return false;

  const recipients = (message.toAddresses ?? "").toLowerCase();
  if (![...ownEmails].some((email) => recipients.includes(email))) return false;

  const messageText = [message.snippet, message.bodyText]
    .filter((value): value is string => Boolean(value))
    .join("\n")
    .trim();
  const content = [message.subject, messageText]
    .filter((value): value is string => Boolean(value))
    .join("\n")
    .trim();
  if (!messageText || AUTOMATED_CONTENT_RE.test(content) || CLOSURE_RE.test(messageText)) return false;

  const hasResponseCue = RESPONSE_CUE_RE.test(messageText);
  const userParticipated = threadMessages.some((item) => isSentByUser(item, ownEmails));
  if (!hasResponseCue && !userParticipated) return false;

  const senderDomain = emailDomain(senderAddress);
  const ownDomains = new Set([...ownEmails].map(emailDomain).filter((value): value is string => Boolean(value)));
  const sameWorkDomain = Boolean(senderDomain && ownDomains.has(senderDomain));
  const businessDomain = Boolean(senderDomain && !PERSONAL_EMAIL_DOMAINS.has(senderDomain));
  const explicitWorkContext = WORK_CONTEXT_RE.test(content);

  return sameWorkDomain || businessDomain || explicitWorkContext;
}

function extractName(value: string | null): string | null {
  if (!value) return null;
  const name = value.replace(/<[^>]+>/g, "").replace(/^['"]|['"]$/g, "").trim();
  return name || extractEmail(value);
}

function truncate(value: string | null, max = 360): string | null {
  if (!value) return null;
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`;
}

/** Rebuild private Gmail reply candidates from the user's own synced mailbox only. */
export async function rebuildGmailPendingReplies(userId: string): Promise<number> {
  const connection = await prisma.gmailConnection.findUnique({
    where: { userId },
    include: {
      user: { select: { email: true } },
      messages: { orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }] }
    }
  });

  if (!connection || connection.status === "DISCONNECTED") {
    await replacePendingRepliesForUser(userId, "GMAIL", []);
    return 0;
  }

  const ownEmails = new Set(
    [connection.oauthEmail, connection.user.email]
      .map(extractEmail)
      .filter((email): email is string => Boolean(email))
  );
  const seenThreads = new Set<string>();
  const candidates: PendingReplyCandidate[] = [];
  const messagesByThread = new Map<string, GmailReplyMessage[]>();

  for (const message of connection.messages) {
    const conversationId = message.threadId ?? message.gmailMessageId;
    const thread = messagesByThread.get(conversationId) ?? [];
    thread.push(message);
    messagesByThread.set(conversationId, thread);
  }

  for (const message of connection.messages) {
    const conversationId = message.threadId ?? message.gmailMessageId;
    if (seenThreads.has(conversationId)) continue;
    seenThreads.add(conversationId);

    const senderAddress = extractEmail(message.fromAddress);
    if (!shouldRecommendGmailReply(message, messagesByThread.get(conversationId) ?? [message], ownEmails)) {
      continue;
    }

    candidates.push({
      conversationExternalId: conversationId,
      conversationKind: "EMAIL_THREAD",
      senderName: extractName(message.fromAddress),
      senderAddress,
      subject: truncate(message.subject, 1000),
      snippet: truncate(message.snippet ?? message.bodyText),
      lastMessageAt: message.receivedAt ?? message.createdAt
    });
  }

  await replacePendingRepliesForUser(userId, "GMAIL", candidates);
  return candidates.length;
}
