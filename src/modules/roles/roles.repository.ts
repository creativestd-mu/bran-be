import { prisma } from "../../lib/prisma";

export async function findAllRoles() {
  return prisma.role.findMany({
    include: {
      permissions: {
        include: { permission: true }
      },
      _count: { select: { users: true } }
    },
    orderBy: { name: "asc" }
  });
}

export async function findRoleById(id: string) {
  return prisma.role.findUnique({
    where: { id },
    include: {
      permissions: {
        include: { permission: true }
      },
      _count: { select: { users: true } }
    }
  });
}

export async function findRoleByName(name: string) {
  return prisma.role.findUnique({ where: { name } });
}

export async function createRole(data: { name: string; description?: string }) {
  return prisma.role.create({
    data,
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } }
    }
  });
}

export async function updateRole(id: string, data: { name?: string; description?: string }) {
  return prisma.role.update({
    where: { id },
    data,
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } }
    }
  });
}

export async function deleteRole(id: string) {
  return prisma.role.delete({ where: { id } });
}

export async function assignPermissionsToRole(roleId: string, permissionIds: string[]) {
  await prisma.rolePermission.deleteMany({ where: { roleId } });

  if (permissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId }))
    });
  }

  return findRoleById(roleId);
}

export async function findAllPermissions() {
  return prisma.permission.findMany({ orderBy: { name: "asc" } });
}

export async function createPermission(data: { name: string; description?: string }) {
  return prisma.permission.create({ data });
}

export async function deletePermission(id: string) {
  return prisma.permission.delete({ where: { id } });
}
