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
import {
  POD_SOCIAL_KINDS,
  POD_SOCIAL_PLATFORMS,
  type PodSocialKind,
  type PodSocialPlatform
} from "./pods.constants";
import { findPodsByName, listPodSocialPosts, searchPodsByName } from "./pods.repository";

const POD_QUERY_RE =
  /\b(pod|pods|owned\s+ips?|inspirations?|ip posts?|inspiration posts?|social accounts?)\b/i;

const PLATFORM_RE: Array<{ re: RegExp; platform: PodSocialPlatform }> = [
  { re: /\b(instagram|ig)\b/i, platform: "INSTAGRAM" },
  { re: /\b(youtube|yt)\b/i, platform: "YOUTUBE" },
  { re: /\b(linkedin)\b/i, platform: "LINKEDIN" },
  { re: /\b(twitter|tweets?|\bx\b)\b/i, platform: "X" }
];

const KIND_OWNED_RE = /\b(owned\s+ips?|our\s+(accounts?|ips?)|ip posts?)\b/i;
const KIND_INSPIRATION_RE = /\b(inspirations?|inspo|inspiration posts?)\b/i;

const POD_DEDUP_TTL_MS = 60 * 1000;
const recentPodEvents = new Map<string, number>();

function markPodEvent(channelId: string, ts: string): boolean {
  const now = Date.now();
  for (const [key, seenAt] of recentPodEvents) {
    if (now - seenAt > POD_DEDUP_TTL_MS) {
      recentPodEvents.delete(key);
    }
  }
  const key = `${channelId}:${ts}`;
  if (recentPodEvents.has(key)) {
    return false;
  }
  recentPodEvents.set(key, now);
  return true;
}

