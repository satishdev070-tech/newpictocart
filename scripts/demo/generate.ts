/**
 * Demo store generator. PURE (no network, no clock except where passed in): turns the category
 * data in ./data into complete store plans: brand, contact, policies, GST, shipping, catalogue
 * (prices in integer paise, src/lib/money.ts), reviews, theme choice and home-page content.
 * Unit tested in tests/unit/demo-stores.test.ts; the runner (seed-demo-stores.mts) does the I/O.
 */
import { toDecimalString, toMinor } from "../../src/lib/money";
import type { ProductType } from "../../src/features/catalog/constants";
import { MARKETPLACE_THEMES } from "../../src/features/theme/marketplace/catalog";
import { layoutSummary } from "../../src/features/theme/layouts/apply-layout";
import { layoutFamily } from "../../src/features/theme/layouts/personalities";
import { isShowcaseSlug } from "../../src/features/theme/marketplace/showcase";
import type { MarketplaceTheme } from "../../src/features/theme/marketplace/types";
import { industryName } from "../../src/features/stores/industries";
import { DEMO_CATEGORIES } from "./data";
import type { Brand, CategoryDef, Department } from "./data/types";

// ------------------------------------------------------------------ helpers

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

export function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Math.abs(h);
}

/** Rounds paise to a retail price ending in 9 rupees (e.g. 1,849 → 1,849; 1,852 → 1,859). */
export function retailPrice(paise: number): number {
  const rupees = Math.max(9, Math.round(paise / 100));
  if (rupees < 100) return rupees * 100;
  return (Math.ceil((rupees + 1) / 10) * 10 - 1) * 100;
}

const code = (s: string, n: number) => s.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, n);

/** STD codes for the cities in the data (landline-style numbers, deterministic). */
const STD: Record<string, string> = {
  "New Delhi": "11", Mumbai: "22", Kolkata: "33", Chennai: "44", Bengaluru: "80", Hyderabad: "40", Pune: "20", Ahmedabad: "79", Jaipur: "141", Lucknow: "522",
  Chandigarh: "172", Kochi: "484", Gurugram: "124", Noida: "120", Surat: "261", Indore: "731", Coimbatore: "422", Jodhpur: "291",
};
export function phoneFor(slug: string, city: string): string {
  const std = STD[city] ?? "80";
  const digits = String(40000000 + (hash(slug) % 9999999)).slice(0, 10 - std.length);
  return `+91 ${std} ${digits.slice(0, Math.ceil(digits.length / 2))} ${digits.slice(Math.ceil(digits.length / 2))}`;
}

// ------------------------------------------------------------------ themes

/**
 * Two themes for a category with different layout variant sets (hero / product layout / header
 * style / footer layout, layouts/apply-layout.ts). Store A gets the industry's first theme, store B
 * the first later one whose hero AND product layout differ (else any different layout). A category
 * with one theme borrows from another industry of the same layout family.
 */
export function pickThemes(industry: string): [MarketplaceTheme, MarketplaceTheme] {
  const own = MARKETPLACE_THEMES.filter((t) => t.industry === industry);
  const family = MARKETPLACE_THEMES.filter((t) => t.industry !== industry && layoutFamily(t.industry) === layoutFamily(industry));
  const pool = [...own, ...family, ...MARKETPLACE_THEMES.filter((t) => t.industry !== industry && layoutFamily(t.industry) !== layoutFamily(industry))];
  const a = pool[0];
  if (!a) throw new Error(`no themes for ${industry}`);
  const la = layoutSummary(a.preset);
  const rest = pool.slice(1);
  const b =
    rest.find((t) => {
      const lb = layoutSummary(t.preset);
      return lb.hero !== la.hero && lb.products !== la.products;
    }) ?? rest.find((t) => JSON.stringify(layoutSummary(t.preset)) !== JSON.stringify(la));
  if (!b) throw new Error(`no second theme for ${industry}`);
  return [a, b];
}

// ------------------------------------------------------------------ plan types

