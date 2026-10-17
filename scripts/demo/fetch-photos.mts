/**
 * Fills scripts/demo/data/unsplash-cache.json with Unsplash search results for every demo
 * department (50 requests/hour on the demo key). Read-only towards Supabase.
 *
 *   pnpm seed:demo-stores:photos [--wait] [--category=<key>]
 */
import { DEMO_CATEGORIES } from "./data";
import { fetchMissingQueries } from "./photos";

const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
if (!key) throw new Error("UNSPLASH_ACCESS_KEY is required (in .env.local)");
const only = process.argv.find((a) => a.startsWith("--category="))?.split("=")[1];
const queries = DEMO_CATEGORIES.filter((c) => !only || c.industry === only).flatMap((c) => c.departments.map((d) => d.q));
const r = await fetchMissingQueries(queries, key, { wait: process.argv.includes("--wait") });
console.log(`fetched ${r.fetched}; ${r.missing} of ${new Set(queries).size} queries still missing`);
