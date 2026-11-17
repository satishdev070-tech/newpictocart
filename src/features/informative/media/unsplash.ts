import "server-only";
import { searchUnsplash, unsplashEnabled } from "@/features/media/unsplash/server";
import { sizedUnsplashUrl, unsplashCredit, type UnsplashPhoto } from "@/features/media/unsplash/photos";
import type { PickerPhoto, PickerSearch } from "./types";

/**
 * Unsplash search for the Website editor's image picker (server only). Reuses the media library's
 * Unsplash client (src/features/media/unsplash): the key is the one saved in Admin → Media library,
 * else UNSPLASH_ACCESS_KEY, and never reaches the browser. Results are hotlinked thumbnails from
 * images.unsplash.com with the photographer credit. Without a key the picker hides the tab.
 *
 * A small per-isolate cache (5 minutes) sits in front of Next's fetch cache so paging back and
 * forth or re-opening the picker costs no API call and almost no CPU.
 */

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 60;
const cache = new Map<string, { at: number; value: PickerSearch }>();

/** For tests. */
export function clearPickerSearchCache(): void {
  cache.clear();
}

/** Media-library photo → the picker's shape (hotlinked thumb and a 1080 px "regular" size). */
export function toPickerPhoto(p: UnsplashPhoto): PickerPhoto {
  return {
    id: p.id,
    thumbUrl: p.thumb,
    regularUrl: sizedUnsplashUrl(p.base, 1080),
    alt: p.alt,
    author: p.photographer?.name ?? "Unsplash",
    authorUrl: p.photographer?.url ?? p.link,
    photoUrl: p.link,
    credit: unsplashCredit(p),
  };
}

/** Unsplash search for the picker; `configured: false` (and no API call) when no key is set. */
export async function searchPickerPhotos(query: string, page: number, now: number = Date.now()): Promise<PickerSearch> {
  if (!(await unsplashEnabled())) return { configured: false, results: [], total: 0, pages: 0 };
  const q = query.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!q) return { configured: true, results: [], total: 0, pages: 0 };
  const key = `${q.toLowerCase()}|${page}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.value;
  const r = await searchUnsplash(q, page);
  const value: PickerSearch = { configured: true, results: r.photos.map(toPickerPhoto), total: r.total, pages: r.pages };
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: now, value });
  return value;
}
