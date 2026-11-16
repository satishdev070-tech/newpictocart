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
  /** All industries the seller named (max 3). `category` mirrors the first. */
  categories: IndustrySlug[];
  /** Subcategory slugs for those industries, or custom labels (max 8). `subcategory` mirrors the first. */
  subcategories: string[];
};

/** Older shapes (drafts saved before multi-select) may lack the lists. */
export type VoiceFactsInput = Omit<VoiceFacts, "categories" | "subcategories"> & {
  categories?: readonly string[];
  subcategories?: readonly string[];
};

/** Kept as an alias: facts after `normalizeFacts` (lists always present, scalars mirror item 0). */
export type NormalizedVoiceFacts = VoiceFacts;

export const MAX_FACT_CATEGORIES = 3;
export const MAX_FACT_SUBCATEGORIES = 8;

export type CategoryMapping = {
  category: IndustrySlug | null;
  subcategory: string | null;
};

function normalizeCategoryText(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
}

export const EMPTY_FACTS: NormalizedVoiceFacts = {
  name: null,
  category: null,
  subcategory: null,
  productsServices: null,
  siteMode: null,
  tagline: null,
  city: null,
  categories: [],
  subcategories: [],
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
  bangles: "jewellery",
  earrings: "jewellery",
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
  gym: "gym",
  "fitness studio": "gym",
  "gym studio": "gym",
  crossfit: "gym",
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

/** Singular candidates for a spoken word: "sarees" → "saree", "toys" → "toy". */
function singularForms(word: string): string[] {
  const out: string[] = [];
  if (word.length > 4 && word.endsWith("ies")) out.push(`${word.slice(0, -3)}y`);
  if (word.length > 4 && word.endsWith("es")) out.push(word.slice(0, -2));
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) out.push(word.slice(0, -1));
  return out;
}

/** Alias lookup that also accepts the plural / singular form ("gift" ↔ "gifts", "shoe" → "shoes"). */
function aliasFor(word: string): IndustrySlug | null {
  if (!word) return null;
  const direct = CATEGORY_ALIASES[word];
  if (direct) return direct;
  for (const form of [...singularForms(word), `${word}s`]) {
    const hit = CATEGORY_ALIASES[form];
    if (hit) return hit;
    if (isIndustry(form)) return form;
  }
  return null;
}

/** Map free-text / model output to a known industry slug. */
export function mapCategoryToIndustry(raw: string | null | undefined): IndustrySlug | null {
  return mapCategoryInput(raw).category;
}

