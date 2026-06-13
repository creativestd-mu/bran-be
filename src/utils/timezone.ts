import { env } from "../config/env";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function readZonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(instant);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const hourRaw = get("hour");

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: hourRaw === "24" ? 0 : Number(hourRaw),
    minute: Number(get("minute")),
    second: Number(get("second"))
  };
}

/**
 * Returns the UTC instant for a wall-clock time in the given IANA timezone.
 */
export function wallClockToUtc(
  parts: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
    ms?: number;
  },
  timeZone: string = env.appTimezone
): Date {
  const {
    year,
    month,
    day,
    hour = 0,
    minute = 0,
    second = 0,
    ms = 0
  } = parts;

  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second, ms);

  for (let i = 0; i < 8; i++) {
    const zoned = readZonedParts(new Date(utcMs), timeZone);
    if (
      zoned.year === year &&
      zoned.month === month &&
      zoned.day === day &&
      zoned.hour === hour &&
      zoned.minute === minute &&
      zoned.second === second
    ) {
      return new Date(utcMs);
    }

    const minuteDelta =
      (year - zoned.year) * 525_600 +
      (month - zoned.month) * 43_200 +
      (day - zoned.day) * 1_440 +
      (hour - zoned.hour) * 60 +
      (minute - zoned.minute) +
      (second - zoned.second) / 60;

    utcMs += minuteDelta * 60_000;
  }

  return new Date(utcMs);
}

export function startOfDayInTimezone(
  instant: Date,
  timeZone: string = env.appTimezone
): Date {
  const { year, month, day } = readZonedParts(instant, timeZone);
  return wallClockToUtc({ year, month, day, hour: 0, minute: 0, second: 0, ms: 0 }, timeZone);
}

export function endOfDayInTimezone(
  instant: Date,
  timeZone: string = env.appTimezone
): Date {
  const { year, month, day } = readZonedParts(instant, timeZone);
  return wallClockToUtc({ year, month, day, hour: 23, minute: 59, second: 59, ms: 999 }, timeZone);
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse an API date/datetime string. Date-only values expand to start or end
 * of day in the configured app timezone.
 */
export function parseApiDateBoundary(
  value: string,
  boundary: "start" | "end"
): Date {
  if (DATE_ONLY_RE.test(value)) {
    const noonUtc = new Date(`${value}T12:00:00.000Z`);
    return boundary === "start"
      ? startOfDayInTimezone(noonUtc)
      : endOfDayInTimezone(noonUtc);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return boundary === "start" ? startOfDayInTimezone(parsed) : endOfDayInTimezone(parsed);
}

export function isSameCalendarDayInTimezone(
  from: Date,
  to: Date,
  timeZone: string = env.appTimezone
): boolean {
  const start = readZonedParts(from, timeZone);
  const end = readZonedParts(to, timeZone);
  return start.year === end.year && start.month === end.month && start.day === end.day;
}
