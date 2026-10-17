import "server-only";
import { logger } from "@/lib/observability/logger";
import { UNSPLASH_CATEGORIES, toUnsplashCategory, type UnsplashCategory } from "./unsplash-categories";
import { STOCK_QUERIES, STOCK_SLOTS, curatedStock, stockPhotoUrl, type StockImage, type StockSet, type StockSlot } from "./unsplash-stock";

export { UNSPLASH_CATEGORIES, toUnsplashCategory, type UnsplashCategory };

/**
 * Category photos from Unsplash for marketing sections (theme cards, business categories, ...).
 *
 * With UNSPLASH_ACCESS_KEY set, each category is looked up once via the Search API and cached by
 * Next's fetch cache for a day (one request per category per day, far under the 50/hour demo
 * limit). Without a key, or when the API fails, a curated static photo per category is used, so
 * callers always get an image. Photos are hotlinked from images.unsplash.com as the API
 * guidelines require, and must be shown with the returned credit ("Photo: X / Unsplash").
 */

export type CategoryImage = {
  /** images.unsplash.com URL, already cropped/sized for a card (800x500, auto format). */
  url: string;
  alt: string;
  /** Photographer credit; null for the curated fallbacks (credited to Unsplash itself). */
  photographer: { name: string; url: string } | null;
  /** Unsplash home link with referral UTM, for the "/ Unsplash" part of the credit. */
  unsplashUrl: string;
  source: "api" | "fallback";
};

const UTM = "utm_source=pictocart&utm_medium=referral";
export const UNSPLASH_HOME = `https://unsplash.com/?${UTM}`;
const SIZE = "w=800&h=500&fit=crop&crop=entropy&auto=format&q=70";
const REVALIDATE_SECONDS = 60 * 60 * 24;

/** Search terms per category: specific enough to get a product/shop photo, not a portrait. */
const QUERIES: Record<UnsplashCategory, string> = {
  fashion: "fashion clothing boutique",
  food: "bakery pastry food",
  jewellery: "jewellery necklace",
  beauty: "cosmetics makeup products",
  furniture: "modern furniture interior",
  electronics: "electronics gadgets",
  handicrafts: "handmade pottery crafts",
  books: "books bookshop",
  fitness: "fitness gym equipment",
  toys: "toys kids",
  stationery: "stationery notebooks",
  pets: "pet dog",
  organic: "organic vegetables market",
  art: "art painting studio",
  services: "small business team",
  general: "retail store shopping",
};

/** Curated images.unsplash.com photos, used when there is no key or the API is unavailable. */
const FALLBACK: Record<UnsplashCategory, { id: string; alt: string }> = {
  fashion: { id: "photo-1445205170230-053b83016050", alt: "Clothes hanging on a boutique rail" },
  food: { id: "photo-1509440159596-0249088772ff", alt: "Freshly baked loaves of bread" },
  jewellery: { id: "photo-1515562141207-7a88fb7ce338", alt: "Pearl necklace in a jewellery box" },
  beauty: { id: "photo-1596462502278-27bfdc403348", alt: "Makeup brushes and cosmetics" },
  furniture: { id: "photo-1555041469-a586c61ea9bc", alt: "Green sofa in a bright living room" },
  electronics: { id: "photo-1498049794561-7780e7231661", alt: "Laptop, phone and headphones on a desk" },
  handicrafts: { id: "photo-1528396518501-b53b655eb9b3", alt: "Shelves of handmade pottery" },
  books: { id: "photo-1512820790803-83ca734da794", alt: "A stack of books" },
  fitness: { id: "photo-1534438327276-14e5300c3a48", alt: "Dumbbells on a rack in a gym" },
  toys: { id: "photo-1558060370-d644479cb6f7", alt: "Colourful toys laid out together" },
  stationery: { id: "photo-1531403009284-440f080d1e12", alt: "Sticky notes on a planning board" },
  pets: { id: "photo-1583337130417-3346a1be7dee", alt: "French bulldog in a yellow jumper" },
  organic: { id: "photo-1542838132-92c53300491e", alt: "Fresh vegetables at a market stall" },
  art: { id: "photo-1460661419201-fd4cecdf8a8b", alt: "Paint brushes with bright colours" },
  services: { id: "photo-1556761175-5973dc0f32e7", alt: "A small team meeting in an office" },
  general: { id: "photo-1441986300917-64674bd600d8", alt: "Inside a modern retail store" },
};

/** The curated static photo for a category. PURE. */
export function fallbackCategoryImage(category: string): CategoryImage {
  const photo = FALLBACK[toUnsplashCategory(category)];
  return { url: `https://images.unsplash.com/${photo.id}?${SIZE}`, alt: photo.alt, photographer: null, unsplashUrl: UNSPLASH_HOME, source: "fallback" };
}

type SearchResponse = {
  results?: { alt_description?: string | null; description?: string | null; urls?: { raw?: string }; user?: { name?: string; links?: { html?: string } } }[];
};