export type VariantPlan = { option1: string | null; sku: string; price: number; compareAtPrice: number | null; initialStock: number };
export type ProductPlan = {
  title: string;
  slug: string;
  department: string;
  type: ProductType;
  short: string;
  description: string;
  tags: string[];
  featured: boolean;
  collections: string[];
  hsn: string;
  weightGrams: number;
  care: string;
  seoTitle: string;
  seoDescription: string;
  option: { name: string; values: { value: string; swatch: string }[] } | null;
  variants: VariantPlan[];
  /** Unsplash search and the photo indexes (main, second) in its results. */
  photo: { q: string; picks: [number, number] };
};

export type ShippingRatePlan = { name: string; price: number; minSubtotal: number; maxSubtotal: number | null; pincodePrefixes: string[]; daysMin: number; daysMax: number; codAllowed: boolean; position: number };

export type StorePlan = {
  key: string;
  slug: string;
  name: string;
  industry: string;
  industryName: string;
  which: 0 | 1;
  owner: { name: string; email: string };
  themeKey: string;
  themeName: string;
  layout: ReturnType<typeof layoutSummary>;
  tagline: string;
  story: string[];
  email: string;
  phone: string;
  whatsapp: string;
  address: { line1: string; city: string; state: string; postal_code: string; country: "IN" };
  social: Record<string, string>;
  legalName: string;
  seo: { title: string; description: string };
  /** stores.tax_settings (rupee thresholds, as saved by the dashboard). */
  taxSettings: { prices_include_tax: boolean; rules: ({ max_unit_price: number; rate: number } | { rate: number })[] };
  /** stores.cod_settings in rupees (dashboard format); paise in codPaise. */
  codPaise: { fee: number; minOrder: number; maxOrder: number };
  shipping: ShippingRatePlan[];
  freeShippingOver: number;
  announcement: string[];
  categories: { slug: string; name: string; description: string; query: string }[];
  collections: { slug: string; title: string; description: string; tag?: string }[];
  products: ProductPlan[];
  faqs: [string, string][];
  testimonials: { quote: string; author: string; location: string }[];
  reviews: { product: number; rating: number; title: string; body: string; author: string }[];
  pages: { slug: string; title: string; kind: "about" | "policy" | "contact" | "page"; body: string[] }[];
  shippingNote: string;
  returnsNote: string;
  promises: readonly [string, string, string];
};

// ------------------------------------------------------------------ store plan

const PEOPLE = [
  ["Aditi S.", "Pune"], ["Rahul M.", "Bengaluru"], ["Fatima K.", "Hyderabad"], ["Gurpreet D.", "Amritsar"], ["Meenakshi R.", "Chennai"], ["Sourav B.", "Kolkata"],
  ["Neha T.", "Jaipur"], ["Vivek P.", "Ahmedabad"], ["Lalitha N.", "Mysuru"], ["Arjun K.", "Delhi"], ["Shreya G.", "Lucknow"], ["Thomas J.", "Kochi"],
] as const;
const REVIEW_LINES = [
  ["Exactly as described", "Looks just like the photos and the quality is better than I expected. Packed very neatly."],
  ["Great value", "Good quality for the price. Delivery took four days to my city."],
  ["Will order again", "Second order from this store. Consistent quality and quick replies on WhatsApp."],
  ["Lovely, small issue", "Really like it. The box was a little dented in transit but the product was fine."],
  ["Perfect gift", "Bought this as a gift and it was a big hit. Nice packaging too."],
  ["Very happy", "Arrived a day early. Exactly what I wanted."],
] as const;
const RATINGS = [5, 4, 5, 4, 5, 5];

/** Owner login for a demo store: an address that can't receive mail, random password set by the runner. */
export const demoOwnerEmail = (slug: string) => `owner@${slug}.demo.test`;