/** True when cleaned text is only the industry itself (no subcategory signal). */
function isIndustryOnlyPhrase(cleaned: string, industry: IndustrySlug): boolean {
  const dashed = cleaned.replace(/\s+/g, "-");
  if (cleaned === industry || dashed === industry) return true;
  if (aliasFor(cleaned) === industry || aliasFor(dashed) === industry) return true;
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
  else category = aliasFor(cleaned) ?? aliasFor(dashed);

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
    const aliased = aliasFor(token);
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

function dedupe<T extends string>(items: readonly T[], max: number): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

/** True when `slug` is a known subcategory of any industry (vs. a seller's custom label). */
function isKnownSubcategorySlug(slug: string): boolean {
  return INDUSTRIES.some((ind) => isSubcategory(ind.slug, slug));
}

/**
 * Keep single + list fields in sync: `category` = categories[0], `subcategory` = subcategories[0].
 * A set scalar that is missing from its list is moved to the front. Known subcategory slugs that
 * belong to none of the categories are dropped; custom labels are kept.
 */
export function normalizeFacts(facts: VoiceFactsInput): NormalizedVoiceFacts {
  let categories = dedupe(
    [...(facts.category ? [facts.category] : []), ...(facts.categories ?? [])].filter((c): c is IndustrySlug => isIndustry(c)),
    MAX_FACT_CATEGORIES,
  );
  let subcategories = dedupe(
    [...(facts.subcategory ? [facts.subcategory] : []), ...(facts.subcategories ?? [])].map((s) => s.trim().slice(0, 80)),
    MAX_FACT_SUBCATEGORIES * 2,
  );
  if (categories.length) {
    subcategories = subcategories.filter(
      (s) => categories.some((c) => isSubcategory(c, s)) || !isKnownSubcategorySlug(s),
    );
  }
  subcategories = subcategories.slice(0, MAX_FACT_SUBCATEGORIES);
  categories = categories.slice(0, MAX_FACT_CATEGORIES);
  return {
    ...facts,
    categories,
    subcategories,
    category: categories[0] ?? null,
    subcategory: subcategories[0] ?? null,
  };
}

/**
 * Merge partial fact updates (null/empty leaves previous). Lists are unioned (new items appended,
 * capped); a scalar `category`/`subcategory` in the patch becomes the first list item.
 * Tolerates `prev` without lists (drafts saved before multi-select).
 */
export function mergeFacts(prev: VoiceFactsInput, patch: Partial<VoiceFacts>): NormalizedVoiceFacts {
  const base: NormalizedVoiceFacts = {
    ...EMPTY_FACTS,
    ...prev,
    categories: (prev.categories ?? []).filter((c): c is IndustrySlug => isIndustry(c)),
    subcategories: [...(prev.subcategories ?? [])],
  };
  const next: NormalizedVoiceFacts = { ...base };
  for (const key of Object.keys(patch) as (keyof VoiceFacts)[]) {
    if (key === "categories" || key === "subcategories") continue;
    const val = patch[key];
    if (val === undefined || val === null) continue;
    if (typeof val === "string" && !val.trim()) continue;
    next[key] = val as never;
  }
  // Scalars from the patch lead; then previous lists; then new list items.
  next.categories = [
    ...(patch.category ? [patch.category] : []),
    ...(base.category && base.category !== patch.category ? [base.category] : []),
    ...base.categories,
    ...(patch.categories ?? []),
  ];
  next.subcategories = [
    ...(patch.subcategory && patch.subcategory.trim() ? [patch.subcategory] : []),
    ...(base.subcategory ? [base.subcategory] : []),
    ...base.subcategories,
    ...(patch.subcategories ?? []),
  ];
  next.category = null;
  next.subcategory = null;
  return normalizeFacts(next);
}

/** Required for five-screen /start: name, category, subcategory. siteMode defaults at finalize. */
export function factsComplete(facts: VoiceFactsInput): boolean {
  return Boolean(
    facts.name && (facts.category || facts.categories?.length) && (facts.subcategory || facts.subcategories?.length),
  );
}

/** Tara shows the confirmation card once name + ≥1 category + ≥1 subcategory are known. */
export function confirmationReady(facts: VoiceFactsInput): boolean {
  const n = normalizeFacts(facts);
  return Boolean(n.name?.trim() && n.categories.length >= 1 && n.subcategories.length >= 1);
}

export function missingFactLabels(facts: VoiceFactsInput): string[] {
  const n = normalizeFacts(facts);
  const missing: string[] = [];
  if (!n.name) missing.push("business name");
  if (!n.categories.length) missing.push("category");
  if (!n.subcategories.length) missing.push("subcategory");
  return missing;
}

/** Facts handed to the journey when the seller confirms Tara's summary. */
export type ConfirmedStoreFacts = {
  name: string;
  categories: string[];
  subcategories: string[];
  city: string | null;
  tagline: string | null;
};

export function toConfirmedFacts(facts: VoiceFactsInput): ConfirmedStoreFacts {
  const n = normalizeFacts(facts);
  return {
    name: (n.name ?? "").trim(),
    categories: [...n.categories],
    subcategories: [...n.subcategories],
    city: n.city?.trim() || null,
    tagline: n.tagline?.trim() || null,
  };
}

function toStringList(raw: unknown): string[] {
  if (typeof raw === "string") return raw.trim() ? [raw] : [];
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && Boolean(v.trim()));
}

