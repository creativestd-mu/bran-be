export const GMAIL_CONNECTION_STATUSES = ["CONNECTED", "DISCONNECTED", "ERROR"] as const;
export type GmailConnectionStatus = (typeof GMAIL_CONNECTION_STATUSES)[number];

/** Statuses the sync cron / manual sync will process. */
export const GMAIL_SYNCABLE_STATUSES = ["CONNECTED", "ERROR"] as const;

export const DEFAULT_GMAIL_SYNC_DAYS = 7;
export const DEFAULT_GMAIL_SYNC_MAX_MESSAGES = 50;
export const GMAIL_SYNC_CONCURRENCY = 5;
/** Cap stored body text to keep DB size and PII blast radius bounded. */
export const GMAIL_BODY_TEXT_MAX_CHARS = 50_000;
