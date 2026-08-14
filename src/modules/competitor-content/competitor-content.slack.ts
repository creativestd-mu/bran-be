import { env } from "../../config/env";
import { getZonedDateParts, wallClockToUtc } from "../../utils/timezone";
import { getSlackBotUserId, postSlackMessage } from "../attendance/attendance.slack";
import {
  parseTaskListDateRangeHeuristic,
  stripSlackUserMentions,
  textMentionsSlackUser,
  type SlackTaskDateRange
} from "../work/work.slack-tasks";
import { isSlackDmChannel } from "../work/work.slack-voice";
import { resolveBranUserIdForSlackUser } from "../work/work.slack";
import { COMPETITOR_NAMES } from "./competitor-content.constants";
import { getCompetitorContentImpact } from "./competitor-content.service";
import type { CompetitorContentImpact, CompetitorContentRecord } from "./competitor-content.types";

const COMPETITOR_INTENT_RE =
  /\b(competitor|competitors|competition|rival|rivals|competitive)\b/i;

const COMPETITOR_COVERAGE_RE =
  /\b(sentiment|coverage|news|mentions?|press|media|impact|impactful|positive|negative|story|stories|article|articles)\b/i;

const COMPETITOR_NAME_RE = new RegExp(`\\b(${COMPETITOR_NAMES.join("|")})\\b`, "i");

const COMPETITOR_DEDUP_TTL_MS = 60 * 1000;
const recentCompetitorEvents = new Map<string, number>();

function markCompetitorEvent(channelId: string, ts: string): boolean {
  const now = Date.now();
  for (const [key, seenAt] of recentCompetitorEvents) {
    if (now - seenAt > COMPETITOR_DEDUP_TTL_MS) {
      recentCompetitorEvents.delete(key);
    }
  }
  const key = `${channelId}:${ts}`;
  if (recentCompetitorEvents.has(key)) {
    return false;
  }
  recentCompetitorEvents.set(key, now);
  return true;
}

export function looksLikeCompetitorQuery(text: string): boolean {
  const trimmed = stripSlackUserMentions(text);
  if (!trimmed) {
    return false;
  }
  if (COMPETITOR_INTENT_RE.test(trimmed)) {
    return true;
  }
  return COMPETITOR_NAME_RE.test(trimmed) && COMPETITOR_COVERAGE_RE.test(trimmed);
}

function defaultLastSevenDays(now = new Date()): SlackTaskDateRange {
  const today = getZonedDateParts(now);
  const startUtc = new Date(Date.UTC(today.year, today.month - 1, today.day - 6));
  const from = {
    year: startUtc.getUTCFullYear(),
    month: startUtc.getUTCMonth() + 1,
    day: startUtc.getUTCDate()
  };
  return {
    from: wallClockToUtc({ ...from, hour: 0, minute: 0, second: 0, ms: 0 }),
    to: wallClockToUtc({ ...today, hour: 23, minute: 59, second: 59, ms: 999 }),
    label: "last 7 days (IST)"
  };
}

export function resolveCompetitorSlackRange(text: string, now = new Date()): SlackTaskDateRange {
  const cleaned = stripSlackUserMentions(text);
  return parseTaskListDateRangeHeuristic(cleaned, now) ?? defaultLastSevenDays();
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return String(Math.round(value));
}

function formatPiece(piece: CompetitorContentRecord, index: number): string {
  const headline = piece.title?.trim() || piece.snippet?.trim() || "Untitled mention";
  const outlet = piece.sourceName || piece.source || "Unknown source";
  const when = piece.publishedAt
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short"
      }).format(new Date(piece.publishedAt))
    : "unknown date";
  const metrics = [
    piece.engagement > 0 ? `eng ${formatCompact(piece.engagement)}` : null,
    piece.reach > 0 ? `reach ${formatCompact(piece.reach)}` : null
  ]
    .filter(Boolean)
    .join(" · ");

  const link = piece.url ? `<${piece.url}|${headline}>` : `*${headline}*`;
  return `${index}. ${link}\n   _${outlet} · ${when}${metrics ? ` · ${metrics}` : ""}_`;
}

