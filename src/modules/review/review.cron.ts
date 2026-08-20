import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { runReviewReminders } from "./review.service";

const POLL_INTERVAL_MS = 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) return;
  if (!env.slackBotToken) {
    return;
  }
  if (!env.reviewRemindersEnabled) {
    return;
  }

  running = true;
  try {
    const result = await runReviewReminders();
    if (result.candidates > 0 || result.sent > 0) {
      console.log("[review-reminders]", JSON.stringify(result));
    }
  } catch (error) {
    console.error("[review-reminders] tick failed:", error);
  } finally {
    running = false;
  }
}

export function startReviewReminderCron(): void {
  if (!env.reviewRemindersCronEnabled) {
    console.log("[review-reminders] Disabled (REVIEW_REMINDERS_CRON_ENABLED=false)");
    return;
  }
  if (env.nodeEnv === "test") {
    return;
  }

  console.log(
    `[review-reminders] Polling every ${POLL_INTERVAL_MS / 1000}s for IST reminder slots`
  );
  timer = setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);

  if (typeof timer === "object" && timer && "unref" in timer) {
    timer.unref();
  }
}

export function stopReviewReminderCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** GET /api/cron/review-reminders */
export async function reviewRemindersCronHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!env.cronSecret || header !== `Bearer ${env.cronSecret}`) {
      throw new HttpError(401, "Unauthorized cron request");
    }
    const result = await runReviewReminders();
    res.status(200).json({
      success: true,
      data: {
        ...result,
        remindersEnabled: env.reviewRemindersEnabled
      }
    });
  } catch (error) {
    next(error);
  }
}
