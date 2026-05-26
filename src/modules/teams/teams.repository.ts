import { prisma } from "../../lib/prisma";

export async function createTeam(data: {
  name: string;
  description?: string;
  verticalId: string;
  createdById?: string;
}) {
  return prisma.team.create({
    data,
    include: {
      vertical: true,
      members: { include: { user: true, reportsTo: true } }
    }
  });
}

export async function listTeams() {
  return prisma.team.findMany({
    include: {
      _count: { select: { members: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      vertical: { select: { id: true, name: true, slug: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          reportsTo: { select: { id: true, name: true, email: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getTeamById(id: string) {
  return prisma.team.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      vertical: { select: { id: true, name: true, slug: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          reportsTo: { select: { id: true, name: true, email: true } }
        }
      }
    }
  });
}

export async function updateTeam(
  id: string,
  data: { name?: string; description?: string; verticalId?: string; isActive?: boolean }
) {
  return prisma.team.update({
    where: { id },
    data
  });
}

export async function deleteTeam(id: string) {
  return prisma.team.delete({ where: { id } });
}

export async function addTeamMember(data: {
  teamId: string;
  userId: string;
  memberRole?: string;
  reportsToUserId?: string;
}) {
  return prisma.teamMember.upsert({
    where: {
      teamId_userId: {
        teamId: data.teamId,
        userId: data.userId
      }
    },
    update: {
      memberRole: data.memberRole ?? "MEMBER",
      reportsToUserId: data.reportsToUserId ?? null,
      isActive: true
    },
    create: {
      teamId: data.teamId,
      userId: data.userId,
      memberRole: data.memberRole ?? "MEMBER",
      reportsToUserId: data.reportsToUserId
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      reportsTo: { select: { id: true, name: true, email: true } }
    }
  });
}

export async function updateTeamMember(
  memberId: string,
  data: { memberRole?: string; reportsToUserId?: string | null; isActive?: boolean }
) {
  return prisma.teamMember.update({
    where: { id: memberId },
    data,
    include: {
      user: { select: { id: true, name: true, email: true } },
      reportsTo: { select: { id: true, name: true, email: true } }
    }
  });
}

export async function getTeamMemberById(memberId: string) {
  return prisma.teamMember.findUnique({
    where: { id: memberId },
    include: {
      user: true,
      reportsTo: true
    }
  });
}

export async function getTeamMemberByTeamAndUser(teamId: string, userId: string) {
  return prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId
      }
    }
  });
}

export async function removeTeamMember(memberId: string) {
  return prisma.teamMember.delete({ where: { id: memberId } });
}
