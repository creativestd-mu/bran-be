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
import { getSentimentDashboard } from "./sentiment.service";
import type { SentimentDashboard } from "./sentiment.types";

const SENTIMENT_RE =
  /\b(sentiment|earned media|meltwater|brand mentions?|press mentions?|media mentions?|mention volume|news coverage|media coverage|brand coverage|press coverage|brand health|how (are|is) (we|the brand) (doing|perceived))\b/i;

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
  return SENTIMENT_RE.test(trimmed);
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
  rangeLabel: string
): string {
  const appUrl = env.appUrl.replace(/\/$/, "");
  const link = appUrl ? `${appUrl}/sentiment` : "";
  const { totals } = dashboard;

  if (totals.mentionCount === 0) {
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

  lines.push("", "_Try `sentiment this week` or `brand mentions last month`._");
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

  if (!looksLikeSentimentQuery(text)) {
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
  const dashboard = await getSentimentDashboard({
    from: range.from.toISOString(),
    to: range.to.toISOString()
  });
  const message = formatSentimentSlackMessage(dashboard, range.label);

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
