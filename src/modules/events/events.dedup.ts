import { prisma } from "../../lib/prisma";
import type { OrgEventSourceType } from "./events.constants";
import {
  buildDatedEventSummary,
  eventDateRangeFromCandidates,
  updatesToSummaryCandidates
} from "./events.summary";
import {
  deleteOrgEvent,
  findOrgEventById,
  findUpdateBySource,
  updateOrgEvent
} from "./events.repository";

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "with",
  "from"
]);

export function normalizeEventTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(title: string): string[] {
  return normalizeEventTitle(title)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

/** True when two event titles likely describe the same org topic (e.g. Road to YC variants). */
export function eventTitlesSimilar(a: string, b: string): boolean {
  const na = normalizeEventTitle(a);
  const nb = normalizeEventTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length > nb.length ? na : nb;
  if (shorter.length >= 12 && longer.includes(shorter)) return true;

  const tokensA = significantTokens(a);
  const tokensB = significantTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const setB = new Set(tokensB);
  let overlap = 0;
  for (const token of tokensA) {
    if (setB.has(token)) overlap += 1;
  }

  const minSize = Math.min(tokensA.length, tokensB.length);
  return minSize >= 2 && overlap / minSize >= 0.55;
}

export async function findSimilarAutoOrgEvent(
  title: string
): Promise<{ id: string; title: string } | null> {
  const autoEvents = await prisma.orgEvent.findMany({
    where: {
      kind: "AUTO",
      status: { in: ["planned", "active"] }
    },
    select: { id: true, title: true },
    orderBy: { latestUpdateAt: "desc" },
    take: 150
  });

  for (const event of autoEvents) {
    if (eventTitlesSimilar(title, event.title)) {
      return event;
    }
  }

  return null;
}

export type ClusterLike = {
  title: string;
  description: string | null;
  summary: string | null;
  confidence: number;
  status: "planned" | "active" | "completed" | "cancelled";
  sourceKeys: string[];
};

/** Merge clusters the LLM split for the same topic in one response. */
export function mergeOverlappingClusters<T extends ClusterLike>(clusters: T[]): T[] {
  const merged: T[] = [];

  for (const cluster of clusters) {
    const index = merged.findIndex((item) => eventTitlesSimilar(item.title, cluster.title));
    if (index < 0) {
      merged.push({ ...cluster, sourceKeys: [...new Set(cluster.sourceKeys)] });
      continue;
    }

    const existing = merged[index];
    const keys = new Set([...existing.sourceKeys, ...cluster.sourceKeys]);
    merged[index] = {
      ...existing,
      title: existing.title.length >= cluster.title.length ? existing.title : cluster.title,
      description: existing.description ?? cluster.description,
      summary: existing.summary ?? cluster.summary,
      confidence: Math.max(existing.confidence, cluster.confidence),
      sourceKeys: [...keys]
    };
  }

  return merged;
}

async function refreshAutoEventSummary(eventId: string): Promise<void> {
  const event = await findOrgEventById(eventId);
  if (!event || event.kind !== "AUTO" || !event.updates?.length) return;

  const candidates = updatesToSummaryCandidates(event.updates);
  if (candidates.length === 0) return;

  const { startsAt, endsAt } = eventDateRangeFromCandidates(candidates);
  await updateOrgEvent(eventId, {
    aiSummary: buildDatedEventSummary(candidates),
    startsAt,
    endsAt,
    aiAnalyzedAt: new Date()
  });
}

/** Collapse existing duplicate AUTO events (keep oldest canonical per similar title). */
export async function dedupeSimilarAutoEvents(): Promise<{
  removed: number;
  movedUpdates: number;
}> {
  const events = await prisma.orgEvent.findMany({
    where: { kind: "AUTO" },
    select: { id: true, title: true, createdAt: true },
    orderBy: { createdAt: "asc" }
  });

  const keepers: Array<{ id: string; title: string }> = [];
  let removed = 0;
  let movedUpdates = 0;

  for (const event of events) {
    const keeper = keepers.find((item) => eventTitlesSimilar(item.title, event.title));
    if (!keeper) {
      keepers.push({ id: event.id, title: event.title });
      continue;
    }

    const updates = await prisma.orgEventUpdate.findMany({
      where: { eventId: event.id },
      select: { id: true, sourceType: true, sourceId: true, occurredAt: true }
    });

    let latest: Date | null = null;
    for (const update of updates) {
      const attached = await findUpdateBySource(
        update.sourceType as OrgEventSourceType,
        update.sourceId
      );
      if (attached?.eventId === keeper.id) {
        if (attached.id !== update.id) {
          await prisma.orgEventUpdate.delete({ where: { id: update.id } });
        }
        continue;
      }
      if (attached && attached.eventId !== event.id) {
        continue;
      }

      await prisma.orgEventUpdate.update({
        where: { id: update.id },
        data: { eventId: keeper.id }
      });
      movedUpdates += 1;
      if (!latest || update.occurredAt > latest) latest = update.occurredAt;
    }

    const keeperEvent = await findOrgEventById(keeper.id);
    const keeperLatest = keeperEvent?.latestUpdateAt;
    if (latest && (!keeperLatest || latest > keeperLatest)) {
      await prisma.orgEvent.update({
        where: { id: keeper.id },
        data: { latestUpdateAt: latest }
      });
    }

    await refreshAutoEventSummary(keeper.id);
    await deleteOrgEvent(event.id);
    removed += 1;
  }

  return { removed, movedUpdates };
}
