import { z } from "zod";
import { INDUSTRY_SLUGS, type IndustrySlug } from "@/features/stores/industries";

/**
 * Product-type catalogue (pure module, shared by the editor, server, storefront and Super Admin).
 *
 * - DEFAULT_PRODUCT_TYPES is the code-side catalogue. Super Admin edits are stored in
 *   public.product_types (migration 3200): a row overrides the default with the same key
 *   (rename, industries, template, disable) or adds a new key. Until the migration is applied the
 *   defaults are used as-is.
 * - Sellers can add store-only types (public.tenant_product_types).
 * - Each type has an attribute template: `fashion` shows the clothing fields (fabric, style,
 *   length, work, pattern, occasion), `sizes` shows the size chart, `specs` are labelled fields
 *   stored as rows in products.attributes.specs (the existing structure the storefront renders).
 * - Product type keys are plain strings: old values (kurta, saree…) keep working; unknown keys are
 *   shown humanised with a generic template.
 */

export const PRODUCT_TYPE_KEY_RE = /^[a-z0-9][a-z0-9_]{0,39}$/;
export const productTypeKeySchema = z.string().trim().toLowerCase().regex(PRODUCT_TYPE_KEY_RE, "Use a product type from the list");

/** Keys accepted by the products.product_type CHECK constraint before migration 3200. */
export const LEGACY_PRODUCT_TYPES = ["kurta", "kurta_set", "suit", "co_ord_set", "dress", "saree", "lehenga", "top", "shirt", "bottom", "dupatta", "nightwear", "accessory", "other"] as const;
export const isLegacyProductType = (key: string) => (LEGACY_PRODUCT_TYPES as readonly string[]).includes(key);

/**
 * Before migration 3200 a non-legacy type is saved as product_type 'other' with the real key in
 * attributes._type (the migration moves it back into product_type).
 */
export const TYPE_FALLBACK_ATTR = "_type";

export function effectiveProductType(productType: string, attributes: unknown): string {
  if (productType === "other" && attributes && typeof attributes === "object" && !Array.isArray(attributes)) {
    const k = (attributes as Record<string, unknown>)[TYPE_FALLBACK_ATTR];
    if (typeof k === "string" && PRODUCT_TYPE_KEY_RE.test(k)) return k;
  }
  return productType;
}

/** save_product failed only because the pre-3200 CHECK rejects a new type key. */
export function isTypeCheckViolation(error: { code?: string; message?: string } | null | undefined, key: string): boolean {
  return !!error && error.code === "23514" && (error.message ?? "").includes("product_type") && !isLegacyProductType(key);
}

/** Payload copy that stores the key in attributes._type and product_type 'other' (pre-3200 fallback). */
export function withTypeFallback<P extends { product: { product_type: string; attributes: Record<string, unknown> } }>(payload: P): P {
  return { ...payload, product: { ...payload.product, product_type: "other", attributes: { ...payload.product.attributes, [TYPE_FALLBACK_ATTR]: payload.product.product_type } } };
}

export type AttributeTemplate = {
  /** Show the clothing fields (fabric, style, length, work, pattern, occasion). */
  fashion: boolean;
  /** Sized product: show the size chart picker and size presets. */
  sizes: boolean;
  /** Labelled detail fields (stored as attributes.specs rows). */
  specs: string[];
  /** Label for the care/usage text box. */
  care: string;
};

export type ProductTypeDef = {
  key: string;
  label: string;
  plural: string;
  industries: string[];
  template: AttributeTemplate;
  position: number;
  status: "active" | "disabled";
  source: "default" | "platform" | "store";
};

export const attributeTemplateSchema = z.object({
  fashion: z.boolean().default(false),
  sizes: z.boolean().default(false),
  specs: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  care: z.string().trim().max(40).default("Care & usage"),
});

export const GENERIC_TEMPLATE: AttributeTemplate = { fashion: false, sizes: false, specs: ["Material", "Dimensions", "Weight"], care: "Care & usage" };

// ---- templates --------------------------------------------------------------------------

const tpl = (specs: string[], care = "Care & usage", extra: Partial<AttributeTemplate> = {}): AttributeTemplate => ({ fashion: false, sizes: false, specs, care, ...extra });

