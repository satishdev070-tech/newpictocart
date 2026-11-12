import { minorToDb } from "@/features/settings/fields";
import { defaultPageSections } from "../defaults";
import { sampleServices } from "../demo";
import { SYSTEM_PAGES } from "../sections";
import { uniqueSlug } from "../slug";
import type { ThemeConfig } from "../themes/types";
import type { CompleteDraft } from "./draft";

/**
 * Pure mapping from a validated onboarding draft to the complete_informative_onboarding payload
 * (unit tested). Money: paise → numeric. Starter services, or 3 category samples flagged
 * is_sample when the seller skipped Step 3.
 */
export function buildCompletionPayload(d: CompleteDraft, theme: ThemeConfig) {
  const b = d.basic;
  const whatsapp = b.whatsappSameAsPhone ? b.phone : b.whatsapp ? normalizeIn(b.whatsapp) : null;
  const site = {
    theme_id: theme.id,
    tagline: b.tagline || null,
    category: b.category,
    contact: { phone: b.phone, whatsapp, email: b.email, city: b.city, address: b.address || null, mapUrl: null },
  };
  const pages = SYSTEM_PAGES.map((p) => ({ type: p.type, title: p.title, slug: p.slug, sections: defaultPageSections(theme, p.type) }));
  const useSamples = d.services.length === 0;
  const source = useSamples
    ? sampleServices(b.category).map((s) => ({ name: s.name, shortDescription: s.shortDescription, priceType: s.priceType, pricePaise: s.pricePaise, durationMinutes: s.durationMinutes, category: s.category }))
    : d.services.map((s) => ({ ...s, durationMinutes: null as number | null, category: null as string | null }));
  const taken = new Set<string>();
  const services = source.map((s) => {
    const slug = uniqueSlug(s.name, taken, "service");
    taken.add(slug);
    return {
      name: s.name,
      slug,
      short_description: s.shortDescription || null,
      price_type: s.priceType,
      price: s.pricePaise == null ? null : minorToDb(s.pricePaise),
      duration_minutes: s.durationMinutes,
      category: s.category,
      is_sample: useSamples,
    };
  });
  return { site, pages, services, usedSamples: useSamples };
}

function normalizeIn(v: string): string | null {
  const digits = v.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return null;
}
