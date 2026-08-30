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
import { getBrandContentImpact } from "../competitor-content/competitor-content.service";
import { getSentimentDashboard } from "./sentiment.service";
import {
  formatBrandContentSummary,
  summarizeBrandContent,
  type BrandContentSummary
} from "./sentiment.summary";
import type { SentimentDashboard } from "./sentiment.types";

const SENTIMENT_EXPLICIT_RE =
  /\b(sentiment|earned media|meltwater|brand mentions?|press mentions?|media mentions?|mention volume|brand health|our (brand|coverage|mentions|sentiment))\b/i;

const SENTIMENT_COVERAGE_RE =
  /\b(news coverage|media coverage|brand coverage|press coverage)\b/i;

const SENTIMENT_BRAND_RE =
  /\b(masters?\s*['’]?s?\s*union|mastersunion|the brand|our brand)\b/i;

const SENTIMENT_HOW_WE_RE =
  /\bhow (are|is|have|has|did) (we|mu|the brand)(\s+\w+){0,3}\s+(done|doing|performed|fared|been|perceived)\b/i;

const MU_ALIAS_RE = /\bmu\b/i;
const MU_ASK_RE =
  /\b(done|doing|sentiment|coverage|mentions?|perceived|performed|fared|health)\b/i;

const SENTIMENT_DEDUP_TTL_MS = 60 * 1000;
const recentSentimentEvents = new Map<string, number>();

function markSentimentEvent(channelId: string, ts: string): boolean {
  const now = Date.now();
  for (const [key, seenAt] of recentSentimentEvents) {
    if (now - seenAt > SENTIMENT_DEDUP_TTL_MS) {
      recentSentimentEvents.delete(key);
    }
  }
  const key = `${channelId}:${ts}`;
  if (recentSentimentEvents.has(key)) {
    return false;
  }
  recentSentimentEvents.set(key, now);
  return true;
}

export function looksLikeSentimentQuery(text: string): boolean {
  const trimmed = stripSlackUserMentions(text);
  if (!trimmed) {
    return false;
  }
  if (
    /\b(don'?t|do\s+not|never|not|ignore)\b[\s\S]{0,24}\b(sentiment|meltwater|earned media|brand mentions?)\b/i.test(
      trimmed
    )
  ) {
    return false;
  }
  if (SENTIMENT_EXPLICIT_RE.test(trimmed) || SENTIMENT_HOW_WE_RE.test(trimmed)) {
    return true;
  }
  // Bare "press coverage" needs a brand/MU anchor.
  if (SENTIMENT_COVERAGE_RE.test(trimmed) && SENTIMENT_BRAND_RE.test(trimmed)) {
    return true;
  }
  if (SENTIMENT_BRAND_RE.test(trimmed) && MU_ASK_RE.test(trimmed)) {
    return true;
  }
  // "MU week planning" should not match — require a performance/coverage ask, not just week/month.
  return MU_ALIAS_RE.test(trimmed) && MU_ASK_RE.test(trimmed);
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

export function resolveSentimentSlackRange(text: string, now = new Date()): SlackTaskDateRange {
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

function formatNet(score: number): string {
  const pct = Math.round(score * 100);
  if (pct > 0) {
    return `+${pct}`;
  }
  return String(pct);
}

export function formatSentimentSlackMessage(
  dashboard: SentimentDashboard,
  rangeLabel: string,
  summary?: BrandContentSummary | null
): string {
  const appUrl = env.appUrl.replace(/\/$/, "");
  const link = appUrl ? `${appUrl}/sentiment` : "";
  const { totals } = dashboard;
  const pieces = summary ? formatBrandContentSummary(summary, rangeLabel) : null;

  if (totals.mentionCount === 0 && !pieces) {
    return [
      `*Brand sentiment — ${rangeLabel}*`,
      "",
      "No earned mentions stored for this window yet.",
      "Ask an admin to run a Meltwater sync, or try a wider range (`sentiment last month`)."
    ].join("\n");
  }

  const lines = [
    `*Brand sentiment — ${rangeLabel}*`,
    "",
    `Mentions: *${formatCompact(totals.mentionCount)}*`,
    `Reach: *${formatCompact(totals.reach)}*`,
    `Net sentiment: *${formatNet(totals.netSentiment)}*  _(positive − negative)_`,
    `Dominant: *${totals.dominant}*`,
    "",
    `Positive  ${formatCompact(totals.sentiment.positive)}  (${totals.sentimentShare.positive}%)`,
    `Neutral   ${formatCompact(totals.sentiment.neutral)}  (${totals.sentimentShare.neutral}%)`,
    `Negative  ${formatCompact(totals.sentiment.negative)}  (${totals.sentimentShare.negative}%)`
  ];

  if (totals.sentiment.unknown > 0) {
    lines.push(
      `Unknown   ${formatCompact(totals.sentiment.unknown)}  (${totals.sentimentShare.unknown}%)`
    );
  }

  if (link) {
    lines.push("", `<${link}|Open Sentiment in Bran>`);
  }

  if (pieces) {
    lines.push("", pieces);
  }

  lines.push("", "_Try `sentiment this week` or `Masters Union last month`._");
  return lines.join("\n");
}

export async function processSlackSentimentMessage(input: {
  channelId: string;
  userId: string;
  text?: string;
  ts: string;
  botId?: string;
  subtype?: string;
  threadTs?: string;
  channelType?: string;
  force?: boolean;
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

  if (!input.force && !looksLikeSentimentQuery(text)) {
    return { handled: false, reason: "not_sentiment" };
  }

  if (!markSentimentEvent(input.channelId, input.ts)) {
    return { handled: true, reason: "duplicate" };
  }

  const branUserId = await resolveBranUserIdForSlackUser(input.userId);
  if (!branUserId) {
    await postSlackMessage(
      input.channelId,
      "I can only share brand sentiment with people onboarded on Bran. Once your Slack email matches an active Bran account, ask me again.",
      isDm ? undefined : { threadTs: input.threadTs ?? input.ts }
    );
    return { handled: true, reason: "unmapped_user" };
  }

  const range = resolveSentimentSlackRange(text);
  const [dashboard, impact] = await Promise.all([
    getSentimentDashboard({
      from: range.from.toISOString(),
      to: range.to.toISOString()
    }),
    getBrandContentImpact({
      from: range.from.toISOString(),
      to: range.to.toISOString()
    }).catch((error) => {
      console.warn("[sentiment.slack] brand content lookup failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    })
  ]);
  const summary = impact ? await summarizeBrandContent(impact) : null;
  const message = formatSentimentSlackMessage(dashboard, range.label, summary);

  await postSlackMessage(
    input.channelId,
    message,
    isDm ? undefined : { threadTs: input.threadTs ?? input.ts }
  );

  console.log("[sentiment.slack] answered", {
    slackUserId: input.userId,
    branUserId,
    channelId: input.channelId,
    isDm,
    label: range.label,
    mentions: dashboard.totals.mentionCount
  });

  return { handled: true, reason: "answered" };
}
