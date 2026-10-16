/**
 * Unsplash photos in the media library (pure, unit tested; safe in client and server code).
 *
 * Two kinds of photo: "api" photos found through the Unsplash API (search, and the photo each
 * theme/category card uses), and "curated" photos, the static images.unsplash.com fallbacks from
 * src/lib/unsplash.ts used when no UNSPLASH_ACCESS_KEY is set. Thumbnails are hotlinked from
 * images.unsplash.com, as the API guidelines require, and always shown with the credit
 * "Photo by <name> on Unsplash".
 */

export type UnsplashPhoto = {
  /** API photo id, or the images.unsplash.com id ("photo-…") of a curated photo. */
  id: string;
  source: "api" | "curated";
  alt: string;
  /** images.unsplash.com base URL (keeps Unsplash's ixid tracking params); size with sizedUnsplashUrl. */
  base: string;
  /** Small hotlinked thumbnail for grids (400 px wide). */
  thumb: string;
  /** Larger hotlinked image (1600 px wide), e.g. for "Copy URL" on the marketing site. */
  full: string;
  width: number | null;
  height: number | null;
  /** Average colour, shown while the thumbnail loads. */
  color: string | null;
  photographer: { name: string; url: string } | null;
  /** Photo page on unsplash.com (with referral UTM), or the Unsplash home for curated photos. */
  link: string;
  /** Where the platform uses this photo, e.g. ["Fashion themes"]; empty for search results. */
  usedFor: string[];
};

export const UNSPLASH_UTM = "utm_source=pictocart&utm_medium=referral";
const HOME = `https://unsplash.com/?${UNSPLASH_UTM}`;

export const API_ID_RE = /^[A-Za-z0-9_-]{6,40}$/;
export const CURATED_ID_RE = /^photo-\d{10,16}-[0-9a-f]{8,16}$/;

export const withUtm = (url: string) => `${url}${url.includes("?") ? "&" : "?"}${UNSPLASH_UTM}`;

/** images.unsplash.com URL at a given width (Unsplash's own resizing; no optimizer needed). */
export function sizedUnsplashUrl(base: string, width: number, format: "auto" | "jpg" = "auto"): string {
  const fmt = format === "jpg" ? "fm=jpg" : "auto=format";
  return `${base}${base.includes("?") ? "&" : "?"}w=${width}&${fmt}&fit=max&q=80`;
}

/** Only https://images.unsplash.com/… is ever hotlinked or downloaded. */
export function isUnsplashImageUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "images.unsplash.com";
  } catch {
    return false;
  }
}

/** The API's download-tracking endpoint for a photo (must be api.unsplash.com over https). */
export function isDownloadLocation(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "api.unsplash.com" && /^\/photos\/[A-Za-z0-9_-]+\/download$/.test(u.pathname);
  } catch {
    return false;
  }
}

/** Shape of a photo in Unsplash API responses (only the fields we read). */
export type ApiPhoto = {
  id?: string;
  alt_description?: string | null;
  description?: string | null;
  width?: number;
  height?: number;
  color?: string | null;
  urls?: { raw?: string };
  links?: { html?: string; download_location?: string };
  user?: { name?: string; links?: { html?: string } };
};

/** Normalises an API photo; null when it is missing anything we need (id, an Unsplash image URL). */
export function fromApiPhoto(p: ApiPhoto | null | undefined, usedFor: string[] = []): UnsplashPhoto | null {
  const raw = p?.urls?.raw;
  if (!p?.id || !API_ID_RE.test(p.id) || !isUnsplashImageUrl(raw)) return null;
  const name = p.user?.name;
  const profile = p.user?.links?.html;
  return {
    id: p.id,
    source: "api",
    alt: (p.alt_description || p.description || "Photo from Unsplash").slice(0, 300),
    base: raw,
    thumb: sizedUnsplashUrl(raw, 400),
    full: sizedUnsplashUrl(raw, 1600),
    width: p.width ?? null,
    height: p.height ?? null,
    color: p.color && /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : null,
    photographer: name && profile ? { name, url: withUtm(profile) } : null,
    link: p.links?.html ? withUtm(p.links.html) : HOME,
    usedFor,
  };
}

/** A curated images.unsplash.com photo (no API involved). */
export function curatedPhoto(id: string, alt: string, usedFor: string[] = []): UnsplashPhoto {
  const base = `https://images.unsplash.com/${id}`;
  return { id, source: "curated", alt, base, thumb: sizedUnsplashUrl(base, 400), full: sizedUnsplashUrl(base, 1600), width: null, height: null, color: null, photographer: null, link: HOME, usedFor };
}

/** "Photo by Jane Doe on Unsplash" (or "Photo from Unsplash" without a photographer). */
export function unsplashCredit(p: Pick<UnsplashPhoto, "photographer">): string {
  return p.photographer ? `Photo by ${p.photographer.name} on Unsplash` : "Photo from Unsplash";
}

/** File name for an imported photo: keeps the credit with the file in the library. */
export function importedFilename(p: Pick<UnsplashPhoto, "photographer" | "id">): string {
  const who = (p.photographer?.name ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `unsplash-${who ? `${who}-` : ""}${p.id.slice(0, 32)}.jpg`;
}

/** Size of an imported copy: the original scaled down to at most `max` px wide. */
export function scaledSize(width: number | null, height: number | null, max: number): { width: number | null; height: number | null } {
  if (!width || !height) return { width: null, height: null };
  const w = Math.min(width, max);
  return { width: w, height: Math.round((height * w) / width) };
}

/** Merges photos by id, keeping the first and combining their `usedFor` labels. */
export function mergePhotos(photos: UnsplashPhoto[]): UnsplashPhoto[] {
  const byId = new Map<string, UnsplashPhoto>();
  for (const p of photos) {
    const seen = byId.get(p.id);
    if (seen) seen.usedFor = [...new Set([...seen.usedFor, ...p.usedFor])];
    else byId.set(p.id, { ...p, usedFor: [...p.usedFor] });
  }
  return [...byId.values()];
}