function variantsFor(dep: Department, title: string, priceRupees: number, mrpRupees: number, prefix: string, n: number): { option: ProductPlan["option"]; variants: VariantPlan[] } {
  const base = toMinor(priceRupees);
  const mrp = mrpRupees > 0 ? toMinor(mrpRupees) : null;
  const sku = `${prefix}-${code(dep.slug, 3)}${n}`;
  const stock = (key: string, i: number) => (hash(key) % 11 === 3 && i > 0 ? 0 : hash(key) % 7 === 2 ? 2 : 6 + (hash(key) % 38));
  if (!dep.opt) return { option: null, variants: [{ option1: null, sku, price: base, compareAtPrice: mrp, initialStock: stock(sku, 1) }] };
  const values = dep.opt.values.map((v) => ({ value: v.split("|")[0]!, swatch: v.split("|")[1] ?? "" }));
  return {
    option: { name: dep.opt.name, values },
    variants: values.map((v, i) => {
      const scale = dep.opt!.scale?.[i] ?? 1;
      const price = scale === 1 ? base : retailPrice(base * scale);
      return { option1: v.value, sku: `${sku}-${code(v.value, 6)}`, price, compareAtPrice: mrp === null ? null : Math.max(price, scale === 1 ? mrp : retailPrice(mrp * scale)), initialStock: stock(`${title}:${v.value}`, i) };
    }),
  };
}

function describe(cat: CategoryDef, dep: Department, brand: Brand, short: string): string {
  const why = cat.promises.map((p) => `- ${p}`).join("\n");
  return `${short}\n\n${dep.blurb} Made for everyday use and backed by ${brand.name}'s support team in ${brand.city}.\n\nWhy you'll love it\n\n${why}\n\nCare\n\n${cat.care}`;
}

