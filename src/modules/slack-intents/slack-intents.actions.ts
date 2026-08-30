import {
  openSlackModal,
  postSlackMessage,
  respondToSlackResponseUrl,
  updateSlackMessage
} from "../attendance/attendance.slack";
import { resolveBranUserIdForSlackUser } from "../work/work.slack";
import { updateUnsupportedSlackQueryClarification } from "../slack-unsupported/slack-unsupported.repository";
import { runSlackIntent } from "./slack-intents.dispatch";
import { learnSlackIntent } from "./slack-intents.learn";
import { matchSlackIntent } from "./slack-intents.matcher";
import {
  resolveDeterministicSlackIntents
} from "./slack-intents.resolve";
import {
  buildIntentClarifyModal,
  formatFeatureRequestAckText,
  formatRunningAllIntentsText,
  formatRunningIntentText,
  INTENT_CLARIFY_ACTION_ID,
  INTENT_CLARIFY_BLOCK_ID,
  INTENT_CLARIFY_CALLBACK_ID,
  parseDidYouMeanActionId,
  SLACK_DID_YOU_MEAN_ACTION_PREFIX
} from "./slack-intents.reply";
import {
  getSlackIntentSuggestion,
  markSlackIntentSuggestion
} from "./slack-intents.repository";
import { isSlackIntentId, slackIntentLabel, type SlackIntentId } from "./slack-intents.catalog";

export { INTENT_CLARIFY_CALLBACK_ID, INTENT_CLARIFY_BLOCK_ID, INTENT_CLARIFY_ACTION_ID };

export function isDidYouMeanActionId(actionId: string): boolean {
  return (
    actionId === "bran_didyoumean_none" ||
    actionId === "bran_didyoumean_all" ||
    actionId.startsWith(SLACK_DID_YOU_MEAN_ACTION_PREFIX)
  );
}

/**
 * Handle Block Kit "Did you mean?" / compound confirm button clicks.
 */
