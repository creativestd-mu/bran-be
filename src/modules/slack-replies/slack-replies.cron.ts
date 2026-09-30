import { env } from "../../config/env";
import { syncAllSlackReplyConnections } from "./slack-replies.service";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function run(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const result = await syncAllSlackReplyConnections();
    console.log(`[slack-replies] Synced ${result.accounts} account(s), ${result.replies} pending, ${result.failures} failure(s)`);
  } finally { running = false; }
}

export function startSlackReplySyncCron(): void {
  if (!env.slackReplySyncCronEnabled || env.nodeEnv === "test" || !env.slackClientSecret) return;
  const interval = Math.max(env.slackReplySyncIntervalMs, 60_000);
  timer = setInterval(() => void run(), interval);
  if (typeof timer === "object" && timer && "unref" in timer) timer.unref();
  void run();
}

export function stopSlackReplySyncCron(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
