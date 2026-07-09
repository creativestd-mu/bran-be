import {
  ATTENDANCE_TIMEZONE,
  LATE_ARRIVAL_CUTOFF_MINUTES,
  SUBMISSION_CUTOFF_MINUTES
} from "./attendance.constants";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

function readZonedParts(instant: Date, timeZone: string = ATTENDANCE_TIMEZONE): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false
  }).formatToParts(instant);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const hourRaw = get("hour");
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: hourRaw === "24" ? 0 : Number(hourRaw),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: weekdayMap[get("weekday")] ?? 0
  };
}

/** Calendar date in IST as YYYY-MM-DD. */
export function todayInIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ATTENDANCE_TIMEZONE }).format(now);
}

/** Calendar date in IST for an arbitrary instant. */
export function dateInIST(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ATTENDANCE_TIMEZONE }).format(instant);
}

/** Convert Slack message `ts` (seconds.fraction) to a Date. */
export function slackTsToDate(ts: string): Date {
  const seconds = Number(ts);
  if (!Number.isFinite(seconds)) {
    return new Date();
  }
  return new Date(seconds * 1000);
}

/** Minutes since midnight IST for an instant. */
export function minutesSinceMidnightIST(instant: Date): number {
  const { hour, minute } = readZonedParts(instant);
  return hour * 60 + minute;
}

/** Parse YYYY-MM-DD into a Date at noon UTC (safe for Prisma @db.Date). */
export function entryDateFromString(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00.000Z`);
}

/** Format a Prisma Date / DateTime as YYYY-MM-DD. */
export function formatEntryDate(value: Date | string): string {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  // Prisma Date fields often come back as UTC midnight for the calendar day.
  return value.toISOString().slice(0, 10);
}

/**
 * Slack conversations.history bounds for an IST calendar day.
 * Returns unix timestamps as strings (seconds with fractional precision).
 */
export function istDayBounds(dateStr: string): { oldest: string; latest: string } {
  const start = new Date(`${dateStr}T00:00:00+05:30`);
  const end = new Date(`${dateStr}T23:59:59.999+05:30`);
  return {
    oldest: (start.getTime() / 1000).toFixed(6),
    latest: (end.getTime() / 1000).toFixed(6)
  };
}

export function isWeekendIST(dateStr: string): boolean {
  const noon = new Date(`${dateStr}T12:00:00+05:30`);
  const { weekday } = readZonedParts(noon);
  return weekday === 0 || weekday === 6;
}

export function classifyFlags(input: {
  submittedAt: Date;
  etaMinutes: number | null;
  recordType: string;
  skipSubmissionDeadline?: boolean;
}): { submittedOnTime: boolean | null; isLateArrival: boolean | null } {
  const { submittedAt, etaMinutes, recordType, skipSubmissionDeadline } = input;

  if (recordType !== "office") {
    const submittedOnTime = skipSubmissionDeadline
      ? null
      : minutesSinceMidnightIST(submittedAt) < SUBMISSION_CUTOFF_MINUTES;
    return { submittedOnTime, isLateArrival: null };
  }

  const submittedOnTime = skipSubmissionDeadline
    ? null
    : minutesSinceMidnightIST(submittedAt) < SUBMISSION_CUTOFF_MINUTES;

  const isLateArrival =
    etaMinutes != null ? etaMinutes > LATE_ARRIVAL_CUTOFF_MINUTES : null;

  return { submittedOnTime, isLateArrival };
}

/** Parse normalized ETA text like "12:30" or "13:00" into minutes since midnight. */
export function etaTextToMinutes(etaText: string | null | undefined): number | null {
  if (!etaText) return null;
  const match = etaText.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
