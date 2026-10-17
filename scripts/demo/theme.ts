/**
 * Theme for a demo store. PURE: builds the store's own content (hero slides, category tiles,
 * product rails, story, testimonials…) for every section the chosen marketplace theme uses, then
 * applies the theme with the real `applyThemePreset` (src/features/theme/marketplace/apply.ts) and
 * validates the result with `parseThemeConfigStrict`, exactly like "Apply theme" in the dashboard.
 */
import { resolveThemeConfig, parseThemeConfigStrict, type ThemeConfig } from "../../src/features/theme/schema/config";
import { defaultSettings } from "../../src/features/theme/sections/definitions";
import { SECTION_TYPES, type SectionType } from "../../src/features/theme/sections/types";
import { applyThemePreset } from "../../src/features/theme/marketplace/apply";
import { findMarketplaceTheme } from "../../src/features/theme/marketplace/catalog";
import type { HomeItem } from "../../src/features/theme/marketplace/types";
import type { StorePlan } from "./generate";

/** Ids and storage paths the runner created; placeholders in tests. */
export type ThemeRefs = {
  categoryIds: Record<string, string>;
  collectionIds: Record<string, string>;
  productIds: string[];
  /** Main photo storage path per product (same order as plan.products). */
  fronts: string[];
  categoryImages: Record<string, string>;
  collectionImages: Record<string, string>;
  images: { hero1: string; hero2: string; heroMobile: string; story: string; feature: string; feature2: string; promo1: string; promo2: string };
};

type Settings = Record<string, unknown>;
const isType = (t: string): t is SectionType => (SECTION_TYPES as readonly string[]).includes(t);
const PRODUCT_LISTS = new Set(["ProductGrid", "ProductCarousel"]);

/** Content of one product rail, chosen from the slot name (a known merchandising slot, or a department). */
function productList(plan: StorePlan, refs: ThemeRefs, name: string, n: number): Settings {
  const dep = (i: number) => plan.categories[i % plan.categories.length]!;
  const byDept = (i: number): Settings => ({ eyebrow: "Shop by category", heading: dep(i).name, subheading: dep(i).description, source: "category", categoryId: refs.categoryIds[dep(i).slug], viewAllHref: `/categories/${dep(i).slug}` });
  const known: Record<string, Settings> = {
    trending: { eyebrow: "Popular this week", heading: "Trending now", source: "featured", viewAllHref: "/collections/bestsellers" },
    bestsellers: { eyebrow: "Customer favourites", heading: "Bestsellers", source: "collection", collectionId: refs.collectionIds.bestsellers, viewAllHref: "/collections/bestsellers" },
    new: { eyebrow: "Just landed", heading: "New arrivals", source: "newest", viewAllHref: "/collections/new-arrivals" },
    deals: { eyebrow: "Limited time", heading: "Deals of the day", source: "sale", viewAllHref: "/collections/deals" },
    offers: { eyebrow: "Offers", heading: "On offer", source: "sale", viewAllHref: "/collections/deals" },
    gifts: { eyebrow: "Gifting", heading: plan.collections.find((c) => c.slug === "gifts")!.title, source: "collection", collectionId: refs.collectionIds.gifts, viewAllHref: "/collections/gifts" },
  };
  if (known[name]) return known[name]!;
  const own = plan.categories.findIndex((c) => c.slug === name);
  if (own >= 0) return byDept(own);
  // Unslotted rails (and category-specific slots of other industries) rotate through useful lists.
  const rotation = ["bestsellers", "new", "dept:0", "deals", "dept:1", "dept:2", "dept:3", "dept:4"];
  const pick = rotation[n % rotation.length]!;
  return pick.startsWith("dept:") ? byDept(Number(pick.slice(5)) + Math.floor(n / rotation.length)) : known[pick]!;
}

