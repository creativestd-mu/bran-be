import { env } from "../../config/env";
import { ATTENDANCE_ADMIN_ROLES } from "../attendance/attendance.constants";
import { postSlackMessage } from "../attendance/attendance.slack";
import { HttpError } from "../../utils/httpError";
import { isSlackMessageAddressedToBran } from "../slack-safety/slack-safety.slack";
import { isSlackDmChannel } from "../work/work.slack-voice";
import { resolveBranUserIdForSlackUser } from "../work/work.slack";
import { runSlackIntent } from "../slack-intents/slack-intents.dispatch";
import { matchSlackIntent } from "../slack-intents/slack-intents.matcher";
import {
  buildDidYouMeanBlocks,
  formatDidYouMeanFallbackText
} from "../slack-intents/slack-intents.reply";
import {
  createSlackIntentSuggestion,
  setSlackIntentSuggestionReplyTs
} from "../slack-intents/slack-intents.repository";
import {
  listUnsupportedSlackQueries,
  updateUnsupportedSlackQueryStatus,
  upsertUnsupportedSlackQuery
} from "./slack-unsupported.repository";

const UNSUPPORTED_DEDUP_TTL_MS = 60 * 1000;
const recentUnsupportedEvents = new Map<string, number>();

const CAPABILITIES_HINT =
  "I can help with: listing/creating tasks (DM or @Bran), assigning a task to everyone in a channel, booking a call (Calendar connected), today’s calendar, attendance, sentiment, competitors, pods, and private ideas (DM).";

function markUnsupportedEvent(channelId: string, ts: string): boolean {
  const now = Date.now();
  for (const [key, seenAt] of recentUnsupportedEvents) {
    if (now - seenAt > UNSUPPORTED_DEDUP_TTL_MS) {
      recentUnsupportedEvents.delete(key);
    }
  }
  const key = `${channelId}:${ts}`;
  if (recentUnsupportedEvents.has(key)) return false;
  recentUnsupportedEvents.set(key, now);
  return true;
}

export function formatUnsupportedSlackReply(reason?: string): string {
  if (reason === "mass_assign_dm") {
    return [
      "I can assign a task to everyone in a *channel*, but not from a DM.",
      "Mention me in the channel with something like: `add task for everyone here: read this article <url>`.",
      "",
      CAPABILITIES_HINT
    ].join("\n");
  }
  if (reason === "mass_assign_over_cap") {
    return [
      "That channel has too many mapped Bran users for a bulk assign right now.",
      "Ask me to create the task for a smaller set (tag people), or create it in Bran and assign there.",
      "",
      CAPABILITIES_HINT
    ].join("\n");
  }
  return [
    "I don’t support that request yet.",
    "",
    CAPABILITIES_HINT,
    "",
    "_I’ve logged this so the team can review whether to add support._"
  ].join("\n");
}

/**
 * When a DM or @Bran message wasn't handled by any feature, reply clearly
 * and persist the ask for product review. Prefer embedding+DeepSeek intent
 * suggestions (auto-run or Did-you-mean buttons) when enabled.
 */
