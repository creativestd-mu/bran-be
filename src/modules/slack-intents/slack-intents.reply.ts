import {
  isSlackIntentId,
  slackIntentLabel,
  type SlackIntentId
} from "./slack-intents.catalog";
import type { IntentCandidate } from "./slack-intents.matcher";

export const SLACK_DID_YOU_MEAN_ACTION_PREFIX = "bran_didyoumean_";
export const SLACK_DID_YOU_MEAN_NONE_ACTION = "bran_didyoumean_none";
export const SLACK_RUN_ALL_INTENTS_ACTION = "bran_didyoumean_all";

export function didYouMeanActionId(intent: SlackIntentId | "none" | "all"): string {
  if (intent === "none") return SLACK_DID_YOU_MEAN_NONE_ACTION;
  if (intent === "all") return SLACK_RUN_ALL_INTENTS_ACTION;
  return `${SLACK_DID_YOU_MEAN_ACTION_PREFIX}${intent}`;
}

export function parseDidYouMeanActionId(
  actionId: string
):
  | { kind: "intent"; intent: SlackIntentId }
  | { kind: "none" }
  | { kind: "all" }
  | null {
  if (actionId === SLACK_DID_YOU_MEAN_NONE_ACTION) {
    return { kind: "none" };
  }
  if (actionId === SLACK_RUN_ALL_INTENTS_ACTION) {
    return { kind: "all" };
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
  /** When true, offer a single "Run all" confirmation for compound requests. */
  runAll?: boolean;
}): unknown[] {
  const top = input.candidates.slice(0, 3);
  const elements: unknown[] = [];

  if (input.runAll && top.length >= 2) {
    elements.push({
      type: "button",
      text: {
        type: "plain_text",
        text: buttonLabel("Run all"),
        emoji: true
      },
      action_id: SLACK_RUN_ALL_INTENTS_ACTION,
      value: input.suggestionId,
      style: "primary"
    });
  }

  for (const candidate of top) {
    elements.push({
      type: "button",
      text: {
        type: "plain_text",
        text: buttonLabel(candidate.label),
        emoji: true
      },
      action_id: didYouMeanActionId(candidate.intent),
      value: input.suggestionId
    });
  }

  elements.push({
    type: "button",
    text: { type: "plain_text", text: "None of these", emoji: true },
    action_id: SLACK_DID_YOU_MEAN_NONE_ACTION,
    value: input.suggestionId
  });

  const intro = input.runAll
    ? "I found *multiple* actions in that message — confirm what I should run:\n"
    : "I don’t support that request yet — *did you mean* one of these?\n";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          intro +
          top.map((c, i) => `${i + 1}. *${c.label}*`).join("\n") +
          (input.runAll
            ? "\n\nTap *Run all* to do them together, or pick one."
            : "\n\nOr tell me which action you meant and I’ll learn it.")
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

export function formatCompoundConfirmText(candidates: IntentCandidate[]): string {
  const labels = candidates.slice(0, 5).map((c) => c.label);
  return `I found multiple actions — confirm to run: ${labels.join(", ")}.`;
}

export function formatRunningIntentText(intent: SlackIntentId): string {
  return `Got it — running *${slackIntentLabel(intent)}*…`;
}

export function formatRunningAllIntentsText(intents: SlackIntentId[]): string {
  const labels = intents.map((id) => slackIntentLabel(id));
  return `Got it — running ${labels.map((l) => `*${l}*`).join(", ")}…`;
}
