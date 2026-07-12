import { randomUUID } from "crypto";
import { HttpError } from "../../utils/httpError";
import {
  findAllUsers,
  findAllUserManagerLinks,
  findUserById,
  findUserByEmail,
  findUserManagerLink,
  findUsersForHierarchy,
  createUser as createUserInDb,
  updateUser,
  deleteUser,
  linkSocialAccount,
  unlinkSocialAccount,
  findSocialAccountsByUser
} from "./users.repository";

const VALID_PLATFORMS = ["YOUTUBE", "INSTAGRAM", "LINKEDIN", "FACEBOOK"] as const;

type UserHierarchyMemberInput = {
  userId: string;
  managerUserId?: string | null;
};

type UserHierarchyListMember = {
  id: string;
  name: string;
  email: string;
  designation: string | null;
  managerUserId: string | null;
  isActive: boolean;
  isPlaceholder: boolean;
  role: { id: string; name: string };
  manager: { id: string; name: string; email: string; designation: string | null } | null;
};

type UserHierarchyNode = {
  id: string;
  name: string;
  email: string;
  designation: string | null;
  managerUserId: string | null;
  isActive: boolean;
  isPlaceholder: boolean;
  role: { id: string; name: string };
  manager: { id: string; name: string; email: string; designation: string | null } | null;
  directReports: UserHierarchyNode[];
};

function buildUserHierarchy(members: UserHierarchyListMember[]) {
  const nodeByUserId = new Map<string, UserHierarchyNode>();

  for (const member of members) {
    nodeByUserId.set(member.id, {
      id: member.id,
      name: member.name,
      email: member.email,
      designation: member.designation,
      managerUserId: member.managerUserId,
      isActive: member.isActive,
      isPlaceholder: member.isPlaceholder,
      role: member.role,
      manager: member.manager,
      directReports: []
    });
  }

  const roots: UserHierarchyNode[] = [];
  for (const member of members) {
    const node = nodeByUserId.get(member.id);
    if (!node) continue;

    if (!member.managerUserId || !nodeByUserId.has(member.managerUserId)) {
      roots.push(node);
      continue;
    }

    const managerNode = nodeByUserId.get(member.managerUserId);
    managerNode?.directReports.push(node);
  }

  return roots;
}

function validateUserHierarchyMembers(members: UserHierarchyMemberInput[]) {
  const memberIds = new Set<string>();

  for (const member of members) {
    if (memberIds.has(member.userId)) {
      throw new HttpError(400, `Duplicate userId in hierarchy payload: ${member.userId}`);
    }
    memberIds.add(member.userId);

    if (member.managerUserId === member.userId) {
      throw new HttpError(400, "User cannot be their own manager");
    }
  }
}

async function validateUserHierarchyUpdates(members: UserHierarchyMemberInput[]) {
  validateUserHierarchyMembers(members);

  const managerUserIds = [
    ...new Set(
      members
        .map((member) => member.managerUserId)
        .filter((managerUserId): managerUserId is string => Boolean(managerUserId))
    )
  ];

  if (managerUserIds.length > 0) {
    const managers = await findAllUserManagerLinks();
    const existingUserIds = new Set(managers.map((user) => user.id));
    const missingManagerIds = managerUserIds.filter((managerUserId) => !existingUserIds.has(managerUserId));

    if (missingManagerIds.length > 0) {
      throw new HttpError(404, `Manager user(s) not found: ${missingManagerIds.join(", ")}`);
    }
  }

  const requestedUserIds = [...new Set(members.map((member) => member.userId))];
  const users = await findAllUserManagerLinks();
  const existingUserIds = new Set(users.map((user) => user.id));
  const missingUserIds = requestedUserIds.filter((userId) => !existingUserIds.has(userId));

  if (missingUserIds.length > 0) {
    throw new HttpError(404, `User(s) not found: ${missingUserIds.join(", ")}`);
  }

  const managerByUser = new Map(users.map((user) => [user.id, user.managerUserId]));

  for (const member of members) {
    if (member.managerUserId !== undefined) {
      managerByUser.set(member.userId, member.managerUserId ?? null);
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
    const managerUserId = managerByUser.get(userId);
    if (managerUserId) detectCycle(managerUserId);
    visiting.delete(userId);
    visited.add(userId);
  };

  for (const userId of requestedUserIds) {
    detectCycle(userId);
  }
}

async function ensureManagerCanBeAssigned(userId: string | undefined, managerUserId?: string | null) {
  if (managerUserId === undefined || managerUserId === null) return;

  if (userId && managerUserId === userId) {
    throw new HttpError(400, "User cannot be their own manager");
  }

  const manager = await findUserManagerLink(managerUserId);
  if (!manager) {
    throw new HttpError(404, "Manager user not found");
  }

  const visited = new Set<string>();
  let currentManagerUserId: string | null = manager.managerUserId;

  while (currentManagerUserId) {
    if (userId && currentManagerUserId === userId) {
      throw new HttpError(400, "Invalid manager hierarchy: circular reporting chain detected");
    }
    if (visited.has(currentManagerUserId)) {
      throw new HttpError(400, "Invalid existing manager hierarchy: circular reporting chain detected");
    }

    visited.add(currentManagerUserId);
    const currentManager = await findUserManagerLink(currentManagerUserId);
    currentManagerUserId = currentManager?.managerUserId ?? null;
  }
}

export async function listUsers(options: {
  page?: number;
  pageSize?: number;
  roleId?: string;
  isActive?: string;
}) {
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 20));
  const isActive =
    options.isActive === "true" ? true : options.isActive === "false" ? false : undefined;

  const { items, total } = await findAllUsers({ page, pageSize, roleId: options.roleId, isActive });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages }
  };
}

