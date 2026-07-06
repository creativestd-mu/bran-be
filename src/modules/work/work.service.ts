import { HttpError } from "../../utils/httpError";
import { parseApiDateBoundary } from "../../utils/timezone";
import { indexWorkUnitForSearch } from "../ai/ai.service";
import {
  notifyWorkUnitAssigned,
  notifyWorkStepAssigned,
  notifyWorkStepOverdue
} from "../notifications/notifications.service";
import { transcribeAndArchiveVoiceRecording } from "../voice-recording/voice-recording.service";
import {
  computeDueFields,
  formatWorkUnitForResponse,
  resolveStatusAndClosedAt
} from "./work.due-fields";
import { extractWorkUnitsFromTranscript } from "./work.extraction";
import { resolveProjectIdFromExtraction } from "./work.project-matching";
import {
  createWorkUnit as createWorkUnitInDb,
  deleteWorkUnit as deleteWorkUnitInDb,
  findOverdueStepsForUser,
  findWorkStepsByUserAndDeadlineRange,
  findWorkUnitById,
  findWorkUnits,
  updateWorkUnit as updateWorkUnitInDb
} from "./work.repository";
import { listAllProjectSummaries } from "../projects/projects.repository";
import { prisma } from "../../lib/prisma";

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
  if (unit.userId !== viewerUserId) {
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
  steps?: Array<{ description: string; deadline?: string | null; done?: boolean; assigneeId?: string | null }>
) {
  return (steps ?? []).map((step) => ({
    description: step.description,
    deadline: parseOptionalDate(step.deadline) ?? null,
    done: step.done ?? false,
    assigneeId: step.assigneeId ?? null
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

async function resolveProjectIdForUser(
  projectId: string | null | undefined
): Promise<string | null> {
  if (!projectId) {
    return null;
  }
  return projectId;
}

export async function createWorkUnit(
  creatorUserId: string,
  data: {
    title: string;
    context: string;
    status?: string;
    isPrivate?: boolean;
    projectId?: string | null;
    assignedToUserId?: string | null;
    audioRecordingId?: string | null;
    steps?: Array<{ description: string; deadline?: string | null; done?: boolean; assigneeId?: string | null }>;
  }
) {
  const ownerUserId = data.assignedToUserId ?? creatorUserId;
  const createdById = ownerUserId !== creatorUserId ? creatorUserId : null;

  const steps = mapSteps(data.steps);
  const lifecycle = buildWorkUnitWriteFields({ explicitStatus: data.status, steps });
  const projectId = await resolveProjectIdForUser(data.projectId);

  const unit = await createWorkUnitInDb({
    userId: ownerUserId,
    createdById,
    projectId,
    audioRecordingId: data.audioRecordingId,
    title: data.title,
    context: data.context,
    isPrivate: data.isPrivate ?? false,
    ...lifecycle,
    steps
  });

  // Notify the assignee when a work unit is created for them by someone else.
  if (createdById) {
    const creator = await prisma.user.findUnique({
      where: { id: creatorUserId },
      select: { id: true, name: true }
    });
    if (creator) {
      void notifyWorkUnitAssigned({
        workUnitId: unit.id,
        workUnitTitle: unit.title,
        assignedToUserId: ownerUserId,
        createdByUser: creator
      });
    }
  }

  // Notify step assignees (skip the work unit owner — they'll see it anyway).
  for (const step of unit.steps) {
    const assigneeId = (step as { assigneeId?: string | null }).assigneeId;
    if (assigneeId && assigneeId !== ownerUserId) {
      const assignedBy = await prisma.user.findUnique({
        where: { id: creatorUserId },
        select: { id: true, name: true }
      });
      if (assignedBy) {
        void notifyWorkStepAssigned({
          workUnitId: unit.id,
          workUnitTitle: unit.title,
          stepDescription: step.description,
          stepDeadline: step.deadline,
          assignedToUserId: assigneeId,
          assignedByUser: assignedBy
        });
      }
    }
  }

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
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 20));

  const { items, total } = await findWorkUnits({
    userId: options.viewerUserId,
    status: options.status,
    from: parseRangeFrom(options.from),
    to: parseRangeTo(options.to),
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
    projectId?: string | null;
    steps?: Array<{ description: string; deadline?: string | null; done?: boolean; assigneeId?: string | null }>;
  }
) {
  const existingRaw = await findWorkUnitById(id);
  if (!existingRaw) throw new HttpError(404, "Work unit not found");
  assertCanModify(existingRaw, viewerUserId, roleName);
  assertNotLockedClosedUnit(existingRaw.status, data);

  // Snapshot existing step assignees so we can detect new assignments.
  const previousAssigneeIds = new Set(
    existingRaw.steps
      .map((s) => (s as { assigneeId?: string | null }).assigneeId)
      .filter(Boolean) as string[]
  );

  const mappedSteps = data.steps !== undefined ? mapSteps(data.steps) : undefined;
  const lifecycle = buildWorkUnitWriteFields({
    existingStatus: existingRaw.status,
    existingClosedAt: existingRaw.closedAt,
    explicitStatus: data.status,
    steps: mappedSteps ?? existingRaw.steps,
    stepsUpdated: mappedSteps !== undefined
  });
  const projectId =
    data.projectId !== undefined ? await resolveProjectIdForUser(data.projectId) : undefined;

  const unit = await updateWorkUnitInDb(id, {
    title: data.title,
    context: data.context,
    isPrivate: data.isPrivate,
    projectId,
    ...lifecycle,
    steps: mappedSteps
  });

  // Notify any newly-assigned step assignees.
  if (mappedSteps) {
    const assignedBy = await prisma.user.findUnique({
      where: { id: viewerUserId },
      select: { id: true, name: true }
    });
    if (assignedBy) {
      for (const step of mappedSteps) {
        if (step.assigneeId && !previousAssigneeIds.has(step.assigneeId)) {
          void notifyWorkStepAssigned({
            workUnitId: id,
            workUnitTitle: unit!.title,
            stepDescription: step.description,
            stepDeadline: step.deadline ?? null,
            assignedToUserId: step.assigneeId,
            assignedByUser: assignedBy
          });
        }
      }
    }
  }

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

  const [availableProjects, availableUsers] = await Promise.all([
    listAllProjectSummaries(),
    prisma.user.findMany({
      where: { isActive: true, id: { not: userId } },
      select: { id: true, name: true }
    })
  ]);

  const extracted = await extractWorkUnitsFromTranscript(sarvam.transcript, {
    availableProjects,
    availableUsers
  });

  const workUnits = [];

  for (const unit of extracted) {
    const projectId = resolveProjectIdFromExtraction({
      projectName: unit.projectName,
      title: unit.title,
      context: unit.context,
      transcript: sarvam.transcript,
      projects: availableProjects
    });

    const assignedToUserId = resolveUserIdFromName(unit.assigneeName, availableUsers) ?? null;

    const created = await createWorkUnit(userId, {
      title: unit.title,
      context: unit.context,
      status: unit.status,
      isPrivate: false,
      projectId,
      assignedToUserId,
      audioRecordingId: recording.id,
      steps: unit.steps.map((step) => ({
        description: step.description,
        deadline: step.deadline,
        assigneeId: resolveUserIdFromName(step.assigneeName, availableUsers)
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

/**
 * Fuzzy match a person name extracted from audio against the users list.
 * Returns the user ID of the best match or null.
 */
export function resolveUserIdFromName(
  name: string | null | undefined,
  users: Array<{ id: string; name: string }>
): string | null {
  if (!name?.trim() || users.length === 0) return null;

  const normTarget = name.trim().toLowerCase();

  // Exact match
  const exact = users.find((u) => u.name.toLowerCase() === normTarget);
  if (exact) return exact.id;

  // Full name contains target or target contains a word from the full name
  for (const user of users) {
    const normUser = user.name.toLowerCase();
    if (normUser.includes(normTarget) || normTarget.includes(normUser)) {
      return user.id;
    }
    // First-name match
    const firstName = normUser.split(" ")[0];
    if (firstName && normTarget === firstName) return user.id;
  }

  return null;
}

/**
 * Find all overdue incomplete steps that belong to or are assigned to `userId`
 * and create one notification per step per day. Idempotent via dedupeKey.
 * Returns the count of steps found to be overdue.
 */
export async function checkOverdueAndNotify(userId: string): Promise<number> {
  const now = new Date();
  const overdueSteps = await findOverdueStepsForUser(userId, now);
  if (overdueSteps.length === 0) return 0;

  const overdueDate = now.toISOString().slice(0, 10);

  for (const step of overdueSteps) {
    if (!step.deadline) continue;

    // Notify the work unit owner
    void notifyWorkStepOverdue({
      workUnitId: step.workUnit.id,
      workUnitTitle: step.workUnit.title,
      stepId: step.id,
      stepDescription: step.description,
      stepDeadline: step.deadline,
      recipientUserId: step.workUnit.userId,
      overdueDate
    });

    // If there is a step-level assignee distinct from the work unit owner, notify them too
    const assigneeId = (step as { assigneeId?: string | null }).assigneeId;
    if (assigneeId && assigneeId !== step.workUnit.userId) {
      void notifyWorkStepOverdue({
        workUnitId: step.workUnit.id,
        workUnitTitle: step.workUnit.title,
        stepId: step.id,
        stepDescription: step.description,
        stepDeadline: step.deadline,
        recipientUserId: assigneeId,
        overdueDate
      });
    }
  }

  return overdueSteps.length;
}
