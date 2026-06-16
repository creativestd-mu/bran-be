import { prisma } from "../../lib/prisma";

const userPreview = { id: true, name: true, email: true } as const;

const kpiInclude = {
  user: { select: userPreview },
  createdBy: { select: userPreview }
} as const;

export async function createUserKpi(data: {
  userId: string;
  title: string;
  description: string;
  sortOrder?: number;
  isActive?: boolean;
  isKey?: boolean;
  createdById: string;
}) {
  return prisma.userKpi.create({
    data: {
      userId: data.userId,
      title: data.title,
      description: data.description,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
      isKey: data.isKey ?? false,
      createdById: data.createdById
    },
    include: kpiInclude
  });
}

export async function createManyUserKpis(
  items: Array<{
    userId: string;
    title: string;
    description: string;
    sortOrder?: number;
    isActive?: boolean;
    isKey?: boolean;
    createdById: string;
  }>
) {
  return prisma.$transaction(
    items.map((item) =>
      prisma.userKpi.create({
        data: {
          userId: item.userId,
          title: item.title,
          description: item.description,
          sortOrder: item.sortOrder ?? 0,
          isActive: item.isActive ?? true,
          isKey: item.isKey ?? false,
          createdById: item.createdById
        },
        include: kpiInclude
      })
    )
  );
}

export async function findUserKpiById(id: string) {
  return prisma.userKpi.findUnique({
    where: { id },
    include: kpiInclude
  });
}

export async function findUserKpis(options: {
  userId?: string;
  isActive?: boolean;
  isKey?: boolean;
  page: number;
  pageSize: number;
}) {
  const where: {
    userId?: string;
    isActive?: boolean;
    isKey?: boolean;
  } = {};

  if (options.userId) where.userId = options.userId;
  if (options.isActive !== undefined) where.isActive = options.isActive;
  if (options.isKey !== undefined) where.isKey = options.isKey;

  const [items, total] = await Promise.all([
    prisma.userKpi.findMany({
      where,
      include: kpiInclude,
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      orderBy: [
        { userId: "asc" },
        { isKey: "desc" },
        { sortOrder: "asc" },
        { createdAt: "asc" }
      ]
    }),
    prisma.userKpi.count({ where })
  ]);

  return { items, total };
}

export async function updateUserKpi(
  id: string,
  data: {
    title?: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
    isKey?: boolean;
  }
) {
  return prisma.userKpi.update({
    where: { id },
    data,
    include: kpiInclude
  });
}

export async function deleteUserKpi(id: string) {
  return prisma.userKpi.delete({ where: { id } });
}

export async function userExists(userId: string): Promise<boolean> {
  const count = await prisma.user.count({ where: { id: userId } });
  return count > 0;
}
