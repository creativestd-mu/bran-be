import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { COMPETITOR_CONTENT_CRON_HOUR_IST } from "./competitor-content.constants";
import { syncCompetitorContentDaily } from "./competitor-content.service";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function nextCompetitorContentSyncAt(from: Date = new Date()): Date {
  const istNow = new Date(from.getTime() + IST_OFFSET_MS);
  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth();
  const day = istNow.getUTCDate();

  let candidate = new Date(
    Date.UTC(year, month, day, COMPETITOR_CONTENT_CRON_HOUR_IST, 0, 0, 0) - IST_OFFSET_MS
  );

  if (candidate.getTime() <= from.getTime()) {
    const tomorrowIst = new Date(istNow.getTime() + 24 * 60 * 60 * 1000);
    candidate = new Date(
      Date.UTC(
        tomorrowIst.getUTCFullYear(),
        tomorrowIst.getUTCMonth(),
        tomorrowIst.getUTCDate(),
        COMPETITOR_CONTENT_CRON_HOUR_IST,
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
  if (!env.meltwaterApiKey || env.meltwaterCompetitorSearchIds.length === 0) {
    console.warn(
      "[competitor-content-cron] Skipping — API key or MELTWATER_COMPETITOR_SEARCH_IDS missing"
    );
    return;
  }

  try {
    const result = await syncCompetitorContentDaily();
    console.log("[competitor-content-cron] Daily sync complete:", JSON.stringify(result));
  } catch (error) {
    console.error("[competitor-content-cron] Daily sync failed:", error);
  }
}

function scheduleNext(): void {
  const next = nextCompetitorContentSyncAt();
  const delay = Math.max(next.getTime() - Date.now(), 1000);
  console.log(
    `[competitor-content-cron] Next sync at ${next.toISOString()} (in ${Math.round(delay / 1000)}s)`
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

export function startCompetitorContentCron(): void {
  if (!env.meltwaterCompetitorCronEnabled) {
    console.log("[competitor-content-cron] Disabled (MELTWATER_COMPETITOR_CRON_ENABLED=false)");
    return;
  }
  if (env.nodeEnv === "test") {
    return;
  }

  scheduleNext();
}

export function stopCompetitorContentCron(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** GET /api/cron/meltwater-competitors — daily competitor content sync (Bearer CRON_SECRET). */
export async function competitorContentCronHandler(
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

    const result = await syncCompetitorContentDaily();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