/** Store content for one section type (n = how many of this type came before). */
export function contentFor(type: SectionType, slot: string, n: number, plan: StorePlan, refs: ThemeRefs): Settings | null {
  const img = refs.images;
  const p = (i: number) => plan.products[i % plan.products.length]!;
  switch (type) {
    case "Hero":
      return {
        slides: [
          { imagePath: img.hero1, mobileImagePath: img.heroMobile, alt: `${plan.name}: ${plan.tagline}`, eyebrow: plan.industryName, heading: plan.tagline, subheading: plan.story[0]!.split(". ")[0]!.slice(0, 220) + ".", ctaLabel: "Shop now", ctaHref: `/categories/${plan.categories[0]!.slug}` },
          { imagePath: img.hero2, alt: plan.categories[1]!.name, eyebrow: "New season", heading: `${plan.categories[1]!.name}, freshly stocked`, subheading: plan.categories[1]!.description, ctaLabel: `Shop ${plan.categories[1]!.name.toLowerCase()}`, ctaHref: `/categories/${plan.categories[1]!.slug}` },
        ],
      };
    case "CategoryGrid":
      return { eyebrow: "Browse", heading: "Shop by category", mode: "manual", items: plan.categories.map((c) => ({ id: refs.categoryIds[c.slug], imagePath: refs.categoryImages[c.slug] ?? "", label: "" })) };
    case "CollectionGrid":
      return { eyebrow: "Curated", heading: "Shop the edit", mode: "manual", items: plan.collections.map((c) => ({ id: refs.collectionIds[c.slug], imagePath: refs.collectionImages[c.slug] ?? "", label: "" })) };
    case "ProductGrid":
    case "ProductCarousel":
      return productList(plan, refs, slot, n);
    case "EditorialImageText": {
      const i = n % 2 === 0 ? 2 : 3;
      const c = plan.categories[i % plan.categories.length]!;
      return { imagePath: n % 2 === 0 ? img.feature : img.feature2, alt: c.name, eyebrow: c.name, heading: n % 2 === 0 ? `Why people love our ${c.name.toLowerCase()}` : `${c.name}, chosen with care`, body: `${c.description} ${plan.promises.join(". ")}.`, ctaLabel: `Shop ${c.name.toLowerCase()}`, ctaHref: `/categories/${c.slug}` };
    }
    case "BrandStory":
      return { eyebrow: "Our story", heading: `About ${plan.name}`, body: plan.story.join("\n\n"), imagePath: img.story, alt: `${plan.name} studio`, stats: [{ value: String(new Date(2026, 0).getFullYear() - Number(plan.story[1]!.match(/Since (\d{4})/)?.[1] ?? 2020)) + "+", label: "Years in business" }, { value: `${plan.products.length * 40}+`, label: "Happy customers" }, { value: "4.6★", label: "Average rating" }], ctaLabel: "Read our story", ctaHref: "/pages/about" };
    case "PromoBanner":
      return {
        tiles: [
          { imagePath: img.promo1, alt: plan.categories[3 % plan.categories.length]!.name, heading: plan.categories[3 % plan.categories.length]!.name, text: plan.categories[3 % plan.categories.length]!.description, ctaLabel: "Explore", ctaHref: `/categories/${plan.categories[3 % plan.categories.length]!.slug}` },
          { imagePath: img.promo2, alt: "Deals", heading: "This week's deals", text: "Prices already reduced, no code needed.", ctaLabel: "Shop deals", ctaHref: "/collections/deals" },
        ],
      };
    case "SaleBanner":
      return { eyebrow: "Limited time", heading: "Season sale is on", subheading: "Up to 30% off selected products. No code needed.", ctaLabel: "Shop deals", ctaHref: "/collections/deals" };
    case "BrandStrip":
      return { eyebrow: `The ${plan.name} range`, heading: "", items: plan.categories.map((c) => ({ name: c.name.slice(0, 40), imagePath: "", href: `/categories/${c.slug}` })) };
    case "TrustBadges":
      return { items: [{ icon: "truck", title: plan.announcement[0]!.slice(0, 40), text: "Across India" }, { icon: "return", title: "Easy returns", text: "Within 10 days of delivery" }, { icon: "cod", title: "Cash on delivery", text: "At most PIN codes" }, { icon: "secure", title: "Secure payments", text: "UPI, cards and netbanking" }] };
    case "Marquee":
      return { items: [...plan.announcement, "Cash on delivery", "GST invoice on every order"].slice(0, 6).map((text) => ({ text: text.slice(0, 80) })) };
    case "FAQ":
      return { heading: "Questions before you buy", source: "store", limit: 5 };
    case "Newsletter":
      return { heading: `Join the ${plan.name} list`, subheading: "New arrivals and offers, about twice a month.", buttonLabel: "Subscribe" };
    case "Testimonials":
      return { heading: "Loved by our customers", items: plan.testimonials.map((t) => ({ ...t, rating: 5 })) };
    case "Reviews":
      return { heading: "What customers say" };
    case "SocialProof":
      return { heading: `@${plan.slug.replace(/-/g, "")}`, handle: `@${plan.slug.replace(/-/g, "")}`.slice(0, 31), profileUrl: plan.social.instagram, posts: refs.fronts.slice(0, 6).map((path, i) => ({ imagePath: path, alt: p(i).title, href: plan.social.instagram })) };
    case "Lookbook":
      return { heading: "The lookbook", looks: refs.fronts.slice(0, 6).map((path, i) => ({ imagePath: path, alt: p(i).title, caption: p(i).title.slice(0, 120), productId: refs.productIds[i] ?? "" })) };
    default:
      return null;
  }
}

