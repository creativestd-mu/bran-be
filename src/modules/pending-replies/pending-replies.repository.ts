import { prisma } from "../../lib/prisma";

export type PendingReplySource = "GMAIL" | "SLACK";

export type PendingReplyCandidate = {
  conversationExternalId: string;
  conversationKind: "EMAIL_THREAD" | "SLACK_DM" | "SLACK_THREAD";
  senderExternalId?: string | null;
  senderName?: string | null;
  senderAddress?: string | null;
  subject?: string | null;
  snippet?: string | null;
  channelId?: string | null;
  channelName?: string | null;
  threadTs?: string | null;
  lastMessageAt: Date;
};

/**
 * Atomically replaces one user's materialized reply list for one source.
 * The user id is mandatory at this lowest layer so callers cannot accidentally
 * read or overwrite another user's private communication data.
 */
export async function replacePendingRepliesForUser(
  userId: string,
  source: PendingReplySource,
  candidates: PendingReplyCandidate[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.pendingReply.deleteMany({ where: { userId, source } });
    if (candidates.length === 0) return;
    await tx.pendingReply.createMany({
      data: candidates.map((candidate) => ({
        userId,
        source,
        ...candidate
      })),
      skipDuplicates: true
    });
  });
}

export async function listPendingRepliesForUser(
  userId: string,
  limit = 10,
  since = new Date(Date.now() - 14 * 86_400_000)
) {
  return prisma.pendingReply.findMany({
    where: { userId, lastMessageAt: { gte: since } },
    orderBy: [{ lastMessageAt: "desc" }, { id: "asc" }],
    take: Math.min(Math.max(limit, 1), 25)
  });
}
