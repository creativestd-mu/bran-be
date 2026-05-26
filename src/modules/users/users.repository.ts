import { prisma } from "../../lib/prisma";

export async function findAllUsers(options: {
  page: number;
  pageSize: number;
  roleId?: string;
  isActive?: boolean;
}) {
  const { page, pageSize, roleId, isActive } = options;
  const where: Record<string, unknown> = {};

  if (roleId) where.roleId = roleId;
  if (isActive !== undefined) where.isActive = isActive;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { role: { select: { id: true, name: true } } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" }
    }),
    prisma.user.count({ where })
  ]);

  return { items, total };
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      role: { select: { id: true, name: true } },
      socialAccounts: true
    }
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { role: { select: { id: true, name: true } } }
  });
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
  return prisma.user.create({
    data,
    include: { role: { select: { id: true, name: true } } }
  });
}

export async function updateUser(
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
  return prisma.user.update({
    where: { id },
    data,
    include: { role: { select: { id: true, name: true } } }
  });
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}

export async function linkSocialAccount(data: {
  userId: string;
  platform: string;
  platformAccountId: string;
  handle?: string;
}) {
  return prisma.socialAccount.upsert({
    where: {
      userId_platform_platformAccountId: {
        userId: data.userId,
        platform: data.platform,
        platformAccountId: data.platformAccountId
      }
    },
    update: { handle: data.handle },
    create: data
  });
}

export async function unlinkSocialAccount(id: string) {
  return prisma.socialAccount.delete({ where: { id } });
}

export async function findSocialAccountsByUser(userId: string) {
  return prisma.socialAccount.findMany({ where: { userId } });
}
