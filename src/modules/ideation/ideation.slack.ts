import { postSlackMessage } from "../attendance/attendance.slack";
import { stripSlackUserMentions } from "../work/work.slack-tasks";
import { isSlackDmChannel } from "../work/work.slack-voice";
import { resolveBranUserIdForSlackUser } from "../work/work.slack";
import { createPrivateIdea, listMyIdeas } from "./ideation.service";

const LIST_IDEAS_RE =
  /\b((show|list|get|fetch)\s+(me\s+)?(my\s+)?ideas?|my ideas?|what ideas do i have|ideas i (have|saved|logged))\b/i;

const ADD_IDEA_RE =
  /\b((add|save|log|capture|note|record|new)\s+(an?\s+)?idea|idea:)\b/i;

const SPOKEN_IDEA_RE =
  /\b(i have an idea|here'?s an idea|idea is|new idea)\b/i;

const IDEA_DEDUP_TTL_MS = 60 * 1000;
const recentIdeaEvents = new Map<string, number>();

function markIdeaEvent(channelId: string, ts: string): boolean {
  const now = Date.now();
  for (const [key, seenAt] of recentIdeaEvents) {
    if (now - seenAt > IDEA_DEDUP_TTL_MS) {
      recentIdeaEvents.delete(key);
    }
  }
  const key = `${channelId}:${ts}`;
  if (recentIdeaEvents.has(key)) {
    return false;
  }
  recentIdeaEvents.set(key, now);
  return true;
}

export function looksLikeListIdeasQuery(text: string): boolean {
  const trimmed = stripSlackUserMentions(text);
  return Boolean(trimmed) && LIST_IDEAS_RE.test(trimmed);
}

export function looksLikeAddIdeaQuery(text: string): boolean {
  const trimmed = stripSlackUserMentions(text);
  if (!trimmed) {
    return false;
  }
  if (ADD_IDEA_RE.test(trimmed) || SPOKEN_IDEA_RE.test(trimmed)) {
    return true;
  }
  return /^\s*idea\b/i.test(trimmed);
}

function stripIdeaTrigger(text: string): string {
  return stripSlackUserMentions(text)
    .replace(ADD_IDEA_RE, " ")
    .replace(SPOKEN_IDEA_RE, " ")
    .replace(/^\s*idea\b[:\s-]*/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function ideaFieldsFromText(text: string): { title: string; description: string } | null {
  const body = stripIdeaTrigger(text);
  if (body.length < 3) {
    return null;
  }
  const firstSentence = body.split(/(?<=[.!?])\s+/)[0] ?? body;
  const title = firstSentence.slice(0, 120).trim();
  return {
    title: title || body.slice(0, 120),
    description: body
  };
}

export function formatMyIdeasSlackMessage(
  ideas: Array<{ title: string; description: string; createdAt: Date | string }>
): string {
  if (ideas.length === 0) {
    return [
      "*Your ideas*",
      "",
      "You don’t have any saved ideas yet. DM me `idea: …` or send a voice note that starts with “idea”."
    ].join("\n");
  }

  const lines = ["*Your ideas* _(only you can see these)_", ""];
  ideas.forEach((idea, index) => {
    const when = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short"
    }).format(new Date(idea.createdAt));
    const snippet = idea.description.replace(/\s+/g, " ").trim().slice(0, 160);
    lines.push(`${index + 1}. *${idea.title}* · ${when}`);
    if (snippet && snippet !== idea.title) {
      lines.push(`   ${snippet}`);
    }
  });
  return lines.join("\n");
}

export async function createIdeaFromSlackText(
  branUserId: string,
  text: string
): Promise<{ title: string } | null> {
  const fields = ideaFieldsFromText(text);
  if (!fields) {
    return null;
  }
  const created = await createPrivateIdea({
    userId: branUserId,
    title: fields.title,
    description: fields.description
  });
  return { title: created.title };
}

export async function processSlackIdeaMessage(input: {
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

  const wantsList = looksLikeListIdeasQuery(text);
  const wantsAdd = looksLikeAddIdeaQuery(text);
  if (!wantsList && !wantsAdd) {
    return { handled: false, reason: "not_idea" };
  }

  if (!markIdeaEvent(input.channelId, input.ts)) {
    return { handled: true, reason: "duplicate" };
  }

  const isDm = isSlackDmChannel(input.channelId, input.channelType);
  if (!isDm) {
    await postSlackMessage(
      input.channelId,
      "Ideas are private. DM Bran Tracker to add or list *your* ideas — I won’t show them in a channel.",
      { threadTs: input.threadTs ?? input.ts }
    );
    return { handled: true, reason: "channel_privacy" };
  }

  const branUserId = await resolveBranUserIdForSlackUser(input.userId);
  if (!branUserId) {
    await postSlackMessage(
      input.channelId,
      "I can only keep ideas for people onboarded on Bran. Once your Slack email matches an active Bran account, DM me again."
    );
    return { handled: true, reason: "unmapped_user" };
  }

  if (wantsList) {
    const ideas = await listMyIdeas({ userId: branUserId, take: 15 });
    await postSlackMessage(input.channelId, formatMyIdeasSlackMessage(ideas));
    return { handled: true, reason: "listed" };
  }

  const created = await createIdeaFromSlackText(branUserId, text);
  if (!created) {
    await postSlackMessage(
      input.channelId,
      "Tell me the idea after the word — e.g. `idea: campus founder night on LinkedIn`."
    );
    return { handled: true, reason: "missing_body" };
  }

  await postSlackMessage(
    input.channelId,
    `Saved to *your* ideas: *${created.title}*\nAsk \`my ideas\` anytime to see only yours.`
  );
  return { handled: true, reason: "created" };
}
