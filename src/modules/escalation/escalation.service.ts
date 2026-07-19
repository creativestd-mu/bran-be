import { HttpError } from "../../utils/httpError";
import { getSlackUserInfo } from "../attendance/attendance.slack";
import { invalidateBrainGraphCache } from "../graph/graph.cache";
import { analyzeEscalationWithAi, isEscalationAiConfigured } from "./escalation.ai";
import {
  ACTIVE_ESCALATION_STATUSES,
  type EscalationPriority,
  type EscalationStatus
} from "./escalation.constants";
import {
  extractEscalationTitle,
  inferPriority,
  inferStatusFromText,
  normalizeEscalationStatus,
  normalizeEscalationTitle
} from "./escalation.parser";
import {
  findActiveEscalationIds,
  findEscalationById,
  findEscalationBySlackMessageTs,
  listEscalations,
  parseStoredAttachments,
  serializeEscalation,
  updateEscalationAiAnalysis,
  updateEscalationStatus,
  upsertEscalation,
  upsertEscalationUpdate
} from "./escalation.repository";
import {
  extractSlackImageAttachments,
  fetchEscalationChannelHistory,
  fetchEscalationThreadReplies,
  isEscalationConfigured,
  resolveEscalationChannelId,
  resolveSlackMentionsInText,
  slackMessageInstant,
  type SlackFile,
  type SlackMessage
} from "./escalation.slack";

const aiAnalysisInFlight = new Set<string>();

type AuthorInfo = {
  slackUserId: string | null;
  authorName: string | null;
  authorEmail: string | null;
};

function isIngestibleMessage(message: SlackMessage): boolean {
  if (!message.user || !message.ts) return false;
  if (message.bot_id) return false;
  if (message.subtype && message.subtype !== "file_share") return false;
  const text = (message.text ?? "").trim();
  const hasImages = extractSlackImageAttachments(message.files).length > 0;
  return Boolean(text || hasImages);
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
      isManual: update.isManual,
      attachments: parseStoredAttachments(update.attachments)
    }))
  });

  if (!analysis) {
    throw new HttpError(503, "Escalation AI is not configured or returned invalid output");
  }

  const now = new Date();
  const status = normalizeEscalationStatus(analysis.status);
  const updated = await updateEscalationAiAnalysis({
    id: escalation.id,
    title: normalizeEscalationTitle(analysis.title, escalation.title),
    latestContext: analysis.summary,
    status,
    priority: analysis.priority,
    aiSummary: analysis.summary,
    aiIssueDescription: analysis.issueDescription,
    aiBlockers: analysis.blockers,
    aiAnalyzedAt: now,
    resolvedAt: resolvedAtForStatus(status)
  });

  invalidateBrainGraphCache();
  return serializeEscalation(updated);
}