export function looksLikePodQuery(text: string): boolean {
  const trimmed = stripSlackUserMentions(text);
  if (!trimmed) return false;
  return POD_QUERY_RE.test(trimmed);
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

export function resolvePodSlackRange(text: string, now = new Date()): SlackTaskDateRange {
  const cleaned = stripSlackUserMentions(text);
  return parseTaskListDateRangeHeuristic(cleaned, now) ?? defaultLastSevenDays();
}

function detectPlatform(text: string): PodSocialPlatform | undefined {
  for (const entry of PLATFORM_RE) {
    if (entry.re.test(text)) return entry.platform;
  }
  return undefined;
}

function detectKind(text: string): PodSocialKind | undefined {
  const owned = KIND_OWNED_RE.test(text);
  const inspiration = KIND_INSPIRATION_RE.test(text);
  if (owned && !inspiration) return "OWNED_IP";
  if (inspiration && !owned) return "INSPIRATION";
  if (inspiration) return "INSPIRATION";
  if (owned) return "OWNED_IP";
  return undefined;
}

function extractPodName(text: string): string | null {
  const cleaned = stripSlackUserMentions(text)
    .replace(/[“”]/g, '"')
    .trim();

  const quoted = cleaned.match(/["']([^"']{2,80})["']/);
  if (quoted?.[1]) return quoted[1].trim();

  const afterPod = cleaned.match(
    /\bpod(?:s)?\s+(?:named\s+)?([a-z0-9][a-z0-9 ._-]{1,60}?)(?:\s+(?:on|for|this|last|today|yesterday|ip|owned|inspiration|instagram|youtube|linkedin|twitter|x)\b|$)/i
  );
  if (afterPod?.[1]) {
    return afterPod[1].replace(/[?.!,]+$/g, "").trim();
  }
  return null;
}

function metricScore(metrics: unknown): number {
  if (!metrics || typeof metrics !== "object") return 0;
  const record = metrics as Record<string, unknown>;
  const likes = typeof record.likes === "number" ? record.likes : 0;
  const comments = typeof record.comments === "number" ? record.comments : 0;
  const views = typeof record.views === "number" ? record.views : 0;
  const shares = typeof record.shares === "number" ? record.shares : 0;
  return likes * 3 + comments * 4 + views * 0.01 + shares * 5;
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

function formatMetrics(metrics: unknown): string {
  if (!metrics || typeof metrics !== "object") return "no metrics";
  const record = metrics as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof record.likes === "number") parts.push(`${formatCompact(record.likes)} likes`);
  if (typeof record.comments === "number") parts.push(`${formatCompact(record.comments)} comments`);
  if (typeof record.views === "number") parts.push(`${formatCompact(record.views)} views`);
  if (typeof record.shares === "number") parts.push(`${formatCompact(record.shares)} shares`);
  return parts.length > 0 ? parts.join(", ") : "no metrics";
}

export function formatPodSlackMessage(input: {
  podName: string;
  rangeLabel: string;
  kind?: PodSocialKind;
  platform?: PodSocialPlatform;
  posts: Array<{
    title: string | null;
    caption: string | null;
    url: string | null;
    publishedAt: Date | null;
    metrics: unknown;
    account: { kind: string; platform: string; handle: string; lastSyncedAt: Date | null };
  }>;
}): string {
  const kindLabel =
    input.kind === "OWNED_IP"
      ? "owned IP"
      : input.kind === "INSPIRATION"
        ? "inspiration"
        : "owned IP + inspiration";
  const platformLabel = input.platform ? ` on ${input.platform}` : "";
  const lines = [
    `*Pod ${input.podName} — ${kindLabel}${platformLabel} (${input.rangeLabel})*`,
    ""
  ];

  if (input.posts.length === 0) {
    lines.push("No stored posts for this window yet.");
    lines.push(
      "Ask an admin to sync pod accounts (`POST /pods/accounts/:id/sync` or cron `/api/cron/pods-social`), or try a wider range."
    );
    return lines.join("\n");
  }

  const stale = input.posts.every((post) => {
    if (!post.account.lastSyncedAt) return true;
    return Date.now() - post.account.lastSyncedAt.getTime() > 7 * 24 * 60 * 60 * 1000;
  });
  if (stale) {
    lines.push("_Heads up: account sync looks stale (>7 days). Results may be outdated._");
    lines.push("");
  }

  input.posts.slice(0, 5).forEach((post, index) => {
    const title =
      post.title?.trim() ||
      post.caption?.trim()?.slice(0, 100) ||
      `${post.account.platform} @${post.account.handle}`;
    const link = post.url ? ` <${post.url}|open>` : "";
    lines.push(
      `${index + 1}. *${title}* — ${post.account.kind}/${post.account.platform} @${post.account.handle}${link}`
    );
    lines.push(`   ${formatMetrics(post.metrics)}`);
  });

  const appUrl = env.appUrl.replace(/\/$/, "");
  if (appUrl) {
    lines.push("", `<${appUrl}|Open Bran>`);
  }

  return lines.join("\n");
}

export async function processSlackPodMessage(input: {
  channelId: string;
  userId: string;
  text?: string;
  ts: string;
  botId?: string;
  subtype?: string;
  threadTs?: string;
  channelType?: string;
  eventType?: string;
  force?: boolean;
}): Promise<{ handled: boolean; reason?: string }> {
  if (input.botId || input.subtype === "bot_message") {
    return { handled: false };
  }
  if (!input.text || (!input.force && !looksLikePodQuery(input.text))) {
    return { handled: false };
  }

  const isDm = isSlackDmChannel(input.channelId, input.channelType);
  if (!isDm) {
    const botUserId = await getSlackBotUserId();
    if (!botUserId || !textMentionsSlackUser(input.text, botUserId)) {
      return { handled: false, reason: "channel_requires_mention" };
    }
  }

  if (!markPodEvent(input.channelId, input.ts)) {
    return { handled: true, reason: "deduped" };
  }

  const branUserId = await resolveBranUserIdForSlackUser(input.userId);
  if (!branUserId) {
    await postSlackMessage(
      input.channelId,
      "I can only answer pod IP/inspiration questions for onboarded Bran users. Ask an admin to add your Slack email in Bran."
    );
    return { handled: true, reason: "not_onboarded" };
  }

  const cleaned = stripSlackUserMentions(input.text);
  const podName = extractPodName(cleaned);
  if (!podName) {
    await postSlackMessage(
      input.channelId,
      'Tell me which pod — e.g. `pod "Growth" top IP posts this week` or `what is inspiring pod Fiction on Instagram`.'
    );
    return { handled: true, reason: "missing_pod_name" };
  }

  let pods = await findPodsByName(podName);
  if (pods.length === 0) {
    pods = await searchPodsByName(podName);
  }

  if (pods.length === 0) {
    await postSlackMessage(
      input.channelId,
      `I couldn't find an active pod named *${podName}*. Check the name in Bran (/pods) and try again.`
    );
    return { handled: true, reason: "pod_not_found" };
  }

  if (pods.length > 1) {
    const names = pods.map((pod) => `• ${pod.name} (${pod.vertical.name})`).join("\n");
    await postSlackMessage(
      input.channelId,
      `Multiple pods matched *${podName}*. Be more specific:\n${names}`
    );
    return { handled: true, reason: "ambiguous_pod" };
  }

  const pod = pods[0]!;
  const range = resolvePodSlackRange(cleaned);
  const kind = detectKind(cleaned);
  const platform = detectPlatform(cleaned);

  if (kind && !POD_SOCIAL_KINDS.includes(kind)) {
    // unreachable but keeps exhaustiveness clear
  }
  if (platform && !POD_SOCIAL_PLATFORMS.includes(platform)) {
    // unreachable
  }

  const posts = await listPodSocialPosts({
    podId: pod.id,
    kind,
    platform,
    from: range.from,
    to: range.to,
    limit: 25
  });

  const ranked = [...posts].sort(
    (a, b) => metricScore(b.metrics) - metricScore(a.metrics)
  );

  const message = formatPodSlackMessage({
    podName: pod.name,
    rangeLabel: range.label,
    kind,
    platform,
    posts: ranked
  });

  await postSlackMessage(input.channelId, message);
  return { handled: true };
}
