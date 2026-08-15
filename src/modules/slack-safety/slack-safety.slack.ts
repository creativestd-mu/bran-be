import { getSlackBotUserId, postSlackMessage } from "../attendance/attendance.slack";
import { isSlackDmChannel } from "../work/work.slack-voice";
import { textMentionsSlackUser } from "../work/work.slack-tasks";
import {
  evaluateSlackPromptSafety,
  evaluateSlackPromptSafetyHeuristic,
  logSlackSafetyBlock,
  looksLikeBranPrompt,
  slackSafetyRefusalText,
  type SlackSafetyVerdict
} from "./slack-safety";

const SAFETY_DEDUP_TTL_MS = 60 * 1000;
const recentSafetyEvents = new Map<string, number>();

function markSafetyEvent(channelId: string, ts: string): boolean {
  const now = Date.now();
  for (const [key, seenAt] of recentSafetyEvents) {
    if (now - seenAt > SAFETY_DEDUP_TTL_MS) {
      recentSafetyEvents.delete(key);
    }
  }
  const key = `${channelId}:${ts}`;
  if (recentSafetyEvents.has(key)) {
    return false;
  }
  recentSafetyEvents.set(key, now);
  return true;
}

export async function isSlackMessageAddressedToBran(input: {
  channelId: string;
  text?: string;
  channelType?: string;
  eventType?: string;
}): Promise<boolean> {
  if (isSlackDmChannel(input.channelId, input.channelType)) {
    return true;
  }
  if (input.eventType === "app_mention") {
    return true;
  }
  const botUserId = await getSlackBotUserId();
  return Boolean(botUserId && input.text && textMentionsSlackUser(input.text, botUserId));
}

async function refuseSlackPrompt(
  input: {
    channelId: string;
    ts: string;
    threadTs?: string;
    userId?: string;
  },
  verdict: SlackSafetyVerdict
): Promise<void> {
  logSlackSafetyBlock({
    category: verdict.category,
    layer: verdict.layer,
    slackUserId: input.userId,
    channelId: input.channelId
  });
  await postSlackMessage(input.channelId, slackSafetyRefusalText(verdict.category), {
    threadTs: input.threadTs ?? input.ts
  });
}

/**
 * Blocks inappropriate prompts directed at Bran. Channel chatter that is not
 * a Bran prompt is left alone so we do not police the whole workspace.
 */
export async function processSlackSafetyGuard(input: {
  channelId: string;
  userId: string;
  text?: string;
  ts: string;
  botId?: string;
  subtype?: string;
  threadTs?: string;
  channelType?: string;
  eventType?: string;
}): Promise<{ handled: boolean; reason?: string }> {
  if (input.botId) {
    return { handled: false, reason: "ignored_bot" };
  }
  if (input.subtype && input.subtype !== "thread_broadcast" && input.subtype !== "file_share") {
    return { handled: false, reason: "ignored_subtype" };
  }

  const text = input.text?.trim() ?? "";
  if (!text) {
    return { handled: false, reason: "empty_text" };
  }

  const addressed = await isSlackMessageAddressedToBran(input);
  const branPrompt = looksLikeBranPrompt(text);
  if (!addressed && !branPrompt) {
    return { handled: false, reason: "not_bran_prompt" };
  }

  const verdict = await evaluateSlackPromptSafety(text, { useLlm: addressed || branPrompt });
  if (verdict.allowed) {
    return { handled: false, reason: "allowed" };
  }

  if (!markSafetyEvent(input.channelId, input.ts)) {
    return { handled: true, reason: "duplicate" };
  }

  try {
    await refuseSlackPrompt(input, verdict);
  } catch (error) {
    console.error("[slack-safety] failed to post refusal:", error);
  }
  return { handled: true, reason: `blocked_${verdict.category}` };
}

/** Silent heuristic skip for channel work ingest (no public shaming). */
export function shouldSkipUnsafeWorkIngest(text: string): SlackSafetyVerdict {
  return evaluateSlackPromptSafetyHeuristic(text);
}

export async function guardSlackDirectedText(input: {
  channelId: string;
  userId: string;
  text: string;
  ts: string;
  threadTs?: string;
  useLlm?: boolean;
}): Promise<{ blocked: boolean; reason?: string }> {
  const verdict = await evaluateSlackPromptSafety(input.text, { useLlm: input.useLlm !== false });
  if (verdict.allowed) {
    return { blocked: false };
  }
  try {
    await refuseSlackPrompt(input, verdict);
  } catch (error) {
    console.error("[slack-safety] failed to post refusal:", error);
  }
  return { blocked: true, reason: `blocked_${verdict.category}` };
}
