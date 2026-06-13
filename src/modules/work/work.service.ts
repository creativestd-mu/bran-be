import { HttpError } from "../../utils/httpError";
import { parseApiDateBoundary } from "../../utils/timezone";
import { indexWorkUnitForSearch } from "../ai/ai.service";
import { transcribeAndArchiveVoiceRecording } from "../voice-recording/voice-recording.service";
import {
  computeDueFields,
  formatWorkUnitForResponse,
  resolveStatusAndClosedAt
} from "./work.due-fields";
import { extractWorkUnitsFromTranscript } from "./work.extraction";
import {
  createWorkUnit as createWorkUnitInDb,
  deleteWorkUnit as deleteWorkUnitInDb,
  findWorkStepsByUserAndDeadlineRange,
  findWorkUnitById,
  findWorkUnits,
  updateWorkUnit as updateWorkUnitInDb
} from "./work.repository";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseOptionalDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `Invalid date: ${value}`);
  }
  return parsed;
}

function parseRangeFrom(value?: string): Date | undefined {
  if (!value) return undefined;
  try {
    return parseApiDateBoundary(value, "start");
  } catch {
    throw new HttpError(400, `Invalid date: ${value}`);
  }
}

function parseRangeTo(value?: string): Date | undefined {
  if (!value) return undefined;
  try {
    return parseApiDateBoundary(value, "end");
  } catch {
    throw new HttpError(400, `Invalid date: ${value}`);
  }
}

function canViewAll(roleName: string): boolean {
  return roleName === "admin" || roleName === "manager" || roleName === "superadmin";
}

export function assertCanView(
  unit: { userId: string; isPrivate: boolean },
  viewerUserId: string
): void {
  if (unit.isPrivate && unit.userId !== viewerUserId) {
    throw new HttpError(403, "Not authorized to view this work unit");
  }
}

export function assertCanModify(
  unit: { userId: string; isPrivate: boolean },
  viewerUserId: string,
  roleName: string
): void {
  if (unit.isPrivate) {
    if (unit.userId !== viewerUserId) {
      throw new HttpError(403, "Not authorized to modify this work unit");
    }
    return;
  }

  if (unit.userId !== viewerUserId && !canViewAll(roleName)) {
    throw new HttpError(403, "Not authorized to modify this work unit");
  }
}

const CLOSED_LOCK_MESSAGE = "Closed work unit is locked. Reopen it before editing.";

function isPureReopenRequest(data: {
  status?: string;
  title?: string;
  context?: string;
  isPrivate?: boolean;
  steps?: unknown;
}): boolean {
  return (
    data.status === "OPEN" &&
    data.title === undefined &&
    data.context === undefined &&
    data.isPrivate === undefined &&
    data.steps === undefined
  );
}

function assertNotLockedClosedUnit(
  status: string,
  data: {
    status?: string;
    title?: string;
    context?: string;
    isPrivate?: boolean;
    steps?: unknown;
  }
): void {
  if (status !== "CLOSED") return;
  if (isPureReopenRequest(data)) return;
  throw new HttpError(409, CLOSED_LOCK_MESSAGE);
}

function mapSteps(
  steps?: Array<{ description: string; deadline?: string | null; done?: boolean }>
) {
  return (steps ?? []).map((step) => ({
    description: step.description,
    deadline: parseOptionalDate(step.deadline) ?? null,
    done: step.done ?? false
  }));
}

function buildWorkUnitWriteFields(options: {
  existingStatus?: string;
  existingClosedAt?: Date | null;
  explicitStatus?: string;
  steps: Array<{ description: string; deadline: Date | null; done: boolean }>;
  stepsUpdated?: boolean;
}) {
  const { status, closedAt } = resolveStatusAndClosedAt({
    existingStatus: options.existingStatus ?? "OPEN",
    existingClosedAt: options.existingClosedAt ?? null,
    explicitStatus: options.explicitStatus,
    steps: options.steps,
    stepsUpdated: options.stepsUpdated ?? true
  });
  const dueFields = computeDueFields(options.steps);

  return {
    status,
    closedAt,
    nextDueAt: dueFields.nextDueAt,
    firstDueAt: dueFields.firstDueAt
  };
}

