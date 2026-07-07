import { prisma } from "../../lib/prisma";

export function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export async function loadNameAssignmentPreferences(
  ownerUserId: string
): Promise<Map<string, string>> {
  const rows = await prisma.nameAssignmentPreference.findMany({
    where: { ownerUserId },
    select: { nameKey: true, userId: true }
  });

  return new Map(rows.map((row) => [row.nameKey, row.userId]));
}

export async function learnAssignmentPreference(options: {
  ownerUserId: string;
  spokenName: string;
  userId: string;
}): Promise<void> {
  const nameKey = normalizeNameKey(options.spokenName);
  if (!nameKey) return;

  await prisma.nameAssignmentPreference.upsert({
    where: {
      ownerUserId_nameKey: {
        ownerUserId: options.ownerUserId,
        nameKey
      }
    },
    update: {
      userId: options.userId
    },
    create: {
      ownerUserId: options.ownerUserId,
      nameKey,
      userId: options.userId
    }
  });
}

export type NameResolutionContext = {
  uploaderId: string;
  directReportIds: Set<string>;
  preferenceMap: Map<string, string>;
};

export function resolveUserIdFromName(
  name: string | null | undefined,
  users: Array<{ id: string; name: string }>,
  ctx?: NameResolutionContext
): string | null {
  if (!name?.trim() || users.length === 0) return null;

  const normTarget = normalizeNameKey(name);

  if (ctx) {
    const preferredUserId = ctx.preferenceMap.get(normTarget);
    if (preferredUserId && users.some((user) => user.id === preferredUserId)) {
      return preferredUserId;
    }
  }

  const candidates = findNameCandidates(normTarget, users);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].id;

  if (ctx) {
    const directReports = candidates.filter((user) => ctx.directReportIds.has(user.id));
    if (directReports.length === 1) return directReports[0].id;
    if (directReports.length > 1) return directReports[0].id;
  }

  return candidates[0].id;
}

function findNameCandidates(
  normTarget: string,
  users: Array<{ id: string; name: string }>
): Array<{ id: string; name: string }> {
  const exact = users.filter((user) => user.name.toLowerCase() === normTarget);
  if (exact.length > 0) return exact;

  const substringMatches = users.filter((user) => {
    const normUser = user.name.toLowerCase();
    return normUser.includes(normTarget) || normTarget.includes(normUser);
  });
  if (substringMatches.length > 0) return substringMatches;

  return users.filter((user) => {
    const firstName = user.name.toLowerCase().split(" ")[0];
    return firstName && normTarget === firstName;
  });
}

export function normalizeStepDescription(description: string): string {
  return description.trim().toLowerCase();
}

export function resolvePreferenceOwnerId(workUnit: {
  createdById: string | null;
  userId: string;
}): string {
  return workUnit.createdById ?? workUnit.userId;
}
