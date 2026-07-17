import {
  ESCALATION_PRIORITIES,
  ESCALATION_STATUSES,
  type EscalationPriority,
  type EscalationStatus
} from "./escalation.constants";

export const ESCALATION_TITLE_MAX_CHARS = 50;

/** Keep list titles ≤50 chars and readable (word-boundary trim). */
export function normalizeEscalationTitle(title: string, fallback = "Escalation"): string {
  const cleaned = title
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
  const value = cleaned.length >= 3 ? cleaned : fallback.trim();
  if (value.length <= ESCALATION_TITLE_MAX_CHARS) return value;

  const words = value.split(" ");
  let result = "";
  for (const word of words) {
    const next = result ? `${result} ${word}` : word;
    if (next.length > ESCALATION_TITLE_MAX_CHARS) break;
    result = next;
  }
  if (result.length < 3) {
    result = value.slice(0, ESCALATION_TITLE_MAX_CHARS);
  }
  return result.replace(/[\s,:;.\-–—/]+$/u, "");
}

export function extractEscalationTitle(text: string): string {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return "Escalation";
  return normalizeEscalationTitle(firstLine, "Escalation");
}

export function inferPriority(text: string): EscalationPriority {
  const lower = text.toLowerCase();
  if (/\b(p0|urgent|critical|sev-?1|blocker)\b/.test(lower)) return "urgent";
  if (/\b(p1|high|sev-?2)\b/.test(lower)) return "high";
  if (/\b(p3|low|minor)\b/.test(lower)) return "low";
  return "medium";
}

/** Normalize legacy waiting/in_progress → open; resolved → closed. */
export function normalizeEscalationStatus(status: EscalationStatus): EscalationStatus {
  if (status === "waiting" || status === "in_progress") return "open";
  if (status === "resolved") return "closed";
  return status;
}

export function isActiveEscalationStatus(status: string): boolean {
  return status === "open" || status === "waiting" || status === "in_progress";
}

export function inferStatusFromText(text: string): EscalationStatus | null {
  const lower = text.toLowerCase();
  if (/\b(closed|archived|cancelled|canceled|no action)\b/.test(lower)) {
    return "closed";
  }
  if (/\b(resolved|fixed|done|completed|shipped|mitigated|sorted)\b/.test(lower)) {
    return "closed";
  }
  if (
    /\b(thanks? (?:that works|all set|sorted|done|resolved)|issue (?:is )?resolved|this is (?:done|fixed|sorted))\b/.test(
      lower
    )
  ) {
    return "closed";
  }
  return null;
}

export function isValidEscalationStatus(value: string): value is EscalationStatus {
  return (ESCALATION_STATUSES as readonly string[]).includes(value);
}

export function isValidEscalationPriority(value: string): value is EscalationPriority {
  return (ESCALATION_PRIORITIES as readonly string[]).includes(value);
}
