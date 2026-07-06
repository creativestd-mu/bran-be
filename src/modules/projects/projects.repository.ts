import { prisma } from "../../lib/prisma";

export async function createProject(data: {
  name: string;
  description?: string;
  objectives?: string;
  finalLink?: string;
  verticalId: string;
  createdById?: string;
  startsAt?: Date;
  endsAt?: Date;
  status?: string;
}) {
  return prisma.project.create({
    data,
    include: {
      vertical: { select: { id: true, name: true, slug: true } },
      phases: { orderBy: { orderIndex: "asc" } },
      members: { include: { user: true, reportsTo: true } }
    }
  });
}

export async function listProjectsForUser(userId: string) {
  return prisma.project.findMany({
    where: {
      OR: [
        { createdById: userId },
        { members: { some: { userId, isActive: true } } }
      ]
    },
    include: {
      _count: { select: { members: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      vertical: { select: { id: true, name: true, slug: true } },
      phases: { orderBy: { orderIndex: "asc" } },
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

export async function listProjectSummariesForUser(userId: string) {
  return prisma.project.findMany({
    where: {
      OR: [
        { createdById: userId },
        { members: { some: { userId, isActive: true } } }
      ]
    },
    select: {
      id: true,
      name: true
    },
    orderBy: { name: "asc" }
  });
}

export async function listAllProjectSummaries() {
  return prisma.project.findMany({
    select: {
      id: true,
      name: true
    },
    orderBy: { name: "asc" }
  });
}

export async function userIsInvolvedInProject(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { createdById: userId },
        { members: { some: { userId, isActive: true } } }
      ]
    },
    select: { id: true }
  });

  return Boolean(project);
}

export async function listProjects() {
  return prisma.project.findMany({
    include: {
      _count: { select: { members: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      vertical: { select: { id: true, name: true, slug: true } },
      phases: { orderBy: { orderIndex: "asc" } },
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

export async function getProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      vertical: { select: { id: true, name: true, slug: true } },
      phases: { orderBy: { orderIndex: "asc" } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          reportsTo: { select: { id: true, name: true, email: true } }
        }
      }
    }
  });
}

export async function updateProject(
  id: string,
  data: {
    name?: string;
    description?: string;
    objectives?: string | null;
    finalLink?: string | null;
    verticalId?: string;
    startsAt?: Date | null;
    endsAt?: Date | null;
    status?: string;
  }
) {
  return prisma.project.update({
    where: { id },
    data,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      vertical: { select: { id: true, name: true, slug: true } },
      phases: { orderBy: { orderIndex: "asc" } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          reportsTo: { select: { id: true, name: true, email: true } }
        }
      }
    }
  });
}

export async function deleteProject(id: string) {
  return prisma.project.delete({ where: { id } });
}

export async function addProjectMember(data: {
  projectId: string;
  userId: string;
  memberRole?: string;
  reportsToUserId?: string;
}) {
  return prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: data.projectId,
        userId: data.userId
      }
    },
    update: {
      memberRole: data.memberRole ?? "MEMBER",
      reportsToUserId: data.reportsToUserId ?? null,
      isActive: true
    },
    create: {
      projectId: data.projectId,
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

export async function getProjectMemberById(memberId: string) {
  return prisma.projectMember.findUnique({
    where: { id: memberId },
    include: { user: true, reportsTo: true }
  });
}

export async function getProjectMemberByProjectAndUser(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId
      }
    }
  });
}

export async function updateProjectMember(
  memberId: string,
  data: { memberRole?: string; reportsToUserId?: string | null; isActive?: boolean }
) {
  return prisma.projectMember.update({
    where: { id: memberId },
    data,
    include: {
      user: { select: { id: true, name: true, email: true } },
      reportsTo: { select: { id: true, name: true, email: true } }
    }
  });
}

export async function removeProjectMember(memberId: string) {
  return prisma.projectMember.delete({ where: { id: memberId } });
}

export async function createProjectPhase(data: {
  projectId: string;
  name: string;
  objectives?: string;
  deadline?: Date;
  status?: string;
  orderIndex?: number;
}) {
  return prisma.projectPhase.create({
    data
  });
}

export async function getProjectPhaseById(phaseId: string) {
  return prisma.projectPhase.findUnique({
    where: { id: phaseId }
  });
}

export async function updateProjectPhase(
  phaseId: string,
  data: {
    name?: string;
    objectives?: string | null;
    deadline?: Date | null;
    status?: string;
    orderIndex?: number;
  }
) {
  return prisma.projectPhase.update({
    where: { id: phaseId },
    data
  });
}

export async function deleteProjectPhase(phaseId: string) {
  return prisma.projectPhase.delete({ where: { id: phaseId } });
}