const withUtm = (url: string) => `${url}${url.includes("?") ? "&" : "?"}${UTM}`;

/**
 * A photo for one category: Unsplash search (cached for a day) when UNSPLASH_ACCESS_KEY is set,
 * otherwise, or on any failure, the curated fallback. Never throws.
 */
export async function getCategoryImage(category: string): Promise<CategoryImage> {
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  const cat = toUnsplashCategory(category);
  if (!key) return fallbackCategoryImage(cat);
  try {
    const params = new URLSearchParams({ query: QUERIES[cat], per_page: "1", orientation: "landscape", content_filter: "high" });
    const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: REVALIDATE_SECONDS, tags: ["unsplash"] },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const photo = ((await res.json()) as SearchResponse).results?.[0];
    const raw = photo?.urls?.raw;
    if (!raw || !raw.startsWith("https://images.unsplash.com/")) throw new Error("no results");
    const name = photo.user?.name;
    const profile = photo.user?.links?.html;
    return {
      url: `${raw}${raw.includes("?") ? "&" : "?"}${SIZE}`,
      alt: photo.alt_description || photo.description || FALLBACK[cat].alt,
      photographer: name && profile ? { name, url: withUtm(profile) } : null,
      unsplashUrl: UNSPLASH_HOME,
      source: "api",
    };
  } catch (error) {
    logger.warn("unsplash.lookup_failed", { category: cat, error: error instanceof Error ? error.message : "unknown" });
    return fallbackCategoryImage(cat);
  }
}

/** Photos for several categories, keyed by the category string passed in. Never throws. */
export async function getCategoryImages(categories: readonly string[]): Promise<Map<string, CategoryImage>> {
  const unique = [...new Set(categories)];
  const images = await Promise.all(unique.map((c) => getCategoryImage(c)));
  return new Map(unique.map((c, i) => [c, images[i]!]));
}

// ---- Media library helpers (appended; see src/features/media/unsplash) -------------------------

/** Search terms used for a category's photo, so the media library can find the same photo. */
export function unsplashCategoryQuery(category: string): string {
  return QUERIES[toUnsplashCategory(category)];
}

/** The curated fallback photos (images.unsplash.com ids like "photo-…"), keyed by category. PURE. */
export function curatedUnsplashPhotos(): { category: UnsplashCategory; id: string; alt: string }[] {
  return UNSPLASH_CATEGORIES.map((category) => ({ category, ...FALLBACK[category] }));
}

// -----------------------------------------------------------------------------
// Theme imagery: several photos per category and image slot (hero, story, tiles, products).
// -----------------------------------------------------------------------------
export { STOCK_SLOTS, curatedStock, curatedStockSet, pickStock, stockCredits, type StockImage, type StockSet, type StockSlot } from "./unsplash-stock";

const ORIENTATION: Record<StockSlot, string> = { hero: "landscape", story: "portrait", tiles: "squarish", products: "squarish" };

/**
 * Photos for one category slot: the Search API (one cached request per slot per day) when
 * UNSPLASH_ACCESS_KEY is set and returns enough results, otherwise the curated pool. Never throws.
 */
export async function getStockImages(category: string, slot: StockSlot, count = 4): Promise<StockImage[]> {
  const cat = toUnsplashCategory(category);
  const curated = curatedStock(cat, slot);
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!key) return curated.slice(0, count);
  try {
    const params = new URLSearchParams({ query: STOCK_QUERIES[cat][slot], per_page: String(Math.max(count, 4)), orientation: ORIENTATION[slot], content_filter: "high" });
    const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: REVALIDATE_SECONDS, tags: ["unsplash"] },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const found: StockImage[] = [];
    for (const photo of ((await res.json()) as SearchResponse).results ?? []) {
      const raw = photo.urls?.raw;
      const m = raw?.match(/^https:\/\/images\.unsplash\.com\/(photo-[\w-]+)/);
      if (!m) continue;
      const name = photo.user?.name;
      const profile = photo.user?.links?.html;
      found.push({
        id: m[1]!,
        url: stockPhotoUrl(m[1]!),
        alt: photo.alt_description || photo.description || curated[0]?.alt || "",
        photographer: name && profile ? { name, url: withUtm(profile) } : null,
        unsplashUrl: UNSPLASH_HOME,
        slot,
        category: cat,
        source: "api",
      });
    }
    return found.length >= Math.min(count, 2) ? found.slice(0, count) : curated.slice(0, count);
  } catch (error) {
    logger.warn("unsplash.stock_failed", { category: cat, slot, error: error instanceof Error ? error.message : "unknown" });
    return curated.slice(0, count);
  }
}

/** Every slot for a category (what a theme fills empty image slots with). Never throws. */
export async function getStockSet(category: string): Promise<StockSet> {
  const cat = toUnsplashCategory(category);
  const [hero, story, tiles, products] = await Promise.all(STOCK_SLOTS.map((slot) => getStockImages(cat, slot)));
  return { category: cat, hero: hero!, story: story!, tiles: tiles!, products: products! };
}
