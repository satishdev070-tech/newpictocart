import { toMinor } from "@/lib/money";
import { minorToDb } from "@/features/settings/fields";
import type { Tables } from "@/lib/supabase/database.types";
import { isInfoCategory, type InfoCategory } from "./categories";
import { PRICE_TYPES, type PriceType } from "./pricing";
import { parseStoredSections, PAGE_TYPES, type PageSection, type PageType } from "./sections";
import { ENQUIRY_SOURCES, ENQUIRY_STATUSES, type EnquirySource, type EnquiryStatus } from "./schemas";

/**
 * Domain models + row mappers (pure, unit tested). Money: numeric(12,2) in the DB, integer paise
 * here (ADR-008); conversion happens only in these mappers.
 */

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const oneOf = <T extends string>(list: readonly T[], v: unknown, dflt: T): T => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : dflt);

export function priceToPaise(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  try {
    return toMinor(v);
  } catch {
    return null;
  }
}
export const paiseToDb = (v: number | null | undefined): number | null => (v == null ? null : minorToDb(v));

export type InfoContact = { phone: string | null; whatsapp: string | null; email: string | null; city: string | null; address: string | null; mapUrl: string | null };
export type InfoSite = {
  tenantId: string;
  themeId: string;
  businessName: string;
  tagline: string | null;
  category: InfoCategory;
  about: string | null;
  logoPath: string | null;
  faviconPath: string | null;
  heroImagePath: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  fontPair: string | null;
  contact: InfoContact;
  hours: { day: number; open: string; close: string; closed: boolean }[];
  socialLinks: Record<string, string>;
  seo: { title: string | null; description: string | null; ogImagePath: string | null };
  options: { enquirySuccessMessage: string | null; showPreferredDateTime: boolean | null; privacyText: string | null };
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  updatedAt: string;
};

export function toSite(r: Tables<"info_sites">): InfoSite {
  const c = obj(r.contact);
  const seo = obj(r.seo);
  const opts = obj(r.options);
  const social = obj(r.social_links);
  return {
    tenantId: r.tenant_id,
    themeId: r.theme_id,
    businessName: r.business_name,
    tagline: r.tagline,
    category: isInfoCategory(r.category) ? r.category : "other",
    about: r.about,
    logoPath: r.logo_path,
    faviconPath: r.favicon_path,
    heroImagePath: r.hero_image_path,
    primaryColor: r.primary_color,
    secondaryColor: r.secondary_color,
    fontPair: r.font_pair,
    contact: { phone: str(c.phone), whatsapp: str(c.whatsapp), email: str(c.email), city: str(c.city), address: str(c.address), mapUrl: str(c.mapUrl) },
    hours: Array.isArray(r.hours)
      ? (r.hours as unknown[]).flatMap((h) => {
          const o = obj(h);
          return typeof o.day === "number" && typeof o.open === "string" && typeof o.close === "string" ? [{ day: o.day, open: o.open, close: o.close, closed: o.closed === true }] : [];
        })
      : [],
    socialLinks: Object.fromEntries(Object.entries(social).filter((e): e is [string, string] => typeof e[1] === "string" && e[1].startsWith("https://"))),
    seo: { title: str(seo.title), description: str(seo.description), ogImagePath: str(seo.ogImagePath) },
    options: {
      enquirySuccessMessage: str(opts.enquirySuccessMessage),
      showPreferredDateTime: typeof opts.showPreferredDateTime === "boolean" ? opts.showPreferredDateTime : null,
      privacyText: str(opts.privacyText),
    },
    status: r.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
  };
}

export type InfoService = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  imagePath: string | null;
  priceType: PriceType;
  pricePaise: number | null;
  durationMinutes: number | null;
  category: string | null;
  isFeatured: boolean;
  isActive: boolean;
  isSample: boolean;
  sortOrder: number;
  seo: { title: string | null; description: string | null };
};

export function toService(r: Tables<"info_services">): InfoService {
  const seo = obj(r.seo);
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    shortDescription: r.short_description,
    description: r.description,
    imagePath: r.image_path,
    priceType: oneOf(PRICE_TYPES, r.price_type, "ON_REQUEST"),
    pricePaise: priceToPaise(r.price),
    durationMinutes: r.duration_minutes,
    category: r.category,
    isFeatured: r.is_featured,
    isActive: r.is_active,
    isSample: r.is_sample,
    sortOrder: r.sort_order,
    seo: { title: str(seo.title), description: str(seo.description) },
  };
}

export type InfoPage = {
  id: string;
  type: PageType;
  title: string;
  slug: string;
  sections: PageSection[];
  isPublished: boolean;
  sortOrder: number;
  seo: { title: string | null; description: string | null };
};

export function toPage(r: Tables<"info_pages">): InfoPage {
  const seo = obj(r.seo);
  return {
    id: r.id,
    type: oneOf(PAGE_TYPES, r.type, "CUSTOM"),
    title: r.title,
    slug: r.slug,
    sections: parseStoredSections(r.sections),
    isPublished: r.is_published,
    sortOrder: r.sort_order,
    seo: { title: str(seo.title), description: str(seo.description) },
  };
}

export type InfoGalleryItem = { id: string; imagePath: string; caption: string | null; alt: string | null; album: string | null; sortOrder: number };
export const toGalleryItem = (r: Tables<"info_gallery_items">): InfoGalleryItem => ({ id: r.id, imagePath: r.image_path, caption: r.caption, alt: r.alt, album: r.album, sortOrder: r.sort_order });

export type InfoTeamMember = { id: string; name: string; role: string | null; bio: string | null; photoPath: string | null; isVisible: boolean; sortOrder: number };
export const toTeamMember = (r: Tables<"info_team_members">): InfoTeamMember => ({ id: r.id, name: r.name, role: r.role, bio: r.bio, photoPath: r.photo_path, isVisible: r.is_visible, sortOrder: r.sort_order });

export type InfoTestimonial = { id: string; authorName: string; authorPhotoPath: string | null; rating: number; text: string; isVisible: boolean; sortOrder: number };
export const toTestimonial = (r: Tables<"info_testimonials">): InfoTestimonial => ({
  id: r.id,
  authorName: r.author_name,
  authorPhotoPath: r.author_photo_path,
  rating: Math.min(5, Math.max(1, r.rating)),
  text: r.text,
  isVisible: r.is_visible,
  sortOrder: r.sort_order,
});

export type InfoFaq = { id: string; question: string; answer: string; isVisible: boolean; sortOrder: number };
export const toFaq = (r: Tables<"info_faqs">): InfoFaq => ({ id: r.id, question: r.question, answer: r.answer, isVisible: r.is_visible, sortOrder: r.sort_order });

export type InfoEnquiry = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  serviceId: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  source: EnquirySource;
  status: EnquiryStatus;
  notes: string | null;
  createdAt: string;
};
export const toEnquiry = (r: Tables<"info_enquiries">): InfoEnquiry => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  email: r.email,
  message: r.message,
  serviceId: r.service_id,
  preferredDate: r.preferred_date,
  preferredTime: r.preferred_time,
  source: oneOf(ENQUIRY_SOURCES, r.source, "CONTACT_FORM"),
  status: oneOf(ENQUIRY_STATUSES, r.status, "NEW"),
  notes: r.notes,
  createdAt: r.created_at,
});
