import type { RecordType } from "./attendance.constants";
import { etaTextToMinutes } from "./attendance.dates";

export type ParsedAttendance = {
  recordType: RecordType;
  etaText: string | null;
  etaMinutes: number | null;
};

/**
 * Parse a Slack attendance message. First match wins:
 * comp off → leave → wfh → eta …
 */
export function parseAttendanceMessage(text: string): ParsedAttendance | null {
  const raw = text.trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();

  if (/\bcomp\s*off\b/.test(lower) || /\bcompoff\b/.test(lower)) {
    return { recordType: "comp_off", etaText: null, etaMinutes: null };
  }

  if (/\bleave\b/.test(lower)) {
    return { recordType: "leave", etaText: null, etaMinutes: null };
  }

  if (/\bwfh\b/.test(lower)) {
    return { recordType: "wfh", etaText: null, etaMinutes: null };
  }

  // eta 12:30 | eta 1 | eta 12 pm | ETA - 1:30
  const etaMatch = lower.match(
    /\beta\b[\s\-–—:]*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/
  );
  if (!etaMatch) return null;

  let hours = Number(etaMatch[1]);
  const minutes = etaMatch[2] != null ? Number(etaMatch[2]) : 0;
  const meridiem = etaMatch[3] as "am" | "pm" | undefined;

  if (!Number.isFinite(hours) || hours < 0 || hours > 23 || minutes > 59) {
    return null;
  }

  if (meridiem === "pm" && hours < 12) {
    hours += 12;
  } else if (meridiem === "am" && hours === 12) {
    hours = 0;
  } else if (!meridiem && etaMatch[2] == null) {
    // Hour-only shorthand: 1–7 assumed PM for office arrival
    if (hours >= 1 && hours <= 7) {
      hours += 12;
    }
  } else if (!meridiem && etaMatch[2] != null) {
    // eta 1:30 without am/pm — treat 1–7 as PM
    if (hours >= 1 && hours <= 7) {
      hours += 12;
    }
  }

  const etaText = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return {
    recordType: "office",
    etaText,
    etaMinutes: etaTextToMinutes(etaText)
  };
}
