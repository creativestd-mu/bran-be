import {
  postSlackMessage,
  respondToSlackResponseUrl,
  updateSlackMessage
} from "../attendance/attendance.slack";
import { resolveBranUserIdForSlackUser } from "../work/work.slack";
import { runSlackIntent } from "./slack-intents.dispatch";
import { learnSlackIntent } from "./slack-intents.learn";
import {
  formatRunningIntentText,
  parseDidYouMeanActionId,
  SLACK_DID_YOU_MEAN_ACTION_PREFIX
} from "./slack-intents.reply";
import {
  getSlackIntentSuggestion,
  markSlackIntentSuggestion
} from "./slack-intents.repository";
import { slackIntentLabel } from "./slack-intents.catalog";

const CAPABILITIES_HINT =
  "I can help with: listing/creating tasks (DM or @Bran), assigning a task to everyone in a channel, booking a call (Calendar connected), today’s calendar, attendance, sentiment, competitors, pods, and private ideas (DM).";

export function isDidYouMeanActionId(actionId: string): boolean {
  return (
    actionId === "bran_didyoumean_none" || actionId.startsWith(SLACK_DID_YOU_MEAN_ACTION_PREFIX)
  );
}

/**
 * Handle Block Kit "Did you mean?" button clicks.
 */
export async function processSlackDidYouMeanAction(input: {
  slackUserId: string;
  actionId: string;
  suggestionId: string;
  channelId?: string;
  responseUrl?: string;
}): Promise<void> {
  const parsed = parseDidYouMeanActionId(input.actionId);
  if (!parsed) return;

  const suggestion = await getSlackIntentSuggestion(input.suggestionId);
  if (!suggestion) {
    if (input.responseUrl) {
      await respondToSlackResponseUrl(input.responseUrl, {
        replace_original: false,
        text: "That suggestion expired. Please send your request again."
      });
    }
    return;
  }

  if (suggestion.slackUserId.toUpperCase() !== input.slackUserId.toUpperCase()) {
    if (input.responseUrl) {
      await respondToSlackResponseUrl(input.responseUrl, {
        replace_original: false,
        response_type: "ephemeral",
        text: "Only the person who sent the original request can pick an action."
      });
    }
    return;
  }

  if (suggestion.status !== "SUGGESTED") {
    if (input.responseUrl) {
      await respondToSlackResponseUrl(input.responseUrl, {
        replace_original: false,
        response_type: "ephemeral",
        text: "That suggestion was already handled."
      });
    }
    return;
  }

  const channelId = input.channelId ?? suggestion.channelId;
  const threadTs = suggestion.threadTs ?? suggestion.messageTs;

  if (parsed.kind === "none") {
    await markSlackIntentSuggestion(suggestion.id, { status: "DISMISSED" });
    const text = [
      "Got it — I won’t run any of those.",
      "Reply with which action you meant (e.g. *Add a Task*), or rephrase.",
      "",
      CAPABILITIES_HINT
    ].join("\n");

    if (suggestion.replyTs) {
      try {
        await updateSlackMessage(channelId, suggestion.replyTs, text, []);
      } catch {
        await postSlackMessage(channelId, text, { threadTs });
      }
    } else if (input.responseUrl) {
      await respondToSlackResponseUrl(input.responseUrl, {
        replace_original: true,
        text
      });
    } else {
      await postSlackMessage(channelId, text, { threadTs });
    }
    return;
  }

  const intent = parsed.intent;
  await markSlackIntentSuggestion(suggestion.id, {
    status: "EXECUTED",
    chosenIntent: intent
  });

  const runningText = formatRunningIntentText(intent);
  if (suggestion.replyTs) {
    try {
      await updateSlackMessage(channelId, suggestion.replyTs, runningText, []);
    } catch {
      // fall through — still execute
    }
  } else if (input.responseUrl) {
    try {
      await respondToSlackResponseUrl(input.responseUrl, {
        replace_original: true,
        text: runningText
      });
    } catch {
      // ignore
    }
  }

  const branUserId =
    suggestion.branUserId ?? (await resolveBranUserIdForSlackUser(input.slackUserId));

  const result = await runSlackIntent(intent, {
    channelId,
    userId: input.slackUserId,
    text: suggestion.originalText,
    ts: suggestion.messageTs,
    threadTs: suggestion.threadTs ?? undefined,
    channelType: suggestion.channelType ?? undefined,
    eventType: suggestion.eventType ?? undefined
  });

  void learnSlackIntent({
    query: suggestion.originalText,
    intent,
    ownerBranUserId: branUserId,
    source: "confirmed"
  }).catch((error) => {
    console.warn("[slack-intents] learn from button failed:", error);
  });

  if (!result.handled) {
    const failText = `I tried to run *${slackIntentLabel(intent)}* but couldn’t complete it. Try rephrasing, or ask again with clearer wording.`;
    await postSlackMessage(channelId, failText, { threadTs });
  }
}
