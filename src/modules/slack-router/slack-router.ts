import { z } from "zod";

import { env } from "../../config/env";
import {
  SLACK_INTENT_CATALOG,
  SLACK_INTENT_IDS,
  type SlackIntentId
} from "../slack-intents/slack-intents.catalog";
import {
  isHardBlockSafetyCategory,
  slackSafetyRouterRules,
  type SlackSafetyCategory
} from "../slack-safety/slack-safety";
import { callOpenRouter } from "../work/work.extraction";
import {
  buildSlackRouterCacheKey,
  getSlackRouterCache,
  istDateKey,
  setSlackRouterCache
} from "./slack-router.cache";

const SAFETY_CATEGORIES = [
  "ok",
  "sexual",
  "hate",
  "violence",
  "self_harm",
  "child_exploitation",
  "jailbreak",
  "illegal",
  "harassment",
  "other"
] as const satisfies readonly SlackSafetyCategory[];

const listRangeSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    label: z.string().trim().catch("")
  })
  .nullable()
  .catch(null);

const intentIdSet = new Set<string>(SLACK_INTENT_IDS);

const routerResponseSchema = z.object({
  safe: z.boolean().catch(true),
  category: z.enum(SAFETY_CATEGORIES).catch("other"),
  intent: z.union([z.enum(SLACK_INTENT_IDS), z.literal("none")]),
  confidence: z.coerce.number().transform((n) => Math.max(0, Math.min(1, n))),
  alternatives: z
    .array(z.string())
    .catch([])
    .default([])
    .transform((ids) => ids.filter((id): id is SlackIntentId => intentIdSet.has(id))),
  listRange: listRangeSchema.default(null)
});

export type SlackRouterResult = z.infer<typeof routerResponseSchema>;

const ROUTER_TIMEOUT_MS = 3000;

/** Static system prompt — keep byte-identical across calls for provider prompt caching. */
function buildRouterSystemPrompt(): string {
  const intents = SLACK_INTENT_CATALOG.map((entry) => {
    const examples = entry.examples.slice(0, 2).map((ex) => `"${ex}"`).join(", ");
    return `- ${entry.id}: ${entry.description} Examples: ${examples}`;
  }).join("\n");

  return [
    "You route workplace Slack messages to Bran, an internal work assistant at Masters' Union.",
    "Return STRICT JSON only with shape:",
    '{"safe":boolean,"category":"ok"|"sexual"|"hate"|"violence"|"self_harm"|"child_exploitation"|"jailbreak"|"illegal"|"harassment"|"other","intent":"add_task"|"list_tasks"|"sentiment"|"competitors"|"pods"|"ideas"|"calendar"|"review"|"none","confidence":0..1,"alternatives":string[],"listRange":{"from":"YYYY-MM-DD","to":"YYYY-MM-DD","label":string}|null}',
    "Safety rules:",
    slackSafetyRouterRules(),
    "Set safe=false and the matching category only for clear abuse. If unsure, safe=true and category=ok.",
    "Pick the single best intent, or none if none fit. confidence is 0..1. alternatives are up to 2 other plausible intents (not including the primary).",
    "listRange is only for list_tasks: inclusive ISO dates (YYYY-MM-DD) resolved in Asia/Kolkata. Weeks are Monday–Sunday. If no date is mentioned for list_tasks, use today for from and to. For other intents, listRange must be null.",
    "Supported intents:",
    intents
  ].join("\n");
}

const ROUTER_SYSTEM_PROMPT = buildRouterSystemPrompt();

function stripCodeFences(text: string): string {
  const trimmed = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function parseSlackRouterResponse(raw: string): SlackRouterResult | null {
  const trimmed = stripCodeFences(raw);
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    const result = routerResponseSchema.safeParse(parsed);
    if (!result.success) return null;
    const data = result.data;
    const alternatives = data.alternatives
      .filter((id) => id !== data.intent)
      .slice(0, 2) as SlackIntentId[];
    return {
      ...data,
      alternatives,
      listRange: data.intent === "list_tasks" ? data.listRange : null
    };
  } catch {
    return null;
  }
}

export function shouldBlockRouterResult(result: SlackRouterResult): boolean {
  return result.safe === false && isHardBlockSafetyCategory(result.category);
}

export async function routeSlackMessage(
  text: string,
  options: { now?: Date; isDm: boolean }
): Promise<{ result: SlackRouterResult | null; cacheHit: boolean }> {
  const now = options.now ?? new Date();
  const key = buildSlackRouterCacheKey({ text, isDm: options.isDm, now });
  const cached = getSlackRouterCache(key);
  if (cached) {
    return { result: cached, cacheHit: true };
  }

  if (!env.openrouterApiKey) {
    return { result: null, cacheHit: false };
  }

  const istDate = istDateKey(now);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long"
  }).format(now);
  const userPrompt = `Today (Asia/Kolkata): ${weekday} ${istDate}\nIs DM: ${options.isDm ? "yes" : "no"}\n\nMessage:\n"""${text.slice(0, 2000)}"""`;

  try {
    const raw = await callOpenRouter(ROUTER_SYSTEM_PROMPT, userPrompt, env.slackRouterModel, {
      maxTokens: 512,
      temperature: 0,
      providerOrder: env.openrouterProviderOrder,
      reasoningEffort: "low",
      timeoutMs: ROUTER_TIMEOUT_MS
    });
    const parsed = parseSlackRouterResponse(raw);
    if (parsed) {
      setSlackRouterCache(key, parsed);
    } else {
      console.warn("[slack-router] unparseable response", { rawPreview: raw.slice(0, 300) });
    }
    return { result: parsed, cacheHit: false };
  } catch (error) {
    console.warn("[slack-router] route failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    return { result: null, cacheHit: false };
  }
}
