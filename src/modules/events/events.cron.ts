import { env } from "../../config/env";
import { detectEventsFromSources } from "./events.service";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function runDetect(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const result = await detectEventsFromSources({
      days: env.eventsDetectDays,
      maxCandidates: env.eventsDetectMaxCandidates
    });
    if (result.skipped) {
      // No new source activity since last run — LLM was not called.
      return;
    }
    console.log(
      `[events-cron] Scanned ${result.scanned}, created ${result.created}, attached ${result.attached}`
    );
  } catch (error) {
    console.error("[events-cron] Detect run failed:", error);
  } finally {
    running = false;
  }
}

export function startEventsDetectCron(): void {
  if (!env.eventsDetectCronEnabled) {
    console.log("[events-cron] Disabled (EVENTS_DETECT_CRON_ENABLED=false)");
    return;
  }
  if (env.nodeEnv === "test") return;

  const interval = Math.max(env.eventsDetectIntervalMs, 60_000);
  console.log(`[events-cron] Enabled — detecting every ${Math.round(interval / 1000)}s`);

  timer = setInterval(() => {
    void runDetect();
  }, interval);

  if (typeof timer === "object" && timer && "unref" in timer) {
    timer.unref();
  }
}

export function stopEventsDetectCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