export function planStore(cat: CategoryDef, which: 0 | 1): StorePlan {
  const brand = cat.brands[which];
  const [ta, tb] = pickThemes(cat.industry);
  const theme = which === 0 ? ta : tb;
  const prefix = code(brand.slug, 3);
  const deps = cat.departments;
  const free = cat.freeOver;
  const freeText = free > 0 ? `Free delivery on orders above ₹${free.toLocaleString("en-IN")}` : "Free delivery on every order";

  const products: ProductPlan[] = [];
  for (const [d, dep] of deps.entries()) {
    dep.products.forEach((row, j) => {
      if (j % 2 !== which) return;
      const [title, price, mrp, short] = row;
      const k = Math.floor(j / 2); // 0..2 within this store's department
      const { option, variants } = variantsFor(dep, title, price, mrp, prefix, d * 3 + k + 1);
      const tags = [dep.slug, ...(k === 0 ? ["bestseller"] : []), ...(k === 2 ? ["new"] : []), ...(mrp > price ? ["deal"] : []), ...(price <= (free || 1500) ? ["gift-pick"] : [])];
      products.push({
        title,
        slug: slugify(title),
        department: dep.slug,
        type: dep.type ?? "other",
        short,
        description: describe(cat, dep, brand, short),
        tags,
        featured: k === 0,
        collections: k === 0 ? ["bestsellers"] : [],
        hsn: dep.hsn ?? cat.hsn,
        weightGrams: cat.weight,
        care: cat.care,
        seoTitle: `${title} | ${brand.name}`.slice(0, 120),
        seoDescription: `${short} ${freeText}.`.slice(0, 300),
        option,
        variants,
        photo: { q: dep.q, picks: [j, j + 6] },
      });
    });
  }

  const shipping: ShippingRatePlan[] = [
    ...(free > 0
      ? [
          { name: "Standard delivery", price: toMinor(cat.weight >= 5000 ? 499 : 79), minSubtotal: 0, maxSubtotal: toMinor(free), pincodePrefixes: [], daysMin: 3, daysMax: 7, codAllowed: true, position: 1 },
          { name: "Free standard delivery", price: 0, minSubtotal: toMinor(free), maxSubtotal: null, pincodePrefixes: [], daysMin: 3, daysMax: 7, codAllowed: true, position: 2 },
        ]
      : [{ name: "Free standard delivery", price: 0, minSubtotal: 0, maxSubtotal: null, pincodePrefixes: [], daysMin: 3, daysMax: 7, codAllowed: true, position: 1 }]),
    { name: "Express (metro cities)", price: toMinor(cat.weight >= 5000 ? 999 : 149), minSubtotal: 0, maxSubtotal: null, pincodePrefixes: ["11", "40", "41", "56", "60", "70", "50", "38"], daysMin: 1, daysMax: 2, codAllowed: false, position: 3 },
  ];
  const shippingNote = `${freeText}; express delivery in 1–2 days to metro cities. Orders placed before 2 pm ship the same working day from ${brand.city}.`;
  const returnsNote = "Returns and exchanges within 10 days of delivery for unused items in original packaging. Damaged or wrong items are replaced free of cost.";
  const gst = cat.gst;
  const taxRules = gst.length === 1 ? [{ rate: gst[0] }] : [{ max_unit_price: gst[1], rate: gst[0] }, { rate: gst[2] }];
  const email = `hello@${brand.slug}.example`;
  const phone = phoneFor(brand.slug, brand.city);
  const people = (n: number) => PEOPLE[(hash(brand.slug) + n) % PEOPLE.length]!;

  return {
    key: `${cat.industry}:${which === 0 ? "a" : "b"}`,
    slug: brand.slug,
    name: brand.name,
    industry: cat.industry,
    industryName: industryName(cat.industry),
    which,
    owner: { name: brand.owner, email: demoOwnerEmail(brand.slug) },
    themeKey: theme.key,
    themeName: theme.name,
    layout: layoutSummary(theme.preset),
    tagline: brand.tagline,
    story: [brand.story, `Since ${brand.since}, we've shipped to customers in every state of India from our base in ${brand.city}. ${cat.promises.join(", ")}.`],
    email,
    phone,
    whatsapp: phone,
    address: { line1: brand.street, city: brand.city, state: brand.state, postal_code: brand.pin, country: "IN" },
    social: { instagram: `https://instagram.com/${brand.slug.replace(/-/g, "")}` },
    legalName: `${brand.name} Private Limited`.replace(/ & /g, " and "),
    seo: { title: `${brand.name} | ${brand.tagline}`.slice(0, 70), description: `${brand.tagline}. Shop ${deps.map((d) => d.name.toLowerCase()).slice(0, 3).join(", ")} and more. ${freeText}.`.slice(0, 160) },
    taxSettings: { prices_include_tax: true, rules: taxRules },
    codPaise: { fee: cat.weight >= 5000 ? 0 : toMinor(49), minOrder: 0, maxOrder: toMinor(cat.weight >= 5000 ? 50000 : 10000) },
    shipping,
    freeShippingOver: toMinor(free),
    announcement: [freeText, ...cat.promises.filter((p) => !/free (shipping|delivery)/i.test(p)).slice(0, 2)],
    categories: deps.map((d) => ({ slug: d.slug, name: d.name, description: d.blurb, query: d.q })),
    collections: [
      { slug: "bestsellers", title: "Bestsellers", description: `Our most-loved ${cat.industry.replace(/-/g, " ")} picks.` },
      { slug: "new-arrivals", title: "New arrivals", description: "Just landed in store.", tag: "new" },
      { slug: "deals", title: "Deals", description: "Prices already reduced, no code needed.", tag: "deal" },
      { slug: "gifts", title: free > 0 ? `Gifts under ₹${Math.max(free, 999).toLocaleString("en-IN")}` : "Gift ideas", description: "Easy, thoughtful gifts.", tag: "gift-pick" },
    ],
    products,
    faqs: [
      ["How long does delivery take?", `Metro cities usually receive orders in 2–4 working days and the rest of India in 4–7. Express delivery (1–2 days) is available in metros. You'll get tracking by SMS and email.`],
      ["Do you offer cash on delivery?", `Yes, on orders up to ₹${(cat.weight >= 5000 ? 50000 : 10000).toLocaleString("en-IN")} at most PIN codes.`],
      ["Can I return or exchange?", returnsNote],
      ["Do I get a GST invoice?", "Yes. Every order comes with a GST invoice; add your GSTIN at checkout for a business invoice."],
      ["How do I contact you?", `Write to ${email} or call ${phone}, Monday to Saturday, 10 am – 7 pm IST.`],
    ],
    testimonials: [0, 1, 2].map((n) => ({ quote: REVIEW_LINES[(n + which) % REVIEW_LINES.length]![1], author: people(n)[0], location: people(n)[1] })),
    reviews: products.slice(0, 18).filter((_, i) => i % 3 === 0).map((_, n) => ({ product: n * 3, rating: RATINGS[n % RATINGS.length]!, title: REVIEW_LINES[n % REVIEW_LINES.length]![0], body: REVIEW_LINES[n % REVIEW_LINES.length]![1], author: people(n + 3)[0] })),
    pages: [
      { slug: "about", title: "About us", kind: "about", body: [brand.story, `Since ${brand.since}, we've shipped to customers in every state of India from ${brand.city}. ${cat.promises.join(". ")}.`] },
      { slug: "shipping-policy", title: "Shipping policy", kind: "policy", body: [shippingNote, "You'll receive tracking details by SMS and email as soon as your order ships. We deliver to over 19,000 PIN codes."] },
      { slug: "returns", title: "Returns & exchanges", kind: "policy", body: [returnsNote, `To start a return, open the order in your account or write to ${email}. Refunds reach the original payment method within 5–7 working days.`] },
      { slug: "contact", title: "Contact us", kind: "contact", body: [`Write to ${email} or call ${phone}, Monday to Saturday, 10 am – 7 pm IST.`, `${brand.street}, ${brand.city}, ${brand.state} ${brand.pin}.`] },
      { slug: "privacy", title: "Privacy policy", kind: "policy", body: [`${brand.name} uses your details only to process orders, provide support and, if you opt in, send updates. We never sell personal data.`] },
      { slug: "terms", title: "Terms of service", kind: "policy", body: [`Prices include GST. Orders are confirmed once payment is received or, for cash on delivery, once we verify the order by phone. ${brand.name} reserves the right to cancel orders affected by pricing errors, with a full refund.`] },
    ],
    shippingNote,
    returnsNote,
    promises: cat.promises,
  };
}

