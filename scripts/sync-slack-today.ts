/**
 * Local debug: sync today's Slack attendance into eta_entries.
 *
 *   npx tsx --env-file=.env scripts/sync-slack-today.ts
 */
import { todayInIST } from "../src/modules/attendance/attendance.dates";
import { syncAttendanceFromSlackHistory } from "../src/modules/attendance/attendance.service";

async function main() {
  const date = process.argv[2] ?? todayInIST();
  console.log(`Syncing Slack attendance for ${date}…`);
  const result = await syncAttendanceFromSlackHistory(date);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
