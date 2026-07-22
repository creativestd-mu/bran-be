export const ORG_EVENT_KINDS = ["MANUAL", "AUTO"] as const;
export type OrgEventKind = (typeof ORG_EVENT_KINDS)[number];

export const ORG_EVENT_STATUSES = ["planned", "active", "completed", "cancelled"] as const;
export type OrgEventStatus = (typeof ORG_EVENT_STATUSES)[number];

export const ORG_EVENT_SOURCE_TYPES = [
  "GMAIL",
  "MEETING",
  "ESCALATION",
  "ATTENDANCE",
  "WORK_UNIT",
  "MANUAL"
] as const;
export type OrgEventSourceType = (typeof ORG_EVENT_SOURCE_TYPES)[number];

export const DEFAULT_DETECT_LOOKBACK_DAYS = 14;
export const DEFAULT_DETECT_MAX_CANDIDATES = 80;
