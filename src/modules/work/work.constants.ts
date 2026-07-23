export const WORK_STATUSES = ["OPEN", "CLOSED"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const WORK_INGEST_SOURCE_TYPES = ["GMAIL", "SLACK", "MEETING"] as const;
export type WorkIngestSourceType = (typeof WORK_INGEST_SOURCE_TYPES)[number];

export const WORK_UNIT_SOURCE_LEDGER_STATUSES = ["PROCESSED", "SKIPPED", "ERROR"] as const;

export const DEFAULT_WORK_INGEST_LOOKBACK_DAYS = 7;
export const DEFAULT_WORK_INGEST_MAX_PER_SOURCE = 40;
export const DEFAULT_WORK_INGEST_CONCURRENCY = 3;
export const WORK_DEDUP_TITLE_LOOKBACK_DAYS = 30;
