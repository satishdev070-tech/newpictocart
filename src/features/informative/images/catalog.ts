import { INFO_CATEGORIES, isInfoCategory, type InfoCategory } from "../categories";
import { findServiceType, SERVICE_TYPES } from "../service-types";
import { INFO_PHOTO_ROWS, type InfoPhotoRow } from "./photos";

/**
 * Relevant photos for a new Informative website (PURE; unit tested). The seller's service type
 * picks a curated, hand-checked Unsplash set (photos.ts): Dentist → dental clinic, Salon → salon,
 * Gym → gym floor, Interior designer → interiors. A custom service ("Something else") or a type
 * with a short list is topped up from its category, which mixes the first photos of every service
 * type in that category. Deterministic: the same business always gets the same photos, with no
 * API call (Unsplash's demo key allows 50 requests an hour, far below signup traffic).
 */

const UTM = "utm_source=pictocart&utm_medium=referral";

/** Service types without their own list borrow a closely related one. */
export const INFO_PHOTO_ALIASES: Readonly<Record<string, string>> = {
  insurance_agent: "chartered_accountant",
  doctor_personal: "clinic",
  contractor: "architect",
  banquet_hall: "event_planner",
  life_coach: "freelancer",
  daycare: "coaching_centre",
  homestay: "interior_designer",
  pet_grooming: "veterinarian",
  courier: "packers_movers",
};

/** Short lists are topped up from a related type before the category mix. */
const RELATED: Readonly<Record<string, string>> = {
  pest_control: "cleaning",
  nail_studio: "salon",
  astrologer: "freelancer",
  ayurveda: "spa",
  physiotherapist: "yoga_studio",
};

/** Photos per site: 1 hero + 6 gallery (+ services reuse them). */
export const INFO_PHOTOS_PER_SITE = 7;
const SET_SIZE = 8;

export type InfoPhoto = {
  /** Unsplash photo id ("photo-…"). */
  id: string;
  /** images.unsplash.com URL without a width. */
  url: string;
  alt: string;
  photographer: { name: string; url: string };
};

export function infoPhotoUrl(id: string): string {
  return `https://images.unsplash.com/${id.startsWith("photo-") ? id : `photo-${id}`}?auto=format&fit=crop&q=70`;
}

function toPhoto(row: InfoPhotoRow): InfoPhoto {
  return { id: `photo-${row[0]}`, url: infoPhotoUrl(row[0]), alt: row[3], photographer: { name: row[1], url: `https://unsplash.com/@${row[2]}?${UTM}` } };
}

/** The pool key a service type's photos come from (its own list or an alias); null if none. */
export function photoPoolKey(serviceTypeId: string | null | undefined): string | null {
  if (!serviceTypeId) return null;
  if (INFO_PHOTO_ROWS[serviceTypeId]) return serviceTypeId;
  const alias = INFO_PHOTO_ALIASES[serviceTypeId];
  return alias && INFO_PHOTO_ROWS[alias] ? alias : null;
}

/** A service type's own curated photos (own list or alias). Empty for unknown / custom types. */
export function serviceTypePhotos(serviceTypeId: string | null | undefined): InfoPhoto[] {
  const key = photoPoolKey(serviceTypeId);
  return key ? INFO_PHOTO_ROWS[key]!.map(toPhoto) : [];
}

/** A category's mix: round-robin over its service types' lists (first photos first). */
export function categoryPhotos(category: string | null | undefined): InfoPhoto[] {
  const cat: InfoCategory = isInfoCategory(category) ? category : "other";
  const pools = [...new Set(SERVICE_TYPES.filter((t) => t.family === cat).map((t) => photoPoolKey(t.id)).filter((k): k is string => !!k))].map(
    (k) => INFO_PHOTO_ROWS[k]!,
  );
  const out: InfoPhoto[] = [];
  const longest = Math.max(0, ...pools.map((p) => p.length));
  for (let i = 0; i < longest; i++) for (const p of pools) if (p[i]) out.push(toPhoto(p[i]!));
  return out;
}

/**
 * The ordered photo set for a site: the service type's photos, then a related type's, then the
 * category mix, without repeats. At least INFO_PHOTOS_PER_SITE photos for every category and type.
 */
export function infoPhotoSet(category: string | null | undefined, serviceTypeId: string | null | undefined): InfoPhoto[] {
  const type = findServiceType(serviceTypeId);
  // A type from another category (stale draft) still wins: it's what the seller picked.
  const related = type ? RELATED[type.id] : undefined;
  const merged = [...serviceTypePhotos(type?.id), ...serviceTypePhotos(related), ...categoryPhotos(type?.family ?? category)];
  const seen = new Set<string>();
  const out: InfoPhoto[] = [];
  for (const p of merged) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length >= SET_SIZE) break;
  }
  return out;
}

export type InfoImagePlan = {
  /** Home hero (info_sites.hero_image_path). */
  hero: InfoPhoto;
  /** Gallery rows; the first one is also the About section's photo. */
  gallery: InfoPhoto[];
  /** One photo per starter service, in the same order as the payload's services. */
  services: InfoPhoto[];
};

/**
 * Which photo goes where. Services reuse the gallery photos (rotated so the first service
 * doesn't repeat the About photo), so a site needs at most 7 downloads.
 */
export function planInfoImages(args: { category: string | null | undefined; serviceTypeId: string | null | undefined; serviceCount: number }): InfoImagePlan {
  const set = infoPhotoSet(args.category, args.serviceTypeId);
  const hero = set[0]!;
  const gallery = set.slice(1, INFO_PHOTOS_PER_SITE);
  const pool = gallery.length ? gallery : [hero];
  const services = Array.from({ length: Math.max(0, args.serviceCount) }, (_, i) => pool[(i + 1) % pool.length]!);
  return { hero, gallery, services };
}

/** Alt text stored with an imported photo: description + Unsplash credit (≤ 200 chars, DB limit). */
export function infoPhotoAlt(p: InfoPhoto): string {
  const credit = `Photo: ${p.photographer.name.trim()} / Unsplash`;
  const base = p.alt.trim().slice(0, 200 - credit.length - 2);
  return base ? `${base}. ${credit}` : credit;
}

/** Every category id (for tests and tooling). */
export const INFO_PHOTO_CATEGORIES: readonly InfoCategory[] = INFO_CATEGORIES.map((c) => c.id);
