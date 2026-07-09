/** Minutes since midnight IST — submission must be before 11:00 AM. */
export const SUBMISSION_CUTOFF_MINUTES = 11 * 60;

/** Minutes since midnight IST — office ETA after 12:30 PM is late arrival. */
export const LATE_ARRIVAL_CUTOFF_MINUTES = 12 * 60 + 30;

export const ATTENDANCE_TIMEZONE = "Asia/Kolkata";

export const RECORD_TYPES = ["office", "wfh", "leave", "comp_off"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const ENTRY_STATUSES = ["submitted", "missing"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const ATTENDANCE_ADMIN_ROLES = new Set([
  "admin",
  "superadmin",
  "chief_of_staff",
  "manager"
]);
