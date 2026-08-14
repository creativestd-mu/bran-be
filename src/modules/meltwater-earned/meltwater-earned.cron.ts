import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { MELTWATER_EARNED_CRON_HOUR_IST } from "./meltwater-earned.constants";
import { syncEarnedMentions } from "./meltwater-earned.service";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function nextEarnedSyncAt(from: Date = new Date()): Date {
  const istNow = new Date(from.getTime() + IST_OFFSET_MS);
  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth();
  const day = istNow.getUTCDate();

  let candidate = new Date(
    Date.UTC(year, month, day, MELTWATER_EARNED_CRON_HOUR_IST, 0, 0, 0) - IST_OFFSET_MS
  );

  if (candidate.getTime() <= from.getTime()) {
    const tomorrowIst = new Date(istNow.getTime() + 24 * 60 * 60 * 1000);
    candidate = new Date(
      Date.UTC(
        tomorrowIst.getUTCFullYear(),
        tomorrowIst.getUTCMonth(),
        tomorrowIst.getUTCDate(),
        MELTWATER_EARNED_CRON_HOUR_IST,
        0,
        0,
        0
      ) - IST_OFFSET_MS
    );
  }

  return candidate;
}

let timer: ReturnType<typeof setTimeout> | null = null;

async function runScheduledSync(): Promise<void> {
  if (!env.meltwaterApiKey || env.meltwaterSearchIds.length === 0) {
    console.warn("[meltwater-earned-cron] Skipping — API key or MELTWATER_SEARCH_IDS missing");
    return;
  }

  try {
    const result = await syncEarnedMentions({
      from: new Date(Date.now() - env.meltwaterEarnedLookbackDays * 24 * 60 * 60 * 1000).toISOString()
    });
    console.log("[meltwater-earned-cron] Daily sync complete:", JSON.stringify(result));
  } catch (error) {
    console.error("[meltwater-earned-cron] Daily sync failed:", error);
  }
}

function scheduleNext(): void {
  const next = nextEarnedSyncAt();
  const delay = Math.max(next.getTime() - Date.now(), 1000);
  console.log(
    `[meltwater-earned-cron] Next sync at ${next.toISOString()} (in ${Math.round(delay / 1000)}s)`
  );

  timer = setTimeout(() => {
    void runScheduledSync().finally(() => {
      scheduleNext();
    });
  }, delay);

  if (typeof timer === "object" && timer && "unref" in timer) {
    timer.unref();
  }
}

export function startMeltwaterEarnedCron(): void {
  if (!env.meltwaterEarnedCronEnabled) {
    console.log("[meltwater-earned-cron] Disabled (MELTWATER_EARNED_CRON_ENABLED=false)");
    return;
  }
  if (env.nodeEnv === "test") {
    return;
  }

  scheduleNext();
}

export function stopMeltwaterEarnedCron(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** GET /api/cron/meltwater-earned — daily earned mention sync (Bearer CRON_SECRET). */
export async function meltwaterEarnedCronHandler(
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

    const result = await syncEarnedMentions({
      from: new Date(Date.now() - env.meltwaterEarnedLookbackDays * 24 * 60 * 60 * 1000).toISOString()
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
