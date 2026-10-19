import { INDUSTRIES, isIndustry, type IndustrySlug } from "@/features/stores/industries";
import { SITE_MODES, type SiteMode } from "@/features/stores/site-mode";

/** Facts Tara extracts during voice onboarding. */
export type VoiceFacts = {
  name: string | null;
  category: IndustrySlug | null;
  siteMode: SiteMode | null;
  tagline: string | null;
  city: string | null;
};

export const EMPTY_FACTS: VoiceFacts = {
  name: null,
  category: null,
  siteMode: null,
  tagline: null,
  city: null,
};

const CATEGORY_ALIASES: Record<string, IndustrySlug> = {
  clothing: "fashion",
  apparel: "fashion",
  clothes: "fashion",
  garments: "fashion",
  boutique: "fashion",
  makeup: "beauty",
  cosmetics: "beauty",
  skincare: "beauty",
  jewelry: "jewellery",
  jewels: "jewellery",
  ornaments: "jewellery",
  furniture: "furniture",
  home: "furniture",
  decor: "home-decor",
  "home decor": "home-decor",
  grocery: "grocery",
  food: "gourmet",
  bakery: "gourmet",
  sweets: "sweets",
  snacks: "sweets",
  health: "health",
  wellness: "health",
  fitness: "sports",
  sports: "sports",
  shoes: "footwear",
  footwear: "footwear",
  kids: "kids",
  baby: "kids",
  books: "books",
  stationery: "books",
  pets: "pets",
  pet: "pets",
  auto: "automotive",
  car: "automotive",
  electronics: "electronics",
  gadgets: "electronics",
  phones: "mobile-accessories",
  mobile: "mobile-accessories",
  handicrafts: "handicrafts",
  craft: "handicrafts",
  ethnic: "handicrafts",
  bags: "bags",
  luggage: "bags",
  watches: "watches",
  organic: "organic",
  natural: "organic",
  ayurveda: "ayurveda",
  herbal: "ayurveda",
  eyewear: "eyewear",
  glasses: "eyewear",
  perfume: "fragrances",
  fragrance: "fragrances",
  kitchen: "kitchen",
  toys: "toys",
  gifts: "gifts",
  plants: "plants",
  garden: "plants",
  pooja: "pooja",
  spiritual: "pooja",
  tools: "tools",
  hardware: "tools",
  music: "music",
  art: "art",
  tea: "beverages",
  coffee: "beverages",
  beverages: "beverages",
  restaurant: "gourmet",
  cafe: "gourmet",
  salon: "beauty",
  clinic: "health",
  consultancy: "general",
  website: "general",
  informative: "general",
};

/** Map free-text / model output to a known industry slug. */
export function mapCategoryToIndustry(raw: string | null | undefined): IndustrySlug | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
  if (!cleaned) return null;
  if (isIndustry(cleaned)) return cleaned;
  const dashed = cleaned.replace(/\s+/g, "-");
  if (isIndustry(dashed)) return dashed;
  if (CATEGORY_ALIASES[cleaned]) return CATEGORY_ALIASES[cleaned]!;
  if (CATEGORY_ALIASES[dashed]) return CATEGORY_ALIASES[dashed]!;
  // Fuzzy: industry short/name contains or is contained by input.
  for (const ind of INDUSTRIES) {
    const name = ind.name.toLowerCase();
    const short = ind.short.toLowerCase();
    if (cleaned.includes(short) || short.includes(cleaned) || cleaned.includes(name) || name.includes(cleaned)) {
      return ind.slug;
    }
  }
  return null;
}

export function mapSiteMode(raw: string | null | undefined): SiteMode | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if ((SITE_MODES as readonly string[]).includes(v)) return v as SiteMode;
  if (v.includes("info") || v.includes("portfolio") || v.includes("brochure") || v.includes("website only")) return "informative";
  if (v.includes("shop") || v.includes("store") || v.includes("sell") || v.includes("ecommerce") || v.includes("e-commerce")) return "ecommerce";
  return null;
}

/** Merge partial fact updates (null/empty leaves previous). */
export function mergeFacts(prev: VoiceFacts, patch: Partial<VoiceFacts>): VoiceFacts {
  const next = { ...prev };
  for (const key of Object.keys(patch) as (keyof VoiceFacts)[]) {
    const val = patch[key];
    if (val === undefined || val === null) continue;
    if (typeof val === "string" && !val.trim()) continue;
    next[key] = val as never;
  }
  return next;
}

export function factsComplete(facts: VoiceFacts): boolean {
  return Boolean(facts.name && facts.category && facts.siteMode);
}

export function missingFactLabels(facts: VoiceFacts): string[] {
  const missing: string[] = [];
  if (!facts.name) missing.push("business name");
  if (!facts.category) missing.push("category");
  if (!facts.siteMode) missing.push("website or online store");
  return missing;
}

/** Suggest a store slug from a business name (form-compatible). */
export function suggestSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}
