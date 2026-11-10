/** Photo categories for Unsplash imagery and the store-industry aliases that map onto them. PURE. */

export const UNSPLASH_CATEGORIES = [
  "fashion",
  "food",
  "jewellery",
  "beauty",
  "furniture",
  "electronics",
  "handicrafts",
  "books",
  "fitness",
  "toys",
  "stationery",
  "pets",
  "organic",
  "art",
  "services",
  "general",
] as const;
export type UnsplashCategory = (typeof UNSPLASH_CATEGORIES)[number];

/** Store industries (src/features/stores/industries.ts) and common aliases -> photo category. */
const ALIASES: Record<string, UnsplashCategory> = {
  clothing: "fashion",
  footwear: "fashion",
  bags: "fashion",
  eyewear: "fashion",
  gourmet: "food",
  bakery: "food",
  grocery: "organic",
  sweets: "food",
  beverages: "food",
  kitchen: "food",
  jewelry: "jewellery",
  watches: "jewellery",
  fragrances: "beauty",
  health: "beauty",
  ayurveda: "organic",
  "home-decor": "furniture",
  "home-textiles": "furniture",
  "smart-home": "electronics",
  "mobile-accessories": "electronics",
  automotive: "electronics",
  tools: "electronics",
  pooja: "handicrafts",
  gifts: "handicrafts",
  sports: "fitness",
  gym: "fitness",
  kids: "toys",
  pet: "pets",
  plants: "organic",
  music: "art",
  service: "services",
};

/** Maps a category, store industry slug or alias to a known photo category ("general" if unknown). */
export function toUnsplashCategory(category: string): UnsplashCategory {
  const key = category.trim().toLowerCase().replace(/[\s_&]+/g, "-");
  if ((UNSPLASH_CATEGORIES as readonly string[]).includes(key)) return key as UnsplashCategory;
  return ALIASES[key] ?? "general";
}
