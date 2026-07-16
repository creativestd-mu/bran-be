import { prisma } from "../../lib/prisma";
import type { EscalationPriority, EscalationStatus } from "./escalation.constants";

export type UpsertEscalationInput = {
  title: string;
  problemContext: string;
  latestContext: string;
  status: EscalationStatus;
  priority: EscalationPriority;
  slackChannelId: string;
  slackMessageTs: string;
  reporterSlackId: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  latestUpdateAt: Date | null;
  resolvedAt: Date | null;
  aiSummary?: string | null;
  aiBlockers?: string | null;
  aiAnalyzedAt?: Date | null;
};

export type UpsertEscalationUpdateInput = {
  escalationId: string;
  slackUserId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  body: string;
  slackMessageTs: string;
  inferredStatus: EscalationStatus | null;
  isManual?: boolean;
  createdAt?: Date;
};

export async function upsertEscalation(input: UpsertEscalationInput) {
  return prisma.escalation.upsert({
    where: { slackMessageTs: input.slackMessageTs },
    create: input,
    update: {
      title: input.title,
      problemContext: input.problemContext,
      latestContext: input.latestContext,
      status: input.status,
      priority: input.priority,
      reporterSlackId: input.reporterSlackId,
      reporterName: input.reporterName,
      reporterEmail: input.reporterEmail,
      latestUpdateAt: input.latestUpdateAt,
      resolvedAt: input.resolvedAt,
      ...(input.aiSummary !== undefined ? { aiSummary: input.aiSummary } : {}),
      ...(input.aiBlockers !== undefined ? { aiBlockers: input.aiBlockers } : {}),
      ...(input.aiAnalyzedAt !== undefined ? { aiAnalyzedAt: input.aiAnalyzedAt } : {})
    }
  });
}

export async function upsertEscalationUpdate(input: UpsertEscalationUpdateInput) {
  return prisma.escalationUpdate.upsert({
    where: { slackMessageTs: input.slackMessageTs },
    create: {
      escalationId: input.escalationId,
      slackUserId: input.slackUserId,
      authorName: input.authorName,
      authorEmail: input.authorEmail,
      body: input.body,
      slackMessageTs: input.slackMessageTs,
      inferredStatus: input.inferredStatus,
      isManual: input.isManual ?? false,
      createdAt: input.createdAt ?? new Date()
    },
    update: {
      body: input.body,
      authorName: input.authorName,
      authorEmail: input.authorEmail,
      inferredStatus: input.inferredStatus
    }
  });
}

export async function findEscalationById(id: string) {
  return prisma.escalation.findUnique({
    where: { id },
    include: {
      updates: {
        orderBy: { createdAt: "asc" }
      }
    }
  });
}

export async function findEscalationBySlackMessageTs(slackMessageTs: string) {
  return prisma.escalation.findUnique({
    where: { slackMessageTs },
    include: {
      updates: {
        orderBy: { createdAt: "asc" }
      }
    }
  });
}

export async function listEscalations(filters: {
  status?: EscalationStatus;
  priority?: EscalationPriority;
  activeOnly?: boolean;
  search?: string;
  take?: number;
  skip?: number;
}) {
  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.activeOnly
      ? { status: { in: ["open", "in_progress", "waiting"] } }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search, mode: "insensitive" as const } },
            { problemContext: { contains: filters.search, mode: "insensitive" as const } },
            { latestContext: { contains: filters.search, mode: "insensitive" as const } },
            { aiSummary: { contains: filters.search, mode: "insensitive" as const } },
            { reporterName: { contains: filters.search, mode: "insensitive" as const } }
          ]
        }
      : {})
  };

  const [items, total, open, inProgress, waiting, resolved, closed] = await Promise.all([
    prisma.escalation.findMany({
      where,
      orderBy: [{ latestUpdateAt: "desc" }, { createdAt: "desc" }],
      take: filters.take ?? 50,
      skip: filters.skip ?? 0,
      include: {
        updates: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    }),
    prisma.escalation.count({ where }),
    prisma.escalation.count({ where: { status: "open" } }),
    prisma.escalation.count({ where: { status: "in_progress" } }),
    prisma.escalation.count({ where: { status: "waiting" } }),
    prisma.escalation.count({ where: { status: "resolved" } }),
    prisma.escalation.count({ where: { status: "closed" } })
  ]);

  return {
    items,
    total,
    summary: { open, inProgress, waiting, resolved, closed }
  };
}

