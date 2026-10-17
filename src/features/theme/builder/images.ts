import type { StockImage, StockSlot } from "@/lib/unsplash-stock";
import { toUnsplashCategory, type UnsplashCategory } from "@/lib/unsplash-categories";
import type { ThemePreset } from "../marketplace/types";
import type { ThemeImage } from "./schema";

/**
 * Unsplash photos for every image slot of a generated theme (pure apart from the injected
 * fetcher, so it is unit tested). Photos keep their photographer credit and Unsplash link; the
 * reference website's own images are never used.
 */

/** Which stock slot a home section's image(s) come from, and how many it shows. */
const SECTION_SLOTS: Record<string, { slot: StockSlot; count: number }> = {
  Hero: { slot: "hero", count: 3 },
  PromoBanner: { slot: "hero", count: 2 },
  SaleBanner: { slot: "hero", count: 1 },
  VideoBanner: { slot: "hero", count: 1 },
  CategoryGrid: { slot: "tiles", count: 6 },
  CollectionGrid: { slot: "tiles", count: 4 },
  Lookbook: { slot: "tiles", count: 4 },
  SocialProof: { slot: "tiles", count: 6 },
  BrandStory: { slot: "story", count: 2 },
  EditorialImageText: { slot: "story", count: 1 },
  Newsletter: { slot: "story", count: 1 },
  ProductGrid: { slot: "products", count: 4 },
  ProductCarousel: { slot: "products", count: 4 },
  Bestseller: { slot: "products", count: 4 },
  NewArrivals: { slot: "products", count: 4 },
  ProductSpotlight: { slot: "products", count: 1 },
  CompactProducts: { slot: "products", count: 3 },
};

export type ImageSlot = { section: number; type: string; slot: StockSlot; count: number };

/** Image slots of a preset's home page, in page order. */
export function imageSlotsFor(preset: Pick<ThemePreset, "home">): ImageSlot[] {
  return preset.home.flatMap(([type], section) => {
    const s = SECTION_SLOTS[type];
    return s ? [{ section, type, ...s }] : [];
  });
}

export type StockFetcher = (category: UnsplashCategory, slot: StockSlot, count: number) => Promise<StockImage[]>;

const toThemeImage = (img: StockImage, section: number | null): ThemeImage => ({
  id: img.id,
  url: img.url,
  alt: img.alt.slice(0, 300),
  photographer: img.photographer,
  unsplashUrl: img.unsplashUrl,
  slot: img.slot,
  category: img.category,
  source: img.source,
  section,
});

/**
 * One fetch per stock slot the theme needs, then photos are dealt out to sections in page order
 * without repeating a photo while the pool lasts. A slot that comes back empty borrows from "hero"
 * then "story", so no section is left without a photo when any photo is available.
 */
export async function fillThemeImages(preset: Pick<ThemePreset, "home" | "family">, industry: string, fetchStock: StockFetcher): Promise<ThemeImage[]> {
  const category = toUnsplashCategory(preset.family ?? industry);
  const slots = imageSlotsFor(preset);
  const need = new Map<StockSlot, number>();
  for (const s of slots) need.set(s.slot, (need.get(s.slot) ?? 0) + s.count);
  const pools = new Map<StockSlot, StockImage[]>();
  await Promise.all(
    [...need.entries()].map(async ([slot, n]) => {
      try {
        pools.set(slot, await fetchStock(category, slot, Math.min(Math.max(n, 4), 12)));
      } catch {
        pools.set(slot, []);
      }
    }),
  );
  const cursor = new Map<StockSlot, number>();
  const out: ThemeImage[] = [];
  for (const s of slots) {
    let pool = pools.get(s.slot) ?? [];
    if (!pool.length) pool = pools.get("hero")?.length ? pools.get("hero")! : (pools.get("story") ?? []);
    if (!pool.length) continue;
    for (let i = 0; i < s.count; i++) {
      const at = cursor.get(s.slot) ?? 0;
      cursor.set(s.slot, at + 1);
      out.push(toThemeImage(pool[at % pool.length]!, s.section));
    }
  }
  return out;
}

/** Unique photographer credits for an attribution line. */
export function imageCredits(images: readonly ThemeImage[]): { name: string; url: string }[] {
  const seen = new Map<string, string>();
  for (const i of images) if (i.photographer && !seen.has(i.photographer.name)) seen.set(i.photographer.name, i.photographer.url);
  return [...seen.entries()].map(([name, url]) => ({ name, url }));
}
