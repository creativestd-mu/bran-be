import {
  getSlackIntent,
  isSlackIntentId,
  SLACK_INTENT_CATALOG,
  slackIntentLabel,
  type SlackIntentId
} from "./slack-intents.catalog";
import type { IntentCandidate } from "./slack-intents.matcher";

export const SLACK_DID_YOU_MEAN_ACTION_PREFIX = "bran_didyoumean_";
export const SLACK_DID_YOU_MEAN_NONE_ACTION = "bran_didyoumean_none";
export const SLACK_RUN_ALL_INTENTS_ACTION = "bran_didyoumean_all";

export const INTENT_CLARIFY_CALLBACK_ID = "bran_intent_clarify";
export const INTENT_CLARIFY_BLOCK_ID = "bran_intent_clarify_text";
export const INTENT_CLARIFY_ACTION_ID = "bran_intent_clarify_input";

/** Preferred pad order when semantic match returns fewer than 3 candidates. */
const DEFAULT_PAD_ORDER: SlackIntentId[] = [
  "add_task",
  "list_tasks",
  "calendar",
  "sentiment",
  "competitors",
  "pods",
  "review",
  "ideas"
];

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

/**
 * Ensure exactly up to 3 supported intent candidates for Did-you-mean,
 * padding from the catalog when semantic match returns fewer.
 */
export function padTop3IntentCandidates(
  candidates: IntentCandidate[],
  options?: { isDm?: boolean; limit?: number }
): IntentCandidate[] {
  const limit = options?.limit ?? 3;
  const isDm = options?.isDm ?? true;
  const seen = new Set<SlackIntentId>();
  const out: IntentCandidate[] = [];

  for (const candidate of candidates) {
    if (!isSlackIntentId(candidate.intent)) continue;
    if (seen.has(candidate.intent)) continue;
    if (!isDm && getSlackIntent(candidate.intent)?.dmOnly) continue;
    seen.add(candidate.intent);
    out.push({
      intent: candidate.intent,
      label: candidate.label || slackIntentLabel(candidate.intent),
      score: candidate.score,
      source: candidate.source
    });
    if (out.length >= limit) return out;
  }

  for (const intent of DEFAULT_PAD_ORDER) {
    if (out.length >= limit) break;
    if (seen.has(intent)) continue;
    if (!isDm && getSlackIntent(intent)?.dmOnly) continue;
    // Skip catalog entries that somehow aren't in SLACK_INTENT_CATALOG
    if (!SLACK_INTENT_CATALOG.some((entry) => entry.id === intent)) continue;
    seen.add(intent);
    out.push({
      intent,
      label: slackIntentLabel(intent),
      score: 0.35,
      source: "catalog"
    });
  }

  return out;
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
    text: { type: "plain_text", text: "No, I meant something else", emoji: true },
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
            : "\n\nPick one, or tap *No, I meant something else* to tell me.")
      }
    },
    {
      type: "actions",
      block_id: `intent_suggest:${input.suggestionId}`,
      elements
    }
  ];
}

export function buildIntentClarifyModal(input: {
  suggestionId: string;
  originalText: string;
}): Record<string, unknown> {
  const preview =
    input.originalText.length > 280
      ? `${input.originalText.slice(0, 277)}...`
      : input.originalText;

  return {
    type: "modal",
    callback_id: INTENT_CLARIFY_CALLBACK_ID,
    private_metadata: JSON.stringify({ suggestionId: input.suggestionId }),
    title: { type: "plain_text", text: "What did you mean?", emoji: true },
    submit: { type: "plain_text", text: "Submit", emoji: true },
    close: { type: "plain_text", text: "Cancel", emoji: true },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Your message:\n>${preview.replace(/\n/g, "\n>")}`
        }
      },
      {
        type: "input",
        block_id: INTENT_CLARIFY_BLOCK_ID,
        label: { type: "plain_text", text: "What should Bran do?", emoji: true },
        element: {
          type: "plain_text_input",
          action_id: INTENT_CLARIFY_ACTION_ID,
          multiline: true,
          min_length: 3,
          max_length: 2000,
          placeholder: {
            type: "plain_text",
            text: "e.g. list Dhananjay’s tasks for this week, or book a call with Amisha…"
          }
        }
      }
    ]
  };
}

export function formatDidYouMeanFallbackText(candidates: IntentCandidate[]): string {
  const labels = candidates.slice(0, 3).map((c) => c.label);
  if (labels.length === 0) {
    return "I don’t support that request yet — tell me what you meant?";
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

export function formatFeatureRequestAckText(): string {
  return [
    "Thanks — I’ve logged that as a *feature request* for the team.",
    "If it’s something Bran already supports, try rephrasing (e.g. *list my tasks* or *book a call with @Name*)."
  ].join("\n");
}