const T = {
  apparel: tpl([], "Fabric & care", { fashion: true, sizes: true }),
  apparelAccessory: tpl(["Material", "Dimensions"], "Fabric & care", { fashion: true }),
  basicApparel: tpl(["Material", "Fit"], "Fabric & care", { sizes: true }),
  footwear: tpl(["Upper material", "Sole material", "Closure", "Heel height"], "Care", { sizes: true }),
  electronics: tpl(["Model", "Warranty", "Battery / power", "Connectivity", "In the box", "Dimensions", "Weight"], "Usage & safety"),
  mobileAccessory: tpl(["Compatible with", "Material", "Connectivity", "Warranty"], "Usage & safety"),
  beauty: tpl(["Net quantity", "Skin / hair type", "Key ingredients", "Shelf life", "Country of origin"], "How to use"),
  jewellery: tpl(["Metal", "Purity", "Stone", "Weight", "Plating", "Dimensions"], "Jewellery care"),
  furniture: tpl(["Material", "Finish", "Dimensions (L × W × H)", "Weight", "Assembly", "Warranty"], "Care & assembly"),
  food: tpl(["Net weight", "Ingredients", "Shelf life", "Veg / non-veg", "Storage", "FSSAI licence no."], "Storage instructions"),
  health: tpl(["Net quantity", "Key ingredients", "Dosage / usage", "Shelf life"], "Directions for use"),
  sports: tpl(["Material", "Size / dimensions", "Weight", "Suitable for"], "Care & usage"),
  kids: tpl(["Age group", "Material", "Dimensions", "Safety certification"], "Care & safety"),
  toy: tpl(["Age group", "Material", "Batteries", "Dimensions", "Safety certification"], "Care & safety"),
  book: tpl(["Author", "Publisher", "Language", "Pages", "ISBN", "Binding"], "Notes"),
  stationery: tpl(["Material", "Dimensions", "Pack of", "Colour"], "Care & usage"),
  pet: tpl(["Pet type", "Breed size", "Net weight", "Ingredients / material"], "Feeding / usage"),
  automotive: tpl(["Compatible vehicles", "Material", "Dimensions", "Warranty"], "Installation & care"),
  appliance: tpl(["Power", "Capacity", "Connectivity", "Dimensions", "Warranty"], "Usage & safety"),
  handicraft: tpl(["Material", "Craft / technique", "Origin", "Dimensions"], "Care"),
  bag: tpl(["Material", "Dimensions", "Capacity", "Compartments", "Warranty"], "Care"),
  watch: tpl(["Movement", "Case material", "Dial size", "Strap material", "Water resistance", "Warranty"], "Care"),
  eyewear: tpl(["Frame material", "Lens type", "Frame size", "UV protection"], "Care"),
  fragrance: tpl(["Volume", "Fragrance notes", "Concentration", "Longevity"], "How to use"),
  decor: tpl(["Material", "Dimensions", "Finish", "Weight"], "Care"),
  lighting: tpl(["Material", "Dimensions", "Bulb type", "Wattage", "Warranty"], "Usage & safety"),
  kitchen: tpl(["Material", "Capacity", "Dimensions", "Dishwasher safe", "Warranty"], "Care & usage"),
  textile: tpl(["Material", "Dimensions", "Thread count", "Pack contents"], "Wash care"),
  gift: tpl(["Contents", "Personalisation", "Dimensions"], "Notes"),
  plant: tpl(["Plant type", "Pot size", "Sunlight", "Watering", "Height"], "Plant care"),
  pooja: tpl(["Material", "Dimensions", "Weight"], "Care"),
  tool: tpl(["Material", "Power", "Dimensions", "Warranty"], "Usage & safety"),
  music: tpl(["Type", "Material", "Includes", "Warranty"], "Care"),
  art: tpl(["Medium", "Dimensions", "Framing", "Artist", "Certificate of authenticity"], "Care"),
  beverage: tpl(["Net weight", "Origin", "Type", "Brewing", "Shelf life"], "Storage & brewing"),
  generic: GENERIC_TEMPLATE,
} satisfies Record<string, AttributeTemplate>;

// ---- default catalogue ------------------------------------------------------------------

type Seed = [key: string, label: string, plural: string, industries: IndustrySlug[], template: AttributeTemplate];