export async function processSlackDidYouMeanAction(input: {
  slackUserId: string;
  actionId: string;
  suggestionId: string;
  channelId?: string;
  responseUrl?: string;
  triggerId?: string;
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
    // Keep suggestion SUGGESTED until modal submit / cancel — open clarify modal.
    if (!input.triggerId) {
      if (input.responseUrl) {
        await respondToSlackResponseUrl(input.responseUrl, {
          replace_original: false,
          response_type: "ephemeral",
          text: "Couldn’t open the form — please tap *No, I meant something else* again."
        });
      }
      return;
    }

    try {
      await openSlackModal(
        input.triggerId,
        buildIntentClarifyModal({
          suggestionId: suggestion.id,
          originalText: suggestion.originalText
        })
      );
    } catch (error) {
      console.error("[slack-intents] open clarify modal failed:", error);
      if (input.responseUrl) {
        await respondToSlackResponseUrl(input.responseUrl, {
          replace_original: false,
          response_type: "ephemeral",
          text: "Couldn’t open the form. Please try again."
        });
      }
    }
    return;
  }

  const branUserId =
    suggestion.branUserId ?? (await resolveBranUserIdForSlackUser(input.slackUserId));

  const dispatchInput = {
    channelId,
    userId: input.slackUserId,
    text: suggestion.originalText,
    ts: suggestion.messageTs,
    threadTs: suggestion.threadTs ?? undefined,
    channelType: suggestion.channelType ?? undefined,
    eventType: suggestion.eventType ?? undefined
  };

  if (parsed.kind === "all") {
    let candidates: Array<{ intent: string }> = [];
    try {
      candidates = JSON.parse(suggestion.candidatesJson) as Array<{ intent: string }>;
    } catch {
      candidates = [];
    }
    const intents = candidates
      .map((c) => c.intent)
      .filter((id): id is SlackIntentId => isSlackIntentId(id));

    if (intents.length === 0) {
      await markSlackIntentSuggestion(suggestion.id, { status: "DISMISSED" });
      await postSlackMessage(channelId, "I couldn’t find actions to run. Please try again.", {
        threadTs
      });
      return;
    }

    await markSlackIntentSuggestion(suggestion.id, {
      status: "EXECUTED",
      chosenIntent: intents.join(",")
    });

    const runningText = formatRunningAllIntentsText(intents);
    if (suggestion.replyTs) {
      try {
        await updateSlackMessage(channelId, suggestion.replyTs, runningText, []);
      } catch {
        // still execute
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

    for (const intent of intents) {
      const result = await runSlackIntent(intent, dispatchInput);
      if (result.handled) {
        void learnSlackIntent({
          query: suggestion.originalText,
          intent,
          ownerBranUserId: branUserId,
          source: "confirmed"
        }).catch((error) => {
          console.warn("[slack-intents] learn from run-all failed:", error);
        });
      } else {
        await postSlackMessage(
          channelId,
          `I tried to run *${slackIntentLabel(intent)}* but couldn’t complete it.`,
          { threadTs }
        );
      }
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

  const result = await runSlackIntent(intent, dispatchInput);

  if (result.handled) {
    void learnSlackIntent({
      query: suggestion.originalText,
      intent,
      ownerBranUserId: branUserId,
      source: "confirmed"
    }).catch((error) => {
      console.warn("[slack-intents] learn from button failed:", error);
    });

    try {
      await updateUnsupportedSlackQueryClarification({
        channelId: suggestion.channelId,
        messageTs: suggestion.messageTs,
        clarificationText: suggestion.originalText,
        resolvedIntent: intent,
        reason: "user_confirmed_intent",
        status: "REVIEWED"
      });
    } catch {
      // Original unsupported row may be missing in edge cases.
    }
  } else {
    const failText = `I tried to run *${slackIntentLabel(intent)}* but couldn’t complete it. Try rephrasing, or ask again with clearer wording.`;
    await postSlackMessage(channelId, failText, { threadTs });
  }
}

/**
 * Modal submit for "No, I meant something else".
 * Executes only a single confident supported intent; otherwise stores a feature request.
 */
export async function processSlackIntentClarifySubmit(input: {
  slackUserId: string;
  suggestionId: string;
  clarificationText: string;
}): Promise<{ ok: true } | { ok: false; fieldError: string }> {
  const clarification = input.clarificationText.trim();
  if (clarification.length < 3) {
    return { ok: false, fieldError: "Please describe what Bran should do (a bit more detail)." };
  }

  const suggestion = await getSlackIntentSuggestion(input.suggestionId);
  if (!suggestion) {
    return { ok: false, fieldError: "That suggestion expired. Send your request again." };
  }

  if (suggestion.slackUserId.toUpperCase() !== input.slackUserId.toUpperCase()) {
    return { ok: false, fieldError: "Only the person who sent the original request can clarify." };
  }

  if (suggestion.status !== "SUGGESTED") {
    return { ok: false, fieldError: "That suggestion was already handled." };
  }

  const channelId = suggestion.channelId;
  const threadTs = suggestion.threadTs ?? suggestion.messageTs;
  const branUserId =
    suggestion.branUserId ?? (await resolveBranUserIdForSlackUser(input.slackUserId));
  const isDm = suggestion.isDm;

  // Prefer the clarification alone; fall back to combined text for context.
  const matchText = clarification;
  const combinedText = `${suggestion.originalText}\n\n${clarification}`;

  let intentToRun: SlackIntentId | null = null;

  const deterministic = resolveDeterministicSlackIntents(matchText);
  if (deterministic.mode === "single" && isSlackIntentId(deterministic.intent)) {
    intentToRun = deterministic.intent;
  } else {
    try {
      const decision = await matchSlackIntent({ text: matchText, isDm });
      if (decision.mode === "auto" && isSlackIntentId(decision.intent)) {
        intentToRun = decision.intent;
      } else {
        // One more try with original + clarification if clarification alone was vague.
        const combined = await matchSlackIntent({ text: combinedText, isDm });
        if (combined.mode === "auto" && isSlackIntentId(combined.intent)) {
          intentToRun = combined.intent;
        }
      }
    } catch (error) {
      console.warn("[slack-intents] clarify match failed:", error);
    }
  }

  if (intentToRun) {
    await markSlackIntentSuggestion(suggestion.id, {
      status: "EXECUTED",
      chosenIntent: intentToRun
    });

    const runningText = formatRunningIntentText(intentToRun);
    if (suggestion.replyTs) {
      try {
        await updateSlackMessage(channelId, suggestion.replyTs, runningText, []);
      } catch {
        // still execute
      }
    }

    const result = await runSlackIntent(intentToRun, {
      channelId,
      userId: input.slackUserId,
      text: clarification,
      ts: suggestion.messageTs,
      threadTs: suggestion.threadTs ?? undefined,
      channelType: suggestion.channelType ?? undefined,
      eventType: suggestion.eventType ?? undefined
    });

    if (result.handled) {
      void learnSlackIntent({
        query: clarification,
        intent: intentToRun,
        ownerBranUserId: branUserId,
        source: "confirmed"
      }).catch((error) => {
        console.warn("[slack-intents] learn from clarify failed:", error);
      });

      try {
        await updateUnsupportedSlackQueryClarification({
          channelId: suggestion.channelId,
          messageTs: suggestion.messageTs,
          clarificationText: clarification,
          resolvedIntent: intentToRun,
          reason: "user_clarified_intent",
          status: "REVIEWED"
        });
      } catch (error) {
        console.warn("[slack-intents] failed to update unsupported after clarify:", error);
      }
    } else {
      await postSlackMessage(
        channelId,
        `I understood *${slackIntentLabel(intentToRun)}* but couldn’t complete it. Try rephrasing.`,
        { threadTs }
      );
    }

    return { ok: true };
  }

  // Ambiguous / unsupported — store as feature request, no side effects.
  await markSlackIntentSuggestion(suggestion.id, { status: "DISMISSED" });

  try {
    await updateUnsupportedSlackQueryClarification({
      channelId: suggestion.channelId,
      messageTs: suggestion.messageTs,
      clarificationText: clarification,
      resolvedIntent: null,
      reason: "user_clarified_feature_request",
      status: "NEW"
    });
  } catch (error) {
    console.warn("[slack-intents] failed to store feature request clarification:", error);
  }

  const ack = formatFeatureRequestAckText();
  if (suggestion.replyTs) {
    try {
      await updateSlackMessage(channelId, suggestion.replyTs, ack, []);
    } catch {
      await postSlackMessage(channelId, ack, { threadTs });
    }
  } else {
    await postSlackMessage(channelId, ack, { threadTs });
  }

  return { ok: true };
}
