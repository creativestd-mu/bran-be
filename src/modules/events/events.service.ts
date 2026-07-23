import { createHash, randomUUID } from "crypto";

import { HttpError } from "../../utils/httpError";
import {
  DEFAULT_DETECT_LOOKBACK_DAYS,
  DEFAULT_DETECT_MAX_CANDIDATES,
  type OrgEventSourceType,
  type OrgEventStatus
} from "./events.constants";
import { clusterSourcesIntoEvents, isEventsAiConfigured } from "./events.ai";
import {
  buildDatedEventSummary,
  eventDateRangeFromCandidates,
  summaryHasDatedTimeline,
  summaryLooksTruncated,
  updatesToSummaryCandidates
} from "./events.summary";
import {
  createOrgEvent,
  createOrgEventUpdate,
  createUpdateFromCandidate,
  deleteOrgEvent,
  findOrgEventById,
  findUpdateBySource,
  listOrgEvents,
  serializeOrgEvent,
  updateOrgEvent
} from "./events.repository";
import {
  loadUnattachedSourceCandidates,
  resolveSourceCandidate,
  type SourceCandidate
} from "./events.sources";

function parseOptionalDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "Invalid datetime");
  }
  return date;
}

async function refreshAutoEventSummary(eventId: string): Promise<void> {
  const event = await findOrgEventById(eventId);
  if (!event || event.kind !== "AUTO" || !event.updates?.length) return;

  const candidates = updatesToSummaryCandidates(event.updates);
  if (candidates.length === 0) return;

  const { startsAt, endsAt } = eventDateRangeFromCandidates(candidates);
  await updateOrgEvent(eventId, {
    aiSummary: buildDatedEventSummary(candidates),
    startsAt,
    endsAt,
    aiAnalyzedAt: new Date()
  });
}

export async function listEvents(query: {
  status?: OrgEventStatus;
  kind?: "MANUAL" | "AUTO";
  limit?: number;
}) {
  const rows = await listOrgEvents(query);
  return {
    events: rows.map(serializeOrgEvent),
    summary: {
      total: rows.length,
      manual: rows.filter((row) => row.kind === "MANUAL").length,
      auto: rows.filter((row) => row.kind === "AUTO").length,
      active: rows.filter((row) => row.status === "active").length
    }
  };
}

export async function getEventDetail(id: string) {
  let event = await findOrgEventById(id);
  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  // Backfill older AUTO events whose summary predates dated timelines or was truncated.
  if (
    event.kind === "AUTO" &&
    event.updates?.length &&
    (!summaryHasDatedTimeline(event.aiSummary) || summaryLooksTruncated(event.aiSummary))
  ) {
    await refreshAutoEventSummary(id);
    event = await findOrgEventById(id);
  }

  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  return serializeOrgEvent(event);
}

export async function createManualEvent(
  userId: string,
  input: {
    title: string;
    description?: string | null;
    status?: OrgEventStatus;
    startsAt?: string | null;
    endsAt?: string | null;
  }
) {
  const event = await createOrgEvent({
    title: input.title,
    description: input.description ?? null,
    kind: "MANUAL",
    status: input.status ?? "planned",
    startsAt: parseOptionalDate(input.startsAt) ?? null,
    endsAt: parseOptionalDate(input.endsAt) ?? null,
    createdById: userId
  });
  return serializeOrgEvent(event);
}

export async function patchEvent(
  id: string,
  input: {
    title?: string;
    description?: string | null;
    status?: OrgEventStatus;
    startsAt?: string | null;
    endsAt?: string | null;
  }
) {
  const existing = await findOrgEventById(id);
  if (!existing) {
    throw new HttpError(404, "Event not found");
  }

  const updated = await updateOrgEvent(id, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.startsAt !== undefined ? { startsAt: parseOptionalDate(input.startsAt) ?? null } : {}),
    ...(input.endsAt !== undefined ? { endsAt: parseOptionalDate(input.endsAt) ?? null } : {})
  });
  return serializeOrgEvent(updated);
}

export async function removeEvent(id: string) {
  const existing = await findOrgEventById(id);
  if (!existing) {
    throw new HttpError(404, "Event not found");
  }
  await deleteOrgEvent(id);
  return { deleted: true };
}

export async function attachSourceToEvent(
  eventId: string,
  input: { sourceType: Exclude<OrgEventSourceType, "MANUAL">; sourceId: string }
) {
  const event = await findOrgEventById(eventId);
  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  const existing = await findUpdateBySource(input.sourceType, input.sourceId);
  if (existing) {
    if (existing.eventId === eventId) {
      return getEventDetail(eventId);
    }
    throw new HttpError(409, "This source is already attached to another event");
  }

  const candidate = await resolveSourceCandidate(input.sourceType, input.sourceId);
  if (!candidate) {
    throw new HttpError(404, "Source item not found");
  }

  await createUpdateFromCandidate(eventId, candidate);
  if (event.kind === "AUTO") {
    await refreshAutoEventSummary(eventId);
  }
  return getEventDetail(eventId);
}

