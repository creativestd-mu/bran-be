import { HttpError } from "../../utils/httpError";
import { getSlackUserInfo } from "../attendance/attendance.slack";
import { analyzeEscalationWithAi, isEscalationAiConfigured } from "./escalation.ai";
import {
  ACTIVE_ESCALATION_STATUSES,
  type EscalationPriority,
  type EscalationStatus
} from "./escalation.constants";
import {
  extractEscalationTitle,
  inferPriority,
  inferStatusFromText
} from "./escalation.parser";
import {
  findEscalationById,
  findEscalationBySlackMessageTs,
  listEscalations,
  serializeEscalation,
  updateEscalationAiAnalysis,
  updateEscalationStatus,
  upsertEscalation,
  upsertEscalationUpdate
} from "./escalation.repository";
import {
  fetchEscalationChannelHistory,
  fetchEscalationThreadReplies,
  isEscalationConfigured,
  resolveEscalationChannelId,
  slackMessageInstant,
  type SlackMessage
} from "./escalation.slack";

const aiAnalysisInFlight = new Set<string>();

type AuthorInfo = {
  slackUserId: string | null;
  authorName: string | null;
  authorEmail: string | null;
};

function isIngestibleMessage(message: SlackMessage): boolean {
  if (!message.user || !message.text || !message.ts) return false;
  if (message.bot_id) return false;
  if (message.subtype) return false;
  return true;
}

async function resolveAuthor(userId: string | undefined): Promise<AuthorInfo> {
  if (!userId) {
    return { slackUserId: null, authorName: null, authorEmail: null };
  }
  try {
    const user = await getSlackUserInfo(userId);
    return {
      slackUserId: user.id,
      authorName:
        user.profile?.real_name ||
        user.real_name ||
        user.profile?.display_name ||
        user.name ||
        null,
      authorEmail: user.profile?.email ?? null
    };
  } catch {
    return { slackUserId: userId, authorName: null, authorEmail: null };
  }
}

function resolvedAtForStatus(status: EscalationStatus): Date | null {
  return status === "resolved" || status === "closed" ? new Date() : null;
}

export function scheduleEscalationAiAnalysis(escalationId: string): void {
  if (!isEscalationAiConfigured()) return;
  if (aiAnalysisInFlight.has(escalationId)) return;

  aiAnalysisInFlight.add(escalationId);
  void refreshEscalationAiAnalysis(escalationId)
    .catch((error) => {
      console.error("[escalation.ai] analysis failed", { escalationId, error });
    })
    .finally(() => {
      aiAnalysisInFlight.delete(escalationId);
    });
}

export async function refreshEscalationAiAnalysis(escalationId: string) {
  const escalation = await findEscalationById(escalationId);
  if (!escalation) {
    throw new HttpError(404, "Escalation not found");
  }

  const analysis = await analyzeEscalationWithAi({
    title: escalation.title,
    problemContext: escalation.problemContext,
    currentStatus: escalation.status as EscalationStatus,
    currentPriority: escalation.priority as EscalationPriority,
    reporterName: escalation.reporterName,
    updates: escalation.updates.map((update) => ({
      authorName: update.authorName,
      body: update.body,
      createdAt: update.createdAt,
      isManual: update.isManual
    }))
  });

  if (!analysis) {
    throw new HttpError(503, "Escalation AI is not configured or returned invalid output");
  }

  const now = new Date();
  const updated = await updateEscalationAiAnalysis({
    id: escalation.id,
    latestContext: analysis.summary,
    status: analysis.status,
    priority: analysis.priority,
    aiSummary: analysis.summary,
    aiBlockers: analysis.blockers,
    aiAnalyzedAt: now,
    resolvedAt: resolvedAtForStatus(analysis.status)
  });

  return serializeEscalation(updated);
}

async function applyStatus(
  escalationId: string,
  currentStatus: EscalationStatus,
  nextStatus: EscalationStatus | null,
  latestContext: string,
  latestUpdateAt: Date
) {
  if (!nextStatus || nextStatus === currentStatus) {
    return updateEscalationStatus({
      id: escalationId,
      status: currentStatus,
      latestContext,
      latestUpdateAt
    });
  }

  return updateEscalationStatus({
    id: escalationId,
    status: nextStatus,
    latestContext,
    latestUpdateAt,
    resolvedAt: resolvedAtForStatus(nextStatus)
  });
}

