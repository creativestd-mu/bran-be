import { ATTENDANCE_ADMIN_ROLES } from "../attendance/attendance.constants";
import { postSlackMessage } from "../attendance/attendance.slack";
import { HttpError } from "../../utils/httpError";
import { isSlackMessageAddressedToBran } from "../slack-safety/slack-safety.slack";
import { isSlackDmChannel } from "../work/work.slack-voice";
import { resolveBranUserIdForSlackUser } from "../work/work.slack";
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
 * and persist the ask for product review.
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

  // Leave pure create phrasing to the directed-create handler when it can run.
  // This path is for leftovers after create already declined or wasn't applicable.
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
