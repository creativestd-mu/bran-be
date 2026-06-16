import { prisma } from "../../lib/prisma";
import { MAX_MOST_VISITED_PAGES } from "./navigation.constants";

export async function createNavSearchLog(input: {
  userId: string;
  query: string;
  selectedPath?: string;
}) {
  return prisma.navSearchLog.create({
    data: {
      userId: input.userId,
      query: input.query,
      selectedPath: input.selectedPath ?? null
    }
  });
}

export async function upsertPageVisit(userId: string, path: string) {
  return prisma.userPageVisit.upsert({
    where: {
      userId_path: { userId, path }
    },
    create: {
      userId,
      path,
      visitCount: 1,
      lastVisitedAt: new Date()
    },
    update: {
      visitCount: { increment: 1 },
      lastVisitedAt: new Date()
    }
  });
}

export async function findMostVisitedPages(userId: string) {
  return prisma.userPageVisit.findMany({
    where: { userId },
    orderBy: [{ visitCount: "desc" }, { lastVisitedAt: "desc" }],
    take: MAX_MOST_VISITED_PAGES,
    select: {
      path: true,
      visitCount: true,
      lastVisitedAt: true
    }
  });
}
