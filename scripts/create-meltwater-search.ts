/**
 * One-shot: create an exhaustive "Masters' Union" saved search in Meltwater.
 *
 *   npx tsx --env-file=.env scripts/create-meltwater-search.ts
 *
 * On success it prints the new search id — set MELTWATER_SEARCH_IDS to that id
 * (locally and on Railway) so the earned-media sync only pulls this search.
 */
import { createMeltwaterSearch } from "../src/modules/meltwater-earned/meltwater-earned.client";

const SEARCH_NAME = "Bran Masters Union";

// Exhaustive brand query for Masters' Union across all platforms (news, blogs,
// X/Twitter, Facebook, Reddit, Instagram, LinkedIn, YouTube, forums). Meltwater
// matches every source in the package unless a filter_set restricts it, so this
// boolean is intentionally source-agnostic and anchored to brand tokens.
const BOOLEAN_QUERY = [
  '"Masters Union"',
  '"Masters\' Union"',
  '"Master\'s Union"',
  '"Masters Union School of Business"',
  "MastersUnion",
  '"mastersunion.org"',
  "#MastersUnion",
  "@mastersunion"
].join(" OR ");

async function main() {
  const name = process.argv[2] || SEARCH_NAME;
  const query = process.argv[3] || BOOLEAN_QUERY;

  console.log(`Creating Meltwater search "${name}"…`);
  console.log(`Boolean: ${query}`);

  const search = await createMeltwaterSearch(name, query);

  console.log("\nCreated search:");
  console.log(JSON.stringify(search, null, 2));
  console.log(`\nNext: set MELTWATER_SEARCH_IDS="${search.id}" (local .env + Railway) to sync only this search.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