async function applyStatus(
  escalationId: string,
  currentStatus: EscalationStatus,
  nextStatus: EscalationStatus | null,
  latestContext: string,
  latestUpdateAt: Date
) {
  const normalizedNext = nextStatus ? normalizeEscalationStatus(nextStatus) : null;
  if (!normalizedNext || normalizedNext === currentStatus) {
    return updateEscalationStatus({
      id: escalationId,
      status: normalizeEscalationStatus(currentStatus),
      latestContext,
      latestUpdateAt
    });
  }

  return updateEscalationStatus({
    id: escalationId,
    status: normalizedNext,
    latestContext,
    latestUpdateAt,
    resolvedAt: resolvedAtForStatus(normalizedNext)
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
  const text = (input.message.text ?? "").trim();
  const attachments = extractSlackImageAttachments(input.message.files);
  const inferredStatus = inferStatusFromText(text);
  const createdAt = slackMessageInstant(input.message.ts);
  const body = text || (attachments.length ? `[${attachments.length} image attachment(s)]` : "");

  await upsertEscalationUpdate({
    escalationId: parent.id,
    slackUserId: author.slackUserId,
    authorName: author.authorName,
    authorEmail: author.authorEmail,
    body,
    attachments,
    slackMessageTs: input.message.ts,
    inferredStatus,
    createdAt
  });

  await applyStatus(
    parent.id,
    parent.status as EscalationStatus,
    inferredStatus,
    body,
    createdAt
  );

  if (options?.scheduleAi !== false) {
    scheduleEscalationAiAnalysis(parent.id);
  }

  invalidateBrainGraphCache();
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
  const text = (input.message.text ?? "").trim();
  const attachments = extractSlackImageAttachments(input.message.files);
  const body = text || (attachments.length ? `[${attachments.length} image attachment(s)]` : "");
  const title = text
    ? extractEscalationTitle(text)
    : attachments[0]?.name ?? "Escalation";
  const priority = inferPriority(text);
  // New escalations default to open; only resolved/closed keywords flip status.
  const status: EscalationStatus = normalizeEscalationStatus(
    inferStatusFromText(text) ?? "open"
  );
  const createdAt = slackMessageInstant(input.message.ts);

  const escalation = await upsertEscalation({
    title,
    problemContext: body,
    latestContext: body,
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
    body,
    attachments,
    slackMessageTs: input.message.ts,
    inferredStatus: status,
    createdAt
  });

  if (options?.scheduleAi !== false) {
    scheduleEscalationAiAnalysis(escalation.id);
  }

  invalidateBrainGraphCache();
  return { handled: true as const, escalationId: escalation.id };
}

export async function processSlackEscalationMessage(input: {
  channelId: string;
  userId: string;
  text?: string;
  ts: string;
  botId?: string;
  subtype?: string;
  threadTs?: string;
  files?: SlackFile[];
}): Promise<{ handled: boolean; reason?: string }> {
  if (!isEscalationConfigured()) {
    return { handled: false, reason: "not_configured" };
  }

  if (input.botId) {
    return { handled: false, reason: "ignored_bot_or_subtype" };
  }
  if (input.subtype && input.subtype !== "file_share") {
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
    thread_ts: input.threadTs,
    subtype: input.subtype,
    files: input.files
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

  // Await AI (small pool) so Sync returns after titles are rewritten.
  // Previously fire-and-forget + re-ingest overwriting title left raw Slack first lines.
  const uniqueIds = [...new Set(analyzedIds)];
  const concurrency = 2;
  let cursor = 0;
  async function analyzeNext(): Promise<void> {
    while (cursor < uniqueIds.length) {
      const escalationId = uniqueIds[cursor];
      cursor += 1;
      try {
        await refreshEscalationAiAnalysis(escalationId);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`ai=${escalationId}: ${msg}`);
        console.error("[escalation.ai] sync analysis failed", { escalationId, error });
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, uniqueIds.length) }, () => analyzeNext())
  );

  invalidateBrainGraphCache();
  return {
    processed: messages.length,
    escalations,
    updates,
    errors
  };
}

async function withResolvedMentions<T extends ReturnType<typeof serializeEscalation>>(
  item: T
): Promise<T> {
  const [title, problemContext, latestContext, aiSummary, aiIssueDescription, ...aiBlockers] =
    await Promise.all([
      resolveSlackMentionsInText(item.title),
      resolveSlackMentionsInText(item.problemContext),
      resolveSlackMentionsInText(item.latestContext),
      resolveSlackMentionsInText(item.ai.summary ?? ""),
      resolveSlackMentionsInText(item.ai.issueDescription ?? ""),
      ...item.ai.blockers.map((blocker) => resolveSlackMentionsInText(blocker))
    ]);

  const updates = item.updates
    ? await Promise.all(
        item.updates.map(async (update) => ({
          ...update,
          body: await resolveSlackMentionsInText(update.body)
        }))
      )
    : item.updates;

  return {
    ...item,
    title,
    problemContext,
    latestContext,
    ai: {
      ...item.ai,
      summary: item.ai.summary ? aiSummary : null,
      issueDescription: item.ai.issueDescription ? aiIssueDescription : null,
      blockers: aiBlockers
    },
    updates
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
  const items = await Promise.all(
    result.items.map((item) => withResolvedMentions(serializeEscalation(item)))
  );
  return {
    summary: result.summary,
    total: result.total,
    items
  };
}

export async function getEscalationDetail(id: string) {
  const row = await findEscalationById(id);
  if (!row) {
    throw new HttpError(404, "Escalation not found");
  }
  return withResolvedMentions(serializeEscalation(row));
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
    status: normalizeEscalationStatus(input.status),
    latestContext: noteBody,
    latestUpdateAt: now,
    resolvedAt: resolvedAtForStatus(normalizeEscalationStatus(input.status))
  });

  // Don't re-run AI after a manual close — it could reopen the issue.
  if (input.status !== "closed" && input.status !== "resolved") {
    scheduleEscalationAiAnalysis(existing.id);
  }

  invalidateBrainGraphCache();
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

  invalidateBrainGraphCache();
  return serializeEscalation(updated);
}

export async function analyzeEscalationById(id: string) {
  return refreshEscalationAiAnalysis(id);
}

/** Sync Slack + re-analyze open issues (daily cron + manual trigger). */
export async function runEscalationDailyCheck(days = 30): Promise<{
  sync: Awaited<ReturnType<typeof syncEscalationsFromSlack>>;
  analyzed: number;
  autoClosed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let analyzed = 0;
  let autoClosed = 0;

  let sync: Awaited<ReturnType<typeof syncEscalationsFromSlack>>;
  try {
    sync = await syncEscalationsFromSlack(days);
    errors.push(...sync.errors);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`sync: ${msg}`);
    sync = { processed: 0, escalations: 0, updates: 0, errors: [msg] };
  }

  if (!isEscalationAiConfigured()) {
    return { sync, analyzed, autoClosed, errors };
  }

  const activeIds = await findActiveEscalationIds();
  const concurrency = 2;
  let cursor = 0;

  async function analyzeNext(): Promise<void> {
    while (cursor < activeIds.length) {
      const id = activeIds[cursor];
      cursor += 1;
      try {
        const before = await findEscalationById(id);
        await refreshEscalationAiAnalysis(id);
        const after = await findEscalationById(id);
        analyzed += 1;
        if (
          before &&
          after &&
          before.status !== "closed" &&
          after.status === "closed"
        ) {
          autoClosed += 1;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`ai=${id}: ${msg}`);
        console.error("[escalation.daily] analysis failed", { id, error });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, activeIds.length) }, () => analyzeNext())
  );

  return { sync, analyzed, autoClosed, errors };
}

export function getEscalationActiveStatuses() {
  return ACTIVE_ESCALATION_STATUSES;
}
