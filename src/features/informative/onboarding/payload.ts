import { minorToDb } from "@/features/settings/fields";
import { defaultPageSections } from "../defaults";
import { sampleServices } from "../demo";
import { findServiceType, seedFor } from "../service-types";
import { SYSTEM_PAGES } from "../sections";
import { uniqueSlug } from "../slug";
import type { ThemeConfig } from "../themes/types";
import type { CompleteDraft } from "./draft";

/**
 * Pure mapping from a validated onboarding draft to the complete_informative_onboarding payload
 * (unit tested). Money: paise → numeric.
 *
 * With a picked service type (M9) the site also gets that type's ready-made tagline (when the
 * seller left it blank), About text and FAQs. Services are the seller's starter list; when they
 * skipped Step 3, the type's (or else the category's) samples are added, flagged is_sample.
 */
export function buildCompletionPayload(d: CompleteDraft, theme: ThemeConfig) {
  const b = d.basic;
  const whatsapp = b.whatsappSameAsPhone ? b.phone : b.whatsapp ? normalizeIn(b.whatsapp) : null;
  const type = findServiceType(b.serviceTypeId);
  const seed = type ? seedFor(type, { name: b.businessName, city: b.city }) : null;
  const site = {
    theme_id: theme.id,
    tagline: b.tagline || seed?.tagline || null,
    category: b.category,
    service_type: (b.serviceType || type?.label || "").slice(0, 60) || null,
    about: seed?.about ?? null,
    faqs: seed?.faqs ?? [],
    contact: { phone: b.phone, whatsapp, email: b.email, city: b.city, address: b.address || null, mapUrl: null },
  };
  const pages = SYSTEM_PAGES.map((p) => ({ type: p.type, title: p.title, slug: p.slug, sections: defaultPageSections(theme, p.type) }));
  const useSamples = d.services.length === 0;
  const source = useSamples
    ? seed
      ? seed.services.slice(0, 3).map((s) => ({ ...s, category: null as string | null }))
      : sampleServices(b.category).map((s) => ({ name: s.name, shortDescription: s.shortDescription, priceType: s.priceType, pricePaise: s.pricePaise, durationMinutes: s.durationMinutes, category: s.category }))
    : d.services.map((s) => ({ ...s, durationMinutes: s.durationMinutes ?? null, category: null as string | null }));
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
