import { prisma } from "../../lib/prisma";

const ownerSelect = {
  id: true,
  name: true,
  email: true,
  role: { select: { id: true, name: true } }
} as const;

const userMiniSelect = {
  id: true,
  name: true,
  email: true
} as const;

const teamInclude = {
  _count: { select: { members: true } },
  createdBy: { select: userMiniSelect },
  members: {
    include: {
      user: { select: userMiniSelect },
      reportsTo: { select: userMiniSelect }
    }
  }
} as const;

const projectInclude = {
  _count: { select: { members: true } },
  createdBy: { select: userMiniSelect },
  phases: { orderBy: { orderIndex: "asc" as const } },
  members: {
    include: {
      user: { select: userMiniSelect },
      reportsTo: { select: userMiniSelect }
    }
  }
} as const;

const podInclude = {
  head: { select: userMiniSelect },
  projects: { include: projectInclude, orderBy: { name: "asc" as const } },
  socialAccounts: {
    select: {
      id: true,
      kind: true,
      platform: true,
      handle: true,
      url: true,
      isActive: true,
      lastSyncedAt: true,
      lastSyncStatus: true
    },
    orderBy: [{ platform: "asc" as const }, { handle: "asc" as const }]
  },
  _count: { select: { projects: true, socialAccounts: true } }
};

const verticalInclude = {
  owner: { select: ownerSelect },
  teams: { include: teamInclude, orderBy: { createdAt: "desc" as const } },
  pods: { include: podInclude, orderBy: { name: "asc" as const } },
  _count: { select: { teams: true, pods: true } }
};

export async function listVerticals() {
  return prisma.vertical.findMany({
    include: verticalInclude,
    orderBy: { name: "asc" }
  });
}

export async function getVerticalById(id: string) {
  return prisma.vertical.findUnique({
    where: { id },
    include: verticalInclude
  });
}

export async function getVerticalBySlug(slug: string) {
  return prisma.vertical.findUnique({
    where: { slug },
    include: verticalInclude
  });
}

export async function updateVertical(
  id: string,
  data: { name?: string; description?: string | null; ownerUserId?: string | null }
) {
  return prisma.vertical.update({
    where: { id },
    data,
    include: { owner: { select: ownerSelect } }
  });
}