export async function updateEscalationAiAnalysis(input: {
  id: string;
  latestContext: string;
  status: EscalationStatus;
  priority: EscalationPriority;
  aiSummary: string;
  aiBlockers: string[];
  aiAnalyzedAt: Date;
  resolvedAt?: Date | null;
}) {
  return prisma.escalation.update({
    where: { id: input.id },
    data: {
      latestContext: input.latestContext,
      status: input.status,
      priority: input.priority,
      aiSummary: input.aiSummary,
      aiBlockers: JSON.stringify(input.aiBlockers),
      aiAnalyzedAt: input.aiAnalyzedAt,
      ...(input.resolvedAt !== undefined ? { resolvedAt: input.resolvedAt } : {})
    },
    include: {
      updates: {
        orderBy: { createdAt: "asc" }
      }
    }
  });
}

export function parseStoredStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

export async function updateEscalationStatus(input: {
  id: string;
  status: EscalationStatus;
  latestContext?: string;
  latestUpdateAt?: Date;
  resolvedAt?: Date | null;
}) {
  return prisma.escalation.update({
    where: { id: input.id },
    data: {
      status: input.status,
      ...(input.latestContext !== undefined ? { latestContext: input.latestContext } : {}),
      ...(input.latestUpdateAt !== undefined ? { latestUpdateAt: input.latestUpdateAt } : {}),
      ...(input.resolvedAt !== undefined ? { resolvedAt: input.resolvedAt } : {})
    },
    include: {
      updates: {
        orderBy: { createdAt: "asc" }
      }
    }
  });
}

export function serializeEscalation(row: {
  id: string;
  title: string;
  problemContext: string;
  latestContext: string;
  status: string;
  priority: string;
  slackChannelId: string;
  slackMessageTs: string;
  reporterSlackId: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  latestUpdateAt: Date | null;
  resolvedAt: Date | null;
  aiSummary?: string | null;
  aiBlockers?: string | null;
  aiAnalyzedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  updates?: Array<{
    id: string;
    escalationId: string;
    slackUserId: string | null;
    authorName: string | null;
    authorEmail: string | null;
    body: string;
    slackMessageTs: string;
    inferredStatus: string | null;
    isManual: boolean;
    createdAt: Date;
  }>;
}) {
  const latestUpdate = row.updates?.length
    ? [...row.updates].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
    : null;

  return {
    id: row.id,
    title: row.title,
    problemContext: row.problemContext,
    latestContext: row.latestContext,
    status: row.status,
    priority: row.priority,
    reporter: {
      slackUserId: row.reporterSlackId,
      name: row.reporterName,
      email: row.reporterEmail
    },
    slack: {
      channelId: row.slackChannelId,
      messageTs: row.slackMessageTs
    },
    latestUpdate: latestUpdate
      ? {
          body: latestUpdate.body,
          authorName: latestUpdate.authorName,
          inferredStatus: latestUpdate.inferredStatus,
          at: latestUpdate.createdAt.toISOString()
        }
      : null,
    latestUpdateAt: row.latestUpdateAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    ai: {
      summary: row.aiSummary ?? null,
      blockers: parseStoredStringArray(row.aiBlockers),
      analyzedAt: row.aiAnalyzedAt?.toISOString() ?? null
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    updates: row.updates?.map((update) => ({
      id: update.id,
      body: update.body,
      authorName: update.authorName,
      authorEmail: update.authorEmail,
      slackUserId: update.slackUserId,
      slackMessageTs: update.slackMessageTs,
      inferredStatus: update.inferredStatus,
      isManual: update.isManual,
      createdAt: update.createdAt.toISOString()
    }))
  };
}
