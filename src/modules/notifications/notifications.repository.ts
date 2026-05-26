import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma";

export type CreateNotificationInput = {
  userId: string;
  kind: string;
  title: string;
  body?: string | null;
  data?: unknown;
  dedupeKey?: string | null;
};

function serialiseData(data: unknown): string | null {
  if (data === undefined || data === null) return null;
  try {
    return JSON.stringify(data);
  } catch {
    return null;
  }
}

/**
 * Idempotent insert: when (userId, dedupeKey) already exists this returns
 * the existing row instead of throwing. Callers can therefore safely re-run
 * a fan-out without producing duplicates.
 */
export async function createNotification(input: CreateNotificationInput) {
  const data = serialiseData(input.data);

  if (input.dedupeKey) {
    return prisma.notification.upsert({
      where: {
        userId_dedupeKey: {
          userId: input.userId,
          dedupeKey: input.dedupeKey
        }
      },
      update: {},
      create: {
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        data,
        dedupeKey: input.dedupeKey
      }
    });
  }

  return prisma.notification.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      data
    }
  });
}

export async function markEmailSent(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { emailSentAt: new Date() }
  });
}

export type ListNotificationsFilters = {
  userId: string;
  unreadOnly?: boolean;
  take?: number;
  skip?: number;
};

export async function listNotifications(filters: ListNotificationsFilters) {
  const where: Prisma.NotificationWhereInput = {
    userId: filters.userId,
    ...(filters.unreadOnly ? { readAt: null } : {})
  };

  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters.take ?? 50,
      skip: filters.skip ?? 0
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: filters.userId, readAt: null } })
  ]);

  return { items, total, unread };
}

export async function countUnread(userId: string) {
  return prisma.notification.count({
    where: { userId, readAt: null }
  });
}

export async function getNotificationByIdForUser(notificationId: string, userId: string) {
  return prisma.notification.findFirst({
    where: { id: notificationId, userId }
  });
}

export async function markNotificationRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() }
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() }
  });
}
