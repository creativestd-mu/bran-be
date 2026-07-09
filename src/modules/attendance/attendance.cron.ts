import { env } from "../../config/env";
import { todayInIST } from "./attendance.dates";
import { runEtaCheck } from "./attendance.service";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Next weekday 11:00 AM IST as a UTC Date. */
export function nextEtaCheckAt(from: Date = new Date()): Date {
  // Work in IST wall-clock by shifting
  const istNow = new Date(from.getTime() + IST_OFFSET_MS);
  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth();
  const day = istNow.getUTCDate();

  // Candidate today 11:00 IST
  let candidate = new Date(Date.UTC(year, month, day, 11, 0, 0, 0) - IST_OFFSET_MS);

  if (candidate.getTime() <= from.getTime()) {
    // Move to tomorrow IST
    const tomorrowIst = new Date(istNow.getTime() + 24 * 60 * 60 * 1000);
    candidate = new Date(
      Date.UTC(
        tomorrowIst.getUTCFullYear(),
        tomorrowIst.getUTCMonth(),
        tomorrowIst.getUTCDate(),
        11,
        0,
        0,
        0
      ) - IST_OFFSET_MS
    );
  }

  // Skip weekends (IST weekday)
  for (let i = 0; i < 8; i++) {
    const ist = new Date(candidate.getTime() + IST_OFFSET_MS);
    const weekday = ist.getUTCDay(); // 0 Sun … 6 Sat in the shifted calendar
    if (weekday !== 0 && weekday !== 6) {
      return candidate;
    }
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }

  return candidate;
}

let timer: ReturnType<typeof setTimeout> | null = null;

async function runScheduledCheck(): Promise<void> {
  if (!env.slackBotToken) {
    console.warn("[attendance-cron] Skipping — SLACK_BOT_TOKEN not configured");
    return;
  }

  try {
    const result = await runEtaCheck(todayInIST(), { sendReminders: false });
    console.log("[attendance-cron] ETA check complete:", JSON.stringify(result));
  } catch (error) {
    console.error("[attendance-cron] ETA check failed:", error);
  }
}

function scheduleNext(): void {
  const next = nextEtaCheckAt();
  const delay = Math.max(next.getTime() - Date.now(), 1000);
  console.log(`[attendance-cron] Next check at ${next.toISOString()} (in ${Math.round(delay / 1000)}s)`);

  timer = setTimeout(() => {
    void runScheduledCheck().finally(() => {
      scheduleNext();
    });
  }, delay);

  // Allow process to exit in tests / short-lived scripts
  if (typeof timer === "object" && timer && "unref" in timer) {
    timer.unref();
  }
}

export function startAttendanceCron(): void {
  if (!env.attendanceCronEnabled) {
    console.log("[attendance-cron] Disabled (ATTENDANCE_CRON_ENABLED=false)");
    return;
  }
  if (env.nodeEnv === "test") {
    return;
  }

  scheduleNext();
}

export function stopAttendanceCron(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
