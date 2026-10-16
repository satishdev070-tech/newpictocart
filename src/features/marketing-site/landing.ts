import { z } from "zod";

/**
 * Landing page CMS (super admin → Landing page). The whole home page, header navigation and
 * footer are one JSON document stored in `platform_settings` under LANDING_KEY. The key is under
 * the `public.` prefix, so the marketing site reads it with the anon key (RLS
 * platform_settings_public_select); writes need platform.settings.manage.
 *
 * PURE (no I/O). Parsing is per section: a malformed or missing section falls back to its
 * default, so a bad value can never take the home page down.
 *
 * Headings support colour highlights: "Now {purple:what to sell} and {green:where to sell}".
 */

export const LANDING_KEY = "public.marketing.landing";

export const HIGHLIGHT_COLORS = ["purple", "green", "orange", "indigo"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

/** Icons the editor offers (lucide names, mapped to components in components/landing-icons). */
export const LANDING_ICONS = [
  "sparkles",
  "camera",
  "globe",
  "palette",
  "message-circle",
  "link",
  "credit-card",
  "truck",
  "file-text",
  "ticket",
  "star",
  "book-open",
  "bar-chart",
  "shopping-cart",
  "search",
  "smartphone",
  "users",
  "store",
  "tag",
  "rocket",
  "package",
  "shield",
  "zap",
  "megaphone",
  "image",
  "mail",
  "receipt",
  "layout",
  "heart",
  "clock",
  "shirt",
  "cake",
  "laptop",
  "flower",
  "scissors",
  "dumbbell",
  "sofa",
  "gem",
  "wrench",
  "paw-print",
  "pen-tool",
  "leaf",
  "toy-brick",
  "pencil",
  "gift",
  "coffee",
  "headphones",
  "watch",
  "shopping-bag",
  "brush",
  "baby",
  "hammer",
  "sprout",
  "hand-heart",
] as const;
export type LandingIcon = (typeof LANDING_ICONS)[number];

/** Fixed palette for icon chips, category tiles and card accents (classes in components/landing-icons). */
export const ACCENT_COLORS = ["purple", "green", "orange", "indigo", "pink", "teal", "blue", "amber", "rose"] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

export const SECTION_KEYS = ["hero", "trust", "solutions", "steps", "faq", "features", "themes", "categories", "pricing", "testimonials", "cta"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  hero: "Hero",
  trust: "Trust strip",
  solutions: "What & where to sell",
  steps: "5 steps",
  faq: "FAQ",
  features: "Features",
  themes: "Themes",
  categories: "Business categories",
  pricing: "Pricing",
  testimonials: "Testimonials",
  cta: "Final call to action",
};

/** Built-in illustrations for the steps section (used when a step has no image URL). */
export const STEP_VISUALS = ["signup", "details", "category", "theme", "live", "none"] as const;
export type StepVisual = (typeof STEP_VISUALS)[number];

// ---- Field schemas --------------------------------------------------------------------

const str = (max: number) => z.string().trim().max(max);

/** Internal path, in-page anchor, https URL, mailto: or tel:. Never javascript: or data:. */
export function isSafeHref(v: string): boolean {
  if (v === "") return true;
  if (v.startsWith("/") && !v.startsWith("//")) return true;
  if (v.startsWith("#")) return true;
  return /^(https:\/\/[^\s]+|mailto:[^\s]+|tel:\+?[0-9 ()-]+)$/i.test(v);
}
const href = str(300).refine(isSafeHref, "Use a path like /pricing, #faq, or a full https:// link");

/** Image: a path in /public or an https URL. */
const imageUrl = str(500).refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\/[^\s]+$/i.test(v), "Use an https:// image link or a /path");

const icon = z.enum(LANDING_ICONS);
const color = z.enum(ACCENT_COLORS);
const link = z.object({ label: str(60), href });

