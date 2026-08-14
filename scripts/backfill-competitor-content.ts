/**
 * One-time monthly backfill of competitor impactful content from Meltwater.
 *
 *   npx tsx --env-file=.env scripts/backfill-competitor-content.ts
 *   npx tsx --env-file=.env scripts/backfill-competitor-content.ts 30
 */
import { syncCompetitorContent } from "../src/modules/competitor-content/competitor-content.service";
import { COMPETITOR_CONTENT_BACKFILL_DAYS } from "../src/modules/competitor-content/competitor-content.constants";

async function main() {
  const days = Number(process.argv[2] ?? COMPETITOR_CONTENT_BACKFILL_DAYS);
  if (!Number.isFinite(days) || days < 1) {
    throw new Error("days must be a positive number");
  }

  console.log(`Backfilling competitor impactful content for the last ${days} days…`);
  const result = await syncCompetitorContent({ lookbackDays: days });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
