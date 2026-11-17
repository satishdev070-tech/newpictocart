import "server-only";
import { logger } from "@/lib/observability/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { isUnsplashImageUrl } from "@/features/media/unsplash/photos";
import { MEDIA_MAX_BYTES } from "@/features/media/rules";
import { registerImportedImage } from "@/features/media/server/media";
import { infoPhotoAlt, type InfoImagePlan, type InfoPhoto } from "./catalog";

/**
 * Copies the planned curated photos (catalog.ts) into the new site's media library and fills the
 * hero, the gallery and each starter service's image, the same way the store seed does
 * (onboarding/seed/images.ts), a couple of photos per call (importInformativeImagesBatch). I/O
 * only: no resizing here (variants are made by the media layer or on first request by /api/img).
 * Best effort: a failed photo is logged and skipped, and nothing the seller already set is
 * overwritten.
 */

/** Same width as the store seed: sharp enough for a full-width hero, well under the size limit. */
export const INFO_PHOTO_WIDTH = 1600;

export type FetchInfoPhoto = (url: string) => Promise<Uint8Array>;
export type InfoImageSeedResult = { hero: boolean; gallery: number; services: number };

async function fetchPhoto(url: string): Promise<Uint8Array> {
  if (!isUnsplashImageUrl(url)) throw new Error("bad image url");
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000), redirect: "error" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (Number(res.headers.get("content-length") ?? 0) > MEDIA_MAX_BYTES) throw new Error("too large");
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MEDIA_MAX_BYTES) throw new Error("too large");
  return bytes;
}

export function infoPhotoDownloadUrl(p: InfoPhoto): string {
  return `${p.url}&w=${INFO_PHOTO_WIDTH}&fm=jpg`;
}

/** Unique photos of a plan, hero first. */
export function planPhotos(plan: InfoImagePlan): InfoPhoto[] {
  const seen = new Map<string, InfoPhoto>();
  for (const p of [plan.hero, ...plan.gallery, ...plan.services]) if (!seen.has(p.id)) seen.set(p.id, p);
  return [...seen.values()];
}

export type InfoPhotoBatchResult = {
  /** Photo ids copied into the media library by this call. */
  imported: string[];
  /** Photo ids whose download / import failed in this call (the caller skips them next time). */
  failed: string[];
  /** Planned photos still to import after this call (not counting skipped ones). 0 = done. */
  remaining: number;
  placed: InfoImageSeedResult;
};

/**
 * One batch of the photo seed (phased onboarding finish; Workers Free has 10 ms CPU per request).
 * Idempotent and resumable: photos already in the site's media library (folder "seed", file
 * `<photo id>.jpg`) are not downloaded again, at most `batchSize` new ones are imported, and then
 * every stored photo is placed where nothing is set yet: hero if empty, service image if empty,
 * gallery only while it holds nothing but seed photos. Nothing the seller set is ever overwritten.
 * Runs with the member's own session (RLS).
 */
