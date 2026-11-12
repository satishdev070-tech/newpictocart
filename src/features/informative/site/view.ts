import { curatedStockSet, sizedStockUrl, type StockImage } from "@/lib/unsplash-stock";
import type { InfoCategory } from "../categories";
import { demoContent } from "../demo";
import { formatDuration, formatServicePrice } from "../pricing";
import { slugify } from "../slug";
import type { ThemeConfig } from "../themes/types";
import type { ThemeOverrides } from "../themes/tokens";

/**
 * Everything the section library renders (pure data, no DB rows). Built from demo content for
 * previews (here) and from published DB content for live sites (M6). Images are absolute URLs.
 */
export type ImageView = { url: string; alt: string; width: number; height: number };
export type ServiceView = { id: string; name: string; href: string; shortDescription: string | null; priceText: string | null; durationText: string | null; category: string | null; imageUrl: string | null; isSample: boolean };
export type SiteView = {
  businessName: string;
  tagline: string | null;
  about: string | null;
  category: InfoCategory;
  logoUrl: string | null;
  hero: ImageView[];
  contact: { phone: string | null; whatsapp: string | null; email: string | null; city: string | null; address: string | null; mapUrl: string | null };
  hours: { day: number; open: string; close: string; closed: boolean }[];
  socialLinks: Record<string, string>;
  services: ServiceView[];
  testimonials: { authorName: string; rating: number; text: string; photoUrl: string | null }[];
  faqs: { question: string; answer: string }[];
  gallery: (ImageView & { caption: string | null })[];
  team: { name: string; role: string | null; bio: string | null; photoUrl: string | null }[];
  stats: { value: string; label: string }[];
  highlights: { title: string; text: string }[];
  ctaLabel: string;
  nav: { label: string; href: string }[];
  /** Photo credits (Unsplash licence). */
  credits: { name: string; url: string }[];
  /** Forms are shown but cannot be sent (demo previews; live sites until enquiries are enabled). */
  preview: boolean;
  /** Explains why the enquiry form is disabled (null = the demo-preview wording). */
  formNote?: string | null;
  /** Live enquiry form settings (present only when `preview` is false). */
  enquiry?: { successMessage: string | null; showDateTime: boolean; privacyHref: string };
  overrides: ThemeOverrides;
};

const img = (s: StockImage | undefined, w: number, h: number): ImageView | null => (s ? { url: sizedStockUrl(s.url, w), alt: s.alt, width: w, height: h } : null);

/** Demo site for a theme (onboarding preview, theme switcher). The user's name/logo replace the demo ones. */
export function buildDemoView(
  theme: ThemeConfig,
  opts: { businessName?: string | null; logoUrl?: string | null; category?: InfoCategory | null; link?: (path: string) => string } = {},
): SiteView {
  const link = opts.link ?? ((path: string) => path);
  const category = opts.category ?? theme.demoCategory;
  const d = demoContent(category);
  const stock = curatedStockSet(d.photoCategory);
  const pool = [...stock.tiles, ...stock.story, ...stock.products];
  const hero = [stock.hero[0], stock.hero[1], stock.hero[2], stock.hero[3]].flatMap((s) => img(s, 1600, 1000) ?? []);
  const gallery = pool.slice(0, 6).flatMap((s, i) => {
    const v = img(s, 800, i % 3 === 1 ? 1000 : 600);
    return v ? [{ ...v, caption: null }] : [];
  });
  const team = pool.slice(6, 6 + d.team.length);
  // Credit exactly the photographers whose photos are shown (Unsplash licence).
  const used = [stock.hero[0], stock.hero[1], stock.hero[2], stock.hero[3], ...pool.slice(0, 6 + d.team.length)];
  const credits = [...new Map(used.flatMap((s) => (s?.photographer ? [[s.photographer.name, s.photographer] as const] : []))).values()];
  return {
    businessName: opts.businessName?.trim() || d.businessName,
    tagline: d.tagline,
    about: d.about,
    category,
    logoUrl: opts.logoUrl ?? null,
    hero,
    contact: { phone: "+91 98765 43210", whatsapp: "+919876543210", email: "hello@example.com", city: "Pune", address: "2nd floor, Example Towers, MG Road, Pune 411001", mapUrl: null },
    hours: [1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "09:00", close: "19:00", closed: false })).concat([{ day: 0, open: "10:00", close: "14:00", closed: true }]),
    socialLinks: { instagram: "https://instagram.com/", facebook: "https://facebook.com/" },
    services: d.services.map((s, i) => ({
      id: `demo-${i}`,
      name: s.name,
      href: link(`/services/${slugify(s.name)}`),
      shortDescription: s.shortDescription,
      priceText: formatServicePrice(s.priceType, s.pricePaise),
      durationText: formatDuration(s.durationMinutes),
      category: s.category,
      imageUrl: pool[i] ? sizedStockUrl(pool[i]!.url, 720) : null,
      isSample: false,
    })),
    testimonials: d.testimonials.map((t) => ({ ...t, photoUrl: null })),
    faqs: d.faqs,
    gallery,
    team: d.team.map((m, i) => ({ ...m, photoUrl: team[i] ? sizedStockUrl(team[i]!.url, 480) : null })),
    stats: d.stats,
    highlights: d.highlights,
    ctaLabel: d.ctaLabel,
    nav: [
      { label: "Home", href: link("/") },
      { label: "About", href: link("/about") },
      { label: "Services", href: link("/services") },
      { label: "Gallery", href: link("/gallery") },
      { label: "Contact", href: link("/contact") },
    ],
    credits,
    preview: true,
    overrides: {},
  };
}