export async function getUserById(id: string) {
  const user = await findUserById(id);
  if (!user) throw new HttpError(404, "User not found");
  return user;
}

export async function createUser(data: {
  email: string;
  name: string;
  roleId: string;
  description?: string;
  phone?: string;
  designation?: string;
  managerUserId?: string | null;
  isActive?: boolean;
  isPlaceholder?: boolean;
}) {
  const existing = await findUserByEmail(data.email);
  if (existing) {
    throw new HttpError(409, "User with this email already exists");
  }

  await ensureManagerCanBeAssigned(undefined, data.managerUserId);

  return createUserInDb({
    ...data,
    isActive: data.isActive ?? true,
    isPlaceholder: data.isPlaceholder ?? false
  });
}

export async function createNewHire(data: {
  name?: string;
  designation?: string;
  roleId: string;
  managerUserId?: string | null;
  email?: string;
}) {
  const id = randomUUID();
  const email =
    data.email?.trim().toLowerCase() ||
    `newhire+${id.replace(/-/g, "").slice(0, 16)}@placeholder.internal`;
  const name = data.name?.trim() || "New Hire";

  return createUser({
    email,
    name,
    roleId: data.roleId,
    designation: data.designation?.trim() || undefined,
    managerUserId: data.managerUserId,
    isActive: false,
    isPlaceholder: true
  });
}

export async function updateUserProfile(
  id: string,
  data: {
    name?: string;
    description?: string;
    phone?: string;
    designation?: string;
    managerUserId?: string | null;
    roleId?: string;
    isActive?: boolean;
    isPlaceholder?: boolean;
    email?: string;
  }
) {
  await getUserById(id);

  if (data.email !== undefined) {
    const email = data.email.trim().toLowerCase();
    if (!email) throw new HttpError(400, "Email is required");
    const existing = await findUserByEmail(email);
    if (existing && existing.id !== id) {
      throw new HttpError(409, "User with this email already exists");
    }
    data = { ...data, email };
  }

  await ensureManagerCanBeAssigned(id, data.managerUserId);
  return updateUser(id, data);
}

export async function removeUser(id: string) {
  await getUserById(id);
  return deleteUser(id);
}

export async function addSocialAccount(
  userId: string,
  data: { platform: string; platformAccountId: string; handle?: string }
) {
  await getUserById(userId);
  const platform = data.platform.toUpperCase();
  if (!VALID_PLATFORMS.includes(platform as (typeof VALID_PLATFORMS)[number])) {
    throw new HttpError(400, `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`);
  }
  return linkSocialAccount({ ...data, platform, userId });
}

export async function removeSocialAccount(id: string) {
  return unlinkSocialAccount(id);
}

export async function getUserSocialAccounts(userId: string) {
  await getUserById(userId);
  return findSocialAccountsByUser(userId);
}

export async function getUserHierarchy(isActive?: boolean) {
  const members = await findUsersForHierarchy(isActive);

  return {
    members,
    hierarchy: buildUserHierarchy(members as UserHierarchyListMember[])
  };
}

export async function upsertUserHierarchy(members: UserHierarchyMemberInput[]) {
  await validateUserHierarchyUpdates(members);

  for (const member of members) {
    if (member.managerUserId === undefined) continue;
    await updateUser(member.userId, {
      managerUserId: member.managerUserId ?? null
    });
  }

  return getUserHierarchy();
}
