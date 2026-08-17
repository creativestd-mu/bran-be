import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma";
import type { PodSocialKind, PodSocialPlatform } from "./pods.constants";

const userPreview = { select: { id: true, name: true, email: true } } as const;

const verticalPreview = {
  select: { id: true, name: true, slug: true }
} as const;

const accountInclude = {
  _count: { select: { posts: true } }
} satisfies Prisma.PodSocialAccountInclude;

const podInclude = {
  vertical: verticalPreview,
  head: userPreview,
  socialAccounts: {
    include: accountInclude,
    orderBy: [{ platform: "asc" as const }, { handle: "asc" as const }]
  },
  projects: {
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" as const }
  },
  _count: { select: { projects: true, socialAccounts: true } }
} satisfies Prisma.PodInclude;

export async function createPod(data: {
  name: string;
  description?: string;
  verticalId: string;
  headUserId: string;
  isActive?: boolean;
}) {
  return prisma.pod.create({
    data: {
      name: data.name,
      description: data.description,
      verticalId: data.verticalId,
      headUserId: data.headUserId,
      isActive: data.isActive ?? true
    },
    include: podInclude
  });
}

export async function listPods(filters?: { verticalId?: string; isActive?: boolean }) {
  return prisma.pod.findMany({
    where: {
      ...(filters?.verticalId ? { verticalId: filters.verticalId } : {}),
      ...(filters?.isActive === undefined ? {} : { isActive: filters.isActive })
    },
    include: podInclude,
    orderBy: [{ name: "asc" }]
  });
}

export async function getPodById(id: string) {
  return prisma.pod.findUnique({
    where: { id },
    include: podInclude
  });
}

export async function findPodsByName(name: string) {
  return prisma.pod.findMany({
    where: {
      name: { equals: name, mode: "insensitive" },
      isActive: true
    },
    include: {
      vertical: verticalPreview,
      head: userPreview
    },
    orderBy: { name: "asc" }
  });
}

export async function searchPodsByName(fragment: string) {
  return prisma.pod.findMany({
    where: {
      isActive: true,
      name: { contains: fragment, mode: "insensitive" }
    },
    include: {
      vertical: verticalPreview,
      head: userPreview
    },
    orderBy: { name: "asc" },
    take: 10
  });
}

export async function updatePod(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    verticalId?: string;
    headUserId?: string;
    isActive?: boolean;
  }
) {
  return prisma.pod.update({
    where: { id },
    data,
    include: podInclude
  });
}

export async function createPodSocialAccount(data: {
  podId: string;
  kind: PodSocialKind;
  platform: PodSocialPlatform;
  handle: string;
  url: string;
  platformAccountId?: string;
  isActive?: boolean;
}) {
  return prisma.podSocialAccount.create({
    data: {
      podId: data.podId,
      kind: data.kind,
      platform: data.platform,
      handle: data.handle,
      url: data.url,
      platformAccountId: data.platformAccountId,
      isActive: data.isActive ?? true
    },
    include: accountInclude
  });
}

export async function listPodSocialAccounts(filters: {
  podId?: string;
  kind?: PodSocialKind;
  platform?: PodSocialPlatform;
  isActive?: boolean;
}) {
  return prisma.podSocialAccount.findMany({
    where: {
      ...(filters.podId ? { podId: filters.podId } : {}),
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.platform ? { platform: filters.platform } : {}),
      ...(filters.isActive === undefined ? {} : { isActive: filters.isActive })
    },
    include: {
      ...accountInclude,
      pod: { select: { id: true, name: true, verticalId: true, isActive: true } }
    },
    orderBy: [{ platform: "asc" }, { handle: "asc" }]
  });
}

export async function getPodSocialAccountById(id: string) {
  return prisma.podSocialAccount.findUnique({
    where: { id },
    include: {
      ...accountInclude,
      pod: { select: { id: true, name: true, verticalId: true, isActive: true } }
    }
  });
}

export async function findPodSocialAccount(input: {
  podId: string;
  kind: string;
  platform: string;
  handle: string;
}) {
  return prisma.podSocialAccount.findUnique({
    where: {
      podId_kind_platform_handle: {
        podId: input.podId,
        kind: input.kind,
        platform: input.platform,
        handle: input.handle
      }
    }
  });
}

export async function updatePodSocialAccount(
  id: string,
  data: {
    kind?: PodSocialKind;
    platform?: PodSocialPlatform;
    handle?: string;
    url?: string;
    platformAccountId?: string | null;
    isActive?: boolean;
    lastSyncedAt?: Date | null;
    lastSyncStatus?: string | null;
    lastSyncError?: string | null;
  }
) {
  return prisma.podSocialAccount.update({
    where: { id },
    data,
    include: accountInclude
  });
}

export async function deletePodSocialAccount(id: string) {
  return prisma.podSocialAccount.delete({ where: { id } });
}

export async function listActivePodSocialAccountsForSync() {
  return prisma.podSocialAccount.findMany({
    where: {
      isActive: true,
      pod: { isActive: true }
    },
    include: {
      pod: { select: { id: true, name: true } }
    },
    orderBy: [{ platform: "asc" }, { handle: "asc" }]
  });
}

export async function upsertPodSocialPost(data: {
  accountId: string;
  platformPostId: string;
  url?: string | null;
  title?: string | null;
  caption?: string | null;
  author?: string | null;
  publishedAt?: Date | null;
  metrics?: Prisma.InputJsonValue | null;
  rawPayload: string;
  syncedAt?: Date;
}) {
  const syncedAt = data.syncedAt ?? new Date();
  return prisma.podSocialPost.upsert({
    where: {
      accountId_platformPostId: {
        accountId: data.accountId,
        platformPostId: data.platformPostId
      }
    },
    create: {
      accountId: data.accountId,
      platformPostId: data.platformPostId,
      url: data.url ?? null,
      title: data.title ?? null,
      caption: data.caption ?? null,
      author: data.author ?? null,
      publishedAt: data.publishedAt ?? null,
      metrics: data.metrics ?? Prisma.JsonNull,
      rawPayload: data.rawPayload,
      syncedAt
    },
    update: {
      url: data.url ?? null,
      title: data.title ?? null,
      caption: data.caption ?? null,
      author: data.author ?? null,
      publishedAt: data.publishedAt ?? null,
      metrics: data.metrics ?? Prisma.JsonNull,
      rawPayload: data.rawPayload,
      syncedAt
    }
  });
}

export async function listPodSocialPosts(filters: {
  podId?: string;
  accountId?: string;
  kind?: PodSocialKind;
  platform?: PodSocialPlatform;
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  return prisma.podSocialPost.findMany({
    where: {
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.from || filters.to
        ? {
            publishedAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {})
            }
          }
        : {}),
      account: {
        ...(filters.podId ? { podId: filters.podId } : {}),
        ...(filters.kind ? { kind: filters.kind } : {}),
        ...(filters.platform ? { platform: filters.platform } : {})
      }
    },
    include: {
      account: {
        select: {
          id: true,
          podId: true,
          kind: true,
          platform: true,
          handle: true,
          url: true,
          lastSyncedAt: true,
          pod: { select: { id: true, name: true } }
        }
      }
    },
    orderBy: [{ publishedAt: "desc" }, { syncedAt: "desc" }],
    take: filters.limit ?? 50
  });
}
