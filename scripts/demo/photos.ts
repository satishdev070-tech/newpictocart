/**
 * Unsplash photos for the demo stores. PURE except `fetchMissingQueries` (network + file write).
 *
 * The Unsplash demo key allows 50 requests an hour, far fewer than 180 department searches, so
 * search results are cached in data/unsplash-cache.json (committed). A seed run reads only the
 * cache, so seeding the live project makes no Unsplash API calls; a department whose search is
 * not cached yet falls back to the curated pool in src/lib/unsplash-stock.ts.
 * Credit ("Photo by X on Unsplash") is kept in each media item's alt text and file name, the
 * same convention as the Media Library's Unsplash import.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { curatedStock, type StockSlot } from "../../src/lib/unsplash-stock";
import { toUnsplashCategory } from "../../src/lib/unsplash-categories";

/** [images.unsplash.com id ("photo-…"), API id, photographer, username, alt]. */
export type CachedPhoto = readonly [id: string, apiId: string, name: string, username: string, alt: string];
export type PhotoCache = Record<string, CachedPhoto[]>;

export type DemoPhoto = { id: string; alt: string; photographer: { name: string; url: string } | null; source: "search" | "curated" };

export const CACHE_PATH = new URL("./data/unsplash-cache.json", import.meta.url);
const UTM = "utm_source=pictocart&utm_medium=referral";

export function loadCache(): PhotoCache {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8")) as PhotoCache;
  } catch {
    return {};
  }
}

const fromCache = ([id, , name, username, alt]: CachedPhoto): DemoPhoto => ({ id, alt, photographer: { name, url: `https://unsplash.com/@${username}?${UTM}` }, source: "search" });

/** Photos for one department search: cached results, else the curated pool for the store's industry. */
export function photosFor(cache: PhotoCache, query: string, industry: string, slot: StockSlot = "products"): DemoPhoto[] {
  const hit = cache[query];
  if (hit?.length) return hit.map(fromCache);
  // Rotated by the query, so departments without a cached search don't all get the same photo.
  const pool = curatedStock(toUnsplashCategory(industry), slot).map((p): DemoPhoto => ({ id: p.id, alt: p.alt, photographer: p.photographer, source: "curated" }));
  const shift = [...query].reduce((a, c) => a + c.charCodeAt(0), 0) % pool.length;
  return [...pool.slice(shift), ...pool.slice(0, shift)];
}

/** The n-th photo of a list, wrapping around (lists are never empty: the curated pool has 2+). */
export const nth = <T,>(list: readonly T[], n: number): T => list[((n % list.length) + list.length) % list.length]!;

/** Download URL for a photo, cropped server-side by Unsplash (imgix). */
export function photoUrl(id: string, width: number, height: number): string {
  return `https://images.unsplash.com/${id.startsWith("photo-") ? id : `photo-${id}`}?auto=format&fit=crop&crop=entropy&q=78&w=${width}&h=${height}`;
}

/** "Photo by Jane Doe on Unsplash" (src/features/media/unsplash/photos.ts convention). */
export const creditOf = (p: DemoPhoto) => (p.photographer ? `Photo by ${p.photographer.name} on Unsplash` : "Photo from Unsplash");

type SearchResponse = { results?: { id?: string; alt_description?: string | null; description?: string | null; urls?: { raw?: string }; user?: { name?: string; username?: string } }[] };

/**
 * Searches Unsplash for every query not in the cache, saving after each one, until the hourly
 * limit is nearly used up. With `wait`, sleeps until the limit resets and continues.
 */
export async function fetchMissingQueries(queries: string[], key: string, opts: { wait: boolean; perPage?: number; log?: (s: string) => void }): Promise<{ fetched: number; missing: number }> {
  const log = opts.log ?? console.log;
  const cache = loadCache();
  let fetched = 0;
  for (const q of [...new Set(queries)]) {
    if (cache[q]?.length) continue;
    const params = new URLSearchParams({ query: q, per_page: String(opts.perPage ?? 20), content_filter: "high", orientation: "portrait" });
    const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" }, signal: AbortSignal.timeout(15000) });
    const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? "0");
    if (res.status === 403 || res.status === 429) {
      if (!opts.wait) break;
      log(`  rate limited; waiting an hour (${queries.filter((x) => !cache[x]?.length).length} queries left)`);
      await new Promise((r) => setTimeout(r, 61 * 60_000));
      continue;
    }
    if (!res.ok) throw new Error(`Unsplash search "${q}" → HTTP ${res.status}`);
    const rows: CachedPhoto[] = [];
    for (const p of ((await res.json()) as SearchResponse).results ?? []) {
      const m = p.urls?.raw?.match(/^https:\/\/images\.unsplash\.com\/(photo-[\w-]+)/);
      if (!m || !p.id || !p.user?.name || !p.user.username) continue;
      rows.push([m[1]!, p.id, p.user.name, p.user.username, (p.alt_description || p.description || q).slice(0, 140)]);
    }
    cache[q] = rows;
    writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 0).replace(/\],"/g, '],\n"')}\n`);
    fetched += 1;
    log(`  ✓ "${q}" (${rows.length} photos, ${remaining} requests left this hour)`);
    if (remaining <= 1) {
      if (!opts.wait) break;
      log("  hourly limit reached; waiting an hour");
      await new Promise((r) => setTimeout(r, 61 * 60_000));
    }
  }
  return { fetched, missing: queries.filter((q) => !cache[q]?.length).length };
}
