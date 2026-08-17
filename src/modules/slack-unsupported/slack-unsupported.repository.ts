import { prisma } from "../../lib/prisma";

export async function upsertUnsupportedSlackQuery(data: {
  slackUserId: string;
  branUserId?: string | null;
  channelId: string;
  channelType?: string | null;
  threadTs?: string | null;
  messageTs: string;
  text: string;
  eventType?: string | null;
  isDm: boolean;
  reason?: string | null;
}) {
  return prisma.unsupportedSlackQuery.upsert({
    where: {
      channelId_messageTs: {
        channelId: data.channelId,
        messageTs: data.messageTs
      }
    },
    create: {
      slackUserId: data.slackUserId,
      branUserId: data.branUserId ?? null,
      channelId: data.channelId,
      channelType: data.channelType ?? null,
      threadTs: data.threadTs ?? null,
      messageTs: data.messageTs,
      text: data.text,
      eventType: data.eventType ?? null,
      isDm: data.isDm,
      reason: data.reason ?? null,
      status: "NEW"
    },
    update: {
      text: data.text,
      reason: data.reason ?? null,
      branUserId: data.branUserId ?? null,
      channelType: data.channelType ?? null,
      threadTs: data.threadTs ?? null,
      eventType: data.eventType ?? null,
      isDm: data.isDm
    }
  });
}

export async function listUnsupportedSlackQueries(filters: {
  status?: string;
  limit?: number;
}) {
  return prisma.unsupportedSlackQuery.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {})
    },
    include: {
      branUser: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 50
  });
}

export async function updateUnsupportedSlackQueryStatus(
  id: string,
  status: "NEW" | "REVIEWED" | "DISMISSED"
) {
  return prisma.unsupportedSlackQuery.update({
    where: { id },
    data: { status },
    include: {
      branUser: { select: { id: true, name: true, email: true } }
    }
  });
}
