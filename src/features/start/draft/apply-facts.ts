import { isIndustry, type IndustrySlug } from "@/features/stores/industries";
import { isSubcategory, subcategoryLabel } from "@/features/stores/subcategories";
import {
  SUB_EXTRAS_PREFIX,
  draftCategories,
  draftStoreName,
  draftSubcategories,
  type StartDraft,
} from "./schema";

export const MAX_STORE_CATEGORIES = 3;
export const MAX_STORE_SUBCATEGORIES = 8;
const MAX_CUSTOM_LABEL = 60;
const MAX_PRODUCTS_SERVICES = 300;

/**
 * What the quiz and Tara (voice) both collect for an online store. `applyStoreFacts` turns it into
 * draft fields, so the two paths always produce identical drafts.
 * - `categories`: industry slugs, primary first (max 3; unknown values dropped).
 * - `subcategories`: known subcategory slugs of any selected category, or custom labels (max 8).
 * - `name` / `city` / `tagline`: `null`/`undefined` keeps the current value; a string replaces it.
 */
export type StoreFacts = {
  name: string | null;
  categories: readonly string[];
  subcategories: readonly string[];
  city: string | null;
  tagline?: string | null;
};

/** Category (among `categories`) that owns `token` as a known subcategory slug. */
export function subcategoryOwner(categories: readonly IndustrySlug[], token: string): IndustrySlug | null {
  return categories.find((c) => isSubcategory(c, token)) ?? null;
}

/** Display label for a selected product type (known slug → label, custom → as typed). */
export function subcategoryDisplayLabel(categories: readonly IndustrySlug[], token: string): string {
  const owner = subcategoryOwner(categories, token);
  return (owner ? subcategoryLabel(owner, token) : null) ?? token;
}

export function normalizeStoreCategories(raw: readonly string[]): IndustrySlug[] {
  const out: IndustrySlug[] = [];
  for (const v of raw) {
    const slug = v?.trim().toLowerCase();
    if (slug && isIndustry(slug) && !out.includes(slug)) out.push(slug);
    if (out.length >= MAX_STORE_CATEGORIES) break;
  }
  return out;
}

export function normalizeStoreSubcategories(raw: readonly string[], categories: readonly IndustrySlug[]): string[] {
  const out: string[] = [];
  for (const v of raw) {
    let t = (v ?? "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    // Known slugs stay slugs; customs are labels (commas would break the `sub:` encoding).
    if (!subcategoryOwner(categories, t)) t = t.replace(/,/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_CUSTOM_LABEL);
    if (!t || out.some((x) => x.toLowerCase() === t.toLowerCase())) continue;
    out.push(t);
    if (out.length >= MAX_STORE_SUBCATEGORIES) break;
  }
  return out;
}

/**
 * Legacy single-field mirror for the seed pipeline: `subcategory` = first slug of the primary
 * category (else first custom, else the label of another category's slug); the rest go in
 * `productsServices` as `sub:a,b` (primary-category slugs as slugs, everything else as labels so
 * `collectSelectionLabels(primary, …)` prints them nicely).
 */
export function compatSubcategoryFields(
  categories: readonly IndustrySlug[],
  subcategories: readonly string[],
): { subcategory: string | null; productsServices: string | null } {
  const primary = categories[0] ?? null;
  const token = (s: string) => {
    if (primary && isSubcategory(primary, s)) return s;
    return subcategoryDisplayLabel(categories, s).replace(/,/g, " ").trim();
  };
  const isPrimarySlug = (s: string) => Boolean(primary && isSubcategory(primary, s));
  const isCustom = (s: string) => !subcategoryOwner(categories, s);
  const lead =
    subcategories.find(isPrimarySlug) ?? subcategories.find(isCustom) ?? subcategories[0] ?? null;
  if (!lead) return { subcategory: null, productsServices: null };
  const rest = subcategories.filter((s) => s !== lead).map(token).filter(Boolean);
  let encoded = "";
  for (const part of rest) {
    const next = encoded ? `${encoded},${part}` : `${SUB_EXTRAS_PREFIX}${part}`;
    if (next.length > MAX_PRODUCTS_SERVICES) break;
    encoded = next;
  }
  return { subcategory: token(lead).slice(0, 80), productsServices: encoded || null };
}

/** Pure: write quiz / voice answers into the draft (business + voice facts). Does not change `screen`. */
export function applyStoreFacts(draft: StartDraft, facts: StoreFacts): StartDraft {
  const categories = normalizeStoreCategories(facts.categories);
  const subcategories = normalizeStoreSubcategories(facts.subcategories, categories);
  const compat = compatSubcategoryFields(categories, subcategories);
  const name = facts.name == null ? draftStoreName(draft) : facts.name.trim().slice(0, 120);
  const city =
    facts.city == null
      ? draft.business.city || draft.voice.facts.city || ""
      : facts.city.trim().slice(0, 80);
  const tagline =
    facts.tagline == null
      ? draft.business.tagline || draft.voice.facts.tagline || ""
      : facts.tagline.trim().slice(0, 160);
  // Free-text products/services (not our `sub:` encoding) survive when there are no extras.
  const prevFree = draft.business.productsServices.trim();
  const freeText = prevFree && !prevFree.toLowerCase().startsWith(SUB_EXTRAS_PREFIX) ? prevFree : "";
  const productsServices = compat.productsServices ?? freeText;
  const primary = categories[0] ?? null;

  return {
    ...draft,
    business: {
      ...draft.business,
      name,
      tagline,
      city,
      category: primary,
      categories,
      subcategory: compat.subcategory,
      subcategories,
      productsServices,
      siteMode: "ecommerce",
    },
    voice: {
      ...draft.voice,
      facts: {
        ...draft.voice.facts,
        name: name || null,
        category: primary,
        categories,
        subcategory: compat.subcategory,
        subcategories,
        productsServices: productsServices || null,
        siteMode: "ecommerce",
        city: city || null,
        tagline: tagline || null,
      },
    },
  };
}

/** Current answers as `StoreFacts` (to resume the quiz or confirm Tara's facts). */
export function storeFactsFromDraft(draft: StartDraft): StoreFacts {
  return {
    name: draftStoreName(draft) || null,
    categories: draftCategories(draft),
    subcategories: draftSubcategories(draft),
    city: draft.business.city || draft.voice.facts.city || null,
    tagline: draft.business.tagline || draft.voice.facts.tagline || null,
  };
}

/** Facts complete enough to leave the quiz / voice step. */
export function storeFactsComplete(facts: StoreFacts): boolean {
  const categories = normalizeStoreCategories(facts.categories);
  return (
    (facts.name?.trim().length ?? 0) >= 2 &&
    categories.length > 0 &&
    normalizeStoreSubcategories(facts.subcategories, categories).length > 0
  );
}