/** Every demo store (2 per category), optionally for one category. */
export function planAll(category?: string): StorePlan[] {
  const cats = DEMO_CATEGORIES.filter((c) => !category || c.industry === category);
  if (category && !cats.length) throw new Error(`unknown category "${category}"`);
  return cats.flatMap((c) => [planStore(c, 0), planStore(c, 1)]);
}

/** Problems that would make a store plan invalid (used by tests and before a run). */
export function validatePlan(p: StorePlan): string[] {
  const out: string[] = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug) || p.slug.length < 3 || p.slug.length > 40) out.push(`bad slug ${p.slug}`);
  if (isShowcaseSlug(p.slug)) out.push(`${p.slug} is a showcase store slug`);
  if (p.categories.length < 4 || p.categories.length > 6) out.push(`${p.slug}: ${p.categories.length} categories`);
  if (p.products.length < 12 || p.products.length > 20) out.push(`${p.slug}: ${p.products.length} products`);
  if (new Set(p.products.map((x) => x.slug)).size !== p.products.length) out.push(`${p.slug}: duplicate product slugs`);
  const skus = p.products.flatMap((x) => x.variants.map((v) => v.sku));
  if (new Set(skus).size !== skus.length) out.push(`${p.slug}: duplicate SKUs`);
  for (const pr of p.products)
    for (const v of pr.variants) {
      if (!Number.isSafeInteger(v.price) || v.price <= 0) out.push(`${pr.title}: price ${v.price}`);
      if (v.compareAtPrice !== null && v.compareAtPrice < v.price) out.push(`${pr.title}: MRP below price`);
    }
  return out;
}

export const rupees = (paise: number) => toDecimalString(paise);
