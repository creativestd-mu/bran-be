import { HttpError } from "../../utils/httpError";
import { env } from "../../config/env";
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
import { extractWorkUnitsFromText, extractWorkUnitsFromTranscript, isWorkExtractionAiConfigured, type WorkExtractionTextKind } from "./work.extraction";
import { resolveProjectIdFromExtraction } from "./work.project-matching";
import {
  learnAssignmentPreference,
  loadNameAssignmentPreferences,
  normalizeStepDescription,
  resolvePreferenceOwnerId,
  resolveUserIdFromName
} from "./work.name-preference";
import {
  createWorkUnit as createWorkUnitInDb,
  deleteWorkUnit as deleteWorkUnitInDb,
  findOverdueStepsForUser,
  findWorkStepById,
  findWorkStepsByUserAndDeadlineRange,
  findWorkUnitById,
  findWorkUnits,
  updateWorkStepAssignee,
  updateWorkUnit as updateWorkUnitInDb
} from "./work.repository";
import { enrichWorkUnitWithTagging } from "./work.tagging";
import { listAllProjectSummaries } from "../projects/projects.repository";
import { prisma } from "../../lib/prisma";
import {
  findVoiceRecordingById
} from "../voice-recording/voice-recording.repository";
import type { WorkIngestSourceType } from "./work.constants";
import { hasSimilarOpenWorkUnit } from "./work.dedup";
import { loadGmailWorkIngestCandidates } from "./work.sources";
import { loadSlackWorkIngestCandidates } from "./work.slack";
import { findWorkUnitSource, recordWorkUnitSource } from "./work.source-ledger";
import type { WorkIngestCandidate } from "./work.sources";

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

function canAccessWorkUnit(
  unit: { userId: string; createdById?: string | null; isPrivate: boolean },
  viewerUserId: string,
  roleName: string
): boolean {
  if (unit.userId === viewerUserId) return true;
  if (unit.createdById === viewerUserId) return true;
  if (unit.isPrivate) return false;
  return canViewAll(roleName);
}

export function assertCanView(
  unit: { userId: string; createdById?: string | null; isPrivate: boolean },
  viewerUserId: string,
  roleName?: string
): void {
  if (canAccessWorkUnit(unit, viewerUserId, roleName ?? "")) return;
  throw new HttpError(403, "Not authorized to view this work unit");
}

