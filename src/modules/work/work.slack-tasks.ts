import { env } from "../../config/env";
import {
  endOfDayInTimezone,
  getZonedDateParts,
  startOfDayInTimezone,
  wallClockToUtc
} from "../../utils/timezone";
import { parseAttendanceMessage } from "../attendance/attendance.parser";
import { implicitWorkDeadline, isWorkDeadlineOverdue, workDeadlineAtEndOfDay } from "./work.due-fields";
import { callWorkLlm, isWorkExtractionAiConfigured } from "./work.extraction";
import { isAcceptAsIsConfirmReply } from "./work.slack-voice";

export type SlackTaskDateRange = {
  from: Date;
  to: Date;
  label: string;
};

export type SlackTaskListQuery = {
  isTaskList: boolean;
  range: SlackTaskDateRange;
  source: "heuristic" | "llm" | "default";
};

type CalendarDay = { year: number; month: number; day: number };

const WEEKDAY_SHORT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

const MONTH_NAME: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12
};

const TASKY_RE =
  /\b(tasks?|to-?dos?|todos?|work units?|deadlines?|pending work|assigned to me|my work)\b/i;
const ASK_TASKS_RE =
  /\b(what do i (have|need)|show (me )?my|list my|my (pending|due|overdue)|due (today|tomorrow|this week)|what(?:'s| is) (on my plate|due))\b/i;

function zonedWeekday(instant: Date, timeZone = env.appTimezone): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short"
  }).format(instant);
  return WEEKDAY_SHORT[weekday] ?? 0;
}

function addCalendarDays(day: CalendarDay, delta: number): CalendarDay {
  const utc = new Date(Date.UTC(day.year, day.month - 1, day.day + delta));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate()
  };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftMonth(day: CalendarDay, delta: number): CalendarDay {
  const utc = new Date(Date.UTC(day.year, day.month - 1 + delta, 1));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: 1 };
}

function rangeForDays(start: CalendarDay, end: CalendarDay, label: string): SlackTaskDateRange {
  return {
    from: wallClockToUtc({ ...start, hour: 0, minute: 0, second: 0, ms: 0 }),
    to: wallClockToUtc({ ...end, hour: 23, minute: 59, second: 59, ms: 999 }),
    label
  };
}

function formatDayLabel(day: CalendarDay): string {
  const instant = wallClockToUtc({ ...day, hour: 12 });
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: env.appTimezone,
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(instant);
}

function formatRangeLabel(from: CalendarDay, to: CalendarDay, hint?: string): string {
  const same =
    from.year === to.year && from.month === to.month && from.day === to.day;
  const span = same ? formatDayLabel(from) : `${formatDayLabel(from)} – ${formatDayLabel(to)}`;
  return hint ? `${hint} (${span}, IST)` : `${span} (IST)`;
}

const SLACK_USER_MENTION_RE = /<@[UW][A-Z0-9]+(?:\|[^>]+)?>/gi;
const SLACK_USER_MENTION_ID_RE = /<@([UW][A-Z0-9]+)(?:\|[^>]+)?>/gi;

const TASK_LIST_RESERVED_NAME_WORDS = new Set([
  "my",
  "our",
  "mine",
  "me",
  "i",
  "the",
  "a",
  "an",
  "today",
  "tomorrow",
  "yesterday",
  "overdue",
  "this",
  "last",
  "next",
  "pending",
  "completed",
  "complete",
  "due",
  "open",
  "closed",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "mon",
  "tue",
  "tues",
  "wed",
  "thu",
  "thur",
  "thurs",
  "fri",
  "sat",
  "sun",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "jan",
  "feb",
  "mar",
  "apr",
  "jun",
  "jul",
  "aug",
  "sep",
  "sept",
  "oct",
  "nov",
  "dec",
  "week",
  "month",
  "year",
  "weekend",
  "show",
  "list",
  "get",
  "give",
  "what",
  "see",
  "check",
  "find",
  "fetch",
  "please",
  "pls"
]);

export type SlackTaskListSubject =
  | { kind: "self" }
  | { kind: "tagged"; slackUserIds: string[] }
  | { kind: "named_untagged"; name: string };

export function stripSlackUserMentions(text: string): string {
  return text.replace(SLACK_USER_MENTION_RE, " ").replace(/\s+/g, " ").trim();
}

