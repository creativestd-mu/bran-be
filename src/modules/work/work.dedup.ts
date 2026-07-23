import { prisma } from "../../lib/prisma";
import { WORK_DEDUP_TITLE_LOOKBACK_DAYS } from "./work.constants";

export function normalizeWorkUnitTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function hasSimilarOpenWorkUnit(
  ownerUserId: string,
  title: string,
  lookbackDays = WORK_DEDUP_TITLE_LOOKBACK_DAYS
): Promise<boolean> {
  const normalized = normalizeWorkUnitTitle(title);
  if (!normalized) return false;

  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const existing = await prisma.workUnit.findMany({
    where: {
      userId: ownerUserId,
      status: "OPEN",
      createdAt: { gte: since }
    },
    select: { title: true }
  });

  return existing.some((unit) => normalizeWorkUnitTitle(unit.title) === normalized);
}
