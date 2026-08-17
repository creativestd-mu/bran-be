import { env } from "../../config/env";
import { getZonedDateParts, wallClockToUtc } from "../../utils/timezone";
import type { BusyInterval } from "./calendar.client";

export const BOOKING_WINDOW_START_HOUR = 12;
export const BOOKING_WINDOW_END_HOUR = 19;
export const BOOKING_SLOT_MINUTES = 30;
export const BOOKING_SEARCH_DAYS = 7;
export const BOOKING_MAX_SLOTS = 5;

export type BookingSlot = {
  start: Date;
  end: Date;
  label: string;
};

function weekdayInTimezone(instant: Date, timeZone = env.appTimezone): number {
  // 0=Sun … 6=Sat in the target timezone
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short"
  }).format(instant);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  return map[weekday] ?? 0;
}

function addCalendarDays(
  parts: { year: number; month: number; day: number },
  days: number
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate()
  };
}

export function mergeBusyIntervals(busy: BusyInterval[]): BusyInterval[] {
  if (busy.length === 0) return [];
  const sorted = [...busy].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: BusyInterval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const next = sorted[i];
    if (next.start.getTime() <= last.end.getTime()) {
      if (next.end > last.end) last.end = next.end;
    } else {
      merged.push({ ...next });
    }
  }
  return merged;
}

export function overlapsBusy(start: Date, end: Date, busy: BusyInterval[]): boolean {
  return busy.some((block) => start < block.end && end > block.start);
}

export function formatSlotLabel(start: Date, end: Date, timeZone = env.appTimezone): string {
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(start);
  const startTime = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(start);
  const endTime = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(end);
  return `${day} · ${startTime}–${endTime} IST`;
}

/**
 * Candidate 30-min slots Mon–Fri between 12:00–19:00 in app timezone,
 * starting from the next half-hour after `now`.
 */
export function generateBookingCandidateSlots(
  now = new Date(),
  options?: {
    durationMinutes?: number;
    windowStartHour?: number;
    windowEndHour?: number;
    searchDays?: number;
    timeZone?: string;
  }
): BookingSlot[] {
  const durationMinutes = options?.durationMinutes ?? BOOKING_SLOT_MINUTES;
  const windowStartHour = options?.windowStartHour ?? BOOKING_WINDOW_START_HOUR;
  const windowEndHour = options?.windowEndHour ?? BOOKING_WINDOW_END_HOUR;
  const searchDays = options?.searchDays ?? BOOKING_SEARCH_DAYS;
  const timeZone = options?.timeZone ?? env.appTimezone;

  const slots: BookingSlot[] = [];
  const today = getZonedDateParts(now, timeZone);

  for (let dayOffset = 0; dayOffset < searchDays; dayOffset++) {
    const day = addCalendarDays(today, dayOffset);
    const noonProbe = wallClockToUtc(
      { ...day, hour: 12, minute: 0, second: 0, ms: 0 },
      timeZone
    );
    const weekday = weekdayInTimezone(noonProbe, timeZone);
    if (weekday === 0 || weekday === 6) continue;

    for (let hour = windowStartHour; hour < windowEndHour; hour++) {
      for (const minute of [0, 30]) {
        if (hour === windowEndHour - 1 && minute + durationMinutes > 60) continue;
        const endMinute = minute + durationMinutes;
        const endHour = hour + Math.floor(endMinute / 60);
        const endMin = endMinute % 60;
        if (endHour > windowEndHour || (endHour === windowEndHour && endMin > 0)) {
          continue;
        }

        const start = wallClockToUtc(
          { ...day, hour, minute, second: 0, ms: 0 },
          timeZone
        );
        const end = wallClockToUtc(
          { ...day, hour: endHour, minute: endMin, second: 0, ms: 0 },
          timeZone
        );
        if (start <= now) continue;

        slots.push({
          start,
          end,
          label: formatSlotLabel(start, end, timeZone)
        });
      }
    }
  }

  return slots;
}

export function pickFreeBookingSlots(
  candidates: BookingSlot[],
  busy: BusyInterval[],
  maxSlots = BOOKING_MAX_SLOTS
): BookingSlot[] {
  const merged = mergeBusyIntervals(busy);
  const free: BookingSlot[] = [];
  for (const slot of candidates) {
    if (overlapsBusy(slot.start, slot.end, merged)) continue;
    free.push(slot);
    if (free.length >= maxSlots) break;
  }
  return free;
}

/** Strip booking verbs / person references and keep topic context for the title. */
export function deriveMeetingTitle(input: {
  text: string;
  requesterName: string;
  targetName: string;
}): string {
  let context = input.text
    .replace(/<@[A-Z0-9]+(?:\|[^>]+)?>/gi, " ")
    .replace(
      /\b(please\s+)?(can you\s+|could you\s+)?(help\s+me\s+)?(book|schedule|set\s*up|setup|arrange|fix)\b/gi,
      " "
    )
    .replace(/\b(a|an|the)?\s*(call|meeting|sync|catch[- ]?up|1:1|one[- ]on[- ]one)\b/gi, " ")
    .replace(
      /\bwith\s+[A-Za-z][A-Za-z.'\-]*(?:\s+[A-Za-z][A-Za-z.'\-]*){0,2}(?=\s+(?:about|regarding|re|to discuss|for)\b|$)/gi,
      " "
    )
    .replace(/\b(about|regarding|re|to discuss|for)\b/gi, " ")
    .replace(/[^\w\s&/+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (context.length < 4) {
    return `${input.requesterName} <> ${input.targetName}`;
  }

  // Title-case lightly
  const titled = context
    .split(" ")
    .map((word) => (word.length <= 2 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1)))
    .join(" ");

  return titled.slice(0, 120);
}