/** Icon and colour picked for a category name, so older plain-text chips still look designed. */
const LABEL_ICONS: [RegExp, LandingIcon, AccentColor][] = [
  [/fashion|cloth|apparel|boutique/i, "shirt", "pink"],
  [/food|bak|cake|sweet/i, "cake", "amber"],
  [/electronic|gadget|mobile/i, "laptop", "blue"],
  [/beauty|cosmetic|skin|salon/i, "flower", "rose"],
  [/handcraft|handmade|craft/i, "scissors", "orange"],
  [/book/i, "book-open", "indigo"],
  [/fitness|gym|sport/i, "dumbbell", "teal"],
  [/d[eé]cor|furniture|home/i, "sofa", "amber"],
  [/jewel/i, "gem", "purple"],
  [/service|repair/i, "wrench", "blue"],
  [/pet/i, "paw-print", "orange"],
  [/art|design/i, "pen-tool", "pink"],
  [/organic|natural|farm/i, "leaf", "green"],
  [/toy|kid/i, "toy-brick", "rose"],
  [/stationer/i, "pencil", "indigo"],
  [/gift/i, "gift", "purple"],
  [/caf[eé]|coffee|tea/i, "coffee", "amber"],
];

export function chipFromLabel(label: string, index: number): { label: string; icon: LandingIcon; color: AccentColor } {
  const match = LABEL_ICONS.find(([re]) => re.test(label));
  return { label, icon: match?.[1] ?? "tag", color: match?.[2] ?? ACCENT_COLORS[index % ACCENT_COLORS.length]! };
}

const chipSchema = z.object({ label: str(40), icon, color });
/** Chips are `{label, icon, color}`; documents saved before that stored plain strings. */
const chips = z
  .array(z.union([str(40), chipSchema]))
  .max(30)
  .transform((list) => list.map((c, i) => (typeof c === "string" ? chipFromLabel(c, i) : c)));

export const heroSchema = z.object({
  enabled: z.boolean(),
  badge: str(60),
  titleLead: str(80),
  rotatingWords: z.array(str(40)).max(12),
  body: str(300),
  primaryCta: link,
  secondaryCta: link,
  liveLabel: str(20),
  stats: z.array(z.object({ icon, value: str(20), label: str(40) })).max(6),
  imageUrl,
  imageAlt: str(120),
  /** Browser-frame slideshow. Empty = the single image above, or rotating theme previews. */
  slides: z.array(z.object({ imageUrl, alt: str(120), caption: str(80) })).max(8).default([]),
  slideInterval: z.number().int().min(2).max(20).default(5),
  autoplay: z.boolean().default(true),
});

export const trustSchema = z.object({ enabled: z.boolean(), title: str(80), chips });

export const solutionsSchema = z.object({
  enabled: z.boolean(),
  badge: str(60),
  title: str(160),
  body: str(300),
  /** `color` "auto" picks the colour from the tag (Source, Sell, Design, Channels, Operate, Grow). */
  items: z.array(z.object({ icon, title: str(60), tag: str(30), body: str(160), linkLabel: str(40), href, badge: str(16), color: z.enum(["auto", ...ACCENT_COLORS]).default("auto") })).max(16),
});

export const stepsSchema = z.object({
  enabled: z.boolean(),
  badge: str(60),
  title: str(160),
  body: str(300),
  items: z.array(z.object({ icon, title: str(60), body: str(240), visual: z.enum(STEP_VISUALS), imageUrl, imageAlt: str(120) })).max(8),
  cta: link,
  note: str(120),
  link,
});

export const faqSchema = z.object({
  enabled: z.boolean(),
  badge: str(60),
  title: str(160),
  body: str(300),
  items: z.array(z.object({ question: str(160), answer: str(1200) })).max(20),
  link,
});

export const featuresSchema = z.object({
  enabled: z.boolean(),
  badge: str(60),
  title: str(160),
  body: str(300),
  highlight: z.object({ icon, title: str(60), body: str(300), tags: z.array(str(30)).max(6) }),
  items: z.array(z.object({ icon, title: str(60), body: str(140) })).max(6),
  mini: z.array(z.object({ icon, title: str(40) })).max(8),
});

export const themesSchema = z.object({ enabled: z.boolean(), badge: str(60), title: str(160), body: str(300), count: z.number().int().min(2).max(12), button: link });

