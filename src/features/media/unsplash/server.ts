import "server-only";
import { logger } from "@/lib/observability/logger";
import { UNSPLASH_CATEGORIES, curatedUnsplashPhotos, toUnsplashCategory, unsplashCategoryQuery, type UnsplashCategory } from "@/lib/unsplash";
import { MARKETPLACE_THEMES } from "@/features/theme/marketplace/catalog";
import { industryShort } from "@/features/stores/industries";
import { MEDIA_MAX_BYTES } from "../rules";
import { API_ID_RE, CURATED_ID_RE, curatedPhoto, fromApiPhoto, isDownloadLocation, isUnsplashImageUrl, mergePhotos, scaledSize, sizedUnsplashUrl, type ApiPhoto, type UnsplashPhoto } from "./photos";

/**
 * Unsplash API access for the media library (server only; the key never reaches the browser).
 * Search results and photo lookups go through Next's fetch cache (a day for the theme photos and
 * photo lookups, an hour for searches), so repeated browsing costs no extra API calls. Without
 * UNSPLASH_ACCESS_KEY the library still lists the curated photos the site falls back to.
 */

const API = "https://api.unsplash.com";
const DAY = 60 * 60 * 24;
const PER_PAGE = 24;
/** Imported copies are at most this wide (Unsplash resizes; keeps files well under 10 MB). */
export const IMPORT_WIDTH = 2000;

const key = () => process.env.UNSPLASH_ACCESS_KEY?.trim() || null;
export const unsplashEnabled = () => key() !== null;

