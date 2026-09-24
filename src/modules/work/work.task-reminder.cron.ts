import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { nextTaskReminderAt, runPendingTaskReminders } from "./work.task-reminder";

let timer: ReturnType<typeof setTimeout> | null = null;

async function runScheduledReminders(): Promise<void> {
  if (!env.slackBotToken) {
    console.warn("[task-reminders] Skipping — SLACK_BOT_TOKEN not configured");
    return;
  }
  if (!env.taskReminderEnabled) {
    console.log("[task-reminders] Skipped — TASK_REMINDER_ENABLED=false");
    return;
  }

  try {
    const result = await runPendingTaskReminders();
    console.log("[task-reminders]", JSON.stringify(result));
  } catch (error) {
    console.error("[task-reminders] run failed:", error);
  }
}

function scheduleNext(): void {
  const next = nextTaskReminderAt();
  const delay = Math.max(next.getTime() - Date.now(), 1000);
  console.log(
    `[task-reminders] Next run at ${next.toISOString()} (in ${Math.round(delay / 1000)}s, ${env.taskReminderHourIst}:00 IST)`
  );

  timer = setTimeout(() => {
    void runScheduledReminders().finally(() => {
      scheduleNext();
    });
  }, delay);

  if (typeof timer === "object" && timer && "unref" in timer) {
    timer.unref();
  }
}

export function startTaskReminderCron(): void {
  if (!env.taskReminderCronEnabled) {
    console.log("[task-reminders] Disabled (TASK_REMINDER_CRON_ENABLED=false)");
    return;
  }
  if (env.nodeEnv === "test") {
    return;
  }

  scheduleNext();
}

export function stopTaskReminderCron(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** GET /api/cron/task-reminders — manual/force run (Bearer CRON_SECRET). */
export async function taskRemindersCronHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!env.cronSecret || header !== `Bearer ${env.cronSecret}`) {
      throw new HttpError(401, "Unauthorized cron request");
    }
    const force = String(req.query.force ?? "").toLowerCase() === "true";
    if (force) {
      const { resetTaskReminderSentDateForTests } = await import("./work.task-reminder.js");
      resetTaskReminderSentDateForTests();
    }
    const result = await runPendingTaskReminders();
    res.status(200).json({
      success: true,
      data: {
        ...result,
        remindersEnabled: env.taskReminderEnabled,
        hourIst: env.taskReminderHourIst
      }
    });
  } catch (error) {
    next(error);
  }
}
