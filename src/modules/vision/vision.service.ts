import { HttpError } from "../../utils/httpError";
import {
  createVision as createVisionInDb,
  deleteVision as deleteVisionInDb,
  findExistingTeamIds,
  findExistingUserIds,
  findVisionById,
  findVisions,
  isUserInvolvedInVision,
  updateVision as updateVisionInDb
} from "./vision.repository";
import {
  deleteVisionDocument,
  displayFilename,
  newVisionId,
  openVisionDocumentReadStream,
  saveVisionDocument
} from "./vision.storage";

const VISION_MANAGER_ROLES = new Set(["admin", "chief_of_staff", "superadmin"]);

export function canManageVisions(roleName: string): boolean {
  return VISION_MANAGER_ROLES.has(roleName);
}

export function assertCanManageVisions(roleName: string): void {
  if (!canManageVisions(roleName)) {
    throw new HttpError(403, "Only admin or chief of staff can manage visions");
  }
}

function addMonths(start: Date, months: number): Date {
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  return end;
}

function parseOptionalDate(value?: string): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `Invalid date: ${value}`);
  }
  return parsed;
}

async function validateInvolvement(
  scope: string,
  teamIds: string[],
  userIds: string[]
): Promise<{ teamIds: string[]; userIds: string[] }> {
  if (scope === "ALL") {
    return { teamIds: [], userIds: [] };
  }

  const [existingTeamIds, existingUserIds] = await Promise.all([
    findExistingTeamIds(teamIds),
    findExistingUserIds(userIds)
  ]);

  const missingTeams = teamIds.filter((id) => !existingTeamIds.includes(id));
  if (missingTeams.length > 0) {
    throw new HttpError(404, `Team(s) not found: ${missingTeams.join(", ")}`);
  }

  const missingUsers = userIds.filter((id) => !existingUserIds.includes(id));
  if (missingUsers.length > 0) {
    throw new HttpError(404, `User(s) not found: ${missingUsers.join(", ")}`);
  }

  return { teamIds: existingTeamIds, userIds: existingUserIds };
}

function formatVision(vision: NonNullable<Awaited<ReturnType<typeof findVisionById>>>) {
  return {
    id: vision.id,
    title: vision.title,
    description: vision.description,
    horizon: vision.horizon,
    durationMonths: vision.durationMonths,
    startsAt: vision.startsAt,
    endsAt: vision.endsAt,
    scope: vision.scope,
    document: {
      originalFilename: vision.originalFilename,
      mimeType: vision.mimeType,
      fileSizeBytes: vision.fileSizeBytes
    },
    involvement: {
      scope: vision.scope,
      teams: vision.teams.map(({ team }) => ({
        id: team.id,
        name: team.name,
        verticalId: team.verticalId,
        memberCount: team._count.members
      })),
      users: vision.users.map(({ user }) => user)
    },
    createdBy: vision.createdBy,
    createdAt: vision.createdAt,
    updatedAt: vision.updatedAt
  };
}

export async function createVision(
  createdById: string,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  data: {
    title: string;
    description?: string;
    horizon: string;
    durationMonths: number;
    startsAt?: string;
    scope: string;
    teamIds: string[];
    userIds: string[];
  }
) {
  const involvement = await validateInvolvement(data.scope, data.teamIds, data.userIds);
  const startsAt = parseOptionalDate(data.startsAt);
  const endsAt = addMonths(startsAt, data.durationMonths);
  const visionId = newVisionId();

  const storagePath = await saveVisionDocument({
    visionId,
    fileBuffer: file.buffer,
    originalname: file.originalname,
    mimetype: file.mimetype
  });

  const vision = await createVisionInDb({
    id: visionId,
    title: data.title,
    description: data.description ?? null,
    horizon: data.horizon,
    durationMonths: data.durationMonths,
    startsAt,
    endsAt,
    scope: data.scope,
    originalFilename: displayFilename(file.originalname),
    mimeType: file.mimetype,
    fileSizeBytes: file.size,
    storagePath,
    createdById,
    teamIds: involvement.teamIds,
    userIds: involvement.userIds
  });

  return formatVision(vision);
}

export async function getVisionById(id: string) {
  const vision = await findVisionById(id);
  if (!vision) throw new HttpError(404, "Vision not found");
  return formatVision(vision);
}

export async function assertCanViewVision(
  visionId: string,
  viewerUserId: string,
  roleName: string
): Promise<void> {
  if (canManageVisions(roleName)) return;
  const allowed = await isUserInvolvedInVision(visionId, viewerUserId);
  if (!allowed) {
    throw new HttpError(403, "Not authorized to view this vision");
  }
}

export async function listVisions(options: {
  viewerUserId: string;
  viewerRole: string;
  horizon?: string;
  scope?: string;
  teamId?: string;
  userId?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 20));

  const manager = canManageVisions(options.viewerRole);
  const { items, total } = await findVisions({
    horizon: options.horizon,
    scope: options.scope,
    teamId: manager ? options.teamId : undefined,
    userId: manager ? options.userId : undefined,
    visibleToUserId: manager ? undefined : options.viewerUserId,
    page,
    pageSize
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items: items.map(formatVision),
    pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages }
  };
}

export async function updateVision(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    horizon?: string;
    durationMonths?: number;
    startsAt?: string;
    scope?: string;
    teamIds?: string[];
    userIds?: string[];
  },
  file?: { buffer: Buffer; originalname: string; mimetype: string; size: number }
) {
  const existing = await findVisionById(id);
  if (!existing) throw new HttpError(404, "Vision not found");

  const nextScope = data.scope ?? existing.scope;
  const nextTeamIds = data.teamIds ?? existing.teams.map(({ teamId }) => teamId);
  const nextUserIds = data.userIds ?? existing.users.map(({ userId }) => userId);
  const involvement = await validateInvolvement(nextScope, nextTeamIds, nextUserIds);

  const startsAt = data.startsAt ? parseOptionalDate(data.startsAt) : existing.startsAt;
  const durationMonths = data.durationMonths ?? existing.durationMonths;
  const endsAt = addMonths(startsAt, durationMonths);

  let storageUpdate: {
    originalFilename?: string;
    mimeType?: string;
    fileSizeBytes?: number;
    storagePath?: string;
  } = {};

  if (file) {
    await deleteVisionDocument(existing.storagePath);
    storageUpdate = {
      originalFilename: displayFilename(file.originalname),
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      storagePath: await saveVisionDocument({
        visionId: id,
        fileBuffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype
      })
    };
  }

  const vision = await updateVisionInDb(id, {
    title: data.title,
    description: data.description,
    horizon: data.horizon,
    durationMonths: data.durationMonths,
    startsAt,
    endsAt,
    scope: data.scope,
    teamIds:
      data.scope !== undefined || data.teamIds !== undefined || data.userIds !== undefined
        ? involvement.teamIds
        : undefined,
    userIds:
      data.scope !== undefined || data.teamIds !== undefined || data.userIds !== undefined
        ? involvement.userIds
        : undefined,
    ...storageUpdate
  });

  return formatVision(vision!);
}

export async function removeVision(id: string) {
  const existing = await findVisionById(id);
  if (!existing) throw new HttpError(404, "Vision not found");

  await deleteVisionInDb(id);
  await deleteVisionDocument(existing.storagePath);
}

export async function resolveVisionDocumentForDownload(id: string) {
  const vision = await findVisionById(id);
  if (!vision) throw new HttpError(404, "Vision not found");
  return {
    vision,
    stream: await openVisionDocumentReadStream(vision.storagePath)
  };
}