async function ingestThreadReply(
  input: {
    channelId: string;
    parentTs: string;
    message: SlackMessage;
  },
  options?: { scheduleAi?: boolean }
) {
  const parent = await findEscalationBySlackMessageTs(input.parentTs);
  if (!parent) return { handled: false, reason: "parent_not_found" as const };

  const author = await resolveAuthor(input.message.user);
  const inferredStatus = inferStatusFromText(input.message.text!);
  const createdAt = slackMessageInstant(input.message.ts);

  await upsertEscalationUpdate({
    escalationId: parent.id,
    slackUserId: author.slackUserId,
    authorName: author.authorName,
    authorEmail: author.authorEmail,
    body: input.message.text!,
    slackMessageTs: input.message.ts,
    inferredStatus,
    createdAt
  });

  await applyStatus(
    parent.id,
    parent.status as EscalationStatus,
    inferredStatus,
    input.message.text!,
    createdAt
  );

  if (options?.scheduleAi !== false) {
    scheduleEscalationAiAnalysis(parent.id);
  }

  return { handled: true as const, escalationId: parent.id };
}

async function ingestTopLevelEscalation(
  input: {
    channelId: string;
    message: SlackMessage;
  },
  options?: { scheduleAi?: boolean }
) {
  const author = await resolveAuthor(input.message.user);
  const text = input.message.text!.trim();
  const title = extractEscalationTitle(text);
  const priority = inferPriority(text);
  const status: EscalationStatus = inferStatusFromText(text) ?? "open";
  const createdAt = slackMessageInstant(input.message.ts);

  const escalation = await upsertEscalation({
    title,
    problemContext: text,
    latestContext: text,
    status,
    priority,
    slackChannelId: input.channelId,
    slackMessageTs: input.message.ts,
    reporterSlackId: author.slackUserId,
    reporterName: author.authorName,
    reporterEmail: author.authorEmail,
    latestUpdateAt: createdAt,
    resolvedAt: resolvedAtForStatus(status)
  });

  await upsertEscalationUpdate({
    escalationId: escalation.id,
    slackUserId: author.slackUserId,
    authorName: author.authorName,
    authorEmail: author.authorEmail,
    body: text,
    slackMessageTs: input.message.ts,
    inferredStatus: status,
    createdAt
  });

  if (options?.scheduleAi !== false) {
    scheduleEscalationAiAnalysis(escalation.id);
  }

  return { handled: true as const, escalationId: escalation.id };
}

export async function processSlackEscalationMessage(input: {
  channelId: string;
  userId: string;
  text: string;
  ts: string;
  botId?: string;
  subtype?: string;
  threadTs?: string;
}): Promise<{ handled: boolean; reason?: string }> {
  if (!isEscalationConfigured()) {
    return { handled: false, reason: "not_configured" };
  }

  if (input.botId || input.subtype) {
    return { handled: false, reason: "ignored_bot_or_subtype" };
  }

  let escalationChannelId: string;
  try {
    escalationChannelId = await resolveEscalationChannelId();
  } catch {
    return { handled: false, reason: "escalation_channel_unavailable" };
  }

  if (input.channelId !== escalationChannelId) {
    return { handled: false, reason: "wrong_channel" };
  }

  const message: SlackMessage = {
    user: input.userId,
    text: input.text,
    ts: input.ts,
    thread_ts: input.threadTs
  };

  if (!isIngestibleMessage(message)) {
    return { handled: false, reason: "ignored_message" };
  }

  const isThreadReply = Boolean(input.threadTs && input.threadTs !== input.ts);
  if (isThreadReply && input.threadTs) {
    const result = await ingestThreadReply({
      channelId: input.channelId,
      parentTs: input.threadTs,
      message
    });
    return result.handled
      ? { handled: true }
      : { handled: false, reason: result.reason };
  }

  await ingestTopLevelEscalation({
    channelId: input.channelId,
    message
  });
  return { handled: true };
}

