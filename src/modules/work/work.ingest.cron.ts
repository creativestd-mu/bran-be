import { env } from "../../config/env";
import { runWorkUnitIngestion } from "./work.service";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function runIngest(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runWorkUnitIngestion();
  } catch (error) {
    console.error("[work-ingest-cron] Run failed:", error);
  } finally {
    running = false;
  }
}

export function startWorkIngestCron(): void {
  if (!env.workIngestCronEnabled) {
    console.log("[work-ingest-cron] Disabled (WORK_INGEST_CRON_ENABLED=false)");
    return;
  }
  if (env.nodeEnv === "test") return;

  const interval = Math.max(env.workIngestIntervalMs, 60_000);
  console.log(`[work-ingest-cron] Enabled — ingesting every ${Math.round(interval / 1000)}s`);

  timer = setInterval(() => {
    void runIngest();
  }, interval);

  if (typeof timer === "object" && timer && "unref" in timer) {
    timer.unref();
  }
}

export function stopWorkIngestCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
