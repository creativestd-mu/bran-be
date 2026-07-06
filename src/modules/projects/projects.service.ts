import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/httpError";
import {
  addProjectMember,
  createProjectPhase,
  createProject,
  deleteProjectPhase,
  deleteProject,
  getProjectPhaseById,
  getProjectById,
  getProjectMemberById,
  getProjectMemberByProjectAndUser,
  listProjects,
  removeProjectMember,
  updateProjectPhase,
  updateProject,
  updateProjectMember
} from "./projects.repository";

type ProjectListMember = {
  id: string;
  userId: string;
  memberRole: string;
  reportsToUserId: string | null;
  isActive: boolean;
  joinedAt: Date;
  user: { id: string; name: string | null; email: string | null };
  reportsTo: { id: string; name: string | null; email: string | null } | null;
};

type ProjectHierarchyNode = {
  id: string;
  userId: string;
  memberRole: string;
  reportsToUserId: string | null;
  isActive: boolean;
  joinedAt: Date;
  user: { id: string; name: string | null; email: string | null };
  reportsTo: { id: string; name: string | null; email: string | null } | null;
  directReports: ProjectHierarchyNode[];
};

function buildProjectHierarchy(members: ProjectListMember[]) {
  const nodeByUserId = new Map<string, ProjectHierarchyNode>();

  for (const member of members) {
    nodeByUserId.set(member.userId, {
      id: member.id,
      userId: member.userId,
      memberRole: member.memberRole,
      reportsToUserId: member.reportsToUserId,
      isActive: member.isActive,
      joinedAt: member.joinedAt,
      user: member.user,
      reportsTo: member.reportsTo,
      directReports: []
    });
  }

  const roots: ProjectHierarchyNode[] = [];
  for (const member of members) {
    const node = nodeByUserId.get(member.userId);
    if (!node) continue;

    if (!member.reportsToUserId || !nodeByUserId.has(member.reportsToUserId)) {
      roots.push(node);
      continue;
    }

    const managerNode = nodeByUserId.get(member.reportsToUserId);
    managerNode?.directReports.push(node);
  }

  return roots;
}

function parseOptionalDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `Invalid date: ${value}`);
  }
  return date;
}

async function ensureVerticalExists(verticalId: string) {
  const vertical = await prisma.vertical.findUnique({
    where: { id: verticalId },
    select: { id: true }
  });
  if (!vertical) throw new HttpError(404, `Vertical not found: ${verticalId}`);
}

async function userCanManageProjects(roleId: string): Promise<boolean> {
  const permission = await prisma.rolePermission.findFirst({
    where: {
      roleId,
      permission: { name: "manage_projects" }
    },
    select: { roleId: true }
  });

  return Boolean(permission);
}

// Kept for potential future use (e.g. write-access gating).
void userCanManageProjects;

async function assertUserCanAccessProject(projectId: string) {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new HttpError(404, "Project not found");
  }
}

export async function listAccessibleProjects() {
  const projects = await listProjects();
  return projects.map((project) => ({
    ...project,
    hierarchy: buildProjectHierarchy(project.members as ProjectListMember[])
  }));
}

export async function getAccessibleProject(id: string) {
  const project = await getProjectById(id);
  if (!project) throw new HttpError(404, "Project not found");
  return project;
}

async function ensureProjectExists(id: string) {
  const project = await getProjectById(id);
  if (!project) throw new HttpError(404, "Project not found");
  return project;
}

export async function createTemporaryProject(input: {
  name: string;
  description?: string;
  objectives?: string;
  finalLink?: string;
  verticalId: string;
  createdById?: string;
  startsAt?: string;
  endsAt?: string;
  status?: string;
}) {
  await ensureVerticalExists(input.verticalId);
  return createProject({
    name: input.name,
    description: input.description,
    objectives: input.objectives,
    finalLink: input.finalLink,
    verticalId: input.verticalId,
    createdById: input.createdById,
    startsAt: parseOptionalDate(input.startsAt) ?? undefined,
    endsAt: parseOptionalDate(input.endsAt) ?? undefined,
    status: input.status
  });
}

