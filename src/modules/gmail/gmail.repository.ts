import { prisma } from "../../lib/prisma";
import { GMAIL_SYNCABLE_STATUSES } from "./gmail.constants";
import type { ParsedGmailMessage } from "./gmail.client";

export async function findGmailConnectionByUserId(userId: string) {
  return prisma.gmailConnection.findUnique({ where: { userId } });
}

export async function listSyncableGmailConnections() {
  return prisma.gmailConnection.findMany({
    where: { status: { in: [...GMAIL_SYNCABLE_STATUSES] } },
    select: {
      id: true,
      userId: true,
      refreshToken: true,
      historyId: true,
      status: true
    }
  });
}

export async function upsertGmailConnection(data: {
  userId: string;
  refreshToken: string;
  oauthEmail?: string | null;
  historyId?: string | null;
  status?: string;
}) {
  return prisma.gmailConnection.upsert({
    where: { userId: data.userId },
    create: {
      userId: data.userId,
      refreshToken: data.refreshToken,
      oauthEmail: data.oauthEmail ?? null,
      historyId: data.historyId ?? null,
      status: data.status ?? "CONNECTED",
      connectedAt: new Date(),
      disconnectedAt: null,
      errorMessage: null
    },
    update: {
      refreshToken: data.refreshToken,
      oauthEmail: data.oauthEmail ?? null,
      // On reconnect, clear history so the next sync does a recent backfill.
      historyId: data.historyId ?? null,
      status: data.status ?? "CONNECTED",
      connectedAt: new Date(),
      disconnectedAt: null,
      errorMessage: null
    }
  });
}

export async function updateGmailConnection(
  userId: string,
  data: {
    status?: string;
    historyId?: string | null;
    lastSyncedAt?: Date | null;
    oauthEmail?: string | null;
    errorMessage?: string | null;
    disconnectedAt?: Date | null;
    refreshToken?: string;
  }
) {
  return prisma.gmailConnection.update({
    where: { userId },
    data
  });
}

export async function deleteGmailConnection(userId: string) {
  return prisma.gmailConnection.delete({ where: { userId } });
}

export async function upsertGmailMessage(connectionId: string, message: ParsedGmailMessage) {
  return prisma.gmailMessage.upsert({
    where: {
      connectionId_gmailMessageId: {
        connectionId,
        gmailMessageId: message.gmailMessageId
      }
    },
    create: {
      connectionId,
      gmailMessageId: message.gmailMessageId,
      threadId: message.threadId,
      subject: message.subject,
      fromAddress: message.fromAddress,
      toAddresses: message.toAddresses,
      snippet: message.snippet,
      bodyText: message.bodyText,
      labelIds: message.labelIds.length > 0 ? JSON.stringify(message.labelIds) : null,
      receivedAt: message.receivedAt,
      isRead: message.isRead
    },
    update: {
      threadId: message.threadId,
      subject: message.subject,
      fromAddress: message.fromAddress,
      toAddresses: message.toAddresses,
      snippet: message.snippet,
      bodyText: message.bodyText,
      labelIds: message.labelIds.length > 0 ? JSON.stringify(message.labelIds) : null,
      receivedAt: message.receivedAt,
      isRead: message.isRead
    }
  });
}

export async function listGmailMessagesForUser(
  userId: string,
  options?: { limit?: number; q?: string }
) {
  const connection = await findGmailConnectionByUserId(userId);
  if (!connection) return [];

  const limit = options?.limit ?? 50;
  const q = options?.q?.trim();

  return prisma.gmailMessage.findMany({
    where: {
      connectionId: connection.id,
      ...(q
        ? {
            OR: [
              { subject: { contains: q, mode: "insensitive" } },
              { fromAddress: { contains: q, mode: "insensitive" } },
              { snippet: { contains: q, mode: "insensitive" } }
            ]
          }
        : {})
    },
    orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
    take: limit
  });
}

export function formatGmailMessageResponse(message: {
  id: string;
  gmailMessageId: string;
  threadId: string | null;
  subject: string | null;
  fromAddress: string | null;
  toAddresses: string | null;
  snippet: string | null;
  bodyText: string | null;
  labelIds: string | null;
  receivedAt: Date | null;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  let labelIds: string[] = [];
  if (message.labelIds) {
    try {
      const parsed = JSON.parse(message.labelIds) as unknown;
      if (Array.isArray(parsed)) {
        labelIds = parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      labelIds = [];
    }
  }

  return {
    id: message.id,
    gmailMessageId: message.gmailMessageId,
    threadId: message.threadId,
    subject: message.subject,
    fromAddress: message.fromAddress,
    toAddresses: message.toAddresses,
    snippet: message.snippet,
    bodyText: message.bodyText,
    labelIds,
    receivedAt: message.receivedAt?.toISOString() ?? null,
    isRead: message.isRead,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString()
  };
}