export async function syncEscalationsFromSlack(days = 30): Promise<{
  processed: number;
  escalations: number;
  updates: number;
  errors: string[];
}> {
  if (!isEscalationConfigured()) {
    throw new HttpError(500, "Escalation Slack channel is not configured");
  }

  const channelId = await resolveEscalationChannelId();
  const oldest = String(Math.floor(Date.now() / 1000) - days * 24 * 60 * 60);
  const messages = await fetchEscalationChannelHistory({ oldest });
  const errors: string[] = [];
  let escalations = 0;
  let updates = 0;

  const topLevel = messages
    .filter((message) => isIngestibleMessage(message))
    .filter((message) => !message.thread_ts || message.thread_ts === message.ts)
    .sort((a, b) => Number(a.ts) - Number(b.ts));

  const analyzedIds: string[] = [];

  for (const message of topLevel) {
    try {
      const result = await ingestTopLevelEscalation({ channelId, message }, { scheduleAi: false });
      if (result.handled) {
        escalations += 1;
        if (result.escalationId) analyzedIds.push(result.escalationId);
      }

      const replies = await fetchEscalationThreadReplies(channelId, message.ts);
      for (const reply of replies) {
        if (!isIngestibleMessage(reply)) continue;
        if (reply.ts === message.ts) continue;
        const threadResult = await ingestThreadReply(
          {
            channelId,
            parentTs: message.ts,
            message: reply
          },
          { scheduleAi: false }
        );
        if (threadResult.handled) updates += 1;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`ts=${message.ts}: ${msg}`);
    }
  }

  for (const escalationId of [...new Set(analyzedIds)]) {
    scheduleEscalationAiAnalysis(escalationId);
  }

  return {
    processed: messages.length,
    escalations,
    updates,
    errors
  };
}

export async function listEscalationTracker(filters: {
  status?: EscalationStatus;
  priority?: EscalationPriority;
  activeOnly?: boolean;
  search?: string;
  take?: number;
  skip?: number;
}) {
  const result = await listEscalations(filters);
  return {
    summary: result.summary,
    total: result.total,
    items: result.items.map((item) => serializeEscalation(item))
  };
}

export async function getEscalationDetail(id: string) {
  const row = await findEscalationById(id);
  if (!row) {
    throw new HttpError(404, "Escalation not found");
  }
  return serializeEscalation(row);
}

export async function setEscalationStatus(input: {
  id: string;
  status: EscalationStatus;
  note?: string;
  actorName?: string | null;
}) {
  const existing = await findEscalationById(input.id);
  if (!existing) {
    throw new HttpError(404, "Escalation not found");
  }

  const now = new Date();
  const noteBody =
    input.note?.trim() ||
    `Status changed to ${input.status}${input.actorName ? ` by ${input.actorName}` : ""}.`;

  await upsertEscalationUpdate({
    escalationId: existing.id,
    slackUserId: null,
    authorName: input.actorName ?? "Admin",
    authorEmail: null,
    body: noteBody,
    slackMessageTs: `manual-status-${existing.id}-${now.getTime()}`,
    inferredStatus: input.status,
    isManual: true,
    createdAt: now
  });

  const updated = await updateEscalationStatus({
    id: existing.id,
    status: input.status,
    latestContext: noteBody,
    latestUpdateAt: now,
    resolvedAt: resolvedAtForStatus(input.status)
  });

  scheduleEscalationAiAnalysis(existing.id);

  return serializeEscalation(updated);
}

export async function addEscalationNote(input: {
  id: string;
  body: string;
  actorName?: string | null;
}) {
  const existing = await findEscalationById(input.id);
  if (!existing) {
    throw new HttpError(404, "Escalation not found");
  }

  const now = new Date();
  const inferredStatus = inferStatusFromText(input.body);

  await upsertEscalationUpdate({
    escalationId: existing.id,
    slackUserId: null,
    authorName: input.actorName ?? "Admin",
    authorEmail: null,
    body: input.body,
    slackMessageTs: `manual-note-${existing.id}-${now.getTime()}`,
    inferredStatus,
    isManual: true,
    createdAt: now
  });

  const updated = await applyStatus(
    existing.id,
    existing.status as EscalationStatus,
    inferredStatus,
    input.body,
    now
  );

  scheduleEscalationAiAnalysis(existing.id);

  return serializeEscalation(updated);
}

export async function analyzeEscalationById(id: string) {
  return refreshEscalationAiAnalysis(id);
}

export function getEscalationActiveStatuses() {
  return ACTIVE_ESCALATION_STATUSES;
}
