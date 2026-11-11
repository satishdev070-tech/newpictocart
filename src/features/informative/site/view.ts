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
  /** Preview mode: forms are shown but cannot be sent. */
  preview: boolean;
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