const SEEDS: Seed[] = [
  // Fashion (the original catalogue; keys kept stable for existing products)
  ["kurta", "Kurta", "Kurtas", ["fashion", "handicrafts"], T.apparel],
  ["kurta_set", "Kurta set", "Kurta sets", ["fashion", "handicrafts"], T.apparel],
  ["suit", "Suit set", "Suit sets", ["fashion"], T.apparel],
  ["co_ord_set", "Co-ord set", "Co-ord sets", ["fashion"], T.apparel],
  ["dress", "Dress", "Dresses", ["fashion", "kids"], T.apparel],
  ["saree", "Saree", "Sarees", ["fashion", "handicrafts"], T.apparel],
  ["lehenga", "Lehenga", "Lehengas", ["fashion"], T.apparel],
  ["top", "Top", "Tops", ["fashion"], T.apparel],
  ["shirt", "Shirt", "Shirts", ["fashion"], T.apparel],
  ["tshirt", "T-shirt", "T-shirts", ["fashion", "sports", "gym"], T.basicApparel],
  ["bottom", "Bottom", "Bottoms", ["fashion"], T.apparel],
  ["jacket", "Jacket", "Jackets", ["fashion"], T.apparel],
  ["dupatta", "Dupatta", "Dupattas", ["fashion", "handicrafts"], T.apparel],
  ["nightwear", "Nightwear", "Nightwear", ["fashion"], T.apparel],
  ["accessory", "Accessory", "Accessories", ["fashion", "jewellery", "bags", "watches", "general"], T.apparelAccessory],
  // Electronics
  ["smartphone", "Smartphone", "Smartphones", ["electronics"], T.electronics],
  ["laptop", "Laptop", "Laptops", ["electronics"], T.electronics],
  ["audio", "Headphones & speakers", "Headphones & speakers", ["electronics", "music", "mobile-accessories"], T.electronics],
  ["wearable", "Smartwatch & wearable", "Smartwatches & wearables", ["electronics", "watches"], T.electronics],
  ["camera", "Camera", "Cameras", ["electronics"], T.electronics],
  ["gadget", "Gadget", "Gadgets", ["electronics", "gifts", "general"], T.electronics],
  // Mobile & computer accessories
  ["phone_case", "Phone case & cover", "Phone cases & covers", ["mobile-accessories", "electronics"], T.mobileAccessory],
  ["charger_cable", "Charger & cable", "Chargers & cables", ["mobile-accessories", "electronics"], T.mobileAccessory],
  ["power_bank", "Power bank", "Power banks", ["mobile-accessories"], T.mobileAccessory],
  ["computer_accessory", "Computer accessory", "Computer accessories", ["mobile-accessories", "electronics"], T.mobileAccessory],
  // Beauty
  ["skincare", "Skincare", "Skincare", ["beauty", "organic", "ayurveda"], T.beauty],
  ["makeup", "Makeup", "Makeup", ["beauty"], T.beauty],
  ["haircare", "Haircare", "Haircare", ["beauty", "ayurveda", "organic"], T.beauty],
  ["bath_body", "Bath & body", "Bath & body", ["beauty", "organic"], T.beauty],
  ["beauty_tool", "Beauty tool", "Beauty tools", ["beauty"], T.electronics],
  // Jewellery
  ["necklace", "Necklace", "Necklaces", ["jewellery"], T.jewellery],
  ["earrings", "Earrings", "Earrings", ["jewellery"], T.jewellery],
  ["ring", "Ring", "Rings", ["jewellery"], T.jewellery],
  ["bangle", "Bangles & bracelets", "Bangles & bracelets", ["jewellery"], T.jewellery],
  ["jewellery_set", "Jewellery set", "Jewellery sets", ["jewellery"], T.jewellery],
  // Furniture
  ["sofa", "Sofa & seating", "Sofas & seating", ["furniture"], T.furniture],
  ["bed", "Bed", "Beds", ["furniture"], T.furniture],
  ["table", "Table", "Tables", ["furniture"], T.furniture],
  ["chair", "Chair", "Chairs", ["furniture"], T.furniture],
  ["storage_furniture", "Storage & wardrobe", "Storage & wardrobes", ["furniture"], T.furniture],
  // Grocery, organic, gourmet, sweets, beverages
  ["staples", "Staples & grains", "Staples & grains", ["grocery", "organic"], T.food],
  ["spices", "Spices & masalas", "Spices & masalas", ["grocery", "organic", "gourmet"], T.food],
  ["oil_ghee", "Oil & ghee", "Oils & ghee", ["grocery", "organic"], T.food],
  ["packaged_food", "Packaged food", "Packaged food", ["grocery", "general"], T.food],
  ["dairy", "Dairy", "Dairy", ["grocery"], T.food],
  ["fresh_produce", "Fruits & vegetables", "Fruits & vegetables", ["grocery", "organic"], T.food],
  ["organic_food", "Organic food", "Organic food", ["organic"], T.food],
  ["bakery", "Bakery", "Bakery", ["gourmet"], T.food],
  ["cake", "Cake", "Cakes", ["gourmet", "gifts"], T.food],
  ["chocolate", "Chocolate", "Chocolates", ["gourmet", "sweets", "gifts"], T.food],
  ["gourmet_food", "Gourmet food", "Gourmet food", ["gourmet"], T.food],
  ["sweets", "Mithai", "Mithai", ["sweets"], T.food],
  ["snacks", "Namkeen & snacks", "Namkeen & snacks", ["sweets", "grocery"], T.food],
  ["dry_fruits", "Dry fruits & nuts", "Dry fruits & nuts", ["sweets", "grocery", "organic"], T.food],
  ["tea", "Tea", "Teas", ["beverages", "organic"], T.beverage],
  ["coffee", "Coffee", "Coffees", ["beverages"], T.beverage],
  ["beverage", "Juice & drink", "Juices & drinks", ["beverages", "grocery"], T.beverage],
  // Health & ayurveda
  ["supplement", "Supplement", "Supplements", ["health", "ayurveda", "sports", "gym"], T.health],
  ["medical_device", "Medical device", "Medical devices", ["health"], T.electronics],
  ["personal_care", "Personal care", "Personal care", ["health", "beauty", "general"], T.health],
  ["ayurvedic_medicine", "Ayurvedic medicine", "Ayurvedic medicines", ["ayurveda", "health"], T.health],
  ["herbal_care", "Herbal care", "Herbal care", ["ayurveda", "organic"], T.health],
  ["essential_oil", "Essential oil", "Essential oils", ["ayurveda", "organic", "fragrances"], T.beauty],
  // Sports
  ["sports_equipment", "Sports equipment", "Sports equipment", ["sports"], T.sports],
  ["fitness_equipment", "Fitness equipment", "Fitness equipment", ["sports", "health", "gym"], T.sports],
  ["sportswear", "Sportswear", "Sportswear", ["sports", "gym"], T.basicApparel],
  ["outdoor_gear", "Outdoor & camping gear", "Outdoor & camping gear", ["sports", "bags"], T.sports],
  // Footwear
  ["shoes", "Shoes", "Shoes", ["footwear", "sports", "gym"], T.footwear],
  ["sneakers", "Sneakers", "Sneakers", ["footwear"], T.footwear],
  ["sandals", "Sandals & heels", "Sandals & heels", ["footwear"], T.footwear],
  ["ethnic_footwear", "Juttis & kolhapuris", "Juttis & kolhapuris", ["footwear", "handicrafts"], T.footwear],
  ["slippers", "Slippers & flip-flops", "Slippers & flip-flops", ["footwear"], T.footwear],
  // Kids & toys
  ["kids_clothing", "Kids clothing", "Kids clothing", ["kids"], T.apparel],
  ["baby_care", "Baby care", "Baby care", ["kids"], T.kids],
  ["baby_gear", "Baby gear", "Baby gear", ["kids"], T.kids],
  ["toy", "Toy", "Toys", ["toys", "kids", "gifts"], T.toy],
  ["board_game", "Board game & puzzle", "Board games & puzzles", ["toys"], T.toy],
  ["educational_toy", "Educational toy", "Educational toys", ["toys", "kids", "books"], T.toy],
  // Books & stationery
  ["book", "Book", "Books", ["books"], T.book],
  ["stationery", "Stationery", "Stationery", ["books", "gifts"], T.stationery],
  ["art_supplies", "Art supplies", "Art supplies", ["books", "art"], T.stationery],
  ["office_supplies", "Office supplies", "Office supplies", ["books"], T.stationery],
  // Pets
  ["pet_food", "Pet food", "Pet food", ["pets"], T.pet],
  ["pet_accessory", "Pet accessory", "Pet accessories", ["pets"], T.pet],
  ["pet_grooming", "Pet grooming", "Pet grooming", ["pets"], T.pet],
  ["pet_toy", "Pet toy", "Pet toys", ["pets"], T.pet],
  // Automotive
  ["car_accessory", "Car accessory", "Car accessories", ["automotive"], T.automotive],
  ["bike_accessory", "Bike accessory", "Bike accessories", ["automotive"], T.automotive],
  ["car_care", "Car care", "Car care", ["automotive"], T.automotive],
  // Smart home & appliances, kitchen
  ["home_appliance", "Home appliance", "Home appliances", ["smart-home"], T.appliance],
  ["kitchen_appliance", "Kitchen appliance", "Kitchen appliances", ["smart-home", "kitchen"], T.appliance],
  ["smart_device", "Smart home device", "Smart home devices", ["smart-home", "electronics"], T.appliance],
  ["cookware", "Cookware", "Cookware", ["kitchen"], T.kitchen],
  ["dinnerware", "Dinnerware & serveware", "Dinnerware & serveware", ["kitchen", "gifts"], T.kitchen],
  ["kitchen_tool", "Kitchen tool", "Kitchen tools", ["kitchen"], T.kitchen],
  ["storage_container", "Storage container", "Storage containers", ["kitchen"], T.kitchen],
  // Home décor & textiles
  ["home_decor", "Home décor", "Home décor", ["home-decor", "handicrafts", "gifts", "general"], T.decor],
  ["lighting", "Lighting", "Lighting", ["home-decor", "smart-home"], T.lighting],
  ["wall_art", "Wall art", "Wall art", ["home-decor", "art"], T.art],
  ["home_fragrance", "Candle & home fragrance", "Candles & home fragrance", ["home-decor", "fragrances", "gifts"], T.fragrance],
  ["bedsheet", "Bedsheets & bedding", "Bedsheets & bedding", ["home-textiles"], T.textile],
  ["curtain", "Curtain", "Curtains", ["home-textiles"], T.textile],
  ["cushion", "Cushion & cover", "Cushions & covers", ["home-textiles", "home-decor"], T.textile],
  ["towel", "Towel", "Towels", ["home-textiles"], T.textile],
  ["rug", "Rug & carpet", "Rugs & carpets", ["home-textiles", "home-decor", "handicrafts"], T.textile],
  // Handicrafts
  ["handicraft", "Handicraft", "Handicrafts", ["handicrafts", "gifts", "art"], T.handicraft],
  // Bags, watches, eyewear, fragrances
  ["handbag", "Handbag", "Handbags", ["bags", "fashion"], T.bag],
  ["backpack", "Backpack", "Backpacks", ["bags"], T.bag],
  ["luggage", "Luggage", "Luggage", ["bags"], T.bag],
  ["wallet", "Wallet", "Wallets", ["bags", "watches"], T.bag],
  ["watch", "Watch", "Watches", ["watches"], T.watch],
  ["sunglasses", "Sunglasses", "Sunglasses", ["eyewear", "watches"], T.eyewear],
  ["eyeglasses", "Eyeglass frame", "Eyeglass frames", ["eyewear"], T.eyewear],
  ["eyewear_accessory", "Eyewear accessory", "Eyewear accessories", ["eyewear"], T.eyewear],
  ["perfume", "Perfume", "Perfumes", ["fragrances"], T.fragrance],
  ["attar", "Attar", "Attars", ["fragrances", "pooja"], T.fragrance],
  ["deodorant", "Deodorant & body mist", "Deodorants & body mists", ["fragrances"], T.fragrance],
  // Gifts
  ["gift_hamper", "Gift hamper", "Gift hampers", ["gifts", "gourmet", "sweets", "general"], T.gift],
  ["personalised_gift", "Personalised gift", "Personalised gifts", ["gifts"], T.gift],
  ["greeting_card", "Greeting card", "Greeting cards", ["gifts", "books"], T.gift],
  // Plants
  ["plant", "Plant", "Plants", ["plants"], T.plant],
  ["seeds", "Seeds", "Seeds", ["plants"], T.plant],
  ["planter", "Pot & planter", "Pots & planters", ["plants", "home-decor"], T.decor],
  ["gardening_tool", "Gardening tool", "Gardening tools", ["plants", "tools"], T.tool],
  // Pooja
  ["pooja_item", "Pooja essential", "Pooja essentials", ["pooja"], T.pooja],
  ["idol", "Idol & murti", "Idols & murtis", ["pooja", "handicrafts", "art"], T.pooja],
  ["incense", "Incense & dhoop", "Incense & dhoop", ["pooja", "fragrances"], T.fragrance],
  ["diya", "Diya & lamp", "Diyas & lamps", ["pooja", "home-decor"], T.pooja],
  // Tools
  ["hand_tool", "Hand tool", "Hand tools", ["tools"], T.tool],
  ["power_tool", "Power tool", "Power tools", ["tools"], T.tool],
  ["hardware", "Hardware & fittings", "Hardware & fittings", ["tools"], T.tool],
  ["electrical", "Electrical supply", "Electrical supplies", ["tools", "smart-home"], T.tool],
  // Music & art
  ["musical_instrument", "Musical instrument", "Musical instruments", ["music"], T.music],
  ["music_accessory", "Music accessory", "Music accessories", ["music"], T.music],
  ["artwork", "Painting & artwork", "Paintings & artwork", ["art", "handicrafts"], T.art],
  ["art_print", "Print & poster", "Prints & posters", ["art", "home-decor"], T.art],
  ["sculpture", "Sculpture", "Sculptures", ["art", "handicrafts"], T.art],
  ["collectible", "Collectible", "Collectibles", ["art", "toys"], T.art],
  // Catch-all
  ["other", "Other", "Other", [], T.generic],
];

