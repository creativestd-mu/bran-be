import { looksLikeCompetitorQuery } from "../competitor-content/competitor-content.slack";
import { looksLikeAddIdeaQuery, looksLikeListIdeasQuery } from "../ideation/ideation.slack";
import {
  looksLikeBookCallQuery,
  looksLikeCalendarAgendaQuery
} from "../meetings/meetings.booking.slack";
import { looksLikePodQuery } from "../pods/pods.slack";
import { looksLikeReviewQuery } from "../review/review.slack";
import { looksLikeSentimentQuery } from "../sentiment/sentiment.slack";
import {
  looksLikeCreateWorkQuery,
  looksLikeSlackDmTaskCreate,
  looksLikeTaskListQuery,
  stripSlackUserMentions
} from "../work/work.slack-tasks";
import {
  getSlackIntent,
  isSlackIntentId,
  slackIntentLabel,
  type SlackIntentId
} from "./slack-intents.catalog";
import {
  hasExplicitTaskCreateEnvelope,
  hasTopLevelBookCallInstruction,
  stripQuotedSlackLines
} from "./slack-intents.text";

/** Deterministic intents — catalog ids plus review (not yet always in catalog). */
export type DeterministicIntentId = SlackIntentId | "review";

export type IntentPrecision = "envelope" | "strong" | "weak";

export type DeterministicIntentHit = {
  intent: DeterministicIntentId;
  precision: IntentPrecision;
  label: string;
};

export type DeterministicResolveResult =
  | {
      mode: "single";
      intent: DeterministicIntentId;
      hits: DeterministicIntentHit[];
    }
  | {
      mode: "compound";
      intents: DeterministicIntentId[];
      hits: DeterministicIntentHit[];
    }
  | {
      mode: "none";
      hits: DeterministicIntentHit[];
    };

/** Sort order when picking a single winner without an explicit multi-ask cue. */
const SINGLE_WINNER_PRIORITY: DeterministicIntentId[] = [
  "add_task",
  "list_tasks",
  "calendar",
  "review",
  "ideas",
  "competitors",
  "sentiment",
  "pods"
];

/** Display / compound ordering (unchanged product ranking). */
const INTENT_PRIORITY: DeterministicIntentId[] = [
  "add_task",
  "ideas",
  "calendar",
  "review",
  "competitors",
  "sentiment",
  "pods",
  "list_tasks"
];

const COMPOUND_CUE_RE =
  /\b(and|also|plus|then|as well|in addition)\b|&|\bboth\b/i;

function labelFor(intent: DeterministicIntentId): string {
  if (intent === "review") return "Reviews";
  return slackIntentLabel(intent);
}

function precisionRank(precision: IntentPrecision): number {
  return precision === "envelope" ? 3 : precision === "strong" ? 2 : 1;
}

/** True when the user clearly asks for more than one action in one message. */
export function hasExplicitCompoundCue(text: string): boolean {
  const cleaned = stripSlackUserMentions(stripQuotedSlackLines(text));
  if (!cleaned) return false;
  return COMPOUND_CUE_RE.test(cleaned);
}

/**
 * Collect every deterministic intent that matches, after quote stripping
 * and create-envelope / book-envelope precedence.
 */
export function collectDeterministicIntentHits(text: string): DeterministicIntentHit[] {
  const routingText = stripQuotedSlackLines(text);
  if (!routingText.trim()) return [];

  const hits: DeterministicIntentHit[] = [];
  const createEnvelope = hasExplicitTaskCreateEnvelope(routingText);
  const listTasks = looksLikeTaskListQuery(routingText);
  const bookEnvelope = hasTopLevelBookCallInstruction(routingText);
  const agenda = looksLikeCalendarAgendaQuery(routingText);

  // Explicit task create wins alone — bullets saying "set up a call" are task bodies.
  if (createEnvelope || looksLikeCreateWorkQuery(routingText)) {
    hits.push({
      intent: "add_task",
      precision: createEnvelope ? "envelope" : "strong",
      label: labelFor("add_task")
    });
    if (createEnvelope) return hits;
  } else if (looksLikeSlackDmTaskCreate(routingText) && !listTasks) {
    hits.push({
      intent: "add_task",
      precision: "weak",
      label: labelFor("add_task")
    });
  }

  if (looksLikeAddIdeaQuery(routingText) || looksLikeListIdeasQuery(routingText)) {
    hits.push({
      intent: "ideas",
      precision: looksLikeAddIdeaQuery(routingText) ? "envelope" : "strong",
      label: labelFor("ideas")
    });
  }

  // Calendar: never attach as a secondary hit next to a clear list-tasks ask
  // unless this is an explicit book/agenda instruction.
  if (bookEnvelope) {
    hits.push({
      intent: "calendar",
      precision: "envelope",
      label: labelFor("calendar")
    });
  } else if (!listTasks && (agenda || looksLikeBookCallQuery(routingText))) {
    hits.push({
      intent: "calendar",
      precision: "strong",
      label: labelFor("calendar")
    });
  }

  if (looksLikeReviewQuery(routingText)) {
    hits.push({
      intent: "review",
      precision: "strong",
      label: labelFor("review")
    });
  }

  if (looksLikeCompetitorQuery(routingText)) {
    hits.push({
      intent: "competitors",
      precision: "strong",
      label: labelFor("competitors")
    });
  }

  if (looksLikeSentimentQuery(routingText)) {
    hits.push({
      intent: "sentiment",
      precision: "strong",
      label: labelFor("sentiment")
    });
  }

  if (looksLikePodQuery(routingText)) {
    hits.push({
      intent: "pods",
      precision: "strong",
      label: labelFor("pods")
    });
  }

  if (listTasks) {
    hits.push({
      intent: "list_tasks",
      precision: "strong",
      label: labelFor("list_tasks")
    });
  }

  return dedupeHits(hits);
}

