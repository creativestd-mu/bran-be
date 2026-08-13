import { env } from "../../config/env";
import {
  endOfDayInTimezone,
  getZonedDateParts,
  startOfDayInTimezone,
  wallClockToUtc
} from "../../utils/timezone";
import { parseAttendanceMessage } from "../attendance/attendance.parser";
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

export function stripSlackUserMentions(text: string): string {
  return text.replace(SLACK_USER_MENTION_RE, " ").replace(/\s+/g, " ").trim();
}

export function textMentionsSlackUser(text: string, slackUserId: string): boolean {
  if (!slackUserId) return false;
  const escaped = slackUserId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<@${escaped}(?:\\|[^>]+)?>`, "i").test(text);
}

export function looksLikeTaskListQuery(text: string): boolean {
  const trimmed = stripSlackUserMentions(text);
  if (!trimmed) return false;
  if (isAcceptAsIsConfirmReply(trimmed)) return false;
  if (parseAttendanceMessage(trimmed)) return false;
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

  if (/\b(by the end of this week|end of (this|the) week|this week)\b/.test(lower)) {
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
  now: Date = new Date()
): Promise<SlackTaskListQuery | null> {
  if (!looksLikeTaskListQuery(text)) return null;

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
  includeUndatedOpen: boolean;
  units: Array<{
    id: string;
    title: string;
    status: string;
    userId: string;
    closedAt: Date | null;
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

    const dueInRange = steps.some((step) => inRange(step.deadline, input.from, input.to));
    const closedInRange = inRange(unit.closedAt, input.from, input.to);
    const nextDueInRange = inRange(unit.nextDueAt, input.from, input.to);
    const firstDueInRange = inRange(unit.firstDueAt, input.from, input.to);
    const overdueOpen =
      input.includeOverdue &&
      unit.status === "OPEN" &&
      Boolean(unit.nextDueAt && unit.nextDueAt.getTime() < input.from.getTime());
    const undatedOpen =
      input.includeUndatedOpen &&
      unit.status === "OPEN" &&
      !unit.nextDueAt &&
      !unit.firstDueAt &&
      steps.every((step) => !step.deadline);

    const relevant =
      dueInRange || closedInRange || nextDueInRange || firstDueInRange || overdueOpen || undatedOpen;
    if (!relevant) continue;

    const pendingSteps = steps.filter((step) => {
      if (step.done) return false;
      if (inRange(step.deadline, input.from, input.to)) return true;
      if (
        input.includeOverdue &&
        step.deadline &&
        step.deadline.getTime() < input.from.getTime()
      ) {
        return true;
      }
      if (input.includeUndatedOpen && !step.deadline) return true;
      return false;
    });
    const completedSteps = steps.filter(
      (step) => step.done && (inRange(step.deadline, input.from, input.to) || closedInRange)
    );

    const isCompletedUnit =
      unit.status === "CLOSED" && (closedInRange || dueInRange || firstDueInRange);

    if (isCompletedUnit || (pendingSteps.length === 0 && completedSteps.length > 0 && unit.status === "CLOSED")) {
      completed.push({
        id: unit.id,
        title: unit.title,
        status: "completed",
        dueAt: unit.firstDueAt ?? steps.find((step) => step.deadline)?.deadline ?? null,
        closedAt: unit.closedAt,
        overdue: false,
        steps: completedSteps.map((step) => ({
          description: step.description,
          done: true,
          deadline: step.deadline
        }))
      });
      continue;
    }

    if (unit.status === "OPEN" && (pendingSteps.length > 0 || overdueOpen || undatedOpen || dueInRange || nextDueInRange)) {
      pending.push({
        id: unit.id,
        title: unit.title,
        status: "pending",
        dueAt: unit.nextDueAt ?? pendingSteps.find((step) => step.deadline)?.deadline ?? null,
        closedAt: null,
        overdue: overdueOpen || Boolean(unit.nextDueAt && unit.nextDueAt.getTime() < Date.now()),
        steps: [...pendingSteps, ...completedSteps].map((step) => ({
          description: step.description,
          done: step.done,
          deadline: step.deadline
        }))
      });
    }

    if (unit.status === "OPEN" && completedSteps.length > 0 && pendingSteps.length === 0 && !overdueOpen && !undatedOpen) {
      completed.push({
        id: unit.id,
        title: unit.title,
        status: "completed",
        dueAt: unit.firstDueAt,
        closedAt: unit.closedAt,
        overdue: false,
        steps: completedSteps.map((step) => ({
          description: step.description,
          done: true,
          deadline: step.deadline
        }))
      });
    }
  }

  pending.sort((a, b) => (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER));
  completed.sort((a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0));
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
  const due = item.status === "completed"
    ? item.closedAt
      ? `closed ${formatDue(item.closedAt)}`
      : "completed"
    : item.overdue
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
}): string {
  const pendingShown = input.pending.slice(0, 20);
  const completedShown = input.completed.slice(0, 20);
  const linkFor = (id: string) =>
    input.appUrl ? `${input.appUrl.replace(/\/$/, "")}/work/${id}` : "";

  const lines = [
    `*Your tasks · ${escapeSlackMrkdwn(input.range.label)}*`,
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