const categoryItem = z.object({ label: str(40), icon, color, href, imageUrl });
const categoriesObject = z.object({ enabled: z.boolean(), title: str(160), body: str(300), items: z.array(categoryItem).max(30) });
/** Documents saved before `items` existed stored `chips: string[]`; those are converted. */
export const categoriesSchema = z.preprocess((v) => {
  if (!v || typeof v !== "object" || Array.isArray(v) || "items" in v) return v;
  const { chips: old, ...rest } = v as Record<string, unknown>;
  if (!Array.isArray(old)) return v;
  return { ...rest, items: old.map((c, i) => (typeof c === "string" ? { ...chipFromLabel(c, i), href: "", imageUrl: "" } : c)) };
}, categoriesObject);

export const pricingSchema = z.object({ enabled: z.boolean(), badge: str(60), title: str(160), body: str(300), note: str(120), noteLink: link });

export const testimonialsSchema = z.object({
  enabled: z.boolean(),
  badge: str(60),
  title: str(160),
  items: z.array(z.object({ quote: str(400), name: str(60), business: str(80), rating: z.number().int().min(1).max(5), result: str(40) })).max(12),
});

export const ctaSchema = z.object({ enabled: z.boolean(), title: str(160), body: str(300), button: link, note: str(120) });

export const headerSchema = z.object({ nav: z.array(link).max(8), loginLabel: str(30), loginHref: href, ctaLabel: str(40), ctaHref: href });

export const footerSchema = z.object({
  tagline: str(200),
  groups: z.array(z.object({ title: str(40), links: z.array(link).max(10) })).max(5),
  socials: z.object({ instagram: href, x: href, facebook: href, youtube: href, linkedin: href }),
  /** WhatsApp number for the floating chat button, digits with country code (e.g. 919876543210). */
  whatsapp: z.string().trim().regex(/^(\d{10,15})?$/, "Digits only, with country code, e.g. 919876543210"),
  whatsappMessage: str(200),
  copyright: str(120),
});

export const seoSchema = z.object({ title: str(70), description: str(170) });

const SECTION_SCHEMAS = {
  hero: heroSchema,
  trust: trustSchema,
  solutions: solutionsSchema,
  steps: stepsSchema,
  faq: faqSchema,
  features: featuresSchema,
  themes: themesSchema,
  categories: categoriesSchema,
  pricing: pricingSchema,
  testimonials: testimonialsSchema,
  cta: ctaSchema,
  header: headerSchema,
  footer: footerSchema,
  seo: seoSchema,
} as const;

const orderSchema = z
  .array(z.enum(SECTION_KEYS))
  .max(SECTION_KEYS.length)
  .refine((a) => new Set(a).size === a.length, "Each section can appear once");

export const landingSchema = z.object({ order: orderSchema, ...SECTION_SCHEMAS });
export type LandingContent = z.infer<typeof landingSchema>;

// ---- Defaults (what the site shows until the super admin saves) ------------------------

