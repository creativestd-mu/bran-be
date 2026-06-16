import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma";

const userPreview = { id: true, name: true, email: true } as const;

const teamPreview = {
  id: true,
  name: true,
  verticalId: true,
  isActive: true,
  _count: { select: { members: true } }
} as const;

const visionInclude = {
  createdBy: { select: userPreview },
  teams: {
    include: {
      team: { select: teamPreview }
    }
  },
  users: {
    include: {
      user: { select: userPreview }
    }
  }
} satisfies Prisma.VisionInclude;

export async function createVision(data: {
  id: string;
  title: string;
  description?: string | null;
  horizon: string;
  durationMonths: number;
  startsAt: Date;
  endsAt: Date;
  scope: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  storagePath: string;
  createdById: string;
  teamIds: string[];
  userIds: string[];
}) {
  const { teamIds, userIds, ...visionData } = data;

  return prisma.vision.create({
    data: {
      ...visionData,
      teams:
        teamIds.length > 0
          ? { create: teamIds.map((teamId) => ({ teamId })) }
          : undefined,
      users:
        userIds.length > 0
          ? { create: userIds.map((userId) => ({ userId })) }
          : undefined
    },
    include: visionInclude
  });
}

export async function findVisionById(id: string) {
  return prisma.vision.findUnique({
    where: { id },
    include: visionInclude
  });
}

function buildListWhere(options: {
  horizon?: string;
  scope?: string;
  teamId?: string;
  userId?: string;
  visibleToUserId?: string;
}): Prisma.VisionWhereInput {
  const where: Prisma.VisionWhereInput = {};

  if (options.horizon) where.horizon = options.horizon;
  if (options.scope) where.scope = options.scope;

  if (options.teamId) {
    where.teams = { some: { teamId: options.teamId } };
  }

  if (options.userId) {
    where.OR = [
      { scope: "ALL" },
      { users: { some: { userId: options.userId } } },
      {
        teams: {
          some: {
            team: {
              members: {
                some: { userId: options.userId, isActive: true }
              }
            }
          }
        }
      }
    ];
  }

  if (options.visibleToUserId) {
    where.OR = [
      { scope: "ALL" },
      { users: { some: { userId: options.visibleToUserId } } },
      {
        teams: {
          some: {
            team: {
              members: {
                some: { userId: options.visibleToUserId, isActive: true }
              }
            }
          }
        }
      }
    ];
  }

  return where;
}

export async function findVisions(options: {
  horizon?: string;
  scope?: string;
  teamId?: string;
  userId?: string;
  visibleToUserId?: string;
  page: number;
  pageSize: number;
}) {
  const where = buildListWhere(options);

  const [items, total] = await Promise.all([
    prisma.vision.findMany({
      where,
      include: visionInclude,
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }]
    }),
    prisma.vision.count({ where })
  ]);

  return { items, total };
}

export async function updateVision(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    horizon?: string;
    durationMonths?: number;
    startsAt?: Date;
    endsAt?: Date;
    scope?: string;
    originalFilename?: string;
    mimeType?: string;
    fileSizeBytes?: number;
    storagePath?: string;
    teamIds?: string[];
    userIds?: string[];
  }
) {
  const { teamIds, userIds, ...scalarFields } = data;

  return prisma.$transaction(async (tx) => {
    if (teamIds !== undefined) {
      await tx.visionTeam.deleteMany({ where: { visionId: id } });
      if (teamIds.length > 0) {
        await tx.visionTeam.createMany({
          data: teamIds.map((teamId) => ({ visionId: id, teamId }))
        });
      }
    }

    if (userIds !== undefined) {
      await tx.visionUser.deleteMany({ where: { visionId: id } });
      if (userIds.length > 0) {
        await tx.visionUser.createMany({
          data: userIds.map((userId) => ({ visionId: id, userId }))
        });
      }
    }

    return tx.vision.update({
      where: { id },
      data: scalarFields,
      include: visionInclude
    });
  });
}

export async function deleteVision(id: string) {
  return prisma.vision.delete({ where: { id } });
}

export async function findExistingTeamIds(teamIds: string[]): Promise<string[]> {
  if (teamIds.length === 0) return [];
  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds }, isActive: true },
    select: { id: true }
  });
  return teams.map((team) => team.id);
}

export async function findExistingUserIds(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, isActive: true },
    select: { id: true }
  });
  return users.map((user) => user.id);
}

export async function findVisionsForAiContext(options: {
  forUserId?: string;
  teamScope?: boolean;
  maxDurationMonths?: number;
  horizon?: string;
  limit?: number;
}) {
  const now = new Date();
  const where: Prisma.VisionWhereInput = {
    endsAt: { gte: now }
  };

  if (options.maxDurationMonths) {
    where.durationMonths = { lte: options.maxDurationMonths };
  }

  if (options.horizon) {
    where.horizon = options.horizon;
  }

  if (options.teamScope) {
    where.OR = [{ scope: "ALL" }, { teams: { some: {} } }];
  } else if (options.forUserId) {
    where.OR = [
      { scope: "ALL" },
      { users: { some: { userId: options.forUserId } } },
      {
        teams: {
          some: {
            team: {
              members: {
                some: { userId: options.forUserId, isActive: true }
              }
            }
          }
        }
      }
    ];
  }

  return prisma.vision.findMany({
    where,
    include: visionInclude,
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    take: options.limit ?? 10
  });
}

export async function isUserInvolvedInVision(visionId: string, userId: string): Promise<boolean> {
  const match = await prisma.vision.findFirst({
    where: {
      id: visionId,
      OR: [
        { scope: "ALL" },
        { users: { some: { userId } } },
        {
          teams: {
            some: {
              team: {
                members: {
                  some: { userId, isActive: true }
                }
              }
            }
          }
        }
      ]
    },
    select: { id: true }
  });
  return !!match;
}
