import { Prisma } from "@prisma/client";

import { ATTENDANCE_ADMIN_ROLES } from "../attendance/attendance.constants";
import { HttpError } from "../../utils/httpError";
import {
  createTranscriptionKeyword,
  deleteTranscriptionKeyword,
  findTranscriptionKeywordById,
  findTranscriptionKeywordByNormalized,
  listTranscriptionKeywords,
  normalizeTranscriptionPhrase,
  updateTranscriptionKeyword
} from "./transcription-keywords.repository";

export function assertCanManageTranscriptionKeywords(roleName: string): void {
  if (!ATTENDANCE_ADMIN_ROLES.has(roleName)) {
    throw new HttpError(403, "Only admin or chief of staff can manage transcription keywords");
  }
}

export async function listTranscriptionKeywordsService(input: {
  roleName: string;
  isActive?: boolean;
}) {
  assertCanManageTranscriptionKeywords(input.roleName);
  return listTranscriptionKeywords({ isActive: input.isActive });
}

export async function createTranscriptionKeywordService(input: {
  roleName: string;
  userId: string;
  phrase: string;
  notes?: string | null;
}) {
  assertCanManageTranscriptionKeywords(input.roleName);

  const normalized = normalizeTranscriptionPhrase(input.phrase);
  const existing = await findTranscriptionKeywordByNormalized(normalized);
  if (existing) {
    throw new HttpError(409, `Keyword already exists: "${existing.phrase}"`);
  }

  try {
    return await createTranscriptionKeyword({
      phrase: input.phrase,
      notes: input.notes,
      createdById: input.userId
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "A keyword with that phrase already exists");
    }
    throw error;
  }
}

export async function updateTranscriptionKeywordService(input: {
  roleName: string;
  id: string;
  phrase?: string;
  notes?: string | null;
  isActive?: boolean;
}) {
  assertCanManageTranscriptionKeywords(input.roleName);

  const existing = await findTranscriptionKeywordById(input.id);
  if (!existing) {
    throw new HttpError(404, "Transcription keyword not found");
  }

  if (input.phrase !== undefined) {
    const normalized = normalizeTranscriptionPhrase(input.phrase);
    const clash = await findTranscriptionKeywordByNormalized(normalized);
    if (clash && clash.id !== input.id) {
      throw new HttpError(409, `Keyword already exists: "${clash.phrase}"`);
    }
  }

  try {
    return await updateTranscriptionKeyword(input.id, {
      phrase: input.phrase,
      notes: input.notes,
      isActive: input.isActive
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "A keyword with that phrase already exists");
    }
    throw error;
  }
}

export async function deleteTranscriptionKeywordService(input: {
  roleName: string;
  id: string;
}) {
  assertCanManageTranscriptionKeywords(input.roleName);

  const existing = await findTranscriptionKeywordById(input.id);
  if (!existing) {
    throw new HttpError(404, "Transcription keyword not found");
  }

  await deleteTranscriptionKeyword(input.id);
  return { id: input.id, deleted: true as const };
}