export function formatCompetitorSlackMessage(
  impact: CompetitorContentImpact,
  rangeLabel: string
): string | null {
  const hasPositive = impact.positive.length > 0;
  const hasNegative = impact.negative.length > 0;

  // Don't force it — nothing notable in this window
  if (!hasPositive && !hasNegative) {
    return null;
  }

  const lines = [`*Competitor impactful content — ${rangeLabel}*`, ""];

  if (hasPositive) {
    lines.push("*Positive (highest engagement)*");
    impact.positive.forEach((piece, index) => {
      lines.push(formatPiece(piece, index + 1));
    });
    lines.push("");
  }

  if (hasNegative) {
    lines.push("*Negative (highest engagement)*");
    impact.negative.forEach((piece, index) => {
      lines.push(formatPiece(piece, index + 1));
    });
    lines.push("");
  }

  lines.push(
    "_Ask `competitor coverage this week` or `Newton sentiment last month`._"
  );
  return lines.join("\n");
}

export async function processSlackCompetitorMessage(input: {
  channelId: string;
  userId: string;
  text?: string;
  ts: string;
  botId?: string;
  subtype?: string;
  threadTs?: string;
  channelType?: string;
}): Promise<{ handled: boolean; reason?: string }> {
  if (input.botId) {
    return { handled: false, reason: "ignored_bot" };
  }
  if (input.subtype && input.subtype !== "thread_broadcast") {
    return { handled: false, reason: "ignored_subtype" };
  }

  const text = input.text?.trim() ?? "";
  if (!text) {
    return { handled: false, reason: "empty_text" };
  }

  const isDm = isSlackDmChannel(input.channelId, input.channelType);
  if (!isDm) {
    const botUserId = await getSlackBotUserId();
    if (!botUserId || !textMentionsSlackUser(text, botUserId)) {
      return { handled: false, reason: "channel_requires_mention" };
    }
  }

  if (!looksLikeCompetitorQuery(text)) {
    return { handled: false, reason: "not_competitor" };
  }

  if (!markCompetitorEvent(input.channelId, input.ts)) {
    return { handled: true, reason: "duplicate" };
  }

  const branUserId = await resolveBranUserIdForSlackUser(input.userId);
  if (!branUserId) {
    await postSlackMessage(
      input.channelId,
      "I can only share competitor coverage with people onboarded on Bran. Once your Slack email matches an active Bran account, ask me again.",
      isDm ? undefined : { threadTs: input.threadTs ?? input.ts }
    );
    return { handled: true, reason: "unmapped_user" };
  }

  if (env.meltwaterCompetitorSearchIds.length === 0) {
    await postSlackMessage(
      input.channelId,
      "Competitor monitoring isn't configured yet (missing MELTWATER_COMPETITOR_SEARCH_IDS).",
      isDm ? undefined : { threadTs: input.threadTs ?? input.ts }
    );
    return { handled: true, reason: "not_configured" };
  }

  const range = resolveCompetitorSlackRange(text);
  const impact = await getCompetitorContentImpact({
    from: range.from.toISOString(),
    to: range.to.toISOString()
  });
  const message = formatCompetitorSlackMessage(impact, range.label);

  if (!message) {
    // Don't force it — stay quiet rather than inventing impact
    await postSlackMessage(
      input.channelId,
      `*Competitor impactful content — ${range.label}*\n\nNothing notable positively or negatively impacting competitor sentiment in this window.`,
      isDm ? undefined : { threadTs: input.threadTs ?? input.ts }
    );
    return { handled: true, reason: "empty" };
  }

  await postSlackMessage(
    input.channelId,
    message,
    isDm ? undefined : { threadTs: input.threadTs ?? input.ts }
  );

  console.log("[competitor.slack] answered", {
    slackUserId: input.userId,
    branUserId,
    channelId: input.channelId,
    isDm,
    label: range.label,
    positive: impact.positive.length,
    negative: impact.negative.length
  });

  return { handled: true, reason: "answered" };
}
