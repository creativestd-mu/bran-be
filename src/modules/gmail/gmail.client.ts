import type { gmail_v1 } from "googleapis";
import { google } from "googleapis";

import { HttpError } from "../../utils/httpError";
import { GMAIL_BODY_TEXT_MAX_CHARS } from "./gmail.constants";
import { createGmailOAuthClient } from "./gmail-oauth.client";

export interface ParsedGmailMessage {
  gmailMessageId: string;
  threadId: string | null;
  subject: string | null;
  fromAddress: string | null;
  toAddresses: string | null;
  snippet: string | null;
  bodyText: string | null;
  labelIds: string[];
  receivedAt: Date | null;
  isRead: boolean;
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function truncateBody(text: string | null): string | null {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= GMAIL_BODY_TEXT_MAX_CHARS) return normalized;
  return `${normalized.slice(0, GMAIL_BODY_TEXT_MAX_CHARS)}…`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string | null {
  const match = headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase());
  return match?.value ?? null;
}

function extractBodyText(payload: gmail_v1.Schema$MessagePart | undefined): string | null {
  if (!payload) return null;

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  for (const part of payload.parts ?? []) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }

  for (const part of payload.parts ?? []) {
    const nested = extractBodyText(part);
    if (nested) return nested;
  }

  if (payload.mimeType === "text/html" && payload.body?.data) {
    return stripHtml(decodeBase64Url(payload.body.data));
  }

  for (const part of payload.parts ?? []) {
    if (part.mimeType === "text/html" && part.body?.data) {
      return stripHtml(decodeBase64Url(part.body.data));
    }
  }

  if (payload.body?.data && !payload.mimeType?.startsWith("multipart/")) {
    return decodeBase64Url(payload.body.data);
  }

  return null;
}

function parseGmailMessage(message: gmail_v1.Schema$Message): ParsedGmailMessage {
  const headers = message.payload?.headers;
  const internalDateMs = message.internalDate ? Number(message.internalDate) : NaN;
  const receivedHeader = getHeader(headers, "Date");
  const fromHeader = receivedHeader ? new Date(receivedHeader) : null;
  const receivedAt = !Number.isNaN(internalDateMs)
    ? new Date(internalDateMs)
    : fromHeader && !Number.isNaN(fromHeader.getTime())
      ? fromHeader
      : null;
  const labelIds = message.labelIds ?? [];

  return {
    gmailMessageId: message.id ?? "",
    threadId: message.threadId ?? null,
    subject: getHeader(headers, "Subject"),
    fromAddress: getHeader(headers, "From"),
    toAddresses: getHeader(headers, "To"),
    snippet: message.snippet ?? null,
    bodyText: truncateBody(extractBodyText(message.payload)),
    labelIds,
    receivedAt,
    isRead: !labelIds.includes("UNREAD")
  };
}

function getGmailClient(refreshToken: string): gmail_v1.Gmail {
  const auth = createGmailOAuthClient(refreshToken);
  return google.gmail({ version: "v1", auth });
}

export async function fetchGmailProfile(refreshToken: string): Promise<{
  emailAddress: string | null;
  historyId: string | null;
}> {
  const gmail = getGmailClient(refreshToken);
  const response = await gmail.users.getProfile({ userId: "me" });
  return {
    emailAddress: response.data.emailAddress ?? null,
    historyId: response.data.historyId ?? null
  };
}

export async function listRecentGmailMessages(
  refreshToken: string,
  options: { maxResults?: number; query?: string }
): Promise<string[]> {
  const gmail = getGmailClient(refreshToken);
  const maxResults = Math.min(Math.max(options.maxResults ?? 50, 1), 500);
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const response = await gmail.users.messages.list({
      userId: "me",
      maxResults: Math.min(100, maxResults - ids.length),
      q: options.query,
      pageToken
    });

    for (const message of response.data.messages ?? []) {
      if (message.id) ids.push(message.id);
      if (ids.length >= maxResults) break;
    }

    pageToken =
      ids.length >= maxResults ? undefined : (response.data.nextPageToken ?? undefined);
  } while (pageToken);

  return ids;
}

export async function fetchGmailMessage(
  refreshToken: string,
  messageId: string
): Promise<ParsedGmailMessage> {
  const gmail = getGmailClient(refreshToken);
  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full"
  });

  if (!response.data.id) {
    throw new HttpError(502, "Gmail returned a message without an id");
  }

  return parseGmailMessage(response.data);
}

export async function listGmailHistoryMessageIds(
  refreshToken: string,
  startHistoryId: string,
  options: { maxResults?: number } = {}
): Promise<{ messageIds: string[]; historyId: string | null }> {
  const gmail = getGmailClient(refreshToken);
  const maxResults = Math.min(Math.max(options.maxResults ?? 50, 1), 500);
  const messageIds = new Set<string>();
  let pageToken: string | undefined;
  let latestHistoryId: string | null = null;

  do {
    const response = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
      pageToken,
      maxResults: 100
    });

    latestHistoryId = response.data.historyId ?? latestHistoryId;

    for (const record of response.data.history ?? []) {
      for (const added of record.messagesAdded ?? []) {
        if (added.message?.id) {
          messageIds.add(added.message.id);
        }
        if (messageIds.size >= maxResults) break;
      }
      if (messageIds.size >= maxResults) break;
    }

    pageToken =
      messageIds.size >= maxResults ? undefined : (response.data.nextPageToken ?? undefined);
  } while (pageToken);

  return {
    messageIds: [...messageIds].slice(0, maxResults),
    historyId: latestHistoryId
  };
}

/** Run async tasks with a fixed concurrency limit. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current]);
    }
  }

  const pool = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(pool);
  return results;
}