export async function processSlackUnsupportedDirectedQuery(input: {
  channelId: string;
  userId: string;
  text?: string;
  ts: string;
  botId?: string;
  subtype?: string;
  threadTs?: string;
  channelType?: string;
  eventType?: string;
  reason?: string;
}): Promise<{ handled: boolean; reason?: string }> {
  if (input.botId) return { handled: false, reason: "ignored_bot" };
  if (input.subtype && input.subtype !== "thread_broadcast") {
    return { handled: false, reason: "ignored_subtype" };
  }

  const text = input.text?.trim() ?? "";
  if (!text) return { handled: false, reason: "empty_text" };

  const addressed = await isSlackMessageAddressedToBran(input);
  if (!addressed) {
    return { handled: false, reason: "not_addressed" };
  }

  if (!markUnsupportedEvent(input.channelId, input.ts)) {
    return { handled: true, reason: "deduped" };
  }

  const isDm = isSlackDmChannel(input.channelId, input.channelType);
  const branUserId = await resolveBranUserIdForSlackUser(input.userId);
  const reason = input.reason ?? "no_handler";

  try {
    await upsertUnsupportedSlackQuery({
      slackUserId: input.userId,
      branUserId,
      channelId: input.channelId,
      channelType: input.channelType ?? null,
      threadTs: input.threadTs ?? null,
      messageTs: input.ts,
      text,
      eventType: input.eventType ?? null,
      isDm,
      reason
    });
  } catch (error) {
    console.error("[slack-unsupported] failed to persist:", error);
  }

  // Special mass-assign reasons keep the static guidance reply.
  if (reason === "mass_assign_dm" || reason === "mass_assign_over_cap") {
    try {
      await postSlackMessage(input.channelId, formatUnsupportedSlackReply(reason), {
        threadTs: input.threadTs ?? input.ts
      });
    } catch (error) {
      console.error("[slack-unsupported] failed to reply:", error);
    }
    return { handled: true, reason: `unsupported_${reason}` };
  }

  if (env.slackIntentSuggestEnabled) {
    try {
      const decision = await matchSlackIntent({ text, isDm });

      if (decision.mode === "auto") {
        const result = await runSlackIntent(decision.intent, {
          channelId: input.channelId,
          userId: input.userId,
          text,
          ts: input.ts,
          botId: input.botId,
          subtype: input.subtype,
          threadTs: input.threadTs,
          channelType: input.channelType,
          eventType: input.eventType
        });
        if (result.handled) {
          // Do not learn auto-runs into the confirmed fast-path store.
          // Human button confirms still learn via processSlackDidYouMeanAction.
          return { handled: true, reason: `intent_auto_${decision.intent}` };
        }
        // Fall through to suggest/generic if force-run somehow failed.
      }

      if (decision.mode === "auto" || decision.mode === "suggest") {
        const top3 = decision.top3.slice(0, 3);
        if (top3.length > 0) {
          const suggestion = await createSlackIntentSuggestion({
            slackUserId: input.userId,
            branUserId,
            channelId: input.channelId,
            channelType: input.channelType ?? null,
            threadTs: input.threadTs ?? null,
            messageTs: input.ts,
            originalText: text,
            eventType: input.eventType ?? null,
            isDm,
            candidates: top3.map((c) => ({
              intent: c.intent,
              label: c.label,
              score: c.score
            }))
          });

          const posted = await postSlackMessage(
            input.channelId,
            formatDidYouMeanFallbackText(top3),
            {
              threadTs: input.threadTs ?? input.ts,
              blocks: buildDidYouMeanBlocks({
                suggestionId: suggestion.id,
                candidates: top3
              })
            }
          );
          await setSlackIntentSuggestionReplyTs(suggestion.id, posted.ts);
          return { handled: true, reason: "intent_suggested" };
        }
      }
    } catch (error) {
      console.error("[slack-unsupported] intent suggest failed:", error);
    }
  }

  try {
    await postSlackMessage(input.channelId, formatUnsupportedSlackReply(reason), {
      threadTs: input.threadTs ?? input.ts
    });
  } catch (error) {
    console.error("[slack-unsupported] failed to reply:", error);
  }

  return { handled: true, reason: `unsupported_${reason}` };
}

export function assertCanReviewUnsupportedSlackQueries(roleName: string) {
  if (!ATTENDANCE_ADMIN_ROLES.has(roleName)) {
    throw new HttpError(403, "Only admin or chief of staff can review unsupported Slack queries");
  }
}

export async function listUnsupportedSlackQueriesService(input: {
  roleName: string;
  status?: string;
  limit?: number;
}) {
  assertCanReviewUnsupportedSlackQueries(input.roleName);
  return listUnsupportedSlackQueries({
    status: input.status,
    limit: input.limit
  });
}

export async function updateUnsupportedSlackQueryStatusService(input: {
  roleName: string;
  id: string;
  status: "NEW" | "REVIEWED" | "DISMISSED";
}) {
  assertCanReviewUnsupportedSlackQueries(input.roleName);
  return updateUnsupportedSlackQueryStatus(input.id, input.status);
}