async function api<T>(path: string, revalidate: number): Promise<T> {
  const k = key();
  if (!k) throw new Error("no key");
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Client-ID ${k}`, "Accept-Version": "v1" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate, tags: ["unsplash"] },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** "Fashion, Footwear themes" for a photo category, from the themes whose industry maps to it. */
function usedForLabel(cat: UnsplashCategory): string[] {
  const industries = [...new Set(MARKETPLACE_THEMES.map((t) => t.industry).filter((i) => toUnsplashCategory(i) === cat))];
  const label = `${cat.charAt(0).toUpperCase()}${cat.slice(1)} category`;
  return industries.length ? [`${industries.map(industryShort).join(", ")} themes`, label] : [label];
}

/**
 * The photos the platform itself uses: each category's theme/landing photo. Same request as
 * src/lib/unsplash.ts getCategoryImage (so it shares that cache entry and finds the same photo),
 * or the curated fallbacks without a key / when the API fails.
 */
export async function featuredUnsplashPhotos(): Promise<UnsplashPhoto[]> {
  const curated = new Map(curatedUnsplashPhotos().map((c) => [c.category, c]));
  const photos = await Promise.all(
    UNSPLASH_CATEGORIES.map(async (cat) => {
      const usedFor = usedForLabel(cat);
      if (key()) {
        try {
          const params = new URLSearchParams({ query: unsplashCategoryQuery(cat), per_page: "1", orientation: "landscape", content_filter: "high" });
          const data = await api<{ results?: ApiPhoto[] }>(`/search/photos?${params}`, DAY);
          const photo = fromApiPhoto(data.results?.[0], usedFor);
          if (photo) return photo;
        } catch (error) {
          logger.warn("unsplash.featured_failed", { category: cat, error: error instanceof Error ? error.message : "unknown" });
        }
      }
      const c = curated.get(cat)!;
      return curatedPhoto(c.id, c.alt, usedFor);
    }),
  );
  return mergePhotos(photos);
}

export type UnsplashSearch = { photos: UnsplashPhoto[]; total: number; pages: number };

/** Unsplash search (safe content only). Without a key: the curated photos matching the words. */
export async function searchUnsplash(query: string, page: number): Promise<UnsplashSearch> {
  const q = query.trim().slice(0, 80);
  if (!key()) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const photos = curatedUnsplashPhotos()
      .filter((c) => words.every((w) => `${c.category} ${c.alt}`.toLowerCase().includes(w)))
      .map((c) => curatedPhoto(c.id, c.alt));
    return { photos, total: photos.length, pages: 1 };
  }
  const params = new URLSearchParams({ query: q, page: String(page), per_page: String(PER_PAGE), content_filter: "high" });
  const data = await api<{ total?: number; total_pages?: number; results?: ApiPhoto[] }>(`/search/photos?${params}`, 60 * 60);
  const photos = (data.results ?? []).map((p) => fromApiPhoto(p)).filter((p): p is UnsplashPhoto => !!p);
  return { photos, total: data.total ?? photos.length, pages: Math.min(data.total_pages ?? 1, 50) };
}

/** Several photos for one store industry (e.g. sample products in a theme preview). Never throws. */
export async function industryUnsplashPhotos(industry: string, count: number): Promise<UnsplashPhoto[]> {
  if (!key()) return [];
  try {
    const params = new URLSearchParams({ query: unsplashCategoryQuery(industry), per_page: String(Math.min(count, 30)), content_filter: "high" });
    const data = await api<{ results?: ApiPhoto[] }>(`/search/photos?${params}`, DAY);
    return (data.results ?? []).map((p) => fromApiPhoto(p)).filter((p): p is UnsplashPhoto => !!p);
  } catch (error) {
    logger.warn("unsplash.industry_failed", { industry, error: error instanceof Error ? error.message : "unknown" });
    return [];
  }
}

type Resolved = { photo: UnsplashPhoto; imageUrl: string; downloadLocation: string | null };

/**
 * Looks a photo up by id from Unsplash itself (never trusting a URL from the browser): an API
 * photo through GET /photos/:id, a curated one only if it is in the curated list.
 */
export async function resolveUnsplashPhoto(id: string): Promise<Resolved | null> {
  if (CURATED_ID_RE.test(id)) {
    const c = curatedUnsplashPhotos().find((x) => x.id === id);
    if (!c) return null;
    const photo = curatedPhoto(c.id, c.alt);
    return { photo, imageUrl: sizedUnsplashUrl(`https://images.unsplash.com/${c.id}`, IMPORT_WIDTH, "jpg"), downloadLocation: null };
  }
  if (!API_ID_RE.test(id) || !key()) return null;
  try {
    const p = await api<ApiPhoto>(`/photos/${encodeURIComponent(id)}`, DAY);
    const photo = fromApiPhoto(p);
    if (!photo || !isUnsplashImageUrl(p.urls?.raw)) return null;
    const dl = p.links?.download_location;
    return { photo, imageUrl: sizedUnsplashUrl(p.urls!.raw!, IMPORT_WIDTH, "jpg"), downloadLocation: isDownloadLocation(dl) ? dl : null };
  } catch (error) {
    logger.warn("unsplash.photo_failed", { id, error: error instanceof Error ? error.message : "unknown" });
    return null;
  }
}

/**
 * Tells Unsplash a photo was used (the API guidelines require calling the photo's
 * download_location whenever an app inserts/downloads it). Not cached; never throws.
 */
export async function trackUnsplashDownload(downloadLocation: string | null): Promise<void> {
  const k = key();
  if (!k || !isDownloadLocation(downloadLocation)) return;
  try {
    await fetch(downloadLocation, { headers: { Authorization: `Client-ID ${k}`, "Accept-Version": "v1" }, cache: "no-store", signal: AbortSignal.timeout(4000) });
  } catch (error) {
    logger.warn("unsplash.download_track_failed", { error: error instanceof Error ? error.message : "unknown" });
  }
}

/** Downloads the photo bytes (JPEG, ≤ IMPORT_WIDTH px, ≤ 10 MB) from images.unsplash.com. */
export async function downloadUnsplashImage(r: Resolved): Promise<{ bytes: Uint8Array; width: number | null; height: number | null }> {
  if (!isUnsplashImageUrl(r.imageUrl)) throw new Error("bad image url");
  const res = await fetch(r.imageUrl, { cache: "no-store", signal: AbortSignal.timeout(15000), redirect: "error" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MEDIA_MAX_BYTES) throw new Error("too large");
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MEDIA_MAX_BYTES) throw new Error("too large");
  return { bytes, ...scaledSize(r.photo.width, r.photo.height, IMPORT_WIDTH) };
}