export const DEFAULT_PRODUCT_TYPES: readonly ProductTypeDef[] = SEEDS.map(([key, label, plural, industries, template], i) => ({
  key,
  label,
  plural,
  industries,
  template,
  position: (i + 1) * 10,
  status: "active",
  source: "default",
}));

const DEFAULT_BY_KEY = new Map(DEFAULT_PRODUCT_TYPES.map((t) => [t.key, t]));

/** Industry → suggested type keys (default catalogue), in catalogue order. "other" is always last. */
export function industryTypeKeys(industry: string | null | undefined, types: readonly ProductTypeDef[] = DEFAULT_PRODUCT_TYPES): string[] {
  if (!industry) return [];
  return types.filter((t) => t.status === "active" && t.key !== "other" && t.industries.includes(industry)).map((t) => t.key);
}

export const INDUSTRY_PRODUCT_TYPES: Record<IndustrySlug, string[]> = Object.fromEntries(INDUSTRY_SLUGS.map((s) => [s, industryTypeKeys(s)])) as Record<IndustrySlug, string[]>;

/** The type a new product starts with: the first suggestion for the store's industry, else "other". */
export function defaultTypeForIndustry(industry: string | null | undefined, types: readonly ProductTypeDef[] = DEFAULT_PRODUCT_TYPES): string {
  return industryTypeKeys(industry, types)[0] ?? "other";
}

