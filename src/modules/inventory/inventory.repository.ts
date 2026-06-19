import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma";

const teamPreview = {
  id: true,
  name: true,
  verticalId: true,
  isActive: true
} as const;

const itemInclude = {
  teams: {
    include: { team: { select: teamPreview } },
    orderBy: [{ isPrimary: "desc" as const }, { assignedAt: "asc" as const }]
  },
  reservations: {
    where: { status: { in: ["ACTIVE", "OVERDUE"] } },
    orderBy: { dueBackAt: "asc" as const },
    take: 5,
    include: {
      node: {
        select: {
          id: true,
          name: true,
          kind: true,
          startsAt: true,
          dueDate: true,
          content: { select: { id: true, title: true } }
        }
      }
    }
  }
} satisfies Prisma.InventoryItemInclude;

const reservationInclude = {
  item: {
    select: {
      id: true,
      name: true,
      category: true,
      serialNumber: true,
      status: true
    }
  },
  node: {
    select: {
      id: true,
      name: true,
      kind: true,
      startsAt: true,
      dueDate: true,
      content: { select: { id: true, title: true, teamId: true } }
    }
  },
  resource: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } }
} satisfies Prisma.InventoryReservationInclude;

export async function createInventoryItem(data: {
  name: string;
  description?: string | null;
  category?: string | null;
  serialNumber?: string | null;
  status?: string;
  isActive?: boolean;
  teamIds?: string[];
  primaryTeamId?: string;
}) {
  const { teamIds, primaryTeamId, ...itemData } = data;

  return prisma.inventoryItem.create({
    data: {
      ...itemData,
      teams:
        teamIds && teamIds.length > 0
          ? {
              create: teamIds.map((teamId) => ({
                teamId,
                isPrimary: primaryTeamId ? teamId === primaryTeamId : teamId === teamIds[0]
              }))
            }
          : undefined
    },
    include: itemInclude
  });
}

export async function findInventoryItemById(id: string) {
  return prisma.inventoryItem.findUnique({
    where: { id },
    include: itemInclude
  });
}

export async function findInventoryItems(options: {
  teamId?: string;
  category?: string;
  status?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
  excludeItemIds?: string[];
}) {
  const where: Prisma.InventoryItemWhereInput = {};

  if (options.teamId) {
    where.teams = { some: { teamId: options.teamId } };
  }
  if (options.category) where.category = options.category;
  if (options.status) where.status = options.status;
  if (options.isActive !== undefined) where.isActive = options.isActive;
  if (options.excludeItemIds && options.excludeItemIds.length > 0) {
    where.id = { notIn: options.excludeItemIds };
  }

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      include: itemInclude,
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      orderBy: [{ name: "asc" }]
    }),
    prisma.inventoryItem.count({ where })
  ]);

  return { items, total };
}

export async function findBusyInventoryItemIds(from: Date, to: Date) {
  const rows = await prisma.inventoryReservation.findMany({
    where: {
      status: { in: ["ACTIVE", "OVERDUE"] },
      returnedAt: null,
      reservedFrom: { lte: to },
      dueBackAt: { gte: from }
    },
    select: { inventoryItemId: true }
  });
  return [...new Set(rows.map((row) => row.inventoryItemId))];
}

export async function updateInventoryItem(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    category?: string | null;
    serialNumber?: string | null;
    status?: string;
    isActive?: boolean;
  }
) {
  return prisma.inventoryItem.update({
    where: { id },
    data,
    include: itemInclude
  });
}

export async function replaceInventoryItemTeams(
  inventoryItemId: string,
  teamIds: string[],
  primaryTeamId?: string | null
) {
  await prisma.$transaction([
    prisma.inventoryItemTeam.deleteMany({ where: { inventoryItemId } }),
    ...(teamIds.length > 0
      ? [
          prisma.inventoryItemTeam.createMany({
            data: teamIds.map((teamId) => ({
              inventoryItemId,
              teamId,
              isPrimary: primaryTeamId ? teamId === primaryTeamId : teamId === teamIds[0]
            }))
          })
        ]
      : [])
  ]);

  return findInventoryItemById(inventoryItemId);
}

export async function deleteInventoryItem(id: string) {
  return prisma.inventoryItem.delete({ where: { id } });
}

export async function teamExists(teamId: string) {
  const count = await prisma.team.count({ where: { id: teamId, isActive: true } });
  return count > 0;
}

export async function findReservations(options: {
  inventoryItemId?: string;
  contentNodeId?: string;
  status?: string;
  overdueOnly?: boolean;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.InventoryReservationWhereInput = {};

  if (options.inventoryItemId) where.inventoryItemId = options.inventoryItemId;
  if (options.contentNodeId) where.contentNodeId = options.contentNodeId;
  if (options.status) where.status = options.status;
  if (options.overdueOnly) {
    where.status = { in: ["ACTIVE", "OVERDUE"] };
    where.returnedAt = null;
    where.dueBackAt = { lt: new Date() };
  }

  const [items, total] = await Promise.all([
    prisma.inventoryReservation.findMany({
      where,
      include: reservationInclude,
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      orderBy: [{ dueBackAt: "asc" }]
    }),
    prisma.inventoryReservation.count({ where })
  ]);

  return { items, total };
}

export async function findReservationById(id: string) {
  return prisma.inventoryReservation.findUnique({
    where: { id },
    include: reservationInclude
  });
}

export async function returnReservation(id: string, notes?: string) {
  return prisma.inventoryReservation.update({
    where: { id },
    data: {
      returnedAt: new Date(),
      status: "RETURNED",
      notes: notes ?? undefined
    },
    include: reservationInclude
  });
}

export async function countActiveReservationsForItem(inventoryItemId: string) {
  return prisma.inventoryReservation.count({
    where: {
      inventoryItemId,
      status: { in: ["ACTIVE", "OVERDUE"] },
      returnedAt: null
    }
  });
}