export const DEFAULT_LANDING: LandingContent = {
  seo: {
    title: "Pictocart — Launch your online store in 5 minutes",
    description: "Create your online store, pick from ready-made themes, take UPI, card and COD payments and ship across India. Free to start.",
  },
  header: {
    nav: [
      { label: "Features", href: "/features" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Pricing", href: "/pricing" },
      { label: "Themes", href: "/themes" },
    ],
    loginLabel: "Login",
    loginHref: "/seller/login",
    ctaLabel: "Start Free",
    ctaHref: "/seller/register",
  },
  order: [...SECTION_KEYS],
  hero: {
    enabled: true,
    badge: "Online Store Builder for India",
    titleLead: "Launch Your Store for",
    rotatingWords: ["Home Bakers", "Boutiques", "Fashion Brands", "Jewellers", "Artisans", "Gift Shops"],
    body: "Pick a theme, add your products and start taking orders. UPI, cards, COD, shipping and GST invoices built in.",
    primaryCta: { label: "Create Your Free Store", href: "/seller/register" },
    secondaryCta: { label: "See how it works", href: "#steps" },
    liveLabel: "LIVE",
    stats: [
      { icon: "palette", value: "{themes}", label: "Themes available" },
      { icon: "clock", value: "5 min", label: "Average setup" },
      { icon: "credit-card", value: "UPI + COD", label: "Payments" },
    ],
    imageUrl: "",
    imageAlt: "",
    slides: [],
    slideInterval: 5,
    autoplay: true,
  },
  trust: {
    enabled: true,
    title: "Built for merchants across India",
    chips: ["Fashion", "Food & Bakery", "Electronics", "Beauty", "Handcraft", "Books", "Fitness", "Home Décor", "Jewellery", "Services", "Pet Supplies", "Organic", "Toys", "Stationery"].map(chipFromLabel),
  },
  solutions: {
    enabled: true,
    badge: "The Only Platform You Need",
    title: "Now {purple:what to sell} and {green:where to sell} — we have a solution for both.",
    body: "From your storefront to GST invoices, we ship every tool a modern Indian seller needs.",
    items: [
      { icon: "palette", title: "Theme Marketplace", tag: "Design", body: "Ready-made themes for every category, edited visually", linkLabel: "Explore this feature", href: "/themes", badge: "", color: "auto" },
      { icon: "message-circle", title: "WhatsApp & Social", tag: "Channels", body: "Order updates on WhatsApp and a social media planner", linkLabel: "Explore this feature", href: "/features", badge: "", color: "auto" },
      { icon: "link", title: "Custom Domain + SSL", tag: "Design", body: "yourbrand.in with an automatically issued certificate", linkLabel: "Explore this feature", href: "/features", badge: "", color: "auto" },
      { icon: "credit-card", title: "Razorpay / UPI / COD", tag: "Operate", body: "All payment modes, paid straight to your account", linkLabel: "Explore this feature", href: "/features", badge: "", color: "auto" },
      { icon: "truck", title: "Shipping", tag: "Operate", body: "Your own rates and PIN code rules, or Delhivery / Shiprocket", linkLabel: "Explore this feature", href: "/features", badge: "", color: "auto" },
      { icon: "file-text", title: "GST-Ready Invoices", tag: "Operate", body: "A GST invoice for every order, ready for your CA", linkLabel: "Explore this feature", href: "/features", badge: "", color: "auto" },
      { icon: "ticket", title: "Coupons & Discounts", tag: "Operate", body: "Usage caps, minimum order and expiry rules", linkLabel: "Explore this feature", href: "/features", badge: "", color: "auto" },
      { icon: "star", title: "Reviews & Ratings", tag: "Operate", body: "1–5 star reviews you approve before they appear", linkLabel: "Explore this feature", href: "/features", badge: "", color: "auto" },
      { icon: "search", title: "SEO Tools", tag: "Channels", body: "Page titles, descriptions and an automatic sitemap", linkLabel: "Explore this feature", href: "/features", badge: "", color: "auto" },
      { icon: "image", title: "Creative Studio", tag: "Grow", body: "Turn product photos into ready-to-post creatives", linkLabel: "Explore this feature", href: "/features", badge: "New", color: "auto" },
      { icon: "bar-chart", title: "Analytics", tag: "Grow", body: "Visitors, orders, sales and conversion over time", linkLabel: "Explore this feature", href: "/features", badge: "", color: "auto" },
      { icon: "users", title: "Team Access", tag: "Operate", body: "Invite staff with owner, manager or viewer roles", linkLabel: "Explore this feature", href: "/features", badge: "", color: "auto" },
    ],
  },
  steps: {
    enabled: true,
    badge: "The Merchant Journey",
    title: "From Sign-Up to First Sale — in {orange:5 Steps}",
    body: "Every screen you'll see, in the order you'll see them. No surprises, no setup calls, no developer needed.",
    items: [
      { icon: "users", title: "Sign Up Free", body: "Create your account with email or Google. No credit card required.", visual: "signup", imageUrl: "", imageAlt: "" },
      { icon: "store", title: "Tell Us About Your Store", body: "Pick a name and a free store web address. That's it — one minute, one screen.", visual: "details", imageUrl: "", imageAlt: "" },
      { icon: "tag", title: "Choose Your Category", body: "Fashion, food, electronics, beauty, services… pick what you sell and we suggest the right themes.", visual: "category", imageUrl: "", imageAlt: "" },
      { icon: "palette", title: "Pick a Beautiful Theme", body: "Choose a theme made for your category, then change colours, fonts and sections without code.", visual: "theme", imageUrl: "", imageAlt: "" },
      { icon: "rocket", title: "Your Store Goes Live", body: "One tap publishes the store. Share it on WhatsApp, Instagram or Facebook.", visual: "live", imageUrl: "", imageAlt: "" },
    ],
    cta: { label: "Start Your Journey — It's Free", href: "/seller/register" },
    note: "No credit card · Free to start · 5-minute setup",
    link: { label: "See full walkthrough", href: "/how-it-works" },
  },
  faq: {
    enabled: true,
    badge: "FAQs",
    title: "Common questions before you sign up",
    body: "Pricing, payments, setup time — answered.",
    items: [
      { question: "Is it really free? What's the catch?", answer: "You can create your store and set it up for free. Paid plans add higher limits and features such as your own domain; you only upgrade when you need them." },
      { question: "How long does setup actually take?", answer: "Most sellers have a store with a theme and their first products in a few minutes. Your store stays private until you publish it." },
      { question: "How does payment work? Where does the money go?", answer: "Online payments go to your own Razorpay, Cashfree or PayU account, so customers pay by UPI, cards and netbanking and the money lands in your bank. You can also offer cash on delivery." },
      { question: "What about GST and invoices?", answer: "Add your GSTIN in settings and a GST invoice is issued for every order, ready to download or print." },
      { question: "Can I use my own domain like mybrand.in?", answer: "Yes. Every store gets a free web address, and on plans that include custom domains you can connect a domain you own. HTTPS is set up automatically." },
    ],
    link: { label: "See all questions", href: "/how-it-works" },
  },
  features: {
    enabled: true,
    badge: "Powerful Features",
    title: "Everything You Need to Sell Online",
    body: "From your storefront to analytics — we've built every tool a modern merchant needs.",
    highlight: {
      icon: "sparkles",
      title: "Creative Studio & AI Captions",
      body: "Turn product photos into ready-to-post creatives and get caption ideas for Instagram and Facebook, straight from your dashboard.",
      tags: ["Templates", "Product photos", "Captions", "Scheduling"],
    },
    items: [
      { icon: "palette", title: "Theme Marketplace", body: "Ready-made themes for every category" },
      { icon: "bar-chart", title: "Real-time Analytics", body: "Track visitors, sales & revenue" },
      { icon: "shopping-cart", title: "Order Management", body: "Track, ship & manage orders" },
      { icon: "credit-card", title: "Payment Integration", body: "Razorpay, UPI & COD support" },
    ],
    mini: [
      { icon: "search", title: "SEO Tools" },
      { icon: "truck", title: "Shipping" },
      { icon: "globe", title: "Custom Domain" },
      { icon: "smartphone", title: "Mobile First" },
    ],
  },
  themes: {
    enabled: true,
    badge: "Theme Marketplace",
    title: "Stunning Themes for Every Business",
    body: "Browse themes made for every business category. Each one fully customisable.",
    count: 4,
    button: { label: "Browse all themes", href: "/themes" },
  },
  categories: {
    enabled: true,
    title: "One Platform. Every Business.",
    body: "Whether you sell fashion, food, or handcraft — we've got the perfect tools and themes for you.",
    items: ["Fashion", "Food & Bakery", "Electronics", "Beauty", "Handcraft", "Books", "Fitness", "Home Décor", "Jewellery", "Services", "Pet Supplies", "Art & Design", "Organic", "Toys", "Stationery"].map((label, i) => ({ ...chipFromLabel(label, i), href: "", imageUrl: "" })),
  },
  pricing: {
    enabled: true,
    badge: "Pricing",
    title: "Start Free. Scale as You Grow.",
    body: "No hidden fees. No credit card required. Upgrade when you need more power.",
    note: "Need more?",
    noteLink: { label: "Compare all plan features", href: "/pricing" },
  },
  testimonials: {
    enabled: false,
    badge: "Testimonials",
    title: "Loved by Merchants",
    items: [],
  },
  cta: {
    enabled: true,
    title: "Your Store is One Click Away",
    body: "Join merchants who've launched their online business with Pictocart. No credit card required.",
    button: { label: "Create Your Free Store", href: "/seller/register" },
    note: "No credit card required • Setup in 5 minutes • Free to start",
  },
  footer: {
    tagline: "Launch your online store in 5 minutes. Made in India, for Indian businesses.",
    groups: [
      {
        title: "Product",
        links: [
          { label: "Features", href: "/features" },
          { label: "Pricing", href: "/pricing" },
          { label: "Themes", href: "/themes" },
          { label: "Get Started", href: "/seller/register" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "How it works", href: "/how-it-works" },
          { label: "Seller login", href: "/seller/login" },
        ],
      },
      {
        title: "Resources",
        links: [
          { label: "Help Center", href: "/how-it-works" },
          { label: "Pricing", href: "/pricing" },
          { label: "Themes", href: "/themes" },
        ],
      },
      {
        title: "Legal",
        links: [
          { label: "Privacy Policy", href: "/privacy" },
          { label: "Terms of Service", href: "/terms" },
        ],
      },
    ],
    socials: { instagram: "", x: "", facebook: "", youtube: "", linkedin: "" },
    whatsapp: "",
    whatsappMessage: "Hi Pictocart, I'd like to know more about creating my online store.",
    copyright: "Pictocart. All rights reserved.",
  },
};

// ---- Parsing --------------------------------------------------------------------------

/** Reads a stored document, falling back to the default for each missing or invalid part. */
export function parseLanding(value: unknown): LandingContent {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const out = { ...DEFAULT_LANDING } as Record<string, unknown>;
  for (const [key, schema] of Object.entries(SECTION_SCHEMAS)) {
    const parsed = (schema as z.ZodType).safeParse(raw[key]);
    if (parsed.success) out[key] = parsed.data;
  }
  const order = orderSchema.safeParse(raw.order);
  // Sections missing from a stored order (e.g. added in a later release) are appended, hidden
  // only if their own `enabled` says so.
  out.order = order.success ? [...order.data, ...SECTION_KEYS.filter((k) => !order.data.includes(k))] : DEFAULT_LANDING.order;
  return out as LandingContent;
}

/** Strict validation for saving: returns the cleaned document or field-path errors. */
export function validateLanding(value: unknown): { ok: true; value: LandingContent } | { ok: false; errors: { path: string; message: string }[] } {
  const parsed = landingSchema.safeParse(value);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, errors: parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message })) };
}