// ---- labels -----------------------------------------------------------------------------

export function humanizeTypeKey(key: string): string {
  const s = key.replace(/_/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Other";
}

export function findType(types: readonly ProductTypeDef[], key: string): ProductTypeDef | undefined {
  return types.find((t) => t.key === key);
}

export function typeLabel(key: string, types: readonly ProductTypeDef[] = DEFAULT_PRODUCT_TYPES): string {
  return (findType(types, key) ?? DEFAULT_BY_KEY.get(key))?.label ?? humanizeTypeKey(key);
}

export function typePluralLabel(key: string, types: readonly ProductTypeDef[] = DEFAULT_PRODUCT_TYPES): string {
  return (findType(types, key) ?? DEFAULT_BY_KEY.get(key))?.plural ?? humanizeTypeKey(key);
}

/** Attribute template for a key; unknown keys get the generic template. */
export function templateFor(key: string, types: readonly ProductTypeDef[] = DEFAULT_PRODUCT_TYPES): AttributeTemplate {
  return (findType(types, key) ?? DEFAULT_BY_KEY.get(key))?.template ?? GENERIC_TEMPLATE;
}

/** A key for a new type from its label ("Handmade soap" → "handmade_soap"). */
export function typeKeyFromLabel(label: string): string {
  const k = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/g, "");
  return PRODUCT_TYPE_KEY_RE.test(k) ? k : "";
}