// ---- Live site (DB content) -------------------------------------------------------------------

/** Minimal shape of the loaded content (server/public.ts SiteBundle), kept structural to stay pure. */
type LiveBundle = {
  site: {
    businessName: string;
    tagline: string | null;
    about: string | null;
    category: InfoCategory;
    logoPath: string | null;
    heroImagePath: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    fontPair: string | null;
    contact: SiteView["contact"];
    hours: SiteView["hours"];
    socialLinks: Record<string, string>;
  };
  services: { id: string; name: string; slug: string; shortDescription: string | null; imagePath: string | null; priceType: Parameters<typeof formatServicePrice>[0]; pricePaise: number | null; durationMinutes: number | null; category: string | null; isSample: boolean }[];
  pages: { type: string; title: string; slug: string }[];
  gallery: { imagePath: string; alt: string | null; caption: string | null }[];
  team: { name: string; role: string | null; bio: string | null; photoPath: string | null }[];
  testimonials: { authorName: string; rating: number; text: string; authorPhotoPath: string | null }[];
  faqs: { question: string; answer: string }[];
};

/**
 * Live SiteView from published content. `asset` turns a storage path into a public URL (assetUrl);
 * `link` maps site paths (identity on the public host, /informative/site-preview/… for the owner's
 * draft preview). Menu items whose content is empty are hidden (plan).
 */
export function buildSiteView(
  b: LiveBundle,
  opts: { asset: (path: string | null) => string | null; link?: (path: string) => string; preview?: boolean; formNote?: string | null; enquiry?: SiteView["enquiry"] },
): SiteView {
  const link = opts.link ?? ((p: string) => p);
  const d = demoContent(b.site.category);
  const hasPage = (type: string) => b.pages.some((p) => p.type === type);
  const nav = [
    { label: "Home", href: link("/") },
    ...(hasPage("ABOUT") ? [{ label: "About", href: link("/about") }] : []),
    ...(hasPage("SERVICES") && b.services.length ? [{ label: "Services", href: link("/services") }] : []),
    ...(b.gallery.length ? [{ label: "Gallery", href: link("/gallery") }] : []),
    ...b.pages.filter((p) => p.type === "CUSTOM").map((p) => ({ label: p.title, href: link(`/${p.slug}`) })),
    { label: "Contact", href: link("/contact") },
  ];
  const hero = opts.asset(b.site.heroImagePath);
  const s = b.site;
  return {
    businessName: s.businessName,
    tagline: s.tagline,
    about: s.about,
    category: s.category,
    logoUrl: opts.asset(s.logoPath),
    hero: hero ? [{ url: hero, alt: "", width: 1600, height: 1000 }] : [],
    contact: s.contact,
    hours: s.hours,
    socialLinks: s.socialLinks,
    services: b.services.map((x) => ({
      id: x.id,
      name: x.name,
      href: link(`/services/${x.slug}`),
      shortDescription: x.shortDescription,
      priceText: formatServicePrice(x.priceType, x.pricePaise),
      durationText: formatDuration(x.durationMinutes),
      category: x.category,
      imageUrl: opts.asset(x.imagePath),
      isSample: x.isSample,
    })),
    testimonials: b.testimonials.map((t) => ({ authorName: t.authorName, rating: t.rating, text: t.text, photoUrl: opts.asset(t.authorPhotoPath) })),
    faqs: b.faqs,
    gallery: b.gallery.flatMap((g) => {
      const url = opts.asset(g.imagePath);
      return url ? [{ url, alt: g.alt ?? g.caption ?? "", width: 800, height: 600, caption: g.caption }] : [];
    }),
    team: b.team.map((m) => ({ name: m.name, role: m.role, bio: m.bio, photoUrl: opts.asset(m.photoPath) })),
    // Stats and highlights have no editor in v1: the section is hidden unless the seller adds content.
    stats: [],
    highlights: [],
    ctaLabel: d.ctaLabel,
    nav,
    credits: [],
    preview: opts.preview ?? false,
    formNote: opts.formNote ?? null,
    enquiry: opts.enquiry,
    overrides: { primaryColor: s.primaryColor, secondaryColor: s.secondaryColor, fontPair: s.fontPair },
  };
}
