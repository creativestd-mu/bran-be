import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/httpError";
import {
  POD_SOCIAL_KINDS,
  POD_SOCIAL_PLATFORMS,
  type PodSocialKind,
  type PodSocialPlatform
} from "./pods.constants";
import {
  createPod,
  createPodSocialAccount,
  deletePodSocialAccount,
  findPodSocialAccount,
  getPodById,
  getPodSocialAccountById,
  listPodSocialAccounts,
  listPodSocialPosts,
  listPods,
  updatePod,
  updatePodSocialAccount
} from "./pods.repository";
import { syncPodSocialAccount } from "./pods.apify";

function assertKind(kind: string): asserts kind is PodSocialKind {
  if (!POD_SOCIAL_KINDS.includes(kind as PodSocialKind)) {
    throw new HttpError(400, `Invalid social account kind: ${kind}`);
  }
}

function assertPlatform(platform: string): asserts platform is PodSocialPlatform {
  if (!POD_SOCIAL_PLATFORMS.includes(platform as PodSocialPlatform)) {
    throw new HttpError(400, `Invalid social platform: ${platform}`);
  }
}

export function normalizeSocialHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "").replace(/^\/+/, "").toLowerCase();
}

export function defaultUrlForPlatform(platform: PodSocialPlatform, handle: string): string {
  const clean = normalizeSocialHandle(handle);
  switch (platform) {
    case "INSTAGRAM":
      return `https://www.instagram.com/${clean}/`;
    case "YOUTUBE":
      return clean.startsWith("uc") || clean.startsWith("UC")
        ? `https://www.youtube.com/channel/${clean}`
        : `https://www.youtube.com/@${clean}`;
    case "X":
      return `https://x.com/${clean}`;
    case "LINKEDIN":
      return `https://www.linkedin.com/in/${clean}/`;
    default:
      return `https://example.com/${clean}`;
  }
}

export function normalizeSocialUrl(
  platform: PodSocialPlatform,
  handle: string,
  url?: string
): string {
  if (url?.trim()) {
    try {
      const parsed = new URL(url.trim());
      return parsed.toString();
    } catch {
      throw new HttpError(400, `Invalid account URL: ${url}`);
    }
  }
  return defaultUrlForPlatform(platform, handle);
}

async function ensureVerticalExists(verticalId: string) {
  const vertical = await prisma.vertical.findUnique({
    where: { id: verticalId },
    select: { id: true }
  });
  if (!vertical) throw new HttpError(404, `Vertical not found: ${verticalId}`);
}

async function ensureUserExists(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true }
  });
  if (!user) throw new HttpError(404, `User not found: ${userId}`);
  if (!user.isActive) throw new HttpError(400, "Head user must be active");
}

async function ensurePodExists(id: string) {
  const pod = await getPodById(id);
  if (!pod) throw new HttpError(404, "Pod not found");
  return pod;
}

export async function createPodService(input: {
  name: string;
  description?: string;
  verticalId: string;
  headUserId: string;
  isActive?: boolean;
}) {
  await Promise.all([ensureVerticalExists(input.verticalId), ensureUserExists(input.headUserId)]);
  return createPod(input);
}

export async function listPodsService(filters?: { verticalId?: string; isActive?: boolean }) {
  return listPods(filters);
}

export async function getPodService(id: string) {
  return ensurePodExists(id);
}

export async function updatePodService(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    verticalId?: string;
    headUserId?: string;
    isActive?: boolean;
  }
) {
  await ensurePodExists(id);
  if (input.verticalId) await ensureVerticalExists(input.verticalId);
  if (input.headUserId) await ensureUserExists(input.headUserId);
  return updatePod(id, input);
}

export async function deactivatePodService(id: string) {
  await ensurePodExists(id);
  return updatePod(id, { isActive: false });
}

export async function addPodAccountService(
  podId: string,
  input: {
    kind: string;
    platform: string;
    handle: string;
    url?: string;
    platformAccountId?: string;
    isActive?: boolean;
  }
) {
  await ensurePodExists(podId);
  assertKind(input.kind);
  assertPlatform(input.platform);

  const handle = normalizeSocialHandle(input.handle);
  if (!handle) throw new HttpError(400, "handle is required");

  const existing = await findPodSocialAccount({
    podId,
    kind: input.kind,
    platform: input.platform,
    handle
  });
  if (existing) {
    throw new HttpError(409, "This social account already exists on the pod");
  }

  return createPodSocialAccount({
    podId,
    kind: input.kind,
    platform: input.platform,
    handle,
    url: normalizeSocialUrl(input.platform, handle, input.url),
    platformAccountId: input.platformAccountId,
    isActive: input.isActive
  });
}

export async function listPodAccountsService(
  podId: string,
  filters: { kind?: PodSocialKind; platform?: PodSocialPlatform; isActive?: boolean }
) {
  await ensurePodExists(podId);
  return listPodSocialAccounts({ podId, ...filters });
}

export async function updatePodAccountService(
  accountId: string,
  input: {
    kind?: string;
    platform?: string;
    handle?: string;
    url?: string;
    platformAccountId?: string | null;
    isActive?: boolean;
  }
) {
  const account = await getPodSocialAccountById(accountId);
  if (!account) throw new HttpError(404, "Pod social account not found");

  const kind = (input.kind ?? account.kind) as PodSocialKind;
  const platform = (input.platform ?? account.platform) as PodSocialPlatform;
  assertKind(kind);
  assertPlatform(platform);

  const handle = input.handle !== undefined ? normalizeSocialHandle(input.handle) : account.handle;
  if (!handle) throw new HttpError(400, "handle is required");

  if (
    handle !== account.handle ||
    kind !== account.kind ||
    platform !== account.platform
  ) {
    const existing = await findPodSocialAccount({
      podId: account.podId,
      kind,
      platform,
      handle
    });
    if (existing && existing.id !== account.id) {
      throw new HttpError(409, "This social account already exists on the pod");
    }
  }

  return updatePodSocialAccount(accountId, {
    kind,
    platform,
    handle,
    url:
      input.url !== undefined
        ? normalizeSocialUrl(platform, handle, input.url)
        : normalizeSocialUrl(platform, handle, account.url),
    platformAccountId: input.platformAccountId,
    isActive: input.isActive
  });
}

export async function removePodAccountService(accountId: string) {
  const account = await getPodSocialAccountById(accountId);
  if (!account) throw new HttpError(404, "Pod social account not found");
  return deletePodSocialAccount(accountId);
}

export async function listPodPostsService(
  podId: string,
  filters: {
    accountId?: string;
    kind?: PodSocialKind;
    platform?: PodSocialPlatform;
    from?: string;
    to?: string;
    limit?: number;
  }
) {
  await ensurePodExists(podId);
  if (filters.accountId) {
    const account = await getPodSocialAccountById(filters.accountId);
    if (!account || account.podId !== podId) {
      throw new HttpError(404, "Pod social account not found on this pod");
    }
  }

  return listPodSocialPosts({
    podId,
    accountId: filters.accountId,
    kind: filters.kind,
    platform: filters.platform,
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(filters.to) : undefined,
    limit: filters.limit
  });
}

export async function syncPodAccountService(accountId: string) {
  const account = await getPodSocialAccountById(accountId);
  if (!account) throw new HttpError(404, "Pod social account not found");
  return syncPodSocialAccount(accountId);
}
