import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/httpError";
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  getTeamById,
  getTeamMemberById,
  getTeamMemberByTeamAndUser,
  listTeams,
  removeTeamMember,
  updateTeam,
  updateTeamMember
} from "./teams.repository";

type TeamHierarchyMemberInput = {
  userId: string;
  memberRole?: string;
  reportsToUserId?: string | null;
};

type TeamListMember = {
  id: string;
  userId: string;
  memberRole: string;
  reportsToUserId: string | null;
  isActive: boolean;
  joinedAt: Date;
  user: { id: string; name: string | null; email: string | null };
  reportsTo: { id: string; name: string | null; email: string | null } | null;
};

type TeamHierarchyNode = {
  id: string;
  userId: string;
  memberRole: string;
  reportsToUserId: string | null;
  isActive: boolean;
  joinedAt: Date;
  user: { id: string; name: string | null; email: string | null };
  reportsTo: { id: string; name: string | null; email: string | null } | null;
  directReports: TeamHierarchyNode[];
};

function buildTeamHierarchy(members: TeamListMember[]) {
  const nodeByUserId = new Map<string, TeamHierarchyNode>();

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

  const roots: TeamHierarchyNode[] = [];
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

function validateHierarchyMembers(members: TeamHierarchyMemberInput[]) {
  const memberIds = new Set<string>();
  const managerByUser = new Map<string, string | null>();

  for (const member of members) {
    if (memberIds.has(member.userId)) {
      throw new HttpError(400, `Duplicate userId in hierarchy payload: ${member.userId}`);
    }
    memberIds.add(member.userId);

    const managerId = member.reportsToUserId ?? null;
    if (managerId === member.userId) {
      throw new HttpError(400, "User cannot report to themselves");
    }
    managerByUser.set(member.userId, managerId);
  }

  for (const member of members) {
    const managerId = member.reportsToUserId;
    if (!managerId) continue;
    if (!memberIds.has(managerId)) {
      throw new HttpError(400, `reportsToUserId must belong to the same hierarchy payload: ${managerId}`);
    }
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();

  const detectCycle = (userId: string) => {
    if (visiting.has(userId)) {
      throw new HttpError(400, "Invalid hierarchy: circular reporting chain detected");
    }
    if (visited.has(userId)) return;

    visiting.add(userId);
    const managerId = managerByUser.get(userId);
    if (managerId) detectCycle(managerId);
    visiting.delete(userId);
    visited.add(userId);
  };

  for (const userId of memberIds) {
    detectCycle(userId);
  }
}

async function ensureVerticalExists(verticalId: string) {
  const vertical = await prisma.vertical.findUnique({
    where: { id: verticalId },
    select: { id: true }
  });
  if (!vertical) throw new HttpError(404, `Vertical not found: ${verticalId}`);
}

export async function createPermanentTeam(input: {
  name: string;
  description?: string;
  verticalId: string;
  createdById?: string;
}) {
  await ensureVerticalExists(input.verticalId);
  return createTeam(input);
}

export async function upsertPermanentTeamHierarchy(input: {
  teamId?: string;
  name?: string;
  description?: string;
  verticalId?: string;
  createdById?: string;
  members: TeamHierarchyMemberInput[];
}) {
  if (!input.teamId && !input.name) {
    throw new HttpError(400, "name is required when teamId is not provided");
  }

  if (input.verticalId) {
    await ensureVerticalExists(input.verticalId);
  }

  validateHierarchyMembers(input.members);

  if (input.members.length > 0) {
    const requestedUserIds = [...new Set(input.members.map((member) => member.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: requestedUserIds } },
      select: { id: true }
    });

    if (users.length !== requestedUserIds.length) {
      const existingUserIds = new Set(users.map((user) => user.id));
      const missingUserIds = requestedUserIds.filter((userId) => !existingUserIds.has(userId));
      throw new HttpError(404, `User(s) not found: ${missingUserIds.join(", ")}`);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    let teamId = input.teamId;
    let created = false;

    if (teamId) {
      const existingTeam = await tx.team.findUnique({
        where: { id: teamId },
        select: { id: true }
      });

      if (existingTeam) {
        await tx.team.update({
          where: { id: teamId },
          data: {
            name: input.name,
            description: input.description,
            verticalId: input.verticalId
          }
        });
      } else {
        if (!input.name) {
          throw new HttpError(400, "name is required to create a new team");
        }
        if (!input.verticalId) {
          throw new HttpError(400, "verticalId is required to create a new team");
        }
        const createdTeam = await tx.team.create({
          data: {
            id: teamId,
            name: input.name,
            description: input.description,
            verticalId: input.verticalId,
            createdById: input.createdById
          },
          select: { id: true }
        });
        teamId = createdTeam.id;
        created = true;
      }
    } else {
      if (!input.verticalId) {
        throw new HttpError(400, "verticalId is required to create a new team");
      }
      const createdTeam = await tx.team.create({
        data: {
          name: input.name!,
          description: input.description,
          verticalId: input.verticalId,
          createdById: input.createdById
        },
        select: { id: true }
      });
      teamId = createdTeam.id;
      created = true;
    }

    for (const member of input.members) {
      await tx.teamMember.upsert({
        where: {
          teamId_userId: {
            teamId,
            userId: member.userId
          }
        },
        update: {
          memberRole: member.memberRole ?? "MEMBER",
          reportsToUserId: member.reportsToUserId ?? null,
          isActive: true
        },
        create: {
          teamId,
          userId: member.userId,
          memberRole: member.memberRole ?? "MEMBER",
          reportsToUserId: member.reportsToUserId ?? null
        }
      });
    }

    const team = await tx.team.findUnique({
      where: { id: teamId },
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

    return { team, created };
  });

  if (!result.team) throw new HttpError(500, "Failed to upsert team hierarchy");
  return result;
}

export async function listPermanentTeams() {
  const teams = await listTeams();
  return teams.map((team) => ({
    ...team,
    hierarchy: buildTeamHierarchy(team.members as TeamListMember[])
  }));
}

export async function getPermanentTeam(id: string) {
  const team = await getTeamById(id);
  if (!team) throw new HttpError(404, "Team not found");
  return team;
}

export async function updatePermanentTeam(
  id: string,
  input: { name?: string; description?: string; verticalId?: string; isActive?: boolean }
) {
  await getPermanentTeam(id);
  if (input.verticalId) {
    await ensureVerticalExists(input.verticalId);
  }
  return updateTeam(id, input);
}

export async function removePermanentTeam(id: string) {
  await getPermanentTeam(id);
  return deleteTeam(id);
}

export async function addMemberToTeam(input: {
  teamId: string;
  userId: string;
  memberRole?: string;
  reportsToUserId?: string;
}) {
  await getPermanentTeam(input.teamId);

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new HttpError(404, "User not found");

  if (input.reportsToUserId) {
    if (input.reportsToUserId === input.userId) {
      throw new HttpError(400, "User cannot report to themselves");
    }
    const leaderMembership = await getTeamMemberByTeamAndUser(input.teamId, input.reportsToUserId);
    if (!leaderMembership) {
      throw new HttpError(400, "reportsToUserId must belong to the same team");
    }
  }

  return addTeamMember(input);
}

export async function updateTeamMemberHierarchy(
  memberId: string,
  input: { memberRole?: string; reportsToUserId?: string | null; isActive?: boolean }
) {
  const member = await getTeamMemberById(memberId);
  if (!member) throw new HttpError(404, "Team member not found");

  if (input.reportsToUserId === member.userId) {
    throw new HttpError(400, "User cannot report to themselves");
  }

  if (input.reportsToUserId) {
    const leaderMembership = await getTeamMemberByTeamAndUser(member.teamId, input.reportsToUserId);
    if (!leaderMembership) {
      throw new HttpError(400, "reportsToUserId must belong to the same team");
    }
  }

  return updateTeamMember(memberId, input);
}

export async function removeMemberFromTeam(memberId: string) {
  const member = await getTeamMemberById(memberId);
  if (!member) throw new HttpError(404, "Team member not found");
  return removeTeamMember(memberId);
}
