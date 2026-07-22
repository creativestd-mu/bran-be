import { env } from "../../config/env";
import { syncAllConnectedGmailAccounts } from "./gmail.service";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function runSync(): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  try {
    const result = await syncAllConnectedGmailAccounts();
    console.log(
      `[gmail-cron] Synced ${result.accounts} account(s), ${result.synced} message(s), ${result.failures} failure(s)`
    );
  } catch (error) {
    console.error("[gmail-cron] Sync run failed:", error);
  } finally {
    running = false;
  }
}

export function startGmailSyncCron(): void {
  if (!env.gmailSyncCronEnabled) {
    console.log("[gmail-cron] Disabled (GMAIL_SYNC_CRON_ENABLED=false)");
    return;
  }
  if (env.nodeEnv === "test") {
    return;
  }
  if (!env.googleClientSecret) {
    console.warn("[gmail-cron] Skipping — Google OAuth is not configured");
    return;
  }

  const interval = Math.max(env.gmailSyncIntervalMs, 60_000);
  console.log(`[gmail-cron] Enabled — syncing every ${Math.round(interval / 1000)}s`);

  timer = setInterval(() => {
    void runSync();
  }, interval);

  if (typeof timer === "object" && timer && "unref" in timer) {
    timer.unref();
  }

  void runSync();
}

export function stopGmailSyncCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
