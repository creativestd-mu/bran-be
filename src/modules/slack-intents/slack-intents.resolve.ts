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
  looksLikeTaskListQuery
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

function labelFor(intent: DeterministicIntentId): string {
  if (intent === "review") return "Reviews";
  return slackIntentLabel(intent);
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

  // Explicit task create wins alone — bullets saying "set up a call" are task bodies.
  if (createEnvelope || looksLikeCreateWorkQuery(routingText)) {
    hits.push({
      intent: "add_task",
      precision: createEnvelope ? "envelope" : "strong",
      label: labelFor("add_task")
    });
    if (createEnvelope) return hits;
  } else if (looksLikeSlackDmTaskCreate(routingText) && !looksLikeTaskListQuery(routingText)) {
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

  if (hasTopLevelBookCallInstruction(routingText) || looksLikeCalendarAgendaQuery(routingText)) {
    hits.push({
      intent: "calendar",
      precision: hasTopLevelBookCallInstruction(routingText) ? "envelope" : "strong",
      label: labelFor("calendar")
    });
  } else if (looksLikeBookCallQuery(routingText)) {
    // looksLikeBookCallQuery already respects create envelope after hardening.
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

  if (looksLikeTaskListQuery(routingText)) {
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
  const rank = { envelope: 3, strong: 2, weak: 1 };
  for (const hit of hits) {
    const prev = best.get(hit.intent);
    if (!prev || rank[hit.precision] > rank[prev.precision]) {
      best.set(hit.intent, hit);
    }
  }
  return [...best.values()].sort(
    (a, b) => INTENT_PRIORITY.indexOf(a.intent) - INTENT_PRIORITY.indexOf(b.intent)
  );
}

/**
 * Side-effect-free resolution:
 * - one envelope/strong intent → single
 * - two+ distinct envelope/strong intents → compound (confirm-all)
 * - only weak → single if one, else none
 */
export function resolveDeterministicSlackIntents(text: string): DeterministicResolveResult {
  const hits = collectDeterministicIntentHits(text);
  if (hits.length === 0) return { mode: "none", hits };

  const actionable = hits.filter((h) => h.precision !== "weak");
  const pool = actionable.length > 0 ? actionable : hits;

  if (pool.length >= 2) {
    return {
      mode: "compound",
      intents: pool.map((h) => h.intent),
      hits
    };
  }

  return {
    mode: "single",
    intent: pool[0].intent,
    hits
  };
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
