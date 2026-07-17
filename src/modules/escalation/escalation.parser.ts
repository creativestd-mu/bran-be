import {
  ESCALATION_PRIORITIES,
  ESCALATION_STATUSES,
  type EscalationPriority,
  type EscalationStatus
} from "./escalation.constants";

export function extractEscalationTitle(text: string): string {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return "Escalation";
  // Provisional until AI rewrites; keep list cells short.
  if (firstLine.length <= 50) return firstLine;
  return `${firstLine.slice(0, 49).trimEnd()}…`;
}

export function inferPriority(text: string): EscalationPriority {
  const lower = text.toLowerCase();
  if (/\b(p0|urgent|critical|sev-?1|blocker)\b/.test(lower)) return "urgent";
  if (/\b(p1|high|sev-?2)\b/.test(lower)) return "high";
  if (/\b(p3|low|minor)\b/.test(lower)) return "low";
  return "medium";
}

/** Normalize legacy waiting/in_progress → open (product default is open). */
export function normalizeEscalationStatus(status: EscalationStatus): EscalationStatus {
  if (status === "waiting" || status === "in_progress") return "open";
  return status;
}

export function inferStatusFromText(text: string): EscalationStatus | null {
  const lower = text.toLowerCase();
  if (/\b(resolved|fixed|done|completed|shipped|mitigated)\b/.test(lower)) {
    return "resolved";
  }
  if (/\b(closed|archived|cancelled|canceled|no action)\b/.test(lower)) {
    return "closed";
  }
  // waiting / in_progress keywords no longer change status — stay open by default.
  return null;
}

export function isValidEscalationStatus(value: string): value is EscalationStatus {
  return (ESCALATION_STATUSES as readonly string[]).includes(value);
}

export function isValidEscalationPriority(value: string): value is EscalationPriority {
  return (ESCALATION_PRIORITIES as readonly string[]).includes(value);
}