export function collectSlackUserMentions(text: string): string[] {
  const ids: string[] = [];
  const re = new RegExp(SLACK_USER_MENTION_ID_RE.source, "gi");
  for (const match of text.matchAll(re)) {
    const id = match[1];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function textMentionsSlackUser(text: string, slackUserId: string): boolean {
  if (!slackUserId) return false;
  const escaped = slackUserId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<@${escaped}(?:\\|[^>]+)?>`, "i").test(text);
}

const FALLBACK_ASSIGNEE_RESERVED = new Set([
  "everyone",
  "everybody",
  "all",
  "me",
  "myself",
  "us",
  "today",
  "tomorrow",
  "yesterday",
  "this",
  "that",
  "the",
  "a",
  "an",
  "my",
  "our",
  "your"
]);

/**
 * When the LLM returns no work units for a directed Slack "add task" message,
 * synthesize one unit with three defaults:
 * 1) title — from "about/regarding …" or stripped create phrasing
 * 2) assigneeName — from "for <Name>" when present (else null → requester / @tag)
 * 3) context — the cleaned original message
 */
export function buildDirectedSlackCreateFallback(
  text: string,
  now: Date = new Date()
): {
  title: string;
  context: string;
  status: "OPEN";
  projectName: null;
  assigneeName: string | null;
  sourceExcerpt: string;
  steps: Array<{
    description: string;
    deadline: string;
    assigneeName: string | null;
    sourceExcerpt: string;
  }>;
} | null {
  const cleaned = stripSlackUserMentions(text).replace(/\s+/g, " ").trim();
  if (cleaned.length < 3) return null;

  let assigneeName: string | null = null;
  const beforeAbout = cleaned
    .replace(/\b(?:about|regarding|\bre)\s+.+$/i, " ")
    .replace(/\s+/g, " ")
    .trim();
  const forMatch = beforeAbout.match(
    /\bfor\s+([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*)?)\b/i
  );
  if (forMatch?.[1]) {
    const candidate = forMatch[1].trim();
    const first = candidate.split(/\s+/)[0]?.toLowerCase() ?? "";
    if (first && !FALLBACK_ASSIGNEE_RESERVED.has(first)) {
      assigneeName = candidate;
    }
  }

  let title = "";
  const aboutMatch = cleaned.match(/\b(?:about|regarding|re)\s+(.+)$/i);
  if (aboutMatch?.[1]?.trim()) {
    title = aboutMatch[1].trim();
  } else {
    const afterColon = cleaned.match(/:\s*(.+)$/);
    if (afterColon?.[1]?.trim() && afterColon[1].trim().length >= 3) {
      title = afterColon[1].trim();
    } else {
      title = cleaned
        .replace(
          /^(?:please\s+)?(?:add|create|log|capture|note|assign)\s+(?:a\s+|an\s+|the\s+|this\s+|these\s+|some\s+)?(?:new\s+)?(?:task|to-?do|todo|work unit|action item|something)?s?\b[:\s-]*/i,
          ""
        )
        .replace(/\bfor\s+[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*)?\b/i, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  title = title.replace(/^[:\-–—\s]+|[:\-–—\s]+$/g, "").trim();
  if (title.length < 2) {
    title = cleaned.slice(0, 80).trim();
  }
  if (title.length > 120) {
    title = `${title.slice(0, 117).trim()}...`;
  }

  const deadline = workDeadlineAtEndOfDay(now).toISOString();
  const excerpt = cleaned.slice(0, 280);

  return {
    title,
    context: cleaned,
    status: "OPEN",
    projectName: null,
    assigneeName,
    sourceExcerpt: excerpt,
    steps: [
      {
        description: title,
        deadline,
        assigneeName,
        sourceExcerpt: excerpt
      }
    ]
  };
}

function isReservedTaskListName(value: string): boolean {
  const first = value.trim().toLowerCase().split(/\s+/)[0] ?? "";
  if (!first || /^\d/.test(first)) return true;
  return TASK_LIST_RESERVED_NAME_WORDS.has(first);
}

export function extractUntaggedTaskListPersonName(text: string): string | null {
  const cleaned = stripSlackUserMentions(text);

  const possessive = cleaned.match(
    /\b([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*)?)['’]s\s+(?:pending\s+|overdue\s+|completed\s+)?(?:tasks?|to-?dos?|todos?|work units?|deadlines?)\b/i
  );
  if (possessive?.[1] && !isReservedTaskListName(possessive[1])) {
    return possessive[1].trim();
  }

  const forOf = cleaned.match(
    /\b(?:tasks?|to-?dos?|todos?|work units?|deadlines?)\s+(?:for|of)\s+([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*)?)\b/i
  );
  if (forOf?.[1] && !isReservedTaskListName(forOf[1])) {
    return forOf[1].trim();
  }

  const leading = cleaned.match(
    /\b(?:show|list|get|give me|what(?:'s| is)|see)\s+([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*)?)\s+(?:pending\s+|overdue\s+|completed\s+)?(?:tasks?|to-?dos?|todos?|work units?)\b/i
  );
  if (leading?.[1] && !isReservedTaskListName(leading[1])) {
    return leading[1].trim();
  }

  return null;
}

export function resolveTaskListSubject(
  text: string,
  input: { requesterSlackId: string; botUserId: string | null }
): SlackTaskListSubject {
  const others = collectSlackUserMentions(text).filter((id) => {
    if (input.botUserId && id.toUpperCase() === input.botUserId.toUpperCase()) return false;
    return id.toUpperCase() !== input.requesterSlackId.toUpperCase();
  });

  if (others.length > 0) {
    return { kind: "tagged", slackUserIds: others };
  }

  const name = extractUntaggedTaskListPersonName(text);
  if (name) return { kind: "named_untagged", name };
  return { kind: "self" };
}

export function looksLikeOverdueTaskQuery(text: string): boolean {
  return /\boverdue\b/i.test(stripSlackUserMentions(text));
}

const CREATE_TASK_PHRASE_RE =
  /\b((add|create|log|capture|note)\s+(a\s+|an\s+|the\s+|this\s+|these\s+)?(new\s+)?(task|to-?do|todo|work unit|action item)s?)\b/i;
const CREATE_ASSIGN_RE = /\bassign\b/i;
const CREATE_LEADING_RE = /^\s*(add|create|log|capture|assign|task)\b/i;
const CREATE_DUTY_RE = /\b(should|needs? to|has to|have to)\b/i;
const CREATE_ACTION_RE =
  /\b(follow up|send|share|finish|complete|review|prepare|draft|update|fix|ship|publish|check|sit with|meet|email|call|write|remind)\b/i;
const CHIT_CHAT_RE =
  /^(hi|hey|hello|thanks|thank you|thx|ok|okay|cool|great|got it|noted|lol|lmk|yes|no|yep|nope)[\s!.]*$/i;
const LIST_ONLY_RE = /\b(show|list|what(?:'s| is)?|my|our|pending|overdue|completed)\b/i;
const RELATIVE_TASKS_WINDOW_RE =
  /\btasks?\s+for\s+(today|tomorrow|yesterday|this|last|next)\b/i;
const ADD_THESE_TASKS_RE =
  /\b(add|create|log|capture|note)\b[\s\S]{0,40}\b(these|following|below)\b/i;
const COLON_META_PREFIX_RE = /^(note|fyi|re|fwd|forwarded|update|ps|btw)\s*:/i;
const NEGATED_CREATE_RE =
  /\b(don'?t|do\s+not|never|not)\s+(add|create|log|capture|note|assign)\b/i;

/** Numbered / bulleted / "Name - work" lines — a dump to create, not a list query. */
export function looksLikeBulkAssignedTaskList(text: string): boolean {
  const trimmed = stripSlackUserMentions(text);
  if (!trimmed) return false;
  const lines = trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 3);
  if (lines.length < 2) return false;

  const taskish = lines.filter(
    (line) =>
      /^\d+[.)]\s+\S/.test(line) ||
      /^[-*•]\s+\S/.test(line) ||
      /^[A-Za-z][A-Za-z.'-]{0,40}(?:\s+[A-Za-z][A-Za-z.'-]{0,40}){0,2}\s*[-–—:]\s+\S/.test(line)
  );
  return taskish.length >= 2;
}

function hasExplicitCreateIntent(text: string): boolean {
  return (
    CREATE_TASK_PHRASE_RE.test(text) ||
    CREATE_ASSIGN_RE.test(text) ||
    CREATE_LEADING_RE.test(text) ||
    ADD_THESE_TASKS_RE.test(text)
  );
}

export function looksLikeCreateWorkQuery(text: string): boolean {
  const trimmed = stripSlackUserMentions(text);
  if (!trimmed) return false;
  if (isAcceptAsIsConfirmReply(trimmed)) return false;
  if (parseAttendanceMessage(trimmed)) return false;
  if (NEGATED_CREATE_RE.test(trimmed)) return false;

  // "tasks for today" alone is a list query; with add/create or a bulk dump it is create.
  if (RELATIVE_TASKS_WINDOW_RE.test(trimmed)) {
    if (hasExplicitCreateIntent(trimmed) || looksLikeBulkAssignedTaskList(trimmed)) {
      return true;
    }
    return false;
  }

  if (CREATE_TASK_PHRASE_RE.test(trimmed)) return true;
  if (CREATE_ASSIGN_RE.test(trimmed)) return true;
  if (CREATE_LEADING_RE.test(trimmed) && !LIST_ONLY_RE.test(trimmed)) return true;
  if (ADD_THESE_TASKS_RE.test(trimmed)) return true;
  if (looksLikeBulkAssignedTaskList(trimmed)) return true;
  if (CREATE_DUTY_RE.test(trimmed) && trimmed.length >= 16) return true;
  // Colon create only for assignee-style "Name: work" / create-leading — not FYI:/Note:/Re:
  if (/:\s+\S/.test(trimmed) && trimmed.length >= 12) {
    if (COLON_META_PREFIX_RE.test(trimmed)) return false;
    if (
      CREATE_LEADING_RE.test(trimmed) ||
      /^[A-Za-z][A-Za-z.'-]{0,40}(?:\s+[A-Za-z][A-Za-z.'-]{0,40}){0,2}\s*:\s+\S/.test(trimmed)
    ) {
      return true;
    }
  }
  return false;
}

const MASS_ASSIGN_RE =
  /\b(everyone|everybody|all (?:the )?(members?|people|folks|teammates?)|whole (?:channel|group|team)|entire (?:channel|group|team))\b/i;
const MASS_ASSIGN_SCOPE_RE =
  /\b((in|for|across|to) (this |the )?(channel|group|team|thread)|here|in here|this (channel|group|team)|whole (?:channel|group|team)|entire (?:channel|group|team))\b/i;

/** "add a task for everyone in this group/channel" */
export function looksLikeChannelMassAssignQuery(text: string): boolean {
  const trimmed = stripSlackUserMentions(text);
  if (!trimmed) return false;
  if (!MASS_ASSIGN_RE.test(trimmed)) return false;
  // Require create/assign intent OR explicit "task for everyone"
  const createLike =
    looksLikeCreateWorkQuery(trimmed) ||
    /\b(task|to-?do|todo|work unit|action item)s?\b/i.test(trimmed);
  if (!createLike) return false;
  return MASS_ASSIGN_SCOPE_RE.test(trimmed) || /\beveryone\b/i.test(trimmed);
}

export function looksLikeSlackDmTaskCreate(text: string): boolean {
  if (looksLikeCreateWorkQuery(text)) return true;
  if (looksLikeChannelMassAssignQuery(text)) return true;
  const trimmed = stripSlackUserMentions(text);
  if (trimmed.length < 20) return false;
  if (looksLikeTaskListQuery(text)) return false;
  if (parseAttendanceMessage(trimmed)) return false;
  if (isAcceptAsIsConfirmReply(trimmed)) return false;
  if (CHIT_CHAT_RE.test(trimmed)) return false;
  return CREATE_ACTION_RE.test(trimmed);
}

export function looksLikeTaskListQuery(text: string): boolean {
  const trimmed = stripSlackUserMentions(text);
  if (!trimmed) return false;
  if (isAcceptAsIsConfirmReply(trimmed)) return false;
  if (parseAttendanceMessage(trimmed)) return false;
  // Never treat create dumps / "add these…" as a checklist query.
  if (looksLikeCreateWorkQuery(text)) return false;
  if (looksLikeBulkAssignedTaskList(trimmed)) return false;
  if (hasExplicitCreateIntent(trimmed)) return false;
  return TASKY_RE.test(trimmed) || ASK_TASKS_RE.test(trimmed);
}

function parseOrdinalDay(raw: string): number | null {
  const match = raw.trim().toLowerCase().match(/^(\d{1,2})(?:st|nd|rd|th)?$/);
  if (!match) return null;
  const day = Number(match[1]);
  if (day < 1 || day > 31) return null;
  return day;
}

function parseOneCalendarDay(raw: string, now: Date): CalendarDay | null {
  const text = raw.trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  const today = getZonedDateParts(now);

  if (text === "today") return today;
  if (text === "yesterday") return addCalendarDays(today, -1);
  if (text === "tomorrow") return addCalendarDays(today, 1);

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  }

  const dmy = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    return { year: Number(dmy[3]), month: Number(dmy[2]), day: Number(dmy[1]) };
  }

  const nthLastMonth = text.match(
    /^(\d{1,2}(?:st|nd|rd|th)?)\s+(?:of\s+)?(last|this|next)\s+month$/
  );
  if (nthLastMonth) {
    const dayNum = parseOrdinalDay(nthLastMonth[1]);
    if (!dayNum) return null;
    const delta = nthLastMonth[2] === "last" ? -1 : nthLastMonth[2] === "next" ? 1 : 0;
    const month = shiftMonth(today, delta);
    const max = lastDayOfMonth(month.year, month.month);
    return { ...month, day: Math.min(dayNum, max) };
  }

  const monthFirst = text.match(
    /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}(?:st|nd|rd|th)?)(?:\s+(\d{4}))?$/
  );
  if (monthFirst) {
    const month = MONTH_NAME[monthFirst[1]];
    const dayNum = parseOrdinalDay(monthFirst[2]);
    if (!month || !dayNum) return null;
    const year = monthFirst[3] ? Number(monthFirst[3]) : today.year;
    return { year, month, day: dayNum };
  }

  const dayFirst = text.match(
    /^(\d{1,2}(?:st|nd|rd|th)?)\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?$/
  );
  if (dayFirst) {
    const dayNum = parseOrdinalDay(dayFirst[1]);
    const month = MONTH_NAME[dayFirst[2]];
    if (!dayNum || !month) return null;
    const year = dayFirst[3] ? Number(dayFirst[3]) : today.year;
    return { year, month, day: dayNum };
  }

  return null;
}

function thisWeekBounds(now: Date): { start: CalendarDay; end: CalendarDay } {
  const today = getZonedDateParts(now);
  const weekday = zonedWeekday(now);
  const daysFromMonday = (weekday + 6) % 7;
  const start = addCalendarDays(today, -daysFromMonday);
  const end = addCalendarDays(start, 6);
  return { start, end };
}

export function parseTaskListDateRangeHeuristic(
  text: string,
  now: Date = new Date()
): SlackTaskDateRange | null {
  const lower = text.trim().toLowerCase().replace(/\s+/g, " ");
  const today = getZonedDateParts(now);

  const fromTo = lower.match(/\bfrom\s+(.+?)\s+to\s+(.+)$/);
  if (fromTo) {
    const start = parseOneCalendarDay(fromTo[1], now);
    const end = parseOneCalendarDay(fromTo[2], now);
    if (start && end) {
      const ordered =
        Date.UTC(start.year, start.month - 1, start.day) <=
        Date.UTC(end.year, end.month - 1, end.day)
          ? { start, end }
          : { start: end, end: start };
      return rangeForDays(
        ordered.start,
        ordered.end,
        formatRangeLabel(ordered.start, ordered.end)
      );
    }
  }

  if (/\b(by the end of this week|end of (this|the) week|th(?:is|si|s|ihs) week)\b/.test(lower)) {
    const { start, end } = thisWeekBounds(now);
    const from = /\b(by the end of this week|end of (this|the) week)\b/.test(lower)
      ? today
      : start;
    return rangeForDays(from, end, formatRangeLabel(from, end, "this week"));
  }

  if (/\blast week\b/.test(lower)) {
    const { start } = thisWeekBounds(now);
    const lastStart = addCalendarDays(start, -7);
    const lastEnd = addCalendarDays(lastStart, 6);
    return rangeForDays(lastStart, lastEnd, formatRangeLabel(lastStart, lastEnd, "last week"));
  }

  if (/\bnext week\b/.test(lower)) {
    const { start } = thisWeekBounds(now);
    const nextStart = addCalendarDays(start, 7);
    const nextEnd = addCalendarDays(nextStart, 6);
    return rangeForDays(nextStart, nextEnd, formatRangeLabel(nextStart, nextEnd, "next week"));
  }

  if (
    /\blast month\b/.test(lower) &&
    !/\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?last\s+month/.test(lower)
  ) {
    const month = shiftMonth(today, -1);
    const endDay = lastDayOfMonth(month.year, month.month);
    const start = { ...month, day: 1 };
    const end = { ...month, day: endDay };
    return rangeForDays(start, end, formatRangeLabel(start, end, "last month"));
  }

  if (/\bthis month\b/.test(lower)) {
    const start = { ...today, day: 1 };
    const end = { ...today, day: lastDayOfMonth(today.year, today.month) };
    return rangeForDays(start, end, formatRangeLabel(start, end, "this month"));
  }

  if (/\byesterday\b/.test(lower)) {
    const day = addCalendarDays(today, -1);
    return rangeForDays(day, day, formatRangeLabel(day, day, "yesterday"));
  }
  if (/\btomorrow\b/.test(lower)) {
    const day = addCalendarDays(today, 1);
    return rangeForDays(day, day, formatRangeLabel(day, day, "tomorrow"));
  }
  if (/\btoday\b/.test(lower)) {
    return rangeForDays(today, today, formatRangeLabel(today, today, "today"));
  }

  const nth = lower.match(
    /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:last|this|next)\s+month)\b/
  );
  if (nth) {
    const day = parseOneCalendarDay(nth[1], now);
    if (day) return rangeForDays(day, day, formatRangeLabel(day, day));
  }

  const named = lower.match(
    /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+\d{4})?|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+\d{4})?)\b/
  );
  if (named) {
    const day = parseOneCalendarDay(named[1], now);
    if (day) return rangeForDays(day, day, formatRangeLabel(day, day));
  }

  return null;
}

function todayRange(now: Date): SlackTaskDateRange {
  const today = getZonedDateParts(now);
  return rangeForDays(today, today, formatRangeLabel(today, today, "today"));
}

function isValidYmd(value: string): CalendarDay | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

async function parseTaskListDateRangeWithLlm(
  text: string,
  now: Date
): Promise<SlackTaskDateRange | null> {
  if (!isWorkExtractionAiConfigured()) return null;

  const today = getZonedDateParts(now);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: env.appTimezone,
    weekday: "long"
  }).format(now);

  const systemPrompt =
    "You parse Slack DMs that ask a user for their own work tasks. Return STRICT JSON only: " +
    '{ "isTaskList": boolean, "from": "YYYY-MM-DD"|null, "to": "YYYY-MM-DD"|null, "label": string }. ' +
    "isTaskList is true only if they want a list of their tasks/todos/deadlines/work units. " +
    "If no date is mentioned, from and to must both be today's date. " +
    "Resolve relative dates using the provided current date in Asia/Kolkata. " +
    "Weeks are Monday–Sunday. 'end of this week' means today through Sunday. " +
    "'last month' is the full previous calendar month. Ranges are inclusive.";

  const userPrompt =
    `Current date-time: ${now.toISOString()} (${weekday}, ${formatDayLabel(today)}, Asia/Kolkata)\n\n` +
    `Slack DM:\n"""${text}"""`;

  const raw = await callWorkLlm(systemPrompt, userPrompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]) as {
    isTaskList?: boolean;
    from?: string | null;
    to?: string | null;
    label?: string | null;
  };

  if (parsed.isTaskList === false) return null;

  const fromDay = isValidYmd(parsed.from ?? "") ?? today;
  const toDay = isValidYmd(parsed.to ?? "") ?? fromDay;
  const ordered =
    Date.UTC(fromDay.year, fromDay.month - 1, fromDay.day) <=
    Date.UTC(toDay.year, toDay.month - 1, toDay.day)
      ? { start: fromDay, end: toDay }
      : { start: toDay, end: fromDay };

  const maxDays = 93;
  const spanDays =
    Math.round(
      (Date.UTC(ordered.end.year, ordered.end.month - 1, ordered.end.day) -
        Date.UTC(ordered.start.year, ordered.start.month - 1, ordered.start.day)) /
        86_400_000
    ) + 1;
  const end = spanDays > maxDays ? addCalendarDays(ordered.start, maxDays - 1) : ordered.end;
  const hint = parsed.label?.trim() || undefined;
  return rangeForDays(ordered.start, end, formatRangeLabel(ordered.start, end, hint));
}

export async function resolveSlackTaskListQuery(
  text: string,
  now: Date = new Date(),
  options?: { force?: boolean }
): Promise<SlackTaskListQuery | null> {
  if (!options?.force && !looksLikeTaskListQuery(text)) return null;

  const cleaned = stripSlackUserMentions(text);
  const heuristic = parseTaskListDateRangeHeuristic(cleaned, now);

  try {
    const llm = await parseTaskListDateRangeWithLlm(cleaned, now);
    if (llm) return { isTaskList: true, range: llm, source: "llm" };
  } catch (error) {
    console.warn("[work.slack-tasks] date parse LLM failed, using heuristic", {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  if (heuristic) return { isTaskList: true, range: heuristic, source: "heuristic" };
  return { isTaskList: true, range: todayRange(now), source: "default" };
}

export function rangeIncludesToday(range: SlackTaskDateRange, now: Date = new Date()): boolean {
  const start = startOfDayInTimezone(now).getTime();
  const end = endOfDayInTimezone(now).getTime();
  return range.from.getTime() <= end && range.to.getTime() >= start;
}

function inRange(value: Date | null | undefined, from: Date, to: Date): boolean {
  if (!value) return false;
  const ms = value.getTime();
  return ms >= from.getTime() && ms <= to.getTime();
}

export type SlackTaskListItem = {
  id: string;
  title: string;
  status: "pending" | "completed";
  dueAt: Date | null;
  closedAt: Date | null;
  overdue: boolean;
  steps: Array<{ description: string; done: boolean; deadline: Date | null }>;
};

export function classifyWorkUnitsForTaskList(input: {
  userId: string;
  from: Date;
  to: Date;
  includeOverdue: boolean;
  units: Array<{
    id: string;
    title: string;
    status: string;
    userId: string;
    closedAt: Date | null;
    createdAt: Date;
    nextDueAt: Date | null;
    firstDueAt: Date | null;
    steps: Array<{
      description: string;
      done: boolean;
      deadline: Date | null;
      assigneeId: string | null;
    }>;
  }>;
}): { pending: SlackTaskListItem[]; completed: SlackTaskListItem[] } {
  const pending: SlackTaskListItem[] = [];
  const completed: SlackTaskListItem[] = [];

  for (const unit of input.units) {
    const relevantSteps = unit.steps.filter(
      (step) =>
        unit.userId === input.userId ||
        step.assigneeId === input.userId ||
        (!step.assigneeId && unit.userId === input.userId)
    );
    const steps = relevantSteps.length > 0 ? relevantSteps : unit.steps;

    const dueSteps = steps.filter((step) => {
      const due = implicitWorkDeadline(step.deadline, unit.createdAt);
      if (inRange(due, input.from, input.to)) return true;
      if (input.includeOverdue && !step.done && due.getTime() < input.from.getTime()) {
        return true;
      }
      return false;
    });

    const implicitUnitDue = implicitWorkDeadline(
      unit.nextDueAt ?? unit.firstDueAt,
      unit.createdAt
    );
    const unitDueInRange =
      inRange(unit.nextDueAt, input.from, input.to) ||
      inRange(unit.firstDueAt, input.from, input.to) ||
      (unit.nextDueAt == null &&
        unit.firstDueAt == null &&
        inRange(implicitUnitDue, input.from, input.to));
    const overdueOpen =
      input.includeOverdue &&
      unit.status === "OPEN" &&
      implicitUnitDue.getTime() < input.from.getTime();

    if (dueSteps.length === 0 && !unitDueInRange && !overdueOpen) continue;

    const pendingSteps = dueSteps.filter((step) => !step.done);
    const completedSteps = dueSteps.filter((step) => step.done);
    const dueAt =
      implicitWorkDeadline(
        pendingSteps.find((step) => step.deadline)?.deadline ??
          completedSteps.find((step) => step.deadline)?.deadline ??
          unit.nextDueAt ??
          unit.firstDueAt ??
          null,
        unit.createdAt
      );

    const stillPending =
      pendingSteps.length > 0 ||
      (dueSteps.length === 0 && unit.status === "OPEN" && (unitDueInRange || overdueOpen));

    const item: SlackTaskListItem = {
      id: unit.id,
      title: unit.title,
      status: stillPending ? "pending" : "completed",
      dueAt,
      closedAt: unit.closedAt,
      overdue: stillPending && isWorkDeadlineOverdue(dueAt),
      steps: dueSteps.map((step) => ({
        description: step.description,
        done: step.done,
        deadline: implicitWorkDeadline(step.deadline, unit.createdAt)
      }))
    };

    if (stillPending) pending.push(item);
    else completed.push(item);
  }

  pending.sort((a, b) => (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER));
  completed.sort((a, b) => (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER));
  return { pending, completed };
}

function escapeSlackMrkdwn(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDue(value: Date | null): string {
  if (!value) return "no due date";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: env.appTimezone,
    day: "numeric",
    month: "short"
  }).format(value);
}

function formatItem(item: SlackTaskListItem, link: string): string {
  const title = escapeSlackMrkdwn(item.title);
  const due = item.overdue
    ? `overdue · due ${formatDue(item.dueAt)}`
    : `due ${formatDue(item.dueAt)}`;
  const head = link ? `• *<${link}|${title}>* — ${due}` : `• *${title}* — ${due}`;
  const steps = item.steps
    .slice(0, 4)
    .map((step) => {
      const mark = step.done ? "✓" : "○";
      return `    ${mark} ${escapeSlackMrkdwn(step.description.slice(0, 120))}`;
    });
  const extra =
    item.steps.length > 4 ? [`    … +${item.steps.length - 4} more steps`] : [];
  return [head, ...steps, ...extra].join("\n");
}

export function formatSlackTaskListMessage(input: {
  range: SlackTaskDateRange;
  pending: SlackTaskListItem[];
  completed: SlackTaskListItem[];
  appUrl?: string;
  ownerName?: string;
}): string {
  const pendingShown = input.pending.slice(0, 20);
  const completedShown = input.completed.slice(0, 20);
  const linkFor = (id: string) =>
    input.appUrl ? `${input.appUrl.replace(/\/$/, "")}/work/${id}` : "";
  const heading = input.ownerName
    ? `${escapeSlackMrkdwn(input.ownerName)}'s tasks by due date`
    : "Your tasks by due date";

  const lines = [
    `*${heading} · ${escapeSlackMrkdwn(input.range.label)}*`,
    "",
    `*Pending (${input.pending.length})*`
  ];

  if (pendingShown.length === 0) {
    lines.push("_None._");
  } else {
    for (const item of pendingShown) {
      lines.push(formatItem(item, linkFor(item.id)));
    }
    if (input.pending.length > pendingShown.length) {
      lines.push(`_…and ${input.pending.length - pendingShown.length} more pending._`);
    }
  }

  lines.push("", `*Completed (${input.completed.length})*`);
  if (completedShown.length === 0) {
    lines.push("_None._");
  } else {
    for (const item of completedShown) {
      lines.push(formatItem(item, linkFor(item.id)));
    }
    if (input.completed.length > completedShown.length) {
      lines.push(`_…and ${input.completed.length - completedShown.length} more completed._`);
    }
  }

  const text = lines.join("\n");
  if (text.length <= 3500) return text;
  return `${text.slice(0, 3400)}\n_…truncated._`;
}

export const SLACK_WORK_COMPLETE_ACTION = "work_complete";
const SLACK_TASK_LIST_META_PREFIX = "tl:";
const SLACK_CHECKLIST_PENDING_CAP = 18;
const SLACK_CHECKLIST_COMPLETED_CAP = 12;

export type SlackTaskListMeta = {
  fromMs: number;
  toMs: number;
  userId: string;
  includeOverdue: boolean;
};

export function encodeSlackTaskListMeta(meta: SlackTaskListMeta): string {
  return `${SLACK_TASK_LIST_META_PREFIX}${meta.fromMs}:${meta.toMs}:${meta.userId}:${meta.includeOverdue ? 1 : 0}`;
}

export function parseSlackTaskListMeta(blockId: string | undefined): SlackTaskListMeta | null {
  if (!blockId?.startsWith(SLACK_TASK_LIST_META_PREFIX)) return null;
  const parts = blockId.slice(SLACK_TASK_LIST_META_PREFIX.length).split(":");
  if (parts.length < 4) return null;
  const fromMs = Number(parts[0]);
  const toMs = Number(parts[1]);
  const userId = parts[2];
  const includeOverdue = parts[3] === "1";
  if (!userId || Number.isNaN(fromMs) || Number.isNaN(toMs)) return null;
  return { fromMs, toMs, userId, includeOverdue };
}

function checkboxLabel(item: SlackTaskListItem): string {
  const due = item.overdue ? `overdue · ${formatDue(item.dueAt)}` : `due ${formatDue(item.dueAt)}`;
  const raw = `${item.title} — ${due}`;
  return raw.length <= 75 ? raw : `${raw.slice(0, 72)}...`;
}

export function formatSlackTaskListBlocks(input: {
  range: SlackTaskDateRange;
  pending: SlackTaskListItem[];
  completed: SlackTaskListItem[];
  appUrl?: string;
  ownerName?: string;
  listUserId: string;
  includeOverdue: boolean;
  /**
   * When true (default), pending tasks render as interactive checkboxes.
   * When false (viewing someone else's list), render a plain read-only list.
   */
  interactive?: boolean;
}): { text: string; blocks: Array<Record<string, unknown>> } {
  const interactive = input.interactive !== false;
  const text = formatSlackTaskListMessage(input);
  const heading = input.ownerName
    ? `${input.ownerName}'s tasks by due date`
    : "Your tasks by due date";
  const pendingShown = input.pending.slice(0, SLACK_CHECKLIST_PENDING_CAP);
  const completedShown = input.completed.slice(0, SLACK_CHECKLIST_COMPLETED_CAP);
  const blocks: Array<Record<string, unknown>> = [
    {
      type: "section",
      block_id: encodeSlackTaskListMeta({
        fromMs: input.range.from.getTime(),
        toMs: input.range.to.getTime(),
        userId: input.listUserId,
        includeOverdue: input.includeOverdue
      }),
      text: {
        type: "mrkdwn",
        text: `*${escapeSlackMrkdwn(heading)} · ${escapeSlackMrkdwn(input.range.label)}*`
      }
    }
  ];

  if (interactive) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: "Check a box to mark that task done in Bran." }]
    });
  }

  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: `*Pending (${input.pending.length})*` }
  });

  if (pendingShown.length === 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "_None._" }
    });
  } else if (interactive) {
    for (const item of pendingShown) {
      blocks.push({
        type: "actions",
        block_id: `wu:${item.id}`,
        elements: [
          {
            type: "checkboxes",
            action_id: SLACK_WORK_COMPLETE_ACTION,
            options: [
              {
                text: { type: "plain_text", text: checkboxLabel(item), emoji: true },
                value: item.id
              }
            ]
          }
        ]
      });
    }
    if (input.pending.length > pendingShown.length) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_…and ${input.pending.length - pendingShown.length} more pending. Ask for a narrower date._`
          }
        ]
      });
    }
  } else {
    const linkFor = (id: string) =>
      input.appUrl ? `${input.appUrl.replace(/\/$/, "")}/work/${id}` : "";
    const lines = pendingShown.map((item) => {
      const due = item.overdue
        ? `overdue · due ${formatDue(item.dueAt)}`
        : `due ${formatDue(item.dueAt)}`;
      const title = escapeSlackMrkdwn(item.title);
      const link = linkFor(item.id);
      return link ? `• *<${link}|${title}>* — ${due}` : `• *${title}* — ${due}`;
    });
    if (input.pending.length > pendingShown.length) {
      lines.push(
        `_…and ${input.pending.length - pendingShown.length} more pending. Ask for a narrower date._`
      );
    }
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: lines.join("\n") }
    });
  }

  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: `*Completed (${input.completed.length})*` }
  });

  if (completedShown.length === 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "_None._" }
    });
  } else {
    const lines = completedShown.map((item) => {
      const due = `due ${formatDue(item.dueAt)}`;
      return `• ~${escapeSlackMrkdwn(item.title)}~ — ${due}`;
    });
    if (input.completed.length > completedShown.length) {
      lines.push(`_…and ${input.completed.length - completedShown.length} more completed._`);
    }
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: lines.join("\n") }
    });
  }

  return { text, blocks };
}
