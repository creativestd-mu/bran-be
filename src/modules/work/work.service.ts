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
import { extractWorkUnitsFromText, extractWorkUnitsFromTranscript, getWorkExtractionAiInfo, isWorkExtractionAiConfigured, type WorkExtractionTextKind } from "./work.extraction";
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
  findWorkUnitsForSlackTaskList,
  updateWorkStepAssignee,
  updateWorkUnit as updateWorkUnitInDb
} from "./work.repository";
import { enrichWorkUnitWithTagging } from "./work.tagging";
import { listAllProjectSummaries } from "../projects/projects.repository";
import { prisma } from "../../lib/prisma";
import {
  findVoiceRecordingById,
  updateVoiceRecording
} from "../voice-recording/voice-recording.repository";
import { previewWorkText, type WorkIngestSourceType } from "./work.constants";
import { hasSimilarOpenWorkUnit } from "./work.dedup";
import { loadGmailWorkIngestCandidates } from "./work.sources";
import { getSlackBotUserId, postSlackMessage, sendDm } from "../attendance/attendance.slack";
import {
  isAllowedSlackWorkChannel,
  loadSlackWorkIngestCandidateFromEvent,
  loadSlackWorkIngestCandidates,
  resolveBranUserIdForSlackUser
} from "./work.slack";
import {
  classifyWorkUnitsForTaskList,
  formatSlackTaskListMessage,
  looksLikeTaskListQuery,
  rangeIncludesToday,
  resolveSlackTaskListQuery,
  textMentionsSlackUser
} from "./work.slack-tasks";
import {
  downloadSlackAudio,
  extractSlackAudioAttachments,
  isAcceptAsIsConfirmReply,
  isSlackDmChannel
} from "./work.slack-voice";
import { findWorkUnitSource, recordWorkUnitSource } from "./work.source-ledger";
import type { WorkIngestCandidate } from "./work.sources";
import type { SlackFile } from "../escalation/escalation.slack";

const SLACK_VOICE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const TASK_LIST_DEDUP_TTL_MS = 60 * 1000;
const recentTaskListEvents = new Map<string, number>();

