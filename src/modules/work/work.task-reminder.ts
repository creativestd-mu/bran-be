import { env } from "../../config/env";
import { lookupSlackUserByEmail, sendDmWithBlocks } from "../attendance/attendance.slack";
import { implicitWorkDeadline, isWorkDeadlineOverdue } from "./work.due-fields";
import {
  findOpenWorkUnitsForReminder,
  listActiveUsersWithOpenWorkUnits
} from "./work.repository";
import {
  SLACK_WORK_COMPLETE_ACTION,
  formatSlackTaskListBlocks,
  type SlackTaskListItem
} from "./work.slack-tasks";

export const TASK_REMINDER_MAX_SHOWN = 10;

/** Wide range so checklist refresh after check-off reloads all open units. */
export const TASK_REMINDER_RANGE = {
  from: new Date(0),
  to: new Date("2099-12-31T23:59:59.999Z"),
  label: "all open"
} as const;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function attendanceDmAllowlist(): string[] {
  return env.attendanceDmAllowlist
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function attendanceDmAllowed(email: string | null | undefined): boolean {
  const allowlist = attendanceDmAllowlist();
  if (allowlist.length === 0) return true;
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
}

export function currentIstDate(from: Date = new Date()): string {
  const ist = new Date(from.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ist.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Next occurrence of the configured IST hour (every day, including weekends). */
export function nextTaskReminderAt(
  from: Date = new Date(),
  hourIst: number = env.taskReminderHourIst
): Date {
  const istNow = new Date(from.getTime() + IST_OFFSET_MS);
  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth();
  const day = istNow.getUTCDate();

  let candidate = new Date(Date.UTC(year, month, day, hourIst, 0, 0, 0) - IST_OFFSET_MS);
  if (candidate.getTime() <= from.getTime()) {
    const tomorrowIst = new Date(istNow.getTime() + 24 * 60 * 60 * 1000);
    candidate = new Date(
      Date.UTC(
        tomorrowIst.getUTCFullYear(),
        tomorrowIst.getUTCMonth(),
        tomorrowIst.getUTCDate(),
        hourIst,
        0,
        0,
        0
      ) - IST_OFFSET_MS
    );
  }
  return candidate;
}

export function toReminderTaskListItems(
  units: Array<{
    id: string;
    title: string;
    nextDueAt: Date | null;
    firstDueAt: Date | null;
    createdAt: Date;
  }>,
  now: Date
): SlackTaskListItem[] {
  return units.map((unit) => {
    const dueAt = implicitWorkDeadline(unit.nextDueAt ?? unit.firstDueAt, unit.createdAt);
    return {
      id: unit.id,
      title: unit.title,
      status: "pending" as const,
      dueAt,
      closedAt: null,
      overdue: isWorkDeadlineOverdue(dueAt, now),
      steps: []
    };
  });
}

export function buildPendingTasksReminderMessage(input: {
  userId: string;
  name: string;
  pending: SlackTaskListItem[];
  totalCount: number;
  appUrl?: string;
}): { text: string; blocks: Array<Record<string, unknown>> } {
  const firstName = input.name.trim().split(/\s+/)[0] || input.name;
  const heading =
    input.totalCount === 1
      ? `Hey ${firstName} 👋 You have 1 pending task`
      : `Hey ${firstName} 👋 You have ${input.totalCount} pending tasks`;

  const appUrl = input.appUrl ?? env.appUrl;
  const { text, blocks } = formatSlackTaskListBlocks({
    range: { ...TASK_REMINDER_RANGE },
    pending: input.pending.slice(0, TASK_REMINDER_MAX_SHOWN),
    completed: [],
    appUrl,
    listUserId: input.userId,
    includeOverdue: true,
    interactive: true,
    pendingCap: TASK_REMINDER_MAX_SHOWN,
    pendingTotal: input.totalCount,
    hideCompleted: true,
    headingOverride: heading,
    mode: "reminder"
  });

  const base = (appUrl || "https://bran.cohesivity.app").replace(/\/$/, "");
  const fallback = `${heading}. Check a box in Slack to mark done, or open ${base}/work`;

  return { text: fallback || text, blocks };
}

export async function sendPendingTasksReminderDm(input: {
  userId: string;
  email: string;
  name: string;
  pending: SlackTaskListItem[];
  totalCount: number;
}): Promise<boolean> {
  if (!env.slackBotToken || input.pending.length === 0) return false;

  const slackUser = await lookupSlackUserByEmail(input.email);
  if (!slackUser?.id) return false;

  const { text, blocks } = buildPendingTasksReminderMessage({
    userId: input.userId,
    name: input.name,
    pending: input.pending,
    totalCount: input.totalCount
  });
  await sendDmWithBlocks(slackUser.id, text, blocks);
  return true;
}

/** In-process guard so we only send one batch per IST calendar day. */
let lastSentDateIst: string | null = null;

export function resetTaskReminderSentDateForTests(): void {
  lastSentDateIst = null;
}

export async function runPendingTaskReminders(now: Date = new Date()): Promise<{
  dateIst: string;
  candidates: number;
  sent: number;
  skippedAllowlist: number;
  skippedNoSlack: number;
  skippedEmpty: number;
  errors: number;
  skippedAlreadySent: boolean;
}> {
  const dateIst = currentIstDate(now);
  if (lastSentDateIst === dateIst) {
    return {
      dateIst,
      candidates: 0,
      sent: 0,
      skippedAllowlist: 0,
      skippedNoSlack: 0,
      skippedEmpty: 0,
      errors: 0,
      skippedAlreadySent: true
    };
  }

  if (!env.taskReminderEnabled) {
    return {
      dateIst,
      candidates: 0,
      sent: 0,
      skippedAllowlist: 0,
      skippedNoSlack: 0,
      skippedEmpty: 0,
      errors: 0,
      skippedAlreadySent: false
    };
  }

  const users = await listActiveUsersWithOpenWorkUnits();
  let sent = 0;
  let skippedAllowlist = 0;
  let skippedNoSlack = 0;
  let skippedEmpty = 0;
  let errors = 0;

  for (const user of users) {
    if (!attendanceDmAllowed(user.email)) {
      skippedAllowlist += 1;
      continue;
    }
    try {
      const units = await findOpenWorkUnitsForReminder(user.id, TASK_REMINDER_MAX_SHOWN);
      if (units.length === 0) {
        skippedEmpty += 1;
        continue;
      }
      const pending = toReminderTaskListItems(units, now);
      const ok = await sendPendingTasksReminderDm({
        userId: user.id,
        email: user.email,
        name: user.name,
        pending,
        totalCount: user.pendingCount
      });
      if (ok) {
        sent += 1;
      } else {
        skippedNoSlack += 1;
      }
    } catch (error) {
      errors += 1;
      console.error(`[task-reminders] Failed for ${user.email}:`, error);
    }
  }

  lastSentDateIst = dateIst;

  return {
    dateIst,
    candidates: users.length,
    sent,
    skippedAllowlist,
    skippedNoSlack,
    skippedEmpty,
    errors,
    skippedAlreadySent: false
  };
}

/** Exported for tests — confirms checklist action wiring. */
export function reminderUsesChecklistAction(): string {
  return SLACK_WORK_COMPLETE_ACTION;
}