function customLabel(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, " ");
  if (t.length < 2 || t.length > 60) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Resolve free-text / model category + subcategory lists into industry slugs and
 * industry-scoped subcategory slugs (unknown niches survive as custom labels).
 */
export function resolveFactLists(
  rawCategories: readonly string[],
  rawSubcategories: readonly string[],
  known: readonly IndustrySlug[] = [],
): { categories: IndustrySlug[]; subcategories: string[] } {
  const categories: IndustrySlug[] = [];
  const subcategories: string[] = [];
  for (const raw of rawCategories) {
    const m = mapCategoryInput(raw);
    if (m.category) categories.push(m.category);
    if (m.subcategory) subcategories.push(m.subcategory);
  }
  for (const raw of rawSubcategories) {
    const scope = [...categories, ...known];
    let hit: string | null = null;
    for (const c of scope) {
      hit = suggestSubcategory(c, raw);
      if (hit) break;
    }
    if (!hit) {
      const m = mapCategoryInput(raw);
      if (m.category && m.subcategory) {
        categories.push(m.category);
        hit = m.subcategory;
      }
    }
    const value = hit ?? (mapCategoryToIndustry(raw) ? null : customLabel(raw));
    if (value) subcategories.push(value);
  }
  return {
    categories: dedupe(categories, MAX_FACT_CATEGORIES),
    subcategories: dedupe(subcategories, MAX_FACT_SUBCATEGORIES),
  };
}

const LEAD_PHRASES =
  /^(?:(?:hi|hello|namaste|namaskar)[,!.\s]+)?(?:i|we)\s+(?:(?:mainly|mostly|also|just|only)\s+)?(?:sell|make|deal\s+in|run\s+a\s+shop\s+for|have\s+a\s+(?:shop|store)\s+(?:for|of)|create|offer)\s+|^(?:my|our)\s+(?:shop|store|business)\s+(?:sells|is\s+about|is\s+for)\s+/i;