function markTaskListEvent(channelId: string, ts: string): boolean {
  const now = Date.now();
  for (const [key, seenAt] of recentTaskListEvents) {
    if (now - seenAt > TASK_LIST_DEDUP_TTL_MS) recentTaskListEvents.delete(key);
  }
  const key = `${channelId}:${ts}`;
  if (recentTaskListEvents.has(key)) return false;
  recentTaskListEvents.set(key, now);
  return true;
}

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
  const role = roleName.trim().toLowerCase();
  return role === "admin" || role === "manager" || role === "superadmin" || role === "chief_of_staff";
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
    throwOnExtractError?: boolean;
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
    throwOnExtractError: options?.throwOnExtractError ?? true
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
    preferredAssigneeUserId?: string | null;
  }
) {
  const { availableProjects, availableUsers, resolutionContext } = context;
  const workUnits = [];
  let skippedDedup = 0;

  for (const unit of extracted) {
    const projectId = resolveProjectIdFromExtraction({
      projectName: unit.projectName,
      title: unit.title,
      context: unit.context,
      transcript: meta.transcriptOrText,
      projects: availableProjects
    });

    const assignedToUserId =
      resolveUserIdFromName(unit.assigneeName, availableUsers, resolutionContext) ??
      meta.preferredAssigneeUserId ??
      null;
    const ownerUserId = assignedToUserId ?? defaultOwnerUserId;

    if (await hasSimilarOpenWorkUnit(ownerUserId, unit.title)) {
      skippedDedup += 1;
      console.log("[work.ingest] skip similar open unit", {
        sourceType: meta.sourceType ?? null,
        sourceId: meta.sourceId ?? null,
        title: unit.title,
        ownerUserId,
        assignedToUserId,
        assigneeName: unit.assigneeName ?? null
      });
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
    console.log("[work.ingest] created unit", {
      sourceType: meta.sourceType ?? null,
      sourceId: meta.sourceId ?? null,
      workUnitId: created.id,
      title: unit.title,
      ownerUserId,
      assignedToUserId,
      assigneeName: unit.assigneeName ?? null,
      steps: unit.steps.length
    });
  }

  return { workUnits, skippedDedup };
}

async function ingestWorkFromText(input: {
  defaultOwnerUserId: string;
  text: string;
  extractionKind: WorkExtractionTextKind;
  audioRecordingId?: string | null;
  sourceType?: WorkIngestSourceType;
  sourceId?: string;
  preferredAssigneeUserId?: string | null;
  useLedger: boolean;
  throwOnExtractError: boolean;
}) {
  if (input.useLedger && input.sourceType && input.sourceId) {
    const existing = await findWorkUnitSource(input.sourceType, input.sourceId);
    // Allow ERROR rows to be retried; PROCESSED/SKIPPED stay terminal.
    if (existing && existing.status !== "ERROR") {
      console.log("[work.ingest] skip ledger already settled", {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        ledgerStatus: existing.status,
        previousWorkUnitCount: existing.workUnitCount,
        textPreview: previewWorkText(input.text)
      });
      return {
        transcript: input.text,
        workUnits: [],
        taggingMappings: [],
        skippedLedger: true as const,
        skipReason: `ledger_${existing.status.toLowerCase()}`
      };
    }
  }

  const assignmentContext = await buildAssignmentContext(input.defaultOwnerUserId);
  console.log("[work.ingest] extracting", {
    sourceType: input.sourceType ?? null,
    sourceId: input.sourceId ?? null,
    kind: input.extractionKind,
    ownerUserId: input.defaultOwnerUserId,
    preferredAssigneeUserId: input.preferredAssigneeUserId ?? null,
    textChars: input.text.length,
    textPreview: previewWorkText(input.text),
    ...getWorkExtractionAiInfo()
  });

  let extracted: Awaited<ReturnType<typeof extractWorkUnitsFromTranscript>>;
  try {
    extracted = await extractWorkUnitsFromText(input.text, {
      kind: input.extractionKind,
      availableProjects: assignmentContext.availableProjects,
      availableUsers: assignmentContext.availableUsers
    });
  } catch (error) {
    const extractError = error instanceof Error ? error.message : String(error);
    console.error("[work.ingest] extraction failed", {
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      extractError,
      ...getWorkExtractionAiInfo()
    });
    if (input.useLedger && input.sourceType && input.sourceId) {
      await recordWorkUnitSource({
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        status: "ERROR",
        workUnitCount: 0,
        errorMessage: extractError
      });
    }
    if (input.throwOnExtractError) throw error;
    return {
      transcript: input.text,
      workUnits: [],
      taggingMappings: [],
      skipReason: "extract_error",
      extractError
    };
  }

  const persisted = await persistExtractedUnits(
    input.defaultOwnerUserId,
    extracted,
    assignmentContext,
    {
      transcriptOrText: input.text,
      audioRecordingId: input.audioRecordingId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      preferredAssigneeUserId: input.preferredAssigneeUserId
    }
  );
  const workUnits = persisted.workUnits;

  let skipReason: string | undefined;
  if (workUnits.length === 0) {
    if (extracted.length === 0) skipReason = "llm_returned_empty";
    else if (persisted.skippedDedup === extracted.length) skipReason = "all_deduped";
    else skipReason = "none_persisted";
  }

  if (input.useLedger && input.sourceType && input.sourceId) {
    await recordWorkUnitSource({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      status: workUnits.length > 0 ? "PROCESSED" : "SKIPPED",
      workUnitCount: workUnits.length
    });
  }

  console.log("[work.ingest] done", {
    sourceType: input.sourceType ?? null,
    sourceId: input.sourceId ?? null,
    extracted: extracted.length,
    created: workUnits.length,
    skippedDedup: persisted.skippedDedup,
    skipReason: skipReason ?? null,
    titles: extracted.map((unit) => unit.title)
  });

  return {
    transcript: input.text,
    workUnits,
    taggingMappings: workUnits.flatMap((unit) => unit.taggingMappings ?? []),
    skipReason,
    extractedCount: extracted.length,
    skippedDedupCount: persisted.skippedDedup
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
    preferredAssigneeUserId: candidate.preferredAssigneeUserId,
    useLedger: true,
    throwOnExtractError: false
  });
}