export async function listTemporaryProjects() {
  return listAccessibleProjects();
}

export async function getTemporaryProject(id: string) {
  return getAccessibleProject(id);
}

export async function updateTemporaryProject(
  id: string,
  input: {
    name?: string;
    description?: string;
    objectives?: string | null;
    finalLink?: string | null;
    verticalId?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    status?: string;
  }
) {
  await ensureProjectExists(id);
  if (input.verticalId) {
    await ensureVerticalExists(input.verticalId);
  }
  return updateProject(id, {
    name: input.name,
    description: input.description,
    objectives: input.objectives,
    finalLink: input.finalLink,
    verticalId: input.verticalId,
    startsAt: parseOptionalDate(input.startsAt),
    endsAt: parseOptionalDate(input.endsAt),
    status: input.status
  });
}

export async function removeTemporaryProject(id: string) {
  await ensureProjectExists(id);
  return deleteProject(id);
}

export async function addMemberToProject(input: {
  projectId: string;
  userId: string;
  memberRole?: string;
  reportsToUserId?: string;
}) {
  await ensureProjectExists(input.projectId);

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new HttpError(404, "User not found");

  if (input.reportsToUserId) {
    if (input.reportsToUserId === input.userId) {
      throw new HttpError(400, "User cannot report to themselves");
    }
    const leaderMembership = await getProjectMemberByProjectAndUser(
      input.projectId,
      input.reportsToUserId
    );
    if (!leaderMembership) {
      throw new HttpError(400, "reportsToUserId must belong to the same project");
    }
  }

  return addProjectMember(input);
}

export async function updateProjectMemberHierarchy(
  memberId: string,
  input: { memberRole?: string; reportsToUserId?: string | null; isActive?: boolean }
) {
  const member = await getProjectMemberById(memberId);
  if (!member) throw new HttpError(404, "Project member not found");

  if (input.reportsToUserId === member.userId) {
    throw new HttpError(400, "User cannot report to themselves");
  }

  if (input.reportsToUserId) {
    const leaderMembership = await getProjectMemberByProjectAndUser(
      member.projectId,
      input.reportsToUserId
    );
    if (!leaderMembership) {
      throw new HttpError(400, "reportsToUserId must belong to the same project");
    }
  }

  return updateProjectMember(memberId, input);
}

export async function removeMemberFromProject(memberId: string) {
  const member = await getProjectMemberById(memberId);
  if (!member) throw new HttpError(404, "Project member not found");
  return removeProjectMember(memberId);
}

export async function addPhaseToProject(input: {
  projectId: string;
  name: string;
  objectives?: string;
  deadline?: string;
  status?: string;
  orderIndex?: number;
}) {
  await ensureProjectExists(input.projectId);
  return createProjectPhase({
    projectId: input.projectId,
    name: input.name,
    objectives: input.objectives,
    deadline: parseOptionalDate(input.deadline) ?? undefined,
    status: input.status,
    orderIndex: input.orderIndex
  });
}

export async function updateProjectPhaseDetails(
  phaseId: string,
  input: {
    name?: string;
    objectives?: string | null;
    deadline?: string | null;
    status?: string;
    orderIndex?: number;
  }
) {
  const phase = await getProjectPhaseById(phaseId);
  if (!phase) throw new HttpError(404, "Project phase not found");

  return updateProjectPhase(phaseId, {
    name: input.name,
    objectives: input.objectives,
    deadline: parseOptionalDate(input.deadline),
    status: input.status,
    orderIndex: input.orderIndex
  });
}

export async function removeProjectPhaseById(phaseId: string) {
  const phase = await getProjectPhaseById(phaseId);
  if (!phase) throw new HttpError(404, "Project phase not found");
  return deleteProjectPhase(phaseId);
}