const CITY_TAIL = /\s+(?:in|from|at|based\s+in)\s+([a-z][a-z .'-]{1,40}?)\s*[.!]?$/i;

/** Common Indian cities (lowercase Latin or Devanagari spelling → display name). */
const KNOWN_CITIES: Readonly<Record<string, string>> = {
  delhi: "Delhi", "new delhi": "New Delhi", dilli: "Delhi", noida: "Noida", "greater noida": "Greater Noida",
  gurgaon: "Gurgaon", gurugram: "Gurugram", ghaziabad: "Ghaziabad", faridabad: "Faridabad", mumbai: "Mumbai",
  bombay: "Mumbai", pune: "Pune", thane: "Thane", nagpur: "Nagpur", nashik: "Nashik", bangalore: "Bengaluru",
  bengaluru: "Bengaluru", mysore: "Mysuru", mysuru: "Mysuru", chennai: "Chennai", madras: "Chennai",
  coimbatore: "Coimbatore", madurai: "Madurai", hyderabad: "Hyderabad", vijayawada: "Vijayawada",
  visakhapatnam: "Visakhapatnam", vizag: "Visakhapatnam", kolkata: "Kolkata", calcutta: "Kolkata",
  ahmedabad: "Ahmedabad", surat: "Surat", vadodara: "Vadodara", baroda: "Vadodara", rajkot: "Rajkot",
  jaipur: "Jaipur", jodhpur: "Jodhpur", udaipur: "Udaipur", lucknow: "Lucknow", kanpur: "Kanpur",
  varanasi: "Varanasi", banaras: "Varanasi", agra: "Agra", meerut: "Meerut", prayagraj: "Prayagraj",
  allahabad: "Prayagraj", patna: "Patna", ranchi: "Ranchi", bhopal: "Bhopal", indore: "Indore",
  chandigarh: "Chandigarh", ludhiana: "Ludhiana", amritsar: "Amritsar", jalandhar: "Jalandhar",
  dehradun: "Dehradun", kochi: "Kochi", cochin: "Kochi", thiruvananthapuram: "Thiruvananthapuram",
  trivandrum: "Thiruvananthapuram", kozhikode: "Kozhikode", bhubaneswar: "Bhubaneswar", guwahati: "Guwahati",
  raipur: "Raipur", goa: "Goa", srinagar: "Srinagar", jammu: "Jammu", mangalore: "Mangaluru", mangaluru: "Mangaluru",
  "दिल्ली": "Delhi", "नई दिल्ली": "New Delhi", "नोएडा": "Noida", "नोयडा": "Noida", "गुड़गांव": "Gurgaon",
  "गुरुग्राम": "Gurugram", "गाज़ियाबाद": "Ghaziabad", "गाजियाबाद": "Ghaziabad", "फरीदाबाद": "Faridabad",
  "मुंबई": "Mumbai", "पुणे": "Pune", "नागपुर": "Nagpur", "बेंगलुरु": "Bengaluru", "बैंगलोर": "Bengaluru",
  "चेन्नई": "Chennai", "हैदराबाद": "Hyderabad", "कोलकाता": "Kolkata", "अहमदाबाद": "Ahmedabad", "सूरत": "Surat",
  "जयपुर": "Jaipur", "जोधपुर": "Jodhpur", "उदयपुर": "Udaipur", "लखनऊ": "Lucknow", "कानपुर": "Kanpur",
  "वाराणसी": "Varanasi", "बनारस": "Varanasi", "आगरा": "Agra", "मेरठ": "Meerut", "पटना": "Patna", "रांची": "Ranchi",
  "भोपाल": "Bhopal", "इंदौर": "Indore", "चंडीगढ़": "Chandigarh", "लुधियाना": "Ludhiana", "अमृतसर": "Amritsar",
  "देहरादून": "Dehradun", "प्रयागराज": "Prayagraj", "इलाहाबाद": "Prayagraj",
};

/** Capitalised words before a postposition that are clearly not places. */
const NOT_A_PLACE = new Set([
  "main", "mai", "mein", "hum", "ham", "mera", "meri", "mere", "hamara", "hamari", "humara", "humari", "apna", "apni",
  "ghar", "dukaan", "dukan", "shop", "store", "market", "bazaar", "bazar", "online", "instagram", "whatsapp",
  "facebook", "amazon", "flipkart", "meesho", "india", "bharat", "city", "shehar", "sheher", "gaon", "gaanv", "area",
  "mohalla", "saal", "years", "pehle", "abhi", "yahan", "wahan", "kahan", "isme", "usme", "inme", "sab", "kya",
]);

/** Hinglish postposition after a city ("Noida mein", "Noida se", "Noida ki dukaan"). */
const LATIN_CITY_BEFORE_POSTPOSITION =
  /(?:^|\s)((?:[A-Za-z][A-Za-z'.-]+\s+)?[A-Za-z][A-Za-z'.-]+)\s+(?:mein|mei|me|men|mai|se|ka|ki|ke)(?=$|[\s,.!?])/gu;
/** Devanagari postposition after a city ("नोएडा में", "दिल्ली से"). */
const DEVANAGARI_CITY_BEFORE_POSTPOSITION =
  /(?:^|\s)((?:[\u0900-\u097F]+\s+)?[\u0900-\u097F]+)\s+(?:में|मे|से|का|की|के)(?=$|[\s,.!?।])/gu;
/** English preposition before a known city anywhere in the sentence ("in Noida we sell…"). */
const KNOWN_CITY_AFTER_PREPOSITION = /(?:^|\s)(?:in|from|at|based\s+in)\s+([A-Za-z][A-Za-z'.-]+(?:\s+[A-Za-z][A-Za-z'.-]+)?)(?=$|[\s,.!?])/giu;

function titleCase(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** City name for a candidate phrase: a known city, or (Latin only) a capitalised non-product word. */
function cityFromCandidate(candidate: string, allowUnknownCapitalised: boolean): string | null {
  const words = candidate.trim().split(/\s+/);
  // Prefer the two-word form ("New Delhi"), then the word next to the postposition / preposition.
  const options = words.length > 1 ? [words.join(" "), words[words.length - 1]!, words[0]!] : words;
  for (const option of options) {
    const known = KNOWN_CITIES[option.toLowerCase()];
    if (known) return known;
  }
  if (!allowUnknownCapitalised) return null;
  const last = words[words.length - 1]!;
  if (!/^[A-Z][a-z'.-]{2,}$/.test(last)) return null;
  if (NOT_A_PLACE.has(last.toLowerCase()) || FILLER_WORDS.has(last.toLowerCase())) return null;
  if (mapCategoryInput(canonicalizeSpokenText(last)).category) return null;
  return titleCase(last);
}

/**
 * City said with a Hindi / Hinglish postposition or mid-sentence English preposition:
 * "Noida mein meri dukaan hai", "Main Noida se hoon", "नोएडा में", "in Noida we sell…".
 * Returns the city and the sentence with that phrase removed.
 */
export function extractCityPhrase(sentence: string): { city: string; rest: string } | null {
  const tries: [RegExp, boolean][] = [
    [KNOWN_CITY_AFTER_PREPOSITION, false],
    [DEVANAGARI_CITY_BEFORE_POSTPOSITION, false],
    [LATIN_CITY_BEFORE_POSTPOSITION, true],
  ];
  for (const [pattern, allowUnknown] of tries) {
    for (const m of sentence.matchAll(pattern)) {
      const city = m[1] ? cityFromCandidate(m[1], allowUnknown) : null;
      if (!city || m.index === undefined) continue;
      const rest = `${sentence.slice(0, m.index)} ${sentence.slice(m.index + m[0].length)}`.replace(/\s+/g, " ").trim();
      return { city, rest };
    }
  }
  return null;
}

/** Letters or combining marks (Indic vowel signs) — used instead of `\b`, which is ASCII-only. */
const L = "[\\p{L}\\p{M}]";

/**
 * Spoken variants → words the category mapper knows. Covers spelling drift from STT
 * ("jewelry", "javels"), and common Hindi / Hinglish shop words. Modest on purpose: the
 * model does the real understanding; this only backs it up.
 */
const SPOKEN_SYNONYMS: readonly [RegExp, string][] = [
  [/(?:jewel(?:le)?ry|jewelery|jwell?ery|jewellry|javell?(?:ery|ry|s)?|jewel)/giu, "jewellery"],
  [/(?:gehn[ae]|gahn[ae]|zevar|zewar|jevar|jewar|zeware?|गहन[ेा]|ज़?ेवर|जेवर)/giu, "jewellery"],
  [/(?:kapd[ea]|kapr[ea]|kapdon|कपड़[ेा]|कपडे)/giu, "clothing"],
  [/(?:saa?rees?|saris?|kurtis?|lehenga?s?|salwar(?:\s+suits?)?|साड़ी|साडी|कुर्ती|लहंगा)/giu, "ethnic wear"],
  [/(?:mithai(?:yan|yaan)?|मिठाई|मिठाइयाँ)/giu, "mithai"],
  [/(?:namkeen|नमकीन)/giu, "namkeen"],
  [/(?:joot[ea]|jutt?is?|chappals?|जूत[ेा]|चप्पल)/giu, "footwear"],
  [/(?:khilon[ea]|खिलौन[ेा])/giu, "toys"],
  [/(?:kitab(?:en|ein|e)?|किताब(?:ें)?)/giu, "books"],
  [/(?:masal[ea]s?|मसाल[ेा])/giu, "spices"],
  [/(?:dawai(?:yan|yaan)?|दवाई|दवा)/giu, "health"],
  [/(?:it+a?r|attar|इत्र)/giu, "perfume"],
  [/(?:chai|चाय)/giu, "tea"],
  [/(?:bartan|बर्तन)/giu, "kitchen"],
  [/(?:shring(?:a|aa)r|singaar|शृंगार|श्रृंगार)/giu, "makeup"],
  [/(?:khaana|khana|खाना)/giu, "food"],
];

/** Filler words dropped from a spoken segment before mapping ("main kapde bechti hoon" → "kapde"). */
const FILLER_WORDS = new Set([
  "i", "we", "my", "our", "the", "a", "an", "some", "all", "lots", "of", "many", "kinds", "types", "type",
  "items", "products", "stuff", "things", "etc", "sell", "selling", "also", "mainly", "mostly", "only", "just",
  "main", "mai", "mein", "hum", "ham", "mera", "meri", "mere", "hamara", "hamari", "humara", "humari", "apna", "apni",
  "bechta", "bechti", "bechte", "bechna", "hoon", "hun", "hu", "hai", "hain", "ka", "ki", "ke", "kaam", "sab", "sare",
  "saare", "bhi", "tarah", "wale", "wali",
  "मैं", "हम", "मेरा", "मेरी", "हमारा", "हमारी", "बेचता", "बेचती", "बेचते", "हूँ", "हूं", "है", "हैं", "का", "की", "के", "सब", "भी",
]);

function dropFillers(segment: string): string {
  return segment
    .split(/\s+/)
    .filter((w) => w && !FILLER_WORDS.has(w))
    .join(" ");
}

/** Apply `SPOKEN_SYNONYMS` on whole words (Unicode-aware). */
export function canonicalizeSpokenText(text: string): string {
  let out = text.toLowerCase();
  for (const [pattern, replacement] of SPOKEN_SYNONYMS) {
    out = out.replace(new RegExp(`(?<!${L})(?:${pattern.source})(?!${L})`, "giu"), replacement);
  }
  return out;
}

const NAME_END = String.raw`(?=\s*(?:[.!?।,]|\s(?:and|aur|और|we|i|where)\s|$))`;
const NAME_PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`(?:store|shop|business|brand|boutique|company|dukaa?n)(?:'s)?\s+(?:name\s+)?(?:is\s+)?(?:called|named)\s+(.+?)${NAME_END}`, "iu"),
  new RegExp(String.raw`(?:store|shop|business|brand|boutique|company|dukaa?n)(?:'s)?\s+name\s+is\s+(.+?)${NAME_END}`, "iu"),
  new RegExp(String.raw`(?:^|\s)(?:it's|it\s+is|we're|we\s+are|i'm|i\s+am)\s+called\s+(.+?)${NAME_END}`, "iu"),
  new RegExp(String.raw`^(?:the\s+)?name\s+is\s+(.+?)${NAME_END}`, "iu"),
  /(?:store|shop|dukaa?n|business|brand)\s+ka\s+naa?m\s+(.+?)\s+hai(?![\p{L}\p{M}])/iu,
  /(?:स्टोर|दुकान|बिज़नेस|ब्रांड)\s+का\s+नाम\s+(.+?)\s+है/u,
];

/** Store name as the seller said it ("My store is called Kia Javels" → "Kia Javels"). */
function extractName(text: string): { name: string | null; rest: string } {
  for (const pattern of NAME_PATTERNS) {
    const m = text.match(pattern);
    const raw = m?.[1];
    if (!raw || m.index === undefined) continue;
    const name = raw
      .trim()
      .replace(/^["'“‘]+|["'”’]+$/g, "")
      .replace(/\s+/g, " ");
    const words = name.split(" ").length;
    if (name.length < 2 || name.length > 60 || words > 6) continue;
    const rest = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`.trim();
    return { name, rest };
  }
  return { name: null, rest: text };
}

/**
 * Local, model-free extraction from what the seller said, e.g.
 * "My store is called Kia Javels. I sell fashion jewelry and bridal sets in Noida"
 * → name "Kia Javels" (kept as said), jewellery, [imitation, bridal], Noida.
 * Understands common Hinglish shop words ("kapde aur gehne" → fashion + jewellery).
 * Runs after every Tara turn to fill gaps the model left, and as the fallback when Tara's
 * JSON can't be parsed.
 */
export function extractFactsFromText(text: string): Partial<VoiceFacts> {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const { name, rest } = extractName(trimmed);
  let city: string | null = null;
  const categories: IndustrySlug[] = [];
  const subcategories: string[] = [];

  const sentences = rest
    .split(/[.!?।]+/u)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const sentence of sentences) {
    let part = sentence;
    const cityMatch = part.match(CITY_TAIL);
    if (cityMatch?.[1]) {
      city ??= cityMatch[1]
        .trim()
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
      part = part.slice(0, cityMatch.index).trim();
    } else {
      const phrase = extractCityPhrase(part);
      if (phrase) {
        city ??= phrase.city;
        part = phrase.rest;
      }
    }
    part = canonicalizeSpokenText(part.replace(LEAD_PHRASES, ""));
    const segments = part
      .split(/\s*(?:,|&|\+|\band\b|\baur\b|\bplus\b|\balso\b|\bor\b|\s+और\s+)\s*/iu)
      .map((s) => dropFillers(s.trim()))
      .filter(Boolean);
    for (const seg of segments) {
      const m = mapCategoryInput(seg);
      if (m.category) categories.push(m.category);
      if (m.subcategory) subcategories.push(m.subcategory);
    }
  }

  const out: Partial<VoiceFacts> = {};
  const cats = dedupe(categories, MAX_FACT_CATEGORIES);
  const subs = dedupe(subcategories, MAX_FACT_SUBCATEGORIES);
  if (name) out.name = name;
  if (cats.length) out.categories = cats;
  if (subs.length) out.subcategories = subs;
  if (city) out.city = city;
  return out;
}

/**
 * Fill only what is still missing after Tara's (model) facts, from the local extractor.
 * Never overrides a value the model or the seller already set, so corrections stick.
 */
export function fillFactGaps(facts: VoiceFactsInput, local: Partial<VoiceFacts>): NormalizedVoiceFacts {
  const n = normalizeFacts(facts);
  const patch: Partial<VoiceFacts> = {};
  if (!n.name?.trim() && local.name) patch.name = local.name;
  if (!n.city?.trim() && local.city) patch.city = local.city;
  if (!n.categories.length && local.categories?.length) patch.categories = local.categories;
  if (!n.subcategories.length && local.subcategories?.length) patch.subcategories = local.subcategories;
  return Object.keys(patch).length ? mergeFacts(n, patch) : n;
}

/**
 * Parse the client's `factsJson` (single + list fields) into normalized facts.
 * Shared by `voiceTurnAction` and `/start`'s `startVoiceTurnAction`.
 */
export function parseVoiceFactsJson(raw: unknown): NormalizedVoiceFacts {
  if (typeof raw !== "string" || !raw.trim()) return { ...EMPTY_FACTS };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    const mapped = mapCategoryInput(str(parsed.category));
    const category = mapped.category;
    const subcategoryRaw = str(parsed.subcategory);
    const subcategory =
      (category && subcategoryRaw ? suggestSubcategory(category, subcategoryRaw) : null) ??
      mapped.subcategory ??
      subcategoryRaw;
    const lists = resolveFactLists(toStringList(parsed.categories), toStringList(parsed.subcategories), category ? [category] : []);
    return mergeFacts(EMPTY_FACTS, {
      name: str(parsed.name),
      category,
      subcategory,
      categories: lists.categories,
      subcategories: lists.subcategories,
      productsServices: str(parsed.productsServices),
      siteMode: mapSiteMode(str(parsed.siteMode)),
      tagline: str(parsed.tagline),
      city: str(parsed.city),
    });
  } catch {
    return { ...EMPTY_FACTS };
  }
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