// ---- merging the catalogue --------------------------------------------------------------

/** A row from public.product_types (platform overrides/additions). */
export type PlatformTypeRow = { key: string; label: string; plural_label: string | null; industries: string[] | null; template: unknown; position: number; status: string };
/** A row from public.tenant_product_types (store-only types). */
export type StoreTypeRow = { key: string; label: string; template: unknown };

export function parseTemplate(value: unknown, fallback: AttributeTemplate = GENERIC_TEMPLATE): AttributeTemplate {
  const r = attributeTemplateSchema.safeParse(value);
  if (!r.success) return fallback;
  // An empty stored object means "not customised": keep the fallback.
  if (value && typeof value === "object" && Object.keys(value as object).length === 0) return fallback;
  return r.data;
}

/**
 * Defaults + platform rows (override by key, or add) + store rows (add only; never shadow a
 * platform key). Disabled types are kept (status "disabled") so existing products still resolve
 * labels; pickers hide them.
 */
export function mergeCatalogue(platform: readonly PlatformTypeRow[] | null, store: readonly StoreTypeRow[] | null = null, defaults: readonly ProductTypeDef[] = DEFAULT_PRODUCT_TYPES): ProductTypeDef[] {
  const out = new Map<string, ProductTypeDef>(defaults.map((t) => [t.key, t]));
  for (const r of platform ?? []) {
    if (!PRODUCT_TYPE_KEY_RE.test(r.key)) continue;
    const base = out.get(r.key);
    out.set(r.key, {
      key: r.key,
      label: r.label || base?.label || humanizeTypeKey(r.key),
      plural: r.plural_label || (r.label && r.label !== base?.label ? r.label : base?.plural) || r.label || humanizeTypeKey(r.key),
      industries: (r.industries ?? []).filter((x) => typeof x === "string"),
      template: parseTemplate(r.template, base?.template ?? GENERIC_TEMPLATE),
      position: r.position,
      status: r.status === "disabled" ? "disabled" : "active",
      source: "platform",
    });
  }
  for (const r of store ?? []) {
    if (!PRODUCT_TYPE_KEY_RE.test(r.key) || out.has(r.key)) continue;
    out.set(r.key, { key: r.key, label: r.label, plural: r.label, industries: [], template: parseTemplate(r.template), position: 100_000, status: "active", source: "store" });
  }
  return [...out.values()].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label));
}

