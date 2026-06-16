const VISION_GUIDANCE_RE =
  /\bvision\b|\bfocus\b|\bpriorit|\bwhat (?:more )?(?:should|can) i (?:do|focus|work on)\b|\bhow can i (?:increase|improve|grow|boost)\b|\bsalary\b|\bcareer\b|\bgoals?\b|\bstrateg|\broadmap\b|\bdirection\b|\bwhat (?:is|are) (?:the|our) (?:team )?(?:vision|direction|plan|priorities)\b/i;

export function isVisionGuidanceQuery(query: string): boolean {
  return VISION_GUIDANCE_RE.test(query);
}

export function parseVisionQueryHints(query: string): {
  maxDurationMonths?: number;
  horizon?: "SHORT_TERM" | "LONG_TERM";
} {
  const lower = query.toLowerCase();
  const hints: { maxDurationMonths?: number; horizon?: "SHORT_TERM" | "LONG_TERM" } = {};

  if (/\b(?:two|2)\s+years?\b|\b24[\s-]?months?\b/.test(lower)) {
    hints.maxDurationMonths = 24;
    hints.horizon = "LONG_TERM";
  } else if (/\b(?:next|one|1)\s+year\b|\b12[\s-]?months?\b/.test(lower)) {
    hints.maxDurationMonths = 12;
    hints.horizon = "LONG_TERM";
  }

  if (/\bshort[\s-]?term\b|\bthis quarter\b|\bnext month\b|\bnext few months\b/.test(lower)) {
    hints.horizon = "SHORT_TERM";
    if (!hints.maxDurationMonths) hints.maxDurationMonths = 6;
  }

  if (/\blong[\s-]?term\b/.test(lower) && !hints.horizon) {
    hints.horizon = "LONG_TERM";
  }

  return hints;
}

export type VisionAiContextItem = {
  id: string;
  title: string;
  description: string | null;
  horizon: string;
  durationMonths: number;
  startsAt: Date;
  endsAt: Date;
  scope: string;
  teams: string[];
  users: string[];
  documentExcerpt: string | null;
};

export type KpiAiContextItem = {
  title: string;
  description: string;
};
