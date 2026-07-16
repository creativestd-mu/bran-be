/**
 * Minutes since midnight IST — submissions before this are on time.
 * Reminders go out at 11:00; late submission starts at 11:30.
 */
export const SUBMISSION_CUTOFF_MINUTES = 11 * 60 + 30;

/** Minutes since midnight IST — office ETA after 12:30 PM is late arrival. */
export const LATE_ARRIVAL_CUTOFF_MINUTES = 12 * 60 + 30;

/** Weekday reminder hour in IST (missing ETA nudges). */
export const REMINDER_HOUR_IST = 11;

export const ATTENDANCE_TIMEZONE = "Asia/Kolkata";

export const RECORD_TYPES = ["office", "wfh", "leave", "comp_off"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const ENTRY_STATUSES = ["submitted", "missing"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

/** Attendance UI + admin APIs are restricted to admin and chief of staff. */
export const ATTENDANCE_ADMIN_ROLES = new Set(["admin", "chief_of_staff"]);
