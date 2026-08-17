import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { POD_SOCIAL_SYNC_CRON_HOUR_IST } from "./pods.constants";
import { syncAllPodSocialAccounts } from "./pods.apify";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function nextPodsSocialSyncAt(from: Date = new Date()): Date {
  const istNow = new Date(from.getTime() + IST_OFFSET_MS);
  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth();
  const day = istNow.getUTCDate();

  let candidate = new Date(
    Date.UTC(year, month, day, POD_SOCIAL_SYNC_CRON_HOUR_IST, 0, 0, 0) - IST_OFFSET_MS
  );

  if (candidate.getTime() <= from.getTime()) {
    const tomorrowIst = new Date(istNow.getTime() + 24 * 60 * 60 * 1000);
    candidate = new Date(
      Date.UTC(
        tomorrowIst.getUTCFullYear(),
        tomorrowIst.getUTCMonth(),
        tomorrowIst.getUTCDate(),
        POD_SOCIAL_SYNC_CRON_HOUR_IST,
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
  if (!env.apifyToken) {
    console.warn("[pods-social-cron] Skipping — APIFY_TOKEN missing");
    return;
  }

  try {
    const result = await syncAllPodSocialAccounts();
    console.log("[pods-social-cron] Daily sync complete:", JSON.stringify({
      total: result.total,
      success: result.success,
      error: result.error,
      skipped: result.skipped
    }));
  } catch (error) {
    console.error("[pods-social-cron] Daily sync failed:", error);
  }
}

function scheduleNext(): void {
  const next = nextPodsSocialSyncAt();
  const delay = Math.max(next.getTime() - Date.now(), 1000);
  console.log(
    `[pods-social-cron] Next sync at ${next.toISOString()} (in ${Math.round(delay / 1000)}s)`
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

export function startPodsSocialCron(): void {
  if (!env.podsSocialCronEnabled) {
    console.log("[pods-social-cron] Disabled (PODS_SOCIAL_CRON_ENABLED=false)");
    return;
  }
  if (env.nodeEnv === "test") {
    return;
  }

  scheduleNext();
}

export function stopPodsSocialCron(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** GET /api/cron/pods-social — daily Pod IP/inspiration sync (Bearer CRON_SECRET). */
export async function podsSocialCronHandler(
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

    const result = await syncAllPodSocialAccounts();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
