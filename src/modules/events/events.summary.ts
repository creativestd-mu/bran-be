import { env } from "../../config/env";
import type { SourceCandidate } from "./events.sources";

const SOURCE_LABELS: Record<string, string> = {
  GMAIL: "Gmail",
  MEETING: "Meeting transcript",
  ESCALATION: "Escalation",
  ATTENDANCE: "Attendance",
  WORK_UNIT: "Work unit"
};

function formatSummaryDate(instant: Date): string {
  return instant.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: env.appTimezone
  });
}

function oneLine(text: string, maxLen = 140): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 1)}…`;
}

/**
 * Chronological, date-stamped summary built from attached source candidates.
 * Optional LLM overview is appended after the dated timeline.
 */
export function buildDatedEventSummary(
  candidates: SourceCandidate[],
  overview?: string | null
): string {
  const sorted = [...candidates].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()
  );

  const timeline = sorted
    .map((candidate) => {
      const when = formatSummaryDate(candidate.occurredAt);
      const source = SOURCE_LABELS[candidate.sourceType] ?? candidate.sourceType;
      const title = oneLine(candidate.title, 120);
      const actor = candidate.actorName ? ` · ${candidate.actorName}` : "";
      const detail = candidate.body ? ` — ${oneLine(candidate.body)}` : "";
      return `• ${when} · ${source} · ${title}${actor}${detail}`;
    })
    .join("\n");

  const overviewText = overview?.trim();
  if (overviewText) {
    return `${timeline}\n\n${overviewText}`;
  }

  return timeline;
}

/** True when summary already uses our dated bullet timeline format. */
export function summaryHasDatedTimeline(summary: string | null | undefined): boolean {
  if (!summary?.trim()) return false;
  return /^•\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4},/m.test(summary);
}

export function updatesToSummaryCandidates(
  updates: Array<{
    sourceType: string;
    sourceId: string;
    title: string | null;
    body: string;
    actorUserId: string | null;
    actorName: string | null;
    occurredAt: Date;
    metadata?: unknown;
  }>
): SourceCandidate[] {
  return updates
    .filter((update) => update.sourceType !== "MANUAL")
    .map((update) => ({
      sourceType: update.sourceType as SourceCandidate["sourceType"],
      sourceId: update.sourceId,
      title: update.title ?? "(untitled)",
      body: update.body,
      actorUserId: update.actorUserId,
      actorName: update.actorName,
      occurredAt: update.occurredAt,
      metadata: (update.metadata as Record<string, unknown> | undefined) ?? undefined
    }));
}

export function eventDateRangeFromCandidates(candidates: SourceCandidate[]): {
  startsAt: Date;
  endsAt: Date;
} {
  let startsAt = candidates[0].occurredAt;
  let endsAt = candidates[0].occurredAt;

  for (const candidate of candidates) {
    if (candidate.occurredAt < startsAt) startsAt = candidate.occurredAt;
    if (candidate.occurredAt > endsAt) endsAt = candidate.occurredAt;
  }

  return { startsAt, endsAt };
}