export function assertCanModify(
  unit: { userId: string; createdById?: string | null; isPrivate: boolean },
  viewerUserId: string,
  roleName: string
): void {
  if (unit.isPrivate) {
    if (unit.userId !== viewerUserId && unit.createdById !== viewerUserId) {
      throw new HttpError(403, "Not authorized to modify this work unit");
    }
    return;
  }

  if (!canAccessWorkUnit(unit, viewerUserId, roleName)) {
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
  steps?: Array<{
    description: string;
    deadline?: string | null;
    done?: boolean;
    assigneeId?: string | null;
    assigneeSpokenName?: string | null;
    sourceExcerpt?: string | null;
  }>
) {
  return (steps ?? []).map((step) => ({
    description: step.description,
    deadline: parseOptionalDate(step.deadline) ?? null,
    done: step.done ?? false,
    assigneeId: step.assigneeId ?? null,
    assigneeSpokenName: step.assigneeSpokenName ?? null,
    sourceExcerpt: step.sourceExcerpt ?? null
  }));
}

function formatWorkUnitResponse(
  unit: NonNullable<Awaited<ReturnType<typeof findWorkUnitById>>>,
  transcript?: string | null
) {
  const formatted = formatWorkUnitForResponse(unit);
  return enrichWorkUnitWithTagging(
    formatted as NonNullable<Awaited<ReturnType<typeof findWorkUnitById>>>,
    transcript
  );
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

async function buildAssignmentContext(userId: string) {
  const [availableProjects, availableUsers, preferenceMap] = await Promise.all([
    listAllProjectSummaries(),
    prisma.user.findMany({
      where: { isActive: true, id: { not: userId } },
      select: { id: true, name: true, managerUserId: true }
    }),
    loadNameAssignmentPreferences(userId)
  ]);

  const directReportIds = new Set(
    availableUsers
      .filter((user) => user.managerUserId === userId)
      .map((user) => user.id)
  );

  return {
    availableProjects,
    availableUsers,
    resolutionContext: {
      uploaderId: userId,
      directReportIds,
      preferenceMap
    }
  };
}

export async function createWorkUnitsFromRecording(
  userId: string,
  recording: { id: string },
  transcript: string,
  options?: {
    sourceType?: WorkIngestSourceType;
    sourceId?: string;
  }
) {
  return ingestWorkFromText({
    defaultOwnerUserId: userId,
    text: transcript,
    extractionKind: "transcript",
    audioRecordingId: recording.id,
    sourceType: options?.sourceType,
    sourceId: options?.sourceId,
    useLedger: Boolean(options?.sourceType && options?.sourceId),
    throwOnExtractError: true
  });
}

async function persistExtractedUnits(
  defaultOwnerUserId: string,
  extracted: Awaited<ReturnType<typeof extractWorkUnitsFromTranscript>>,
  context: Awaited<ReturnType<typeof buildAssignmentContext>>,
  meta: {
    transcriptOrText: string;
    audioRecordingId?: string | null;
    sourceType?: WorkIngestSourceType;
    sourceId?: string;
  }
) {
  const { availableProjects, availableUsers, resolutionContext } = context;
  const workUnits = [];

  for (const unit of extracted) {
    const projectId = resolveProjectIdFromExtraction({
      projectName: unit.projectName,
      title: unit.title,
      context: unit.context,
      transcript: meta.transcriptOrText,
      projects: availableProjects
    });

    const assignedToUserId =
      resolveUserIdFromName(unit.assigneeName, availableUsers, resolutionContext) ?? null;
    const ownerUserId = assignedToUserId ?? defaultOwnerUserId;

    if (await hasSimilarOpenWorkUnit(ownerUserId, unit.title)) {
      continue;
    }

    const created = await createWorkUnit(defaultOwnerUserId, {
      title: unit.title,
      context: unit.context,
      status: unit.status,
      isPrivate: false,
      projectId,
      assignedToUserId,
      assigneeSpokenName: unit.assigneeName ?? null,
      sourceExcerpt: unit.sourceExcerpt ?? null,
      audioRecordingId: meta.audioRecordingId ?? null,
      sourceType: meta.sourceType,
      sourceId: meta.sourceId,
      steps: unit.steps.map((step) => ({
        description: step.description,
        deadline: step.deadline,
        assigneeId: resolveUserIdFromName(step.assigneeName, availableUsers, resolutionContext),
        assigneeSpokenName: step.assigneeName ?? null,
        sourceExcerpt: step.sourceExcerpt ?? null
      }))
    });
    workUnits.push(created);
  }

  return workUnits;
}

async function ingestWorkFromText(input: {
  defaultOwnerUserId: string;
  text: string;
  extractionKind: WorkExtractionTextKind;
  audioRecordingId?: string | null;
  sourceType?: WorkIngestSourceType;
  sourceId?: string;
  useLedger: boolean;
  throwOnExtractError: boolean;
}) {
  if (input.useLedger && input.sourceType && input.sourceId) {
    const existing = await findWorkUnitSource(input.sourceType, input.sourceId);
    if (existing) {
      return {
        transcript: input.text,
        workUnits: [],
        taggingMappings: [],
        skippedLedger: true as const
      };
    }
  }

  const assignmentContext = await buildAssignmentContext(input.defaultOwnerUserId);

  let extracted: Awaited<ReturnType<typeof extractWorkUnitsFromTranscript>>;
  try {
    extracted = await extractWorkUnitsFromText(input.text, {
      kind: input.extractionKind,
      availableProjects: assignmentContext.availableProjects,
      availableUsers: assignmentContext.availableUsers
    });
  } catch (error) {
    if (input.useLedger && input.sourceType && input.sourceId) {
      await recordWorkUnitSource({
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        status: "ERROR",
        workUnitCount: 0,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }
    if (input.throwOnExtractError) throw error;
    return { transcript: input.text, workUnits: [], taggingMappings: [] };
  }

  const workUnits = await persistExtractedUnits(
    input.defaultOwnerUserId,
    extracted,
    assignmentContext,
    {
      transcriptOrText: input.text,
      audioRecordingId: input.audioRecordingId,
      sourceType: input.sourceType,
      sourceId: input.sourceId
    }
  );

  if (input.useLedger && input.sourceType && input.sourceId) {
    await recordWorkUnitSource({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      status: workUnits.length > 0 ? "PROCESSED" : "SKIPPED",
      workUnitCount: workUnits.length
    });
  }

  return {
    transcript: input.text,
    workUnits,
    taggingMappings: workUnits.flatMap((unit) => unit.taggingMappings ?? [])
  };
}

async function ingestWorkFromCandidate(candidate: WorkIngestCandidate) {
  const kind: WorkExtractionTextKind =
    candidate.sourceType === "GMAIL" ? "email" : candidate.sourceType === "SLACK" ? "slack" : "transcript";

  return ingestWorkFromText({
    defaultOwnerUserId: candidate.ownerUserId,
    text: candidate.text,
    extractionKind: kind,
    sourceType: candidate.sourceType,
    sourceId: candidate.sourceId,
    useLedger: true,
    throwOnExtractError: false
  });
}

export async function ingestWorkUnitsFromGmail() {
  const candidates = await loadGmailWorkIngestCandidates();
  let created = 0;
  await mapWithConcurrency(candidates, env.workIngestConcurrency, async (candidate) => {
    const result = await ingestWorkFromCandidate(candidate);
    created += result.workUnits.length;
  });
  return { scanned: candidates.length, created };
}

export async function ingestWorkUnitsFromSlack() {
  const candidates = await loadSlackWorkIngestCandidates();
  let created = 0;
  await mapWithConcurrency(candidates, env.workIngestConcurrency, async (candidate) => {
    const result = await ingestWorkFromCandidate(candidate);
    created += result.workUnits.length;
  });
  return { scanned: candidates.length, created };
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  const concurrency = Math.max(1, Math.min(limit, items.length || 1));
  let index = 0;

  async function run(): Promise<void> {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => run()));
}

export async function runWorkUnitIngestion() {
  if (!isWorkExtractionAiConfigured()) {
    console.log("[work-ingest] AI not configured — skipping");
    return { gmail: { scanned: 0, created: 0 }, slack: { scanned: 0, created: 0 } };
  }

  const gmail = await ingestWorkUnitsFromGmail();
  const slack = await ingestWorkUnitsFromSlack();
  console.log(
    `[work-ingest] Gmail scanned ${gmail.scanned}, created ${gmail.created}; Slack scanned ${slack.scanned}, created ${slack.created}`
  );
  return { gmail, slack };
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
    assigneeSpokenName?: string | null;
    sourceExcerpt?: string | null;
    audioRecordingId?: string | null;
    sourceType?: WorkIngestSourceType | null;
    sourceId?: string | null;
    steps?: Array<{
      description: string;
      deadline?: string | null;
      done?: boolean;
      assigneeId?: string | null;
      assigneeSpokenName?: string | null;
      sourceExcerpt?: string | null;
    }>;
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
    assigneeSpokenName: data.assigneeSpokenName ?? null,
    sourceExcerpt: data.sourceExcerpt ?? null,
    sourceType: data.sourceType ?? null,
    sourceId: data.sourceId ?? null,
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
  return formatWorkUnitResponse(unit);
}

export async function getWorkUnitById(id: string, viewerUserId?: string, roleName?: string) {
  const unit = await findWorkUnitById(id);
  if (!unit) throw new HttpError(404, "Work unit not found");
  if (viewerUserId) {
    assertCanView(unit, viewerUserId, roleName);
  }
  return formatWorkUnitResponse(unit);
}

export async function listWorkUnits(options: {
  viewerUserId: string;
  viewerRole?: string;
  targetUserId?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 20));

  // Admins/managers may filter by any user; others can only see their own units.
  const isPrivileged = canViewAll(options.viewerRole ?? "");
  const filterUserId =
    options.targetUserId && isPrivileged
      ? options.targetUserId
      : options.viewerUserId;

  const { items, total } = await findWorkUnits({
    userId: filterUserId,
    status: options.status,
    from: parseRangeFrom(options.from),
    to: parseRangeTo(options.to),
    page,
    pageSize
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items: items.map((unit) => formatWorkUnitResponse(unit)),
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
    assignedToUserId?: string | null;
    steps?: Array<{
      description: string;
      deadline?: string | null;
      done?: boolean;
      assigneeId?: string | null;
      assigneeSpokenName?: string | null;
      sourceExcerpt?: string | null;
    }>;
  }
) {
  const existingRaw = await findWorkUnitById(id);
  if (!existingRaw) throw new HttpError(404, "Work unit not found");
  assertCanModify(existingRaw, viewerUserId, roleName);
  assertNotLockedClosedUnit(existingRaw.status, data);

  const preferenceOwnerId = resolvePreferenceOwnerId(existingRaw);
  const previousAssigneeIds = new Set(
    existingRaw.steps
      .map((s) => (s as { assigneeId?: string | null }).assigneeId)
      .filter(Boolean) as string[]
  );
  const oldStepsByDescription = new Map(
    existingRaw.steps.map((step) => [
      normalizeStepDescription(step.description),
      step as {
        description: string;
        assigneeId?: string | null;
        assigneeSpokenName?: string | null;
        sourceExcerpt?: string | null;
      }
    ])
  );

  let mappedSteps = data.steps !== undefined ? mapSteps(data.steps) : undefined;
  if (mappedSteps) {
    mappedSteps = mappedSteps.map((step) => {
      const oldStep = oldStepsByDescription.get(normalizeStepDescription(step.description));
      const assigneeSpokenName =
        step.assigneeSpokenName ?? oldStep?.assigneeSpokenName ?? null;
      const sourceExcerpt = step.sourceExcerpt ?? oldStep?.sourceExcerpt ?? null;

      if (
        oldStep?.assigneeSpokenName &&
        step.assigneeId &&
        step.assigneeId !== oldStep.assigneeId
      ) {
        void learnAssignmentPreference({
          ownerUserId: preferenceOwnerId,
          spokenName: oldStep.assigneeSpokenName,
          userId: step.assigneeId
        });
      }

      return {
        ...step,
        assigneeSpokenName,
        sourceExcerpt
      };
    });
  }

  const lifecycle = buildWorkUnitWriteFields({
    existingStatus: existingRaw.status,
    existingClosedAt: existingRaw.closedAt,
    explicitStatus: data.status,
    steps: mappedSteps ?? existingRaw.steps,
    stepsUpdated: mappedSteps !== undefined
  });
  const projectId =
    data.projectId !== undefined ? await resolveProjectIdForUser(data.projectId) : undefined;

  let nextOwnerUserId = existingRaw.userId;
  let nextCreatedById = existingRaw.createdById;
  let ownerReassigned = false;

  if (data.assignedToUserId !== undefined) {
    const resolvedOwnerUserId = data.assignedToUserId ?? viewerUserId;
    if (resolvedOwnerUserId !== existingRaw.userId) {
      ownerReassigned = true;
      nextOwnerUserId = resolvedOwnerUserId;
      nextCreatedById = resolvedOwnerUserId !== viewerUserId ? viewerUserId : null;

      if (existingRaw.assigneeSpokenName) {
        void learnAssignmentPreference({
          ownerUserId: preferenceOwnerId,
          spokenName: existingRaw.assigneeSpokenName,
          userId: resolvedOwnerUserId
        });
      }
    }
  }

  const unit = await updateWorkUnitInDb(id, {
    title: data.title,
    context: data.context,
    isPrivate: data.isPrivate,
    projectId,
    userId: ownerReassigned ? nextOwnerUserId : undefined,
    createdById: ownerReassigned ? nextCreatedById : undefined,
    ...lifecycle,
    steps: mappedSteps
  });

  if (ownerReassigned && nextOwnerUserId !== viewerUserId) {
    const assignedBy = await prisma.user.findUnique({
      where: { id: viewerUserId },
      select: { id: true, name: true }
    });
    if (assignedBy) {
      void notifyWorkUnitAssigned({
        workUnitId: id,
        workUnitTitle: unit!.title,
        assignedToUserId: nextOwnerUserId,
        createdByUser: assignedBy
      });
    }
  }

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
  return formatWorkUnitResponse(unit!);
}

export async function reassignWorkUnitAssignments(
  workUnitId: string,
  viewerUserId: string,
  roleName: string,
  data: {
    ownerUserId?: string | null;
    stepAssignments?: Array<{ stepId: string; assigneeId: string | null }>;
  }
) {
  const existingRaw = await findWorkUnitById(workUnitId);
  if (!existingRaw) throw new HttpError(404, "Work unit not found");
  assertCanModify(existingRaw, viewerUserId, roleName);
  if (existingRaw.status === "CLOSED") {
    throw new HttpError(409, CLOSED_LOCK_MESSAGE);
  }

  const preferenceOwnerId = resolvePreferenceOwnerId(existingRaw);
  let ownerReassigned = false;
  let nextOwnerUserId = existingRaw.userId;
  let nextCreatedById = existingRaw.createdById;

  if (data.ownerUserId !== undefined) {
    const resolvedOwnerUserId = data.ownerUserId ?? viewerUserId;
    if (resolvedOwnerUserId !== existingRaw.userId) {
      ownerReassigned = true;
      nextOwnerUserId = resolvedOwnerUserId;
      nextCreatedById = resolvedOwnerUserId !== viewerUserId ? viewerUserId : null;

      if (existingRaw.assigneeSpokenName) {
        void learnAssignmentPreference({
          ownerUserId: preferenceOwnerId,
          spokenName: existingRaw.assigneeSpokenName,
          userId: resolvedOwnerUserId
        });
      }
    }
  }

  const assignedBy = await prisma.user.findUnique({
    where: { id: viewerUserId },
    select: { id: true, name: true }
  });

  if (data.stepAssignments?.length) {
    for (const assignment of data.stepAssignments) {
      const step = await findWorkStepById(workUnitId, assignment.stepId);
      if (!step) {
        throw new HttpError(404, `Work step not found: ${assignment.stepId}`);
      }

      const previousAssigneeId = step.assigneeId;
      if (assignment.assigneeId === previousAssigneeId) continue;

      if (step.assigneeSpokenName && assignment.assigneeId) {
        void learnAssignmentPreference({
          ownerUserId: preferenceOwnerId,
          spokenName: step.assigneeSpokenName,
          userId: assignment.assigneeId
        });
      }

      await updateWorkStepAssignee(workUnitId, assignment.stepId, assignment.assigneeId);

      if (assignment.assigneeId && assignedBy && assignment.assigneeId !== viewerUserId) {
        void notifyWorkStepAssigned({
          workUnitId,
          workUnitTitle: existingRaw.title,
          stepDescription: step.description,
          stepDeadline: step.deadline,
          assignedToUserId: assignment.assigneeId,
          assignedByUser: assignedBy
        });
      }
    }
  }

  if (ownerReassigned) {
    await updateWorkUnitInDb(workUnitId, {
      userId: nextOwnerUserId,
      createdById: nextCreatedById
    });

    if (nextOwnerUserId !== viewerUserId && assignedBy) {
      void notifyWorkUnitAssigned({
        workUnitId,
        workUnitTitle: existingRaw.title,
        assignedToUserId: nextOwnerUserId,
        createdByUser: assignedBy
      });
    }
  }

  const unit = await findWorkUnitById(workUnitId);
  void indexWorkUnitForSearch(workUnitId);
  return formatWorkUnitResponse(unit!);
}

export async function removeWorkUnit(id: string, viewerUserId: string, roleName: string) {
  const existing = await findWorkUnitById(id);
  if (!existing) throw new HttpError(404, "Work unit not found");
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

  const result = await createWorkUnitsFromRecording(userId, recording, sarvam.transcript);

  return {
    transcript: sarvam.transcript,
    audioRecording: recording,
    workUnits: result.workUnits,
    taggingMappings: result.taggingMappings
  };
}

export async function regenerateWorkUnitsFromRecording(recordingId: string, userId: string) {
  const recording = await findVoiceRecordingById(recordingId);
  if (!recording) {
    throw new HttpError(404, "Voice recording not found");
  }
  if (!recording.transcript) {
    throw new HttpError(422, "Voice recording has no transcript to regenerate from");
  }

  const result = await createWorkUnitsFromRecording(userId, recording, recording.transcript, {
    ...(await prisma.meeting
      .findFirst({
        where: { voiceRecordingId: recordingId },
        select: { id: true }
      })
      .then((meeting) =>
        meeting ? { sourceType: "MEETING" as const, sourceId: meeting.id } : {}
      ))
  });

  return {
    transcript: recording.transcript,
    audioRecording: recording,
    workUnits: result.workUnits,
    taggingMappings: result.taggingMappings
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
