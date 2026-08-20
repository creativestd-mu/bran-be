import type { Prisma, ReviewStatus } from "@prisma/client";

import { prisma } from "../../lib/prisma";
import { DEFAULT_REVIEW_REMINDER_TIMES } from "./review.constants";

const userSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true
} as const;

export type ReviewWithUsers = Prisma.ReviewRequestGetPayload<{
  include: {
    requestedBy: { select: typeof userSelect };
    requestedTo: { select: typeof userSelect };
  };
}>;

export async function findActiveUserById(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, isActive: true, isPlaceholder: false },
    select: userSelect
  });
}

export async function createReviewRequest(input: {
  requestedById: string;
  requestedToId: string;
  context: string;
  fileUrl?: string | null;
  storagePath?: string | null;
  fileName?: string | null;
  contentType?: string | null;
}): Promise<ReviewWithUsers> {
  return prisma.reviewRequest.create({
    data: {
      requestedById: input.requestedById,
      requestedToId: input.requestedToId,
      context: input.context,
      fileUrl: input.fileUrl ?? null,
      storagePath: input.storagePath ?? null,
      fileName: input.fileName ?? null,
      contentType: input.contentType ?? null
    },
    include: {
      requestedBy: { select: userSelect },
      requestedTo: { select: userSelect }
    }
  });
}

export async function findReviewById(id: string): Promise<ReviewWithUsers | null> {
  return prisma.reviewRequest.findUnique({
    where: { id },
    include: {
      requestedBy: { select: userSelect },
      requestedTo: { select: userSelect }
    }
  });
}

export async function listReviewsForUser(input: {
  userId: string;
  direction: "incoming" | "outgoing" | "all";
  status: ReviewStatus | "all";
}): Promise<ReviewWithUsers[]> {
  const where: Prisma.ReviewRequestWhereInput = {};

  if (input.direction === "incoming") {
    where.requestedToId = input.userId;
  } else if (input.direction === "outgoing") {
    where.requestedById = input.userId;
  } else {
    where.OR = [{ requestedById: input.userId }, { requestedToId: input.userId }];
  }

  if (input.status !== "all") {
    where.status = input.status;
  }

  return prisma.reviewRequest.findMany({
    where,
    include: {
      requestedBy: { select: userSelect },
      requestedTo: { select: userSelect }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function respondToReview(input: {
  id: string;
  status: "accepted" | "rejected";
  responseComment: string;
  respondedAt: Date;
}): Promise<ReviewWithUsers> {
  return prisma.reviewRequest.update({
    where: { id: input.id },
    data: {
      status: input.status,
      responseComment: input.responseComment,
      respondedAt: input.respondedAt
    },
    include: {
      requestedBy: { select: userSelect },
      requestedTo: { select: userSelect }
    }
  });
}

export async function setReviewSlackMessage(input: {
  id: string;
  slackChannelId: string;
  slackMessageTs: string;
}): Promise<void> {
  await prisma.reviewRequest.update({
    where: { id: input.id },
    data: {
      slackChannelId: input.slackChannelId,
      slackMessageTs: input.slackMessageTs
    }
  });
}

export async function countPendingIncoming(userId: string): Promise<number> {
  return prisma.reviewRequest.count({
    where: { requestedToId: userId, status: "pending" }
  });
}

export async function listPendingIncoming(userId: string): Promise<ReviewWithUsers[]> {
  return prisma.reviewRequest.findMany({
    where: { requestedToId: userId, status: "pending" },
    include: {
      requestedBy: { select: userSelect },
      requestedTo: { select: userSelect }
    },
    orderBy: { createdAt: "asc" }
  });
}

export async function getReminderPreference(userId: string) {
  return prisma.reviewReminderPreference.findUnique({ where: { userId } });
}

export async function upsertReminderPreference(input: {
  userId: string;
  times: string[];
  enabled: boolean;
}) {
  return prisma.reviewReminderPreference.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      times: input.times,
      enabled: input.enabled
    },
    update: {
      times: input.times,
      enabled: input.enabled
    }
  });
}

export async function markReminderSent(input: {
  userId: string;
  slot: string;
  dateIst: string;
}): Promise<void> {
  await prisma.reviewReminderPreference.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      times: [...DEFAULT_REVIEW_REMINDER_TIMES],
      enabled: true,
      lastRemindedSlot: input.slot,
      lastRemindedOn: input.dateIst
    },
    update: {
      lastRemindedSlot: input.slot,
      lastRemindedOn: input.dateIst
    }
  });
}

/**
 * Users who should receive a reminder for the current IST slot:
 * - have at least one pending incoming review
 * - preference enabled (or no row → defaults)
 * - times include the slot (or no row → defaults)
 * - not already reminded for this slot today
 */
export async function listUsersNeedingReminder(slot: string, dateIst: string) {
  const pendingByUser = await prisma.reviewRequest.groupBy({
    by: ["requestedToId"],
    where: { status: "pending" },
    _count: { _all: true }
  });

  if (pendingByUser.length === 0) return [];

  const userIds = pendingByUser.map((row) => row.requestedToId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, isActive: true, isPlaceholder: false },
    select: { id: true, email: true, name: true }
  });
  const prefs = await prisma.reviewReminderPreference.findMany({
    where: { userId: { in: userIds } }
  });
  const prefByUser = new Map(prefs.map((p) => [p.userId, p]));
  const countByUser = new Map(pendingByUser.map((row) => [row.requestedToId, row._count._all]));

  const result: Array<{
    userId: string;
    email: string;
    name: string;
    pendingCount: number;
  }> = [];

  for (const user of users) {
    const pref = prefByUser.get(user.id);
    const enabled = pref?.enabled ?? true;
    if (!enabled) continue;

    const times = pref?.times?.length ? pref.times : [...DEFAULT_REVIEW_REMINDER_TIMES];
    if (!times.includes(slot)) continue;

    if (pref?.lastRemindedOn === dateIst && pref?.lastRemindedSlot === slot) {
      continue;
    }

    result.push({
      userId: user.id,
      email: user.email,
      name: user.name,
      pendingCount: countByUser.get(user.id) ?? 0
    });
  }

  return result;
}
