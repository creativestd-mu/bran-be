import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma";

const userSelect = { id: true, name: true, email: true } as const;

const workUnitInclude = {
  user: { select: userSelect },
  createdBy: { select: userSelect },
  project: { select: { id: true, name: true, status: true } },
  audioRecording: {
    select: { id: true, transcript: true, originalFilename: true, createdAt: true }
  },
  steps: {
    orderBy: { deadline: "asc" as const },
    include: { assignee: { select: userSelect } }
  }
} as const;

function listOrderBy(status?: string): Prisma.WorkUnitOrderByWithRelationInput[] {
  if (status === "OPEN") {
    return [
      { nextDueAt: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" }
    ];
  }

  if (status === "CLOSED") {
    return [
      { firstDueAt: { sort: "asc", nulls: "last" } },
      { closedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" }
    ];
  }

  return [{ createdAt: "desc" }];
}

export async function createWorkUnit(data: {
  userId: string;
  createdById?: string | null;
  projectId?: string | null;
  audioRecordingId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  title: string;
  context: string;
  status: string;
  isPrivate: boolean;
  assigneeSpokenName?: string | null;
  sourceExcerpt?: string | null;
  closedAt?: Date | null;
  nextDueAt?: Date | null;
  firstDueAt?: Date | null;
  steps: Array<{
    description: string;
    deadline?: Date | null;
    done?: boolean;
    assigneeId?: string | null;
    assigneeSpokenName?: string | null;
    sourceExcerpt?: string | null;
  }>;
}) {
  return prisma.workUnit.create({
    data: {
      userId: data.userId,
      createdById: data.createdById ?? null,
      projectId: data.projectId ?? null,
      audioRecordingId: data.audioRecordingId ?? null,
      sourceType: data.sourceType ?? null,
      sourceId: data.sourceId ?? null,
      title: data.title,
      context: data.context,
      status: data.status,
      isPrivate: data.isPrivate,
      assigneeSpokenName: data.assigneeSpokenName ?? null,
      sourceExcerpt: data.sourceExcerpt ?? null,
      closedAt: data.closedAt ?? null,
      nextDueAt: data.nextDueAt ?? null,
      firstDueAt: data.firstDueAt ?? null,
      steps: {
        create: data.steps.map((step) => ({
          description: step.description,
          deadline: step.deadline ?? null,
          done: step.done ?? false,
          assigneeId: step.assigneeId ?? null,
          assigneeSpokenName: step.assigneeSpokenName ?? null,
          sourceExcerpt: step.sourceExcerpt ?? null
        }))
      }
    },
    include: workUnitInclude
  });
}

export async function findWorkUnitById(id: string) {
  return prisma.workUnit.findUnique({
    where: { id },
    include: workUnitInclude
  });
}

export async function findWorkUnits(options: {
  userId?: string;
  status?: string;
  from?: Date;
  to?: Date;
  isPrivateVisibleForUserId?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.WorkUnitWhereInput = {};

  if (options.userId) {
    where.OR = [{ userId: options.userId }, { createdById: options.userId }];
  }
  if (options.status) where.status = options.status;

  if (options.from || options.to) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (options.from) dateFilter.gte = options.from;
    if (options.to) dateFilter.lte = options.to;

    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { createdAt: dateFilter },
          { nextDueAt: dateFilter },
          { firstDueAt: dateFilter },
          { steps: { some: { deadline: dateFilter } } }
        ]
      }
    ];
  }

  if (options.isPrivateVisibleForUserId) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [{ isPrivate: false }, { userId: options.isPrivateVisibleForUserId }]
      }
    ];
  }

  const [items, total] = await Promise.all([
    prisma.workUnit.findMany({
      where,
      include: workUnitInclude,
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      orderBy: listOrderBy(options.status)
    }),
    prisma.workUnit.count({ where })
  ]);

  return { items, total };
}

export async function updateWorkUnit(
  id: string,
  data: {
    title?: string;
    context?: string;
    status?: string;
    isPrivate?: boolean;
    projectId?: string | null;
    userId?: string;
    createdById?: string | null;
    assigneeSpokenName?: string | null;
    closedAt?: Date | null;
    nextDueAt?: Date | null;
    firstDueAt?: Date | null;
    steps?: Array<{
      description: string;
      deadline?: Date | null;
      done?: boolean;
      assigneeId?: string | null;
      assigneeSpokenName?: string | null;
      sourceExcerpt?: string | null;
    }>;
  }
) {
  const { steps, ...scalarFields } = data;

  if (steps !== undefined) {
    await prisma.$transaction([
      prisma.workStep.deleteMany({ where: { workUnitId: id } }),
      prisma.workUnit.update({
        where: { id },
        data: {
          ...scalarFields,
          steps: {
            create: steps.map((step) => ({
              description: step.description,
              deadline: step.deadline ?? null,
              done: step.done ?? false,
              assigneeId: step.assigneeId ?? null,
              assigneeSpokenName: step.assigneeSpokenName ?? null,
              sourceExcerpt: step.sourceExcerpt ?? null
            }))
          }
        }
      })
    ]);
    return findWorkUnitById(id);
  }

  return prisma.workUnit.update({
    where: { id },
    data: scalarFields,
    include: workUnitInclude
  });
}

export async function findWorkStepById(workUnitId: string, stepId: string) {
  return prisma.workStep.findFirst({
    where: { id: stepId, workUnitId },
    include: { assignee: { select: userSelect } }
  });
}

export async function updateWorkStepAssignee(
  workUnitId: string,
  stepId: string,
  assigneeId: string | null
) {
  return prisma.workStep.updateMany({
    where: { id: stepId, workUnitId },
    data: { assigneeId }
  });
}

export async function deleteWorkUnit(id: string) {
  return prisma.workUnit.delete({ where: { id } });
}

export async function findWorkUnitsByUserAndDateRange(userId: string, from: Date, to: Date) {
  return prisma.workUnit.findMany({
    where: {
      userId,
      createdAt: { gte: from, lte: to }
    },
    include: workUnitInclude,
    orderBy: { createdAt: "desc" }
  });
}

export async function findWorkStepsByUserAndDeadlineRange(userId: string, from: Date, to: Date) {
  return prisma.workStep.findMany({
    where: {
      deadline: { gte: from, lte: to },
      workUnit: { userId }
    },
    include: {
      workUnit: {
        select: { id: true, title: true, status: true, isPrivate: true }
      }
    },
    orderBy: { deadline: "asc" }
  });
}

export async function findOverdueStepsForUser(userId: string, now: Date) {
  return prisma.workStep.findMany({
    where: {
      done: false,
      deadline: { lt: now },
      OR: [
        { workUnit: { userId } },
        { assigneeId: userId }
      ]
    },
    include: {
      workUnit: { select: { id: true, title: true, userId: true } }
    },
    orderBy: { deadline: "asc" }
  });
}