export async function ingestWorkUnitsFromGmail() {
  if (!env.workIngestGmailEnabled) {
    return { scanned: 0, created: 0 };
  }

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

/**
 * Slack Events webhook path — ingest a single channel/thread message near-real-time.
 */
export async function processSlackWorkMessage(input: {
  channelId: string;
  userId: string;
  text?: string;
  ts: string;
  botId?: string;
  subtype?: string;
  threadTs?: string;
}): Promise<{ handled: boolean; reason?: string; created?: number }> {
  const eventMeta = {
    channelId: input.channelId,
    userId: input.userId,
    ts: input.ts,
    threadTs: input.threadTs ?? null,
    textPreview: previewWorkText(input.text ?? "")
  };

  if (!isWorkExtractionAiConfigured()) {
    console.warn("[work.slack-event] skip", { reason: "ai_not_configured", ...eventMeta, ...getWorkExtractionAiInfo() });
    return { handled: false, reason: "ai_not_configured" };
  }

  // Channel work ingest is for channels; DMs use the voice-draft flow instead.
  if (isSlackDmChannel(input.channelId)) {
    console.log("[work.slack-event] skip", { reason: "dm_skipped", ...eventMeta });
    return { handled: false, reason: "dm_skipped" };
  }

  if (!(await isAllowedSlackWorkChannel(input.channelId))) {
    console.log("[work.slack-event] skip", { reason: "channel_not_allowed", ...eventMeta });
    return { handled: false, reason: "channel_not_allowed" };
  }

  const text = input.text?.trim() ?? "";
  if (!text) {
    console.log("[work.slack-event] skip", { reason: "empty_text", ...eventMeta });
    return { handled: false, reason: "empty_text" };
  }

  const candidate = await loadSlackWorkIngestCandidateFromEvent({
    channelId: input.channelId,
    userId: input.userId,
    text,
    ts: input.ts,
    botId: input.botId,
    subtype: input.subtype,
    threadTs: input.threadTs
  });

  if (!candidate) {
    console.log("[work.slack-event] skip", { reason: "no_candidate", ...eventMeta });
    return { handled: false, reason: "no_candidate" };
  }

  console.log("[work.slack-event] candidate ready", {
    sourceId: candidate.sourceId,
    ownerUserId: candidate.ownerUserId,
    preferredAssigneeUserId: candidate.preferredAssigneeUserId ?? null,
    title: candidate.title,
    textChars: candidate.text.length,
    textPreview: previewWorkText(candidate.text),
    ...getWorkExtractionAiInfo()
  });

  const result = await ingestWorkFromCandidate(candidate);
  console.log(
    `[work.slack-event] ${candidate.sourceId} → created ${result.workUnits.length} work unit(s)`,
    {
      skipReason: result.skipReason ?? null,
      skippedLedger: Boolean(result.skippedLedger),
      extractedCount: result.extractedCount ?? null,
      skippedDedupCount: result.skippedDedupCount ?? null,
      extractError: result.extractError ?? null,
      ...getWorkExtractionAiInfo()
    }
  );
  return { handled: true, created: result.workUnits.length, reason: result.skipReason };
}

/**
 * DM, or @Bran in a channel/group: list pending + completed tasks for a date range.
 */
export async function processSlackTaskListMessage(input: {
  channelId: string;
  userId: string;
  text?: string;
  ts: string;
  botId?: string;
  subtype?: string;
  threadTs?: string;
  channelType?: string;
}): Promise<{ handled: boolean; reason?: string }> {
  if (input.botId) return { handled: false, reason: "ignored_bot" };
  if (input.subtype && input.subtype !== "thread_broadcast") {
    return { handled: false, reason: "ignored_subtype" };
  }

  const text = input.text?.trim() ?? "";
  if (!text) return { handled: false, reason: "empty_text" };

  const isDm = isSlackDmChannel(input.channelId, input.channelType);
  if (!isDm) {
    const botUserId = await getSlackBotUserId();
    if (!botUserId || !textMentionsSlackUser(text, botUserId)) {
      return { handled: false, reason: "channel_requires_mention" };
    }
  }

  if (!looksLikeTaskListQuery(text)) return { handled: false, reason: "not_task_list" };

  if (!markTaskListEvent(input.channelId, input.ts)) {
    return { handled: true, reason: "duplicate" };
  }

  const query = await resolveSlackTaskListQuery(text);
  if (!query) return { handled: false, reason: "not_task_list" };

  const branUserId = await resolveBranUserIdForSlackUser(input.userId);
  if (!branUserId) {
    await postSlackMessage(
      input.channelId,
      "I couldn’t match your Slack account to a Bran user. Once your Slack email matches a Bran account, I can list your tasks here.",
      isDm ? undefined : { threadTs: input.threadTs ?? input.ts }
    );
    return { handled: true, reason: "unmapped_user" };
  }

  const includeToday = rangeIncludesToday(query.range);
  const units = await findWorkUnitsForSlackTaskList({
    userId: branUserId,
    from: query.range.from,
    to: query.range.to,
    includeOverdue: includeToday,
    includeUndatedOpen: includeToday
  });

  const { pending, completed } = classifyWorkUnitsForTaskList({
    userId: branUserId,
    from: query.range.from,
    to: query.range.to,
    includeOverdue: includeToday,
    includeUndatedOpen: includeToday,
    units
  });

  const message = formatSlackTaskListMessage({
    range: query.range,
    pending,
    completed,
    appUrl: env.appUrl
  });

  await postSlackMessage(
    input.channelId,
    message,
    isDm ? undefined : { threadTs: input.threadTs ?? input.ts }
  );
  console.log("[work.slack-tasks] listed", {
    slackUserId: input.userId,
    branUserId,
    channelId: input.channelId,
    isDm,
    source: query.source,
    label: query.range.label,
    pending: pending.length,
    completed: completed.length
  });
  return { handled: true, reason: "listed" };
}

/**
 * DM voice note → Sarvam transcript → draft → thread reply asking for confirm/edit.
 */
export async function processSlackVoiceWorkMessage(input: {
  channelId: string;
  userId: string;
  ts: string;
  botId?: string;
  subtype?: string;
  channelType?: string;
  files?: SlackFile[];
}): Promise<{ handled: boolean; reason?: string }> {
  if (input.botId) {
    return { handled: false, reason: "ignored_bot" };
  }

  // Allow file_share (typical for Slack voice notes); skip other subtypes.
  if (input.subtype && input.subtype !== "file_share") {
    return { handled: false, reason: "ignored_subtype" };
  }

  if (!isSlackDmChannel(input.channelId, input.channelType)) {
    return { handled: false, reason: "not_dm" };
  }

  const attachments = extractSlackAudioAttachments(input.files);
  if (attachments.length === 0) {
    return { handled: false, reason: "no_audio" };
  }

  const existing = await prisma.slackVoiceWorkDraft.findUnique({
    where: {
      slackChannelId_slackThreadTs: {
        slackChannelId: input.channelId,
        slackThreadTs: input.ts
      }
    }
  });
  if (existing) {
    return { handled: false, reason: "already_drafted" };
  }

  const branUserId = await resolveBranUserIdForSlackUser(input.userId);
  if (!branUserId) {
    try {
      await sendDm(
        input.userId,
        "Your Slack email isn’t linked to a Bran account yet, so I can’t turn this voice note into work units. Ask an admin to match your Slack email to Bran, then try again."
      );
    } catch (error) {
      console.error("[work.slack-voice] failed to notify unlinked user:", error);
    }
    return { handled: false, reason: "bran_user_unlinked" };
  }

  const audio = await downloadSlackAudio(attachments[0]);
  if (!audio) {
    try {
      await postSlackMessage(
        input.channelId,
        "I couldn’t download that voice note (unsupported format or over 25 MB). Try again with a shorter clip.",
        { threadTs: input.ts }
      );
    } catch (error) {
      console.error("[work.slack-voice] failed to post download error:", error);
    }
    return { handled: false, reason: "download_failed" };
  }

  let recording: { id: string };
  let transcript: string;
  try {
    const archived = await transcribeAndArchiveVoiceRecording({
      userId: branUserId,
      source: "slack_work",
      fileBuffer: audio.buffer,
      originalname: audio.name,
      mimetype: audio.mimetype
    });
    recording = archived.recording;
    transcript = archived.sarvam.transcript.trim();
  } catch (error) {
    console.error("[work.slack-voice] transcription failed:", error);
    try {
      await postSlackMessage(
        input.channelId,
        "Sorry — I couldn’t transcribe that voice note. Please try again in a moment.",
        { threadTs: input.ts }
      );
    } catch (postError) {
      console.error("[work.slack-voice] failed to post transcription error:", postError);
    }
    return { handled: false, reason: "transcription_failed" };
  }

  if (!transcript) {
    try {
      await postSlackMessage(
        input.channelId,
        "I got the audio but couldn’t extract any speech. Try speaking a bit clearer or longer.",
        { threadTs: input.ts }
      );
    } catch (error) {
      console.error("[work.slack-voice] failed to post empty transcript notice:", error);
    }
    return { handled: false, reason: "empty_transcript" };
  }

  try {
    await prisma.slackVoiceWorkDraft.create({
      data: {
        branUserId,
        slackUserId: input.userId,
        slackChannelId: input.channelId,
        slackThreadTs: input.ts,
        voiceRecordingId: recording.id,
        transcript,
        status: "AWAITING_CONFIRM"
      }
    });
  } catch (error) {
    // Unique collision from a concurrent duplicate event — treat as already handled.
    console.warn("[work.slack-voice] draft create race:", error);
    return { handled: false, reason: "draft_create_race" };
  }

  const reply = [
    "Here's the transcript:",
    "",
    transcript,
    "",
    "Reply in this thread with your edited text to create work units,",
    "or reply `create` to use this as-is."
  ].join("\n");

  try {
    await postSlackMessage(input.channelId, reply, { threadTs: input.ts });
  } catch (error) {
    console.error("[work.slack-voice] failed to post transcript reply:", error);
  }

  console.log(
    `[work.slack-voice] draft ready for ${input.channelId}:${input.ts} (recording ${recording.id})`
  );
  return { handled: true };
}

/**
 * DM thread reply on a voice draft → create work units from edited or accepted transcript.
 */
export async function processSlackVoiceWorkConfirm(input: {
  channelId: string;
  userId: string;
  text?: string;
  ts: string;
  botId?: string;
  subtype?: string;
  threadTs?: string;
  channelType?: string;
}): Promise<{ handled: boolean; reason?: string; created?: number }> {
  if (input.botId || input.subtype) {
    return { handled: false, reason: "ignored_bot_or_subtype" };
  }

  if (!isSlackDmChannel(input.channelId, input.channelType)) {
    return { handled: false, reason: "not_dm" };
  }

  const threadTs = input.threadTs;
  if (!threadTs || threadTs === input.ts) {
    return { handled: false, reason: "not_thread_reply" };
  }

  const text = input.text?.trim() ?? "";
  if (!text) {
    return { handled: false, reason: "empty_text" };
  }

  const draft = await prisma.slackVoiceWorkDraft.findUnique({
    where: {
      slackChannelId_slackThreadTs: {
        slackChannelId: input.channelId,
        slackThreadTs: threadTs
      }
    }
  });

  if (!draft) {
    return { handled: false, reason: "no_draft" };
  }

  if (draft.status === "CREATED") {
    return { handled: false, reason: "already_created" };
  }

  if (draft.status === "EXPIRED" || draft.status === "FAILED") {
    return { handled: false, reason: `draft_${draft.status.toLowerCase()}` };
  }

  if (draft.status !== "AWAITING_CONFIRM") {
    return { handled: false, reason: "draft_not_awaiting" };
  }

  const ageMs = Date.now() - draft.createdAt.getTime();
  if (ageMs > SLACK_VOICE_DRAFT_TTL_MS) {
    await prisma.slackVoiceWorkDraft.update({
      where: { id: draft.id },
      data: { status: "EXPIRED" }
    });
    try {
      await postSlackMessage(
        input.channelId,
        "This voice draft expired (older than 24 hours). Send a new voice note to start again.",
        { threadTs }
      );
    } catch (error) {
      console.error("[work.slack-voice] failed to post expiry notice:", error);
    }
    return { handled: false, reason: "draft_expired" };
  }

  if (draft.slackUserId !== input.userId) {
    return { handled: false, reason: "wrong_user" };
  }

  const finalText = isAcceptAsIsConfirmReply(text) ? draft.transcript : text;
  if (!finalText.trim()) {
    return { handled: false, reason: "empty_final_text" };
  }

  if (!isWorkExtractionAiConfigured()) {
    try {
      await postSlackMessage(
        input.channelId,
        "Work extraction isn’t configured right now, so I can’t create work units from this yet.",
        { threadTs }
      );
    } catch (error) {
      console.error("[work.slack-voice] failed to post AI-config notice:", error);
    }
    return { handled: false, reason: "ai_not_configured" };
  }

  try {
    const result = await createWorkUnitsFromRecording(
      draft.branUserId,
      { id: draft.voiceRecordingId },
      finalText,
      { sourceType: "SLACK", sourceId: draft.id, throwOnExtractError: false }
    );

    await prisma.slackVoiceWorkDraft.update({
      where: { id: draft.id },
      data: { status: "CREATED" }
    });

    const titles = result.workUnits.map((unit) => `• ${unit.title}`).join("\n");
    const count = result.workUnits.length;
    const reply =
      count === 0
        ? "I processed that, but didn’t find any new work units to create (they may already exist)."
        : `Created ${count} work unit${count === 1 ? "" : "s"}:\n${titles}`;

    await postSlackMessage(input.channelId, reply, { threadTs });

    console.log(
      `[work.slack-voice] confirm ${draft.id} → created ${count} work unit(s)`
    );
    return { handled: true, created: count };
  } catch (error) {
    console.error("[work.slack-voice] confirm/create failed:", error);
    try {
      await postSlackMessage(
        input.channelId,
        "Sorry — I couldn’t create work units from that text. Reply again with an edit (or `create`), or send a new voice note.",
        { threadTs }
      );
    } catch (postError) {
      console.error("[work.slack-voice] failed to post create error:", postError);
    }
    // Leave status AWAITING_CONFIRM so the user can retry.
    return { handled: true, reason: "create_failed" };
  }
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

  // Admins/managers may list everyone or filter by person; others only see their own.
  const isPrivileged = canViewAll(options.viewerRole ?? "");
  const filterUserId = isPrivileged ? options.targetUserId : options.viewerUserId;

  const { items, total } = await findWorkUnits({
    userId: filterUserId,
    status: options.status,
    from: parseRangeFrom(options.from),
    to: parseRangeTo(options.to),
    // Privileged "everyone": hide others' private units. Person filter: include that person's private units.
    isPrivateVisibleForUserId: isPrivileged
      ? (options.targetUserId ?? options.viewerUserId)
      : undefined,
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

export async function regenerateWorkUnitsFromRecording(
  recordingId: string,
  userId: string,
  transcript?: string
) {
  const recording = await findVoiceRecordingById(recordingId);
  if (!recording) {
    throw new HttpError(404, "Voice recording not found");
  }

  const nextTranscript = (transcript ?? recording.transcript)?.trim() ?? "";
  if (!nextTranscript) {
    throw new HttpError(422, "Voice recording has no transcript to regenerate from");
  }

  if (nextTranscript !== (recording.transcript ?? "").trim()) {
    await updateVoiceRecording(recordingId, { transcript: nextTranscript });
  }

  const result = await createWorkUnitsFromRecording(userId, recording, nextTranscript, {
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
    transcript: nextTranscript,
    audioRecording: { ...recording, transcript: nextTranscript },
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
