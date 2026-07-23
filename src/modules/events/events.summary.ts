import { env } from "../../config/env";
import type { SourceCandidate } from "./events.sources";

function formatCasualDate(instant: Date): string {
  return instant.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: env.appTimezone
  });
}

function formatCasualDateRange(start: Date, end: Date): string {
  const startLabel = formatCasualDate(start);
  const endLabel = formatCasualDate(end);
  if (startLabel === endLabel) return startLabel;

  const startDay = start.toLocaleDateString("en-CA", { timeZone: env.appTimezone });
  const endDay = end.toLocaleDateString("en-CA", { timeZone: env.appTimezone });
  if (startDay === endDay) return startLabel;

  return `${startLabel} to ${endLabel}`;
}

function normalizeSummaryText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function summaryLooksTruncated(summary: string | null | undefined): boolean {
  if (!summary?.trim()) return false;
  return /…|\.\.\.(?:\s|$)/.test(summary);
}

/** Legacy bullet timelines from older builds. */
export function summaryUsesBulletTimeline(summary: string | null | undefined): boolean {
  if (!summary?.trim()) return false;
  return /^•\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4},/m.test(summary);
}

/** @deprecated use summaryUsesBulletTimeline */
export function summaryHasDatedTimeline(summary: string | null | undefined): boolean {
  return summaryUsesBulletTimeline(summary);
}

export function summaryShouldRefresh(summary: string | null | undefined): boolean {
  if (!summary?.trim()) return true;
  if (summaryLooksTruncated(summary)) return true;
  if (summaryUsesBulletTimeline(summary)) return true;
  return false;
}

function buildHeuristicProseSummary(
  candidates: SourceCandidate[],
  range: { startsAt: Date; endsAt: Date }
): string {
  const when = formatCasualDateRange(range.startsAt, range.endsAt);
  const seen = new Set<string>();
  const titles: string[] = [];

  for (const candidate of [...candidates].sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()
  )) {
    const title = normalizeSummaryText(candidate.title);
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    titles.push(title);
    if (titles.length >= 5) break;
  }

  if (titles.length === 0) {
    return `Activity picked up around ${when}.`;
  }

  if (titles.length === 1) {
    return `Around ${when}, work focused on ${titles[0]}.`;
  }

  const head = titles.slice(0, -1).join("; ");
  const last = titles[titles.length - 1];
  return `From ${when}, updates touched ${head}; and ${last}.`;
}

/**
 * Short prose AI summary. Prefer LLM overview when provided; otherwise a compact fallback.
 */
export function buildEventAiSummary(
  candidates: SourceCandidate[],
  overview?: string | null
): string {
  const range = eventDateRangeFromCandidates(candidates);
  const overviewText = overview?.trim();
  if (overviewText) {
    return overviewText;
  }
  return buildHeuristicProseSummary(candidates, range);
}

/** @deprecated use buildEventAiSummary */
export function buildDatedEventSummary(
  candidates: SourceCandidate[],
  overview?: string | null
): string {
  return buildEventAiSummary(candidates, overview);
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
