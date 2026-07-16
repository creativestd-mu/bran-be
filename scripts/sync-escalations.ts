/**
 * Backfill escalation tracker from Slack channel history.
 *
 *   npx tsx --env-file=.env scripts/sync-escalations.ts
 *   npx tsx --env-file=.env scripts/sync-escalations.ts 60   # last 60 days
 */
import { syncEscalationsFromSlack } from "../src/modules/escalation/escalation.service";

async function main() {
  const days = Number(process.argv[2] ?? 30);
  if (!Number.isFinite(days) || days < 1) {
    throw new Error("days must be a positive number");
  }

  console.log(`Syncing Slack escalations for the last ${days} days…`);
  const result = await syncEscalationsFromSlack(days);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
