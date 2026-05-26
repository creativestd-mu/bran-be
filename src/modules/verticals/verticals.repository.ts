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
  phases: { orderBy: { orderIndex: "asc" } },
  members: {
    include: {
      user: { select: userMiniSelect },
      reportsTo: { select: userMiniSelect }
    }
  }
} as const;

const verticalInclude = {
  owner: { select: ownerSelect },
  teams: { include: teamInclude, orderBy: { createdAt: "desc" } },
  projects: { include: projectInclude, orderBy: { createdAt: "desc" } },
  _count: { select: { teams: true, projects: true } }
} as const;

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
