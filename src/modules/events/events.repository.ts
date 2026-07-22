import type { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma";
import type { OrgEventKind, OrgEventSourceType, OrgEventStatus } from "./events.constants";
import type { SourceCandidate } from "./events.sources";

export async function createOrgEvent(data: {
  title: string;
  description?: string | null;
  kind?: OrgEventKind;
  status?: OrgEventStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdById?: string | null;
  aiSummary?: string | null;
  aiAnalyzedAt?: Date | null;
  confidence?: number | null;
  latestUpdateAt?: Date | null;
}) {
  return prisma.orgEvent.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      kind: data.kind ?? "MANUAL",
      status: data.status ?? "planned",
      startsAt: data.startsAt ?? null,
      endsAt: data.endsAt ?? null,
      createdById: data.createdById ?? null,
      aiSummary: data.aiSummary ?? null,
      aiAnalyzedAt: data.aiAnalyzedAt ?? null,
      confidence: data.confidence ?? null,
      latestUpdateAt: data.latestUpdateAt ?? null
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { updates: true } }
    }
  });
}

export async function updateOrgEvent(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    status?: OrgEventStatus;
    startsAt?: Date | null;
    endsAt?: Date | null;
    aiSummary?: string | null;
    aiAnalyzedAt?: Date | null;
    confidence?: number | null;
    latestUpdateAt?: Date | null;
  }
) {
  return prisma.orgEvent.update({
    where: { id },
    data,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { updates: true } }
    }
  });
}

export async function findOrgEventById(id: string) {
  return prisma.orgEvent.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      updates: {
        orderBy: { occurredAt: "desc" },
        include: {
          actor: { select: { id: true, name: true, email: true } }
        }
      }
    }
  });
}

export async function listOrgEvents(options?: {
  status?: OrgEventStatus;
  kind?: OrgEventKind;
  limit?: number;
}) {
  return prisma.orgEvent.findMany({
    where: {
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.kind ? { kind: options.kind } : {})
    },
    orderBy: [{ latestUpdateAt: "desc" }, { createdAt: "desc" }],
    take: options?.limit ?? 50,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      updates: {
        orderBy: { occurredAt: "desc" },
        take: 1
      },
      _count: { select: { updates: true } }
    }
  });
}

export async function findUpdateBySource(sourceType: OrgEventSourceType, sourceId: string) {
  return prisma.orgEventUpdate.findUnique({
    where: { sourceType_sourceId: { sourceType, sourceId } }
  });
}

export async function createOrgEventUpdate(data: {
  eventId: string;
  sourceType: OrgEventSourceType;
  sourceId: string;
  title?: string | null;
  body: string;
  actorUserId?: string | null;
  actorName?: string | null;
  occurredAt: Date;
  metadata?: Record<string, unknown> | null;
}) {
  const update = await prisma.orgEventUpdate.create({
    data: {
      eventId: data.eventId,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      title: data.title ?? null,
      body: data.body,
      actorUserId: data.actorUserId ?? null,
      actorName: data.actorName ?? null,
      occurredAt: data.occurredAt,
      metadata: (data.metadata ?? undefined) as Prisma.InputJsonValue | undefined
    },
    include: {
      actor: { select: { id: true, name: true, email: true } }
    }
  });

  await prisma.orgEvent.update({
    where: { id: data.eventId },
    data: { latestUpdateAt: data.occurredAt }
  });

  return update;
}

export async function createUpdateFromCandidate(eventId: string, candidate: SourceCandidate) {
  return createOrgEventUpdate({
    eventId,
    sourceType: candidate.sourceType,
    sourceId: candidate.sourceId,
    title: candidate.title,
    body: candidate.body || candidate.title,
    actorUserId: candidate.actorUserId ?? null,
    actorName: candidate.actorName ?? null,
    occurredAt: candidate.occurredAt,
    metadata: candidate.metadata ?? null
  });
}

export async function deleteOrgEvent(id: string) {
  return prisma.orgEvent.delete({ where: { id } });
}

export function serializeOrgEvent(event: {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  createdById: string | null;
  aiSummary: string | null;
  aiAnalyzedAt: Date | null;
  confidence: number | null;
  latestUpdateAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { id: string; name: string; email: string } | null;
  updates?: Array<{
    id: string;
    sourceType: string;
    sourceId: string;
    title: string | null;
    body: string;
    actorUserId: string | null;
    actorName: string | null;
    occurredAt: Date;
    metadata: unknown;
    createdAt: Date;
    actor?: { id: string; name: string; email: string } | null;
  }>;
  _count?: { updates: number };
}) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    kind: event.kind,
    status: event.status,
    startsAt: event.startsAt?.toISOString() ?? null,
    endsAt: event.endsAt?.toISOString() ?? null,
    createdById: event.createdById,
    createdBy: event.createdBy ?? null,
    aiSummary: event.aiSummary,
    aiAnalyzedAt: event.aiAnalyzedAt?.toISOString() ?? null,
    confidence: event.confidence,
    latestUpdateAt: event.latestUpdateAt?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    updateCount: event._count?.updates ?? event.updates?.length ?? 0,
    latestUpdate: event.updates?.[0]
      ? serializeOrgEventUpdate(event.updates[0])
      : null,
    updates: event.updates?.map(serializeOrgEventUpdate)
  };
}

export function serializeOrgEventUpdate(update: {
  id: string;
  sourceType: string;
  sourceId: string;
  title: string | null;
  body: string;
  actorUserId: string | null;
  actorName: string | null;
  occurredAt: Date;
  metadata: unknown;
  createdAt: Date;
  actor?: { id: string; name: string; email: string } | null;
}) {
  return {
    id: update.id,
    sourceType: update.sourceType,
    sourceId: update.sourceId,
    title: update.title,
    body: update.body,
    actorUserId: update.actorUserId,
    actorName: update.actorName,
    actor: update.actor ?? null,
    occurredAt: update.occurredAt.toISOString(),
    metadata: update.metadata ?? null,
    createdAt: update.createdAt.toISOString()
  };
}
