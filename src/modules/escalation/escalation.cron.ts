import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { ESCALATION_CRON_HOUR_IST } from "./escalation.constants";
import { runEscalationDailyCheck } from "./escalation.service";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Next 10:00 AM IST as a UTC Date. */
export function nextEscalationCheckAt(from: Date = new Date()): Date {
  const istNow = new Date(from.getTime() + IST_OFFSET_MS);
  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth();
  const day = istNow.getUTCDate();

  let candidate = new Date(
    Date.UTC(year, month, day, ESCALATION_CRON_HOUR_IST, 0, 0, 0) - IST_OFFSET_MS
  );

  if (candidate.getTime() <= from.getTime()) {
    const tomorrowIst = new Date(istNow.getTime() + 24 * 60 * 60 * 1000);
    candidate = new Date(
      Date.UTC(
        tomorrowIst.getUTCFullYear(),
        tomorrowIst.getUTCMonth(),
        tomorrowIst.getUTCDate(),
        ESCALATION_CRON_HOUR_IST,
        0,
        0,
        0
      ) - IST_OFFSET_MS
    );
  }

  return candidate;
}

let timer: ReturnType<typeof setTimeout> | null = null;

async function runScheduledCheck(): Promise<void> {
  if (!env.slackBotToken) {
    console.warn("[escalation-cron] Skipping — SLACK_BOT_TOKEN not configured");
    return;
  }

  try {
    const result = await runEscalationDailyCheck(30);
    console.log(
      `[escalation-cron] Daily check complete:`,
      JSON.stringify({
        analyzed: result.analyzed,
        autoClosed: result.autoClosed,
        syncEscalations: result.sync.escalations,
        syncUpdates: result.sync.updates,
        errors: result.errors.length
      })
    );
  } catch (error) {
    console.error("[escalation-cron] Daily check failed:", error);
  }
}

function scheduleNext(): void {
  const next = nextEscalationCheckAt();
  const delay = Math.max(next.getTime() - Date.now(), 1000);
  console.log(
    `[escalation-cron] Next check at ${next.toISOString()} (in ${Math.round(delay / 1000)}s)`
  );

  timer = setTimeout(() => {
    void runScheduledCheck().finally(() => {
      scheduleNext();
    });
  }, delay);

  if (typeof timer === "object" && timer && "unref" in timer) {
    timer.unref();
  }
}

export function startEscalationCron(): void {
  if (!env.escalationCronEnabled) {
    console.log("[escalation-cron] Disabled (ESCALATION_CRON_ENABLED=false)");
    return;
  }
  if (env.nodeEnv === "test") {
    return;
  }

  scheduleNext();
}

export function stopEscalationCron(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** GET /api/cron/escalation-check — daily Slack sync + AI refresh (Bearer CRON_SECRET). */
export async function escalationCronHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!env.cronSecret) {
      throw new HttpError(500, "CRON_SECRET is not configured");
    }
    if (header !== `Bearer ${env.cronSecret}`) {
      throw new HttpError(401, "Unauthorized cron request");
    }

    const result = await runEscalationDailyCheck(30);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