export async function createWorkUnit(
  userId: string,
  data: {
    title: string;
    context: string;
    status?: string;
    isPrivate?: boolean;
    audioRecordingId?: string | null;
    steps?: Array<{ description: string; deadline?: string | null; done?: boolean }>;
  }
) {
  const steps = mapSteps(data.steps);
  const lifecycle = buildWorkUnitWriteFields({
    explicitStatus: data.status,
    steps
  });

  const unit = await createWorkUnitInDb({
    userId,
    audioRecordingId: data.audioRecordingId,
    title: data.title,
    context: data.context,
    isPrivate: data.isPrivate ?? false,
    ...lifecycle,
    steps
  });

  void indexWorkUnitForSearch(unit.id);
  return formatWorkUnitForResponse(unit);
}

export async function getWorkUnitById(id: string) {
  const unit = await findWorkUnitById(id);
  if (!unit) throw new HttpError(404, "Work unit not found");
  return formatWorkUnitForResponse(unit);
}

export async function listWorkUnits(options: {
  viewerUserId: string;
  viewerRole: string;
  userId?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 20));

  const filterUserId = canViewAll(options.viewerRole) ? options.userId : undefined;

  const { items, total } = await findWorkUnits({
    userId: filterUserId,
    status: options.status,
    from: parseRangeFrom(options.from),
    to: parseRangeTo(options.to),
    isPrivateVisibleForUserId: options.viewerUserId,
    page,
    pageSize
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items: items.map((unit) => formatWorkUnitForResponse(unit)),
    pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages }
  };
}

export async function updateWorkUnit(
  id: string,
  viewerUserId: string,
  roleName: string,
  data: {
    title?: string;
    context?: string;
    status?: string;
    isPrivate?: boolean;
    steps?: Array<{ description: string; deadline?: string | null; done?: boolean }>;
  }
) {
  const existingRaw = await findWorkUnitById(id);
  if (!existingRaw) throw new HttpError(404, "Work unit not found");
  assertCanModify(existingRaw, viewerUserId, roleName);
  assertNotLockedClosedUnit(existingRaw.status, data);

  const mappedSteps = data.steps !== undefined ? mapSteps(data.steps) : undefined;
  const lifecycle = buildWorkUnitWriteFields({
    existingStatus: existingRaw.status,
    existingClosedAt: existingRaw.closedAt,
    explicitStatus: data.status,
    steps: mappedSteps ?? existingRaw.steps,
    stepsUpdated: mappedSteps !== undefined
  });

  const unit = await updateWorkUnitInDb(id, {
    title: data.title,
    context: data.context,
    isPrivate: data.isPrivate,
    ...lifecycle,
    steps: mappedSteps
  });

  void indexWorkUnitForSearch(unit!.id);
  return formatWorkUnitForResponse(unit!);
}

export async function removeWorkUnit(id: string, viewerUserId: string, roleName: string) {
  const existing = await getWorkUnitById(id);
  assertCanModify(existing, viewerUserId, roleName);
  if (existing.status === "CLOSED") {
    throw new HttpError(409, CLOSED_LOCK_MESSAGE);
  }
  await deleteWorkUnitInDb(id);
}

export async function createWorkUnitsFromAudio(
  userId: string,
  fileBuffer: Buffer,
  originalname: string,
  mimetype: string
) {
  const { recording, sarvam } = await transcribeAndArchiveVoiceRecording({
    userId,
    source: "work",
    fileBuffer,
    originalname,
    mimetype
  });

  const extracted = await extractWorkUnitsFromTranscript(sarvam.transcript);
  const workUnits = [];

  for (const unit of extracted) {
    const created = await createWorkUnit(userId, {
      title: unit.title,
      context: unit.context,
      status: unit.status,
      isPrivate: false,
      audioRecordingId: recording.id,
      steps: unit.steps.map((step) => ({
        description: step.description,
        deadline: step.deadline
      }))
    });
    workUnits.push(created);
  }

  return {
    transcript: sarvam.transcript,
    audioRecording: recording,
    workUnits
  };
}

export async function getMyDeadlines(userId: string, date?: string) {
  const day = date ? new Date(date) : new Date();
  if (Number.isNaN(day.getTime())) {
    throw new HttpError(400, `Invalid date: ${date}`);
  }

  const from = startOfDay(day);
  const to = endOfDay(day);
  const steps = await findWorkStepsByUserAndDeadlineRange(userId, from, to);

  return {
    date: from,
    deadlines: steps.map((step) => ({
      id: step.id,
      description: step.description,
      deadline: step.deadline,
      done: step.done,
      workUnit: step.workUnit
    }))
  };
}