/** Content sections for a template list: slot ids for slotted items, plain ids for the rest. */
function contentPool(items: readonly HomeItem[], plan: StorePlan, refs: ThemeRefs, prefix: string) {
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  const out: { id: string; type: SectionType; settings: Settings; visibility: { desktop: boolean; mobile: boolean } }[] = [];
  items.forEach(([t, , slot], i) => {
    if (!isType(t)) return;
    const family = PRODUCT_LISTS.has(t) ? "list" : t;
    const n = counts.get(family) ?? 0;
    counts.set(family, n + 1);
    const id = slot ? `slot-${slot}` : `${prefix}-${t.toLowerCase()}-${i + 1}`.slice(0, 40);
    if (seen.has(id)) return;
    seen.add(id);
    const content = contentFor(t, slot ?? "", n, plan, refs);
    if (content) out.push({ id, type: t, settings: { ...defaultSettings(t), ...content }, visibility: { desktop: true, mobile: true } });
  });
  return out;
}

export function buildThemeConfig(plan: StorePlan, refs: ThemeRefs): ThemeConfig {
  const theme = findMarketplaceTheme(plan.themeKey);
  if (!theme) throw new Error(`unknown theme ${plan.themeKey}`);
  const preset = theme.preset;
  const content = resolveThemeConfig({
    schemaVersion: 1,
    tokens: preset.tokens,
    header: { menuHandle: "main", ...preset.header },
    productCard: preset.productCard,
    layout: {
      header: [
        { id: "announcement-1", type: "AnnouncementBar", settings: { ...defaultSettings("AnnouncementBar"), messages: plan.announcement.slice(0, 3).map((text) => ({ text, href: "" })) }, visibility: { desktop: true, mobile: true } },
        { id: "header-1", type: "Header", settings: defaultSettings("Header"), visibility: { desktop: true, mobile: true } },
        { id: "megamenu-1", type: "MegaMenu", settings: { ...defaultSettings("MegaMenu"), menuHandle: "main" }, visibility: { desktop: true, mobile: false } },
      ],
      footer: [{ id: "footer-1", type: "Footer", settings: { ...defaultSettings("Footer"), menuHandles: ["shop", "footer"], about: plan.tagline, showContact: true, showSocial: true, showPaymentNote: true }, visibility: { desktop: true, mobile: true } }],
    },
    templates: {
      home: contentPool(preset.home, plan, refs, "home"),
      collection: contentPool(preset.collection ?? [], plan, refs, "collection"),
      product: contentPool(preset.product ?? [["TrustBadges", {}]], plan, refs, "product"),
    },
  });
  if (content.issues.length) throw new Error(`${plan.slug}: content issues ${JSON.stringify(content.issues.slice(0, 3))}`);
  const applied = parseThemeConfigStrict(applyThemePreset(content.config, preset));
  if (!applied.ok) throw new Error(`${plan.slug}: theme ${plan.themeKey} invalid ${JSON.stringify(applied.issues.slice(0, 3))}`);
  return applied.config;
}
