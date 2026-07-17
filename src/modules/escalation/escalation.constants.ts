export const ESCALATION_STATUSES = [
  "open",
  "in_progress",
  "waiting",
  "resolved",
  "closed"
] as const;

export type EscalationStatus = (typeof ESCALATION_STATUSES)[number];

export const ESCALATION_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type EscalationPriority = (typeof ESCALATION_PRIORITIES)[number];

export const ACTIVE_ESCALATION_STATUSES: EscalationStatus[] = [
  "open",
  "in_progress",
  "waiting"
];

/** Daily cron runs at this hour in IST. */
export const ESCALATION_CRON_HOUR_IST = 10;