export async function addEventNote(
  eventId: string,
  user: { userId: string; email?: string | null; name?: string | null },
  input: { body: string; title?: string }
) {
  const event = await findOrgEventById(eventId);
  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  await createOrgEventUpdate({
    eventId,
    sourceType: "MANUAL",
    sourceId: randomUUID(),
    title: input.title ?? "Note",
    body: input.body,
    actorUserId: user.userId,
    actorName: user.name ?? user.email ?? null,
    occurredAt: new Date()
  });

  return getEventDetail(eventId);
}

export async function listUnattachedSources(query: {
  sourceType?: Exclude<OrgEventSourceType, "MANUAL">;
  days?: number;
  limit?: number;
}) {
  const candidates = await loadUnattachedSourceCandidates({
    days: query.days,
    maxCandidates: query.limit ?? 50,
    sourceType: query.sourceType
  });

  return {
    sources: candidates.map((candidate) => ({
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      title: candidate.title,
      body: candidate.body,
      actorUserId: candidate.actorUserId ?? null,
      actorName: candidate.actorName ?? null,
      occurredAt: candidate.occurredAt.toISOString(),
      metadata: candidate.metadata ?? null
    }))
  };
}

/**
 * Signature of the unattached-candidate set from the most recent detection run.
 * When the set is unchanged, we skip the (expensive) LLM clustering call. This
 * makes the detection cron safe to run frequently: it only spends tokens when
 * new source activity has actually appeared. Reset to null on `force`/restart,
 * costing at most one extra run.
 */
let lastDetectionSignature: string | null = null;

function computeCandidateSignature(candidates: SourceCandidate[]): string {
  const keys = candidates
    .map((candidate) => `${candidate.sourceType}:${candidate.sourceId}`)
    .sort();
  return createHash("sha1").update(keys.join("|")).digest("hex");
}

export async function detectEventsFromSources(options?: {
  days?: number;
  maxCandidates?: number;
  /** Bypass the change-detection gate (used by manual/user-triggered runs). */
  force?: boolean;
}): Promise<{
  scanned: number;
  created: number;
  attached: number;
  skipped: boolean;
  events: ReturnType<typeof serializeOrgEvent>[];
}> {
  if (!isEventsAiConfigured()) {
    throw new HttpError(503, "AI provider is not configured for event detection");
  }

  const candidates = await loadUnattachedSourceCandidates({
    days: options?.days ?? DEFAULT_DETECT_LOOKBACK_DAYS,
    maxCandidates: options?.maxCandidates ?? DEFAULT_DETECT_MAX_CANDIDATES
  });

  if (candidates.length < 2) {
    // Nothing clusterable; remember the (small) set so we don't retry uselessly.
    lastDetectionSignature = computeCandidateSignature(candidates);
    return { scanned: candidates.length, created: 0, attached: 0, skipped: false, events: [] };
  }

  const signature = computeCandidateSignature(candidates);
  if (!options?.force && signature === lastDetectionSignature) {
    // Unattached set is identical to the last run — no new activity, skip the LLM.
    return { scanned: candidates.length, created: 0, attached: 0, skipped: true, events: [] };
  }

  const byKey = new Map(
    candidates.map((candidate) => [`${candidate.sourceType}:${candidate.sourceId}`, candidate])
  );

  const clusters = await clusterSourcesIntoEvents(candidates);
  const createdEvents = [];
  let attached = 0;

  for (const cluster of clusters) {
    const clusterCandidates: SourceCandidate[] = [];
    for (const key of cluster.sourceKeys) {
      const candidate = byKey.get(key);
      if (!candidate) continue;
      const already = await findUpdateBySource(candidate.sourceType, candidate.sourceId);
      if (already) continue;
      clusterCandidates.push(candidate);
    }
    if (clusterCandidates.length < 2) continue;

    // A real org/business/student event must be anchored by a substantive
    // business source (email, escalation, or work unit). Meetings are only
    // context/enrichment — a cluster made only of meetings is just a meeting,
    // not an org event, so skip it.
    const businessAnchors = clusterCandidates.filter(
      (candidate) => candidate.sourceType !== "MEETING"
    );
    if (businessAnchors.length === 0) continue;

    const latest = clusterCandidates.reduce((max, item) =>
      item.occurredAt > max ? item.occurredAt : max
    , clusterCandidates[0].occurredAt);
    const { startsAt, endsAt } = eventDateRangeFromCandidates(clusterCandidates);

    const event = await createOrgEvent({
      title: cluster.title,
      description: cluster.description,
      kind: "AUTO",
      status: cluster.status,
      startsAt,
      endsAt,
      aiSummary: buildDatedEventSummary(clusterCandidates, cluster.summary),
      aiAnalyzedAt: new Date(),
      confidence: cluster.confidence,
      latestUpdateAt: latest
    });

    for (const candidate of clusterCandidates) {
      await createUpdateFromCandidate(event.id, candidate);
      attached += 1;
      byKey.delete(`${candidate.sourceType}:${candidate.sourceId}`);
    }

    const detail = await findOrgEventById(event.id);
    if (detail) createdEvents.push(serializeOrgEvent(detail));
  }

  // Signature over the candidates still unattached after this run. Items that
  // stayed unattached (noise/singletons) won't re-trigger the LLM until genuinely
  // new source activity changes the set.
  lastDetectionSignature = computeCandidateSignature(Array.from(byKey.values()));

  return {
    scanned: candidates.length,
    created: createdEvents.length,
    attached,
    skipped: false,
    events: createdEvents
  };
}