export async function importInformativeImagesBatch(args: {
  tenantId: string;
  userId: string;
  plan: InfoImagePlan;
  /** Service slugs in payload order (plan.services[i] belongs to serviceSlugs[i]). */
  serviceSlugs: string[];
  /** Photo ids to leave out (failed in an earlier call). */
  skip?: readonly string[];
  batchSize?: number;
  fetchPhoto?: FetchInfoPhoto;
}): Promise<InfoPhotoBatchResult> {
  const { tenantId, userId, plan } = args;
  const get = args.fetchPhoto ?? fetchPhoto;
  const batchSize = Math.max(1, Math.min(args.batchSize ?? 2, 4));
  const skip = new Set(args.skip ?? []);
  const photos = planPhotos(plan);
  const supabase = await createSupabaseServerClient();

  const stored = new Map<string, string>();
  const { data: existing, error: existingError } = await supabase
    .from("media_assets")
    .select("storage_path, filename")
    .eq("tenant_id", tenantId)
    .eq("folder", "seed")
    .in("filename", photos.map(seedFilename));
  if (existingError) throw mapDbError(existingError, { op: "informative.seed_media" });
  for (const row of existing ?? []) {
    const p = photos.find((x) => seedFilename(x) === row.filename);
    if (p && !stored.has(p.id)) stored.set(p.id, row.storage_path);
  }

  const pending = photos.filter((p) => !stored.has(p.id) && !skip.has(p.id));
  const batch = pending.slice(0, batchSize);
  const imported: string[] = [];
  const failed: string[] = [];
  await Promise.all(
    batch.map(async (p) => {
      try {
        const bytes = await get(infoPhotoDownloadUrl(p));
        const item = await registerImportedImage(tenantId, userId, { bytes, filename: seedFilename(p), folder: "seed", alt: infoPhotoAlt(p), width: null, height: null });
        stored.set(p.id, item.path);
        imported.push(p.id);
      } catch (err) {
        failed.push(p.id);
        logger.warn("informative.seed_image_skipped", { tenantId, photoId: p.id, message: err instanceof Error ? err.message.slice(0, 200) : "unknown" });
      }
    }),
  );

  const placed = imported.length || pending.length === batch.length ? await placeSeedPhotos(tenantId, plan, args.serviceSlugs, stored) : { hero: false, gallery: 0, services: 0 };
  return { imported, failed, remaining: pending.length - batch.length, placed };
}

function seedFilename(p: InfoPhoto): string {
  return `${p.id}.jpg`;
}

/** Puts stored seed photos where nothing is set yet (never overwrites). Best effort per target. */
async function placeSeedPhotos(tenantId: string, plan: InfoImagePlan, serviceSlugs: string[], stored: Map<string, string>): Promise<InfoImageSeedResult> {
  const result: InfoImageSeedResult = { hero: false, gallery: 0, services: 0 };
  if (!stored.size) return result;
  const supabase = await createSupabaseServerClient();

  const heroPath = stored.get(plan.hero.id);
  if (heroPath) {
    const { data, error } = await supabase.from("info_sites").update({ hero_image_path: heroPath }).eq("tenant_id", tenantId).is("hero_image_path", null).select("tenant_id");
    if (error) logger.warn("informative.seed_hero_failed", { tenantId, code: error.code });
    else result.hero = (data ?? []).length > 0;
  }

  const seedPaths = new Set(stored.values());
  const { data: gallery, error: galleryError } = await supabase.from("info_gallery_items").select("image_path").eq("tenant_id", tenantId).is("deleted_at", null);
  if (galleryError) logger.warn("informative.seed_gallery_failed", { tenantId, code: galleryError.code });
  else {
    const present = (gallery ?? []).map((g) => g.image_path);
    // The seller's own photos are there: leave the gallery alone.
    if (present.every((path) => seedPaths.has(path))) {
      const have = new Set(present);
      const rows = plan.gallery.flatMap((p, i) => {
        const path = stored.get(p.id);
        return path && !have.has(path) ? [{ tenant_id: tenantId, image_path: path, alt: infoPhotoAlt(p), caption: null, album: null, sort_order: i }] : [];
      });
      if (rows.length) {
        const { error } = await supabase.from("info_gallery_items").insert(rows);
        if (error) logger.warn("informative.seed_gallery_failed", { tenantId, code: error.code });
        else result.gallery = rows.length;
      }
    }
  }

  for (const [i, slug] of serviceSlugs.entries()) {
    const photo = plan.services[i];
    const path = photo ? stored.get(photo.id) : undefined;
    if (!path) continue;
    const { data, error } = await supabase.from("info_services").update({ image_path: path }).eq("tenant_id", tenantId).eq("slug", slug).is("image_path", null).select("id");
    if (error) logger.warn("informative.seed_service_image_failed", { tenantId, code: error.code });
    else result.services += (data ?? []).length;
  }
  return result;
}
