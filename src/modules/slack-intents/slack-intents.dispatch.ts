import { isSlackIntentId, type SlackIntentId } from "./slack-intents.catalog";

export type SlackIntentDispatchInput = {
  channelId: string;
  userId: string;
  text?: string;
  ts: string;
  botId?: string;
  subtype?: string;
  threadTs?: string;
  channelType?: string;
  eventType?: string;
};

/**
 * Force-run a Bran Slack intent handler (skips looksLike* gates).
 * Uses dynamic imports to avoid a cycle with work.service ↔ unsupported.
 */
export async function runSlackIntent(
  intent: SlackIntentId | string,
  input: SlackIntentDispatchInput
): Promise<{ handled: boolean; reason?: string; created?: number }> {
  if (!isSlackIntentId(intent)) {
    return { handled: false, reason: "unknown_intent" };
  }

  const forced = { ...input, force: true as const };

  switch (intent) {
    case "add_task": {
      const { processSlackDirectedWorkCreateMessage } = await import("../work/work.service.js");
      return processSlackDirectedWorkCreateMessage(forced);
    }
    case "list_tasks": {
      const { processSlackTaskListMessage } = await import("../work/work.service.js");
      return processSlackTaskListMessage(forced);
    }
    case "sentiment": {
      const { processSlackSentimentMessage } = await import("../sentiment/sentiment.slack.js");
      return processSlackSentimentMessage(forced);
    }
    case "competitors": {
      const { processSlackCompetitorMessage } = await import(
        "../competitor-content/competitor-content.slack.js"
      );
      return processSlackCompetitorMessage(forced);
    }
    case "pods": {
      const { processSlackPodMessage } = await import("../pods/pods.slack.js");
      return processSlackPodMessage(forced);
    }
    case "ideas": {
      const { processSlackIdeaMessage } = await import("../ideation/ideation.slack.js");
      return processSlackIdeaMessage(forced);
    }
    case "calendar": {
      const { processSlackCalendarMessage } = await import("../meetings/meetings.booking.slack.js");
      return processSlackCalendarMessage(forced);
    }
    case "review": {
      const { processSlackReviewMessage } = await import("../review/review.slack.js");
      return processSlackReviewMessage(forced);
    }
    default:
      return { handled: false, reason: "unknown_intent" };
  }
}
