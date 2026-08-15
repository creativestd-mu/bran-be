/**
 * Tighten the MU competitor search, remove polluted rows, then rebuild 30 days.
 *
 *   npx tsx --env-file=.env scripts/fix-meltwater-competitor-search.ts
 */
import { prisma } from "../src/lib/prisma";
import { syncCompetitorContentMonthlyBackfill } from "../src/modules/competitor-content/competitor-content.service";
import { updateMeltwaterSearch } from "../src/modules/meltwater-earned/meltwater-earned.client";

const SEARCH_ID = "28994734";
const SEARCH_NAME = "Bran MU Competitors";

// Avoid bare "Scaler" and "upGrad": Meltwater stemming matched unrelated
// #scalerc/model vehicles and words such as "upgrade".
const BOOLEAN_QUERY = [
  '"Newton School of Technology"',
  '"Newton School of Coding"',
  '"newtonschool.co"',
  '"@NewtonSchool"',
  '"Scaler School of Business"',
  '"Scaler School of Technology"',
  '"Scaler Academy"',
  '"scaler.com"',
  '"@scaler_official"',
  '"Ashoka University"',
  '"ashoka.edu.in"',
  '"@AshokaUniv"',
  '"upGrad Education"',
  '"upGrad Campus"',
  '"upGrad Abroad"',
  '"upgrad.com"',
  '"@upGrad_edu"',
  '"Mesa School of Business"',
  '"mesaschool.co"',
  '"@mesaschoolofbusiness"'
].join(" OR ");

async function main() {
  console.log(`Updating Meltwater search ${SEARCH_ID}…`);
  const search = await updateMeltwaterSearch(SEARCH_ID, SEARCH_NAME, BOOLEAN_QUERY);
  console.log(JSON.stringify(search, null, 2));

  const deleted = await prisma.meltwaterCompetitorContent.deleteMany({
    where: { searchId: SEARCH_ID }
  });
  console.log(`Deleted ${deleted.count} polluted rows.`);

  const result = await syncCompetitorContentMonthlyBackfill();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
