import { env } from "../../config/env";
import { syncAllConnectedCalendars } from "./meetings.service";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function runSync(): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  try {
    const result = await syncAllConnectedCalendars();
    console.log(
      `[meetings-cron] Synced ${result.calendars} calendar(s), ${result.failures} failure(s)`
    );
  } catch (error) {
    console.error("[meetings-cron] Sync run failed:", error);
  } finally {
    running = false;
  }
}

export function startMeetingsSyncCron(): void {
  if (!env.meetingsSyncCronEnabled) {
    console.log("[meetings-cron] Disabled (MEETINGS_SYNC_CRON_ENABLED=false)");
    return;
  }
  if (env.nodeEnv === "test") {
    return;
  }
  if (!env.recallApiKey) {
    console.warn("[meetings-cron] Skipping — RECALL_API_KEY not configured");
    return;
  }

  const interval = Math.max(env.meetingsSyncIntervalMs, 60_000);
  console.log(`[meetings-cron] Enabled — syncing every ${Math.round(interval / 1000)}s`);

  timer = setInterval(() => {
    void runSync();
  }, interval);

  if (typeof timer === "object" && timer && "unref" in timer) {
    timer.unref();
  }

  // Kick off an initial run shortly after boot.
  void runSync();
}

export function stopMeetingsSyncCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