// ---- Heading highlights ---------------------------------------------------------------

export type HighlightPart = { text: string; color: HighlightColor | null };

const HIGHLIGHT_RE = /\{(purple|green|orange|indigo):([^{}]+)\}/g;

/** "Now {purple:what to sell}" → [{text:"Now ",color:null},{text:"what to sell",color:"purple"}]. */
export function parseHighlights(text: string): HighlightPart[] {
  const parts: HighlightPart[] = [];
  let last = 0;
  for (const m of text.matchAll(HIGHLIGHT_RE)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), color: null });
    parts.push({ text: m[2]!, color: m[1] as HighlightColor });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), color: null });
  return parts;
}

/** Plain text of a highlighted heading (for meta tags, aria labels). */
export const stripHighlights = (text: string) => parseHighlights(text).map((p) => p.text).join("");

/** Replaces live tokens in stat values, e.g. "{themes}" with the real theme count. */
export function fillTokens(value: string, tokens: Record<string, string | number>): string {
  return value.replace(/\{(\w+)\}/g, (all, k: string) => (k in tokens ? String(tokens[k]) : all));
}

/** wa.me link for the floating WhatsApp button, or null when no number is set. */
export function whatsappHref(number: string, message: string): string | null {
  if (!/^\d{10,15}$/.test(number)) return null;
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
