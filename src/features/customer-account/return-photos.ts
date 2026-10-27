import { sniffImage } from "@/lib/storage/sniff";

/**
 * Photos a shopper attaches to a return request (pure; the upload is in actions.ts).
 * Stored in the private bucket at tenant/{tenant}/returns/{order}/{uuid}.{ext}; storage RLS lets
 * only the order's own customer and the store's staff (orders.read) read them.
 */
export const RETURN_PHOTO_BUCKET = "private-files";
export const MAX_RETURN_PHOTOS = 5;
export const MAX_RETURN_PHOTO_BYTES = 5 * 1024 * 1024;
export const RETURN_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
/** Reasons where a photo is required (the item itself is the evidence). */
export const PHOTO_REQUIRED_REASONS: readonly string[] = ["damaged"];

const ALLOWED = new Set(["jpg", "png", "webp"]);

export type ReturnPhoto = { bytes: Uint8Array; mime: string; ext: string };

/** Validates uploaded files by real content (magic bytes), count and size. Returns field errors or the photos. */
export function validateReturnPhotos(files: { size: number; bytes: Uint8Array }[], reason: string): { ok: true; photos: ReturnPhoto[] } | { ok: false; error: string } {
  const real = files.filter((f) => f.size > 0);
  if (real.length > MAX_RETURN_PHOTOS) return { ok: false, error: `Attach up to ${MAX_RETURN_PHOTOS} photos.` };
  if (real.length === 0 && PHOTO_REQUIRED_REASONS.includes(reason)) return { ok: false, error: "Add at least one photo of the damage." };
  const photos: ReturnPhoto[] = [];
  for (const f of real) {
    if (f.size > MAX_RETURN_PHOTO_BYTES) return { ok: false, error: "Each photo must be 5 MB or smaller." };
    const kind = sniffImage(f.bytes);
    if (!kind || !ALLOWED.has(kind.ext)) return { ok: false, error: "Photos must be JPG, PNG or WebP images." };
    photos.push({ bytes: f.bytes, mime: kind.mime, ext: kind.ext });
  }
  return { ok: true, photos };
}

/** The only path shape the DB and storage policies accept for a return photo. */
export function returnPhotoPath(tenantId: string, orderId: string, id: string, ext: string): string {
  return `tenant/${tenantId}/returns/${orderId}/${id}.${ext}`;
}