export type TypeGroups = { suggested: ProductTypeDef[]; store: ProductTypeDef[]; others: ProductTypeDef[] };

/**
 * Picker groups: the store's own types, types for its industry, then everything else (A–Z).
 * `current` is always included (even when disabled/unknown) so an existing product keeps its value.
 */
export function groupTypesForPicker(types: readonly ProductTypeDef[], industry: string | null | undefined, current?: string): TypeGroups {
  const visible = types.filter((t) => t.status === "active" || t.key === current);
  const store = visible.filter((t) => t.source === "store");
  const suggestedKeys = new Set(industryTypeKeys(industry, visible.map((t) => (t.key === current ? { ...t, status: "active" as const } : t))));
  const suggested = visible.filter((t) => t.source !== "store" && suggestedKeys.has(t.key));
  const others = visible.filter((t) => t.source !== "store" && !suggestedKeys.has(t.key)).sort((a, b) => (a.key === "other" ? 1 : b.key === "other" ? -1 : a.label.localeCompare(b.label)));
  if (current && !types.some((t) => t.key === current)) {
    others.unshift({ key: current, label: humanizeTypeKey(current), plural: humanizeTypeKey(current), industries: [], template: GENERIC_TEMPLATE, position: 0, status: "active", source: "default" });
  }
  return { suggested, store, others };
}

// ---- spec fields from a template --------------------------------------------------------

export type Spec = { label: string; value: string };
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function specValue(specs: readonly Spec[], label: string): string {
  return specs.find((s) => same(s.label, label))?.value ?? "";
}

/** Sets (or, with an empty value, removes) the spec row for a template label. */
export function setSpecValue(specs: readonly Spec[], label: string, value: string): Spec[] {
  const i = specs.findIndex((s) => same(s.label, label));
  if (!value.trim()) return i < 0 ? [...specs] : specs.filter((_, j) => j !== i);
  if (i < 0) return [...specs, { label, value }];
  return specs.map((s, j) => (j === i ? { label: s.label, value } : s));
}

/** Spec rows that are not one of the template's labelled fields (the free-form list). */
export function extraSpecs(specs: readonly Spec[], templateLabels: readonly string[]): { spec: Spec; index: number }[] {
  return specs.map((spec, index) => ({ spec, index })).filter(({ spec }) => !templateLabels.some((l) => same(l, spec.label)));
}
