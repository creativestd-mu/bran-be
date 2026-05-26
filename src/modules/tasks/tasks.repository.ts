import { prisma } from "../../lib/prisma";

export async function createTask(data: {
  userId: string;
  title: string;
  description?: string;
  type: string;
  platform?: string;
  contentUrl?: string;
  metadata?: string;
  dueDate?: Date;
}) {
  return prisma.task.create({
    data,
    include: { user: { select: { id: true, name: true, email: true } } }
  });
}

export async function findTaskById(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } }
  });
}

export async function findTasks(options: {
  userId?: string;
  status?: string;
  type?: string;
  platform?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}) {
  const where: Record<string, unknown> = {};

  if (options.userId) where.userId = options.userId;
  if (options.status) where.status = options.status;
  if (options.type) where.type = options.type;
  if (options.platform) where.platform = options.platform;

  if (options.from || options.to) {
    const dateFilter: Record<string, Date> = {};
    if (options.from) dateFilter.gte = options.from;
    if (options.to) dateFilter.lte = options.to;
    where.createdAt = dateFilter;
  }

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      orderBy: { createdAt: "desc" }
    }),
    prisma.task.count({ where })
  ]);

  return { items, total };
}

export async function updateTask(
  id: string,
  data: {
    title?: string;
    description?: string;
    type?: string;
    platform?: string;
    contentUrl?: string;
    status?: string;
    metadata?: string;
    dueDate?: Date | null;
    completedAt?: Date | null;
  }
) {
  return prisma.task.update({
    where: { id },
    data,
    include: { user: { select: { id: true, name: true, email: true } } }
  });
}

export async function deleteTask(id: string) {
  return prisma.task.delete({ where: { id } });
}

export async function findTasksByUserAndDateRange(
  userId: string,
  from: Date,
  to: Date
) {
  return prisma.task.findMany({
    where: {
      userId,
      createdAt: { gte: from, lte: to }
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" }
  });
}
