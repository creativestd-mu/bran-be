import { HttpError } from "../../utils/httpError";
import {
  findAllRoles,
  findRoleById,
  findRoleByName,
  createRole as createRoleInDb,
  updateRole as updateRoleInDb,
  deleteRole as deleteRoleInDb,
  assignPermissionsToRole,
  findAllPermissions,
  createPermission as createPermissionInDb,
  deletePermission as deletePermissionInDb
} from "./roles.repository";

const PROTECTED_ROLES = ["admin", "manager", "content_creator"];

export async function listRoles() {
  const roles = await findAllRoles();
  return roles.map((role) => ({
    ...role,
    permissions: role.permissions.map((rp) => rp.permission)
  }));
}

export async function getRoleById(id: string) {
  const role = await findRoleById(id);
  if (!role) throw new HttpError(404, "Role not found");
  return {
    ...role,
    permissions: role.permissions.map((rp) => rp.permission)
  };
}

export async function createRole(data: { name: string; description?: string }) {
  const existing = await findRoleByName(data.name);
  if (existing) throw new HttpError(409, "Role with this name already exists");
  return createRoleInDb(data);
}

export async function updateRole(id: string, data: { name?: string; description?: string }) {
  const role = await findRoleById(id);
  if (!role) throw new HttpError(404, "Role not found");

  if (data.name && data.name !== role.name) {
    const existing = await findRoleByName(data.name);
    if (existing) throw new HttpError(409, "Role with this name already exists");
  }

  return updateRoleInDb(id, data);
}

export async function removeRole(id: string) {
  const role = await findRoleById(id);
  if (!role) throw new HttpError(404, "Role not found");
  if (PROTECTED_ROLES.includes(role.name)) {
    throw new HttpError(400, "Cannot delete a built-in role");
  }
  if (role._count.users > 0) {
    throw new HttpError(400, "Cannot delete a role that still has users assigned");
  }
  return deleteRoleInDb(id);
}

export async function setRolePermissions(roleId: string, permissionIds: string[]) {
  const role = await findRoleById(roleId);
  if (!role) throw new HttpError(404, "Role not found");
  return assignPermissionsToRole(roleId, permissionIds);
}

export async function listPermissions() {
  return findAllPermissions();
}

export async function createPermission(data: { name: string; description?: string }) {
  return createPermissionInDb(data);
}

export async function removePermission(id: string) {
  return deletePermissionInDb(id);
}