function dedupeHits(hits: DeterministicIntentHit[]): DeterministicIntentHit[] {
  const best = new Map<DeterministicIntentId, DeterministicIntentHit>();
  for (const hit of hits) {
    const prev = best.get(hit.intent);
    if (!prev || precisionRank(hit.precision) > precisionRank(prev.precision)) {
      best.set(hit.intent, hit);
    }
  }
  return [...best.values()].sort(
    (a, b) => INTENT_PRIORITY.indexOf(a.intent) - INTENT_PRIORITY.indexOf(b.intent)
  );
}

function sortForSingleWinner(hits: DeterministicIntentHit[]): DeterministicIntentHit[] {
  return [...hits].sort((a, b) => {
    const prec = precisionRank(b.precision) - precisionRank(a.precision);
    if (prec !== 0) return prec;
    return SINGLE_WINNER_PRIORITY.indexOf(a.intent) - SINGLE_WINNER_PRIORITY.indexOf(b.intent);
  });
}

function singleResult(
  intent: DeterministicIntentId,
  allHits: DeterministicIntentHit[]
): DeterministicResolveResult {
  const winner = allHits.find((h) => h.intent === intent) ?? {
    intent,
    precision: "strong" as const,
    label: labelFor(intent)
  };
  // Only expose the winner so callers cannot accidentally dispatch a secondary hit.
  return { mode: "single", intent, hits: [winner] };
}

/**
 * Side-effect-free resolution:
 * - clear primary (envelope, or single strong) → single (secondaries dropped)
 * - compound only with an explicit multi-ask cue (and/also/…) or 2+ envelopes + cue
 * - without a cue, pick one dominant winner
 */
export function resolveDeterministicSlackIntents(text: string): DeterministicResolveResult {
  const hits = collectDeterministicIntentHits(text);
  if (hits.length === 0) return { mode: "none", hits };

  const envelope = hits.filter((h) => h.precision === "envelope");
  const strong = hits.filter((h) => h.precision === "strong");
  const actionable = envelope.length > 0 ? envelope : strong.length > 0 ? strong : hits;
  const compoundCue = hasExplicitCompoundCue(text);

  if (actionable.length === 1) {
    return singleResult(actionable[0].intent, hits);
  }

  // Multiple matches: only ask to confirm when the user joined actions explicitly.
  if (compoundCue && actionable.length >= 2) {
    const intents = sortForSingleWinner(actionable).map((h) => h.intent);
    return {
      mode: "compound",
      intents,
      hits: actionable
    };
  }

  // One clear resolve — drop secondary false positives.
  const winner = sortForSingleWinner(actionable)[0];
  return singleResult(winner.intent, hits);
}

export function isDispatchableSlackIntent(
  intent: DeterministicIntentId
): intent is SlackIntentId | "review" {
  return intent === "review" || isSlackIntentId(intent);
}

export function logSlackIntentRoute(input: {
  channelId: string;
  ts: string;
  mode: string;
  intents?: string[];
  reason?: string;
  durationMs?: number;
}): void {
  console.info(
    "[slack-intents.route]",
    JSON.stringify({
      channelId: input.channelId,
      ts: input.ts,
      mode: input.mode,
      intents: input.intents ?? [],
      reason: input.reason ?? null,
      durationMs: input.durationMs ?? null
    })
  );
}

export function filterHitsForChannel(
  hits: DeterministicIntentHit[],
  isDm: boolean
): DeterministicIntentHit[] {
  if (isDm) return hits;
  return hits.filter((hit) => {
    if (hit.intent === "review") return true;
    if (!isSlackIntentId(hit.intent)) return true;
    return !getSlackIntent(hit.intent)?.dmOnly;
  });
}
