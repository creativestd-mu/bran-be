export const CALENDAR_CONNECTION_STATUSES = ["CONNECTED", "DISCONNECTED", "ERROR"] as const;
export type CalendarConnectionStatus = (typeof CALENDAR_CONNECTION_STATUSES)[number];

export const MEETING_STATUSES = [
  "SCHEDULED",
  "JOINING",
  "RECORDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED"
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const GOOGLE_MEET_URL_PATTERNS = ["meet.google.com", "google.com/meet"] as const;

export function isGoogleMeetUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const normalized = url.toLowerCase();
  return GOOGLE_MEET_URL_PATTERNS.some((pattern) => normalized.includes(pattern));
}
