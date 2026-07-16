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
  return firstLine.length > 500 ? `${firstLine.slice(0, 497)}...` : firstLine;
}

export function inferPriority(text: string): EscalationPriority {
  const lower = text.toLowerCase();
  if (/\b(p0|urgent|critical|sev-?1|blocker)\b/.test(lower)) return "urgent";
  if (/\b(p1|high|sev-?2)\b/.test(lower)) return "high";
  if (/\b(p3|low|minor)\b/.test(lower)) return "low";
  return "medium";
}

export function inferStatusFromText(text: string): EscalationStatus | null {
  const lower = text.toLowerCase();
  if (/\b(resolved|fixed|done|completed|shipped|mitigated)\b/.test(lower)) {
    return "resolved";
  }
  if (/\b(closed|archived|cancelled|canceled|no action)\b/.test(lower)) {
    return "closed";
  }
  if (/\b(waiting|blocked|pending|on hold|awaiting)\b/.test(lower)) {
    return "waiting";
  }
  if (/\b(in progress|working on|investigating|looking into|assigned|picked up)\b/.test(
    lower
  )) {
    return "in_progress";
  }
  return null;
}

export function isValidEscalationStatus(value: string): value is EscalationStatus {
  return (ESCALATION_STATUSES as readonly string[]).includes(value);
}

export function isValidEscalationPriority(value: string): value is EscalationPriority {
  return (ESCALATION_PRIORITIES as readonly string[]).includes(value);
}
