import {
  isSlackIntentId,
  slackIntentLabel,
  type SlackIntentId
} from "./slack-intents.catalog";
import type { IntentCandidate } from "./slack-intents.matcher";

export const SLACK_DID_YOU_MEAN_ACTION_PREFIX = "bran_didyoumean_";
export const SLACK_DID_YOU_MEAN_NONE_ACTION = "bran_didyoumean_none";

export function didYouMeanActionId(intent: SlackIntentId | "none"): string {
  return intent === "none"
    ? SLACK_DID_YOU_MEAN_NONE_ACTION
    : `${SLACK_DID_YOU_MEAN_ACTION_PREFIX}${intent}`;
}

export function parseDidYouMeanActionId(
  actionId: string
): { kind: "intent"; intent: SlackIntentId } | { kind: "none" } | null {
  if (actionId === SLACK_DID_YOU_MEAN_NONE_ACTION) {
    return { kind: "none" };
  }
  if (!actionId.startsWith(SLACK_DID_YOU_MEAN_ACTION_PREFIX)) {
    return null;
  }
  const intent = actionId.slice(SLACK_DID_YOU_MEAN_ACTION_PREFIX.length);
  if (!isSlackIntentId(intent)) return null;
  return { kind: "intent", intent };
}

function buttonLabel(text: string): string {
  // Slack plain_text max 75 chars.
  return text.length > 70 ? `${text.slice(0, 67)}...` : text;
}

export function buildDidYouMeanBlocks(input: {
  suggestionId: string;
  candidates: IntentCandidate[];
}): unknown[] {
  const top = input.candidates.slice(0, 3);
  const elements: unknown[] = top.map((candidate) => ({
    type: "button",
    text: {
      type: "plain_text",
      text: buttonLabel(candidate.label),
      emoji: true
    },
    action_id: didYouMeanActionId(candidate.intent),
    value: input.suggestionId
  }));

  elements.push({
    type: "button",
    text: { type: "plain_text", text: "None of these", emoji: true },
    action_id: SLACK_DID_YOU_MEAN_NONE_ACTION,
    value: input.suggestionId
  });

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "I don’t support that request yet — *did you mean* one of these?\n" +
          top.map((c, i) => `${i + 1}. *${c.label}*`).join("\n") +
          "\n\nOr tell me which action you meant and I’ll learn it."
      }
    },
    {
      type: "actions",
      block_id: `intent_suggest:${input.suggestionId}`,
      elements
    }
  ];
}

export function formatDidYouMeanFallbackText(candidates: IntentCandidate[]): string {
  const labels = candidates.slice(0, 3).map((c) => c.label);
  if (labels.length === 0) {
    return "I don’t support that request yet.";
  }
  return `I don’t support that request yet — did you mean: ${labels.join(", ")}?`;
}

export function formatRunningIntentText(intent: SlackIntentId): string {
  return `Got it — running *${slackIntentLabel(intent)}*…`;
}
