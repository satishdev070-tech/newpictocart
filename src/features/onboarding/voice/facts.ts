import { INDUSTRIES, isIndustry, type IndustrySlug } from "@/features/stores/industries";
import { SITE_MODES, type SiteMode } from "@/features/stores/site-mode";
import { isSubcategory, subcategoriesFor } from "@/features/stores/subcategories";

/** Facts Tara extracts during voice onboarding. */
export type VoiceFacts = {
  name: string | null;
  category: IndustrySlug | null;
  /** Optional start-flow subcategory slug (industry-scoped). */
  subcategory: string | null;
  /** Optional free-text products / services blurb. */
  productsServices: string | null;
  siteMode: SiteMode | null;
  tagline: string | null;
  city: string | null;
};

export type CategoryMapping = {
  category: IndustrySlug | null;
  subcategory: string | null;
};

function normalizeCategoryText(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
}

export const EMPTY_FACTS: VoiceFacts = {
  name: null,
  category: null,
  subcategory: null,
  productsServices: null,
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
  return mapCategoryInput(raw).category;
}

/** True when cleaned text is only the industry itself (no subcategory signal). */
function isIndustryOnlyPhrase(cleaned: string, industry: IndustrySlug): boolean {
  const dashed = cleaned.replace(/\s+/g, "-");
  if (cleaned === industry || dashed === industry) return true;
  if (CATEGORY_ALIASES[cleaned] === industry || CATEGORY_ALIASES[dashed] === industry) return true;
  const ind = INDUSTRIES.find((i) => i.slug === industry);
  if (!ind) return false;
  const name = ind.name.toLowerCase();
  const short = ind.short.toLowerCase();
  return cleaned === name || cleaned === short || dashed === name.replace(/\s+/g, "-");
}

/**
 * Suggest an industry-scoped subcategory slug from free text (label, slug, or phrase).
 * Returns null when the text only names the industry or nothing matches.
 */
export function suggestSubcategory(
  industry: IndustrySlug,
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const cleaned = normalizeCategoryText(raw);
  if (!cleaned) return null;
  const dashed = cleaned.replace(/\s+/g, "-");
  if (isSubcategory(industry, cleaned)) return cleaned;
  if (isSubcategory(industry, dashed)) return dashed;

  const list = subcategoriesFor(industry);
  for (const entry of list) {
    const label = entry.label.toLowerCase();
    const slugWords = entry.slug.replace(/-/g, " ");
    if (label === cleaned || slugWords === cleaned) return entry.slug;
  }

  // Bare industry name/alias (e.g. "fashion", "clothing") is not a subcategory.
  if (isIndustryOnlyPhrase(cleaned, industry)) return null;

  const tokens = cleaned.split(/[\s-]+/).filter(Boolean);
  for (const entry of list) {
    const label = entry.label.toLowerCase();
    const slugWords = entry.slug.replace(/-/g, " ");
    const labelTokens = label.split(/[\s&/,]+/).filter((t) => t.length >= 2);
    // Whole label / slug as substring (min length avoids "cat" inside "category").
    if (label.length >= 5 && (cleaned.includes(label) || label.includes(cleaned))) return entry.slug;
    if (slugWords.length >= 5 && cleaned.includes(slugWords)) return entry.slug;
    if (entry.slug.length >= 5 && cleaned.includes(entry.slug)) return entry.slug;
    // Token equals subcategory slug or a label word: "ethnic clothing" → ethnic
    if (tokens.includes(entry.slug)) return entry.slug;
    if (tokens.some((t) => labelTokens.includes(t) && t.length >= 4)) return entry.slug;
  }
  return null;
}

/**
 * Map free-text category to industry and, when the phrase is specific enough, a subcategory.
 * Industry aliases win over bare subcategory slugs (e.g. "clothing" → fashion, not kids.clothing).
 */
export function mapCategoryInput(raw: string | null | undefined): CategoryMapping {
  if (!raw) return { category: null, subcategory: null };
  const cleaned = normalizeCategoryText(raw);
  if (!cleaned) return { category: null, subcategory: null };
  const dashed = cleaned.replace(/\s+/g, "-");

  // Industry from slug / alias first — aliases like "clothing" must not lose to kids.clothing.
  let category: IndustrySlug | null = null;
  if (isIndustry(cleaned)) category = cleaned;
  else if (isIndustry(dashed)) category = dashed;
  else if (CATEGORY_ALIASES[cleaned]) category = CATEGORY_ALIASES[cleaned]!;
  else if (CATEGORY_ALIASES[dashed]) category = CATEGORY_ALIASES[dashed]!;

  if (category) {
    return { category, subcategory: suggestSubcategory(category, cleaned) };
  }

  // Exact subcategory slug or full label across industries.
  for (const ind of INDUSTRIES) {
    for (const entry of subcategoriesFor(ind.slug)) {
      const label = entry.label.toLowerCase();
      const slugWords = entry.slug.replace(/-/g, " ");
      if (
        entry.slug === cleaned ||
        entry.slug === dashed ||
        label === cleaned ||
        slugWords === cleaned
      ) {
        return { category: ind.slug, subcategory: entry.slug };
      }
    }
  }

  // Fuzzy industry name / short (whole-phrase containment only).
  for (const ind of INDUSTRIES) {
    const name = ind.name.toLowerCase();
    const short = ind.short.toLowerCase();
    if (
      (short.length >= 4 && cleaned.includes(short)) ||
      (name.length >= 4 && cleaned.includes(name)) ||
      (cleaned.length >= 4 && (short === cleaned || name === cleaned || name.includes(cleaned)))
    ) {
      category = ind.slug;
      break;
    }
  }

  if (category) {
    return { category, subcategory: suggestSubcategory(category, cleaned) };
  }

  // Phrase token matches a subcategory slug (e.g. "ethnic clothing" → fashion/ethnic)
  // or an industry alias word (e.g. "my clothing boutique" → fashion).
  const tokens = cleaned.split(/[\s-]+/).filter(Boolean);
  for (const ind of INDUSTRIES) {
    for (const entry of subcategoriesFor(ind.slug)) {
      if (tokens.includes(entry.slug)) {
        return { category: ind.slug, subcategory: entry.slug };
      }
    }
  }
  for (const token of tokens) {
    const aliased = CATEGORY_ALIASES[token];
    if (aliased) {
      return { category: aliased, subcategory: suggestSubcategory(aliased, cleaned) };
    }
  }

  return { category: null, subcategory: null };
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

/** Required for five-screen /start: name, category, subcategory. siteMode defaults at finalize. */
export function factsComplete(facts: VoiceFacts): boolean {
  return Boolean(facts.name && facts.category && facts.subcategory);
}

export function missingFactLabels(facts: VoiceFacts): string[] {
  const missing: string[] = [];
  if (!facts.name) missing.push("business name");
  if (!facts.category) missing.push("category");
  if (!facts.subcategory) missing.push("subcategory");
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
