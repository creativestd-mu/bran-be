import { HttpError } from "../../utils/httpError";
import {
  findAllUsers,
  findUserById,
  findUserByEmail,
  createUser as createUserInDb,
  updateUser,
  deleteUser,
  linkSocialAccount,
  unlinkSocialAccount,
  findSocialAccountsByUser
} from "./users.repository";

const VALID_PLATFORMS = ["YOUTUBE", "INSTAGRAM", "LINKEDIN", "FACEBOOK"] as const;

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
  isActive?: boolean;
}) {
  const existing = await findUserByEmail(data.email);
  if (existing) {
    throw new HttpError(409, "User with this email already exists");
  }

  return createUserInDb({
    ...data,
    isActive: data.isActive ?? true
  });
}

export async function updateUserProfile(
  id: string,
  data: {
    name?: string;
    description?: string;
    phone?: string;
    designation?: string;
    roleId?: string;
    isActive?: boolean;
  }
) {
  await getUserById(id);
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
