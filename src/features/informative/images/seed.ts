import "server-only";
import { logger } from "@/lib/observability/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUnsplashImageUrl } from "@/features/media/unsplash/photos";
import { MEDIA_MAX_BYTES } from "@/features/media/rules";
import { registerImportedImage } from "@/features/media/server/media";
import { infoPhotoAlt, type InfoImagePlan, type InfoPhoto } from "./catalog";

/**
 * Copies the planned curated photos (catalog.ts) into the new site's media library and fills the
 * hero, the gallery and each starter service's image, the same way the store seed does
 * (onboarding/seed/images.ts). I/O only: no resizing here (variants are made by the media layer
 * or on first request by /api/img). Best effort: a failed photo is logged and skipped, and
 * nothing the seller already set is overwritten. Runs with the member's own session (RLS).
 */

/** Same width as the store seed: sharp enough for a full-width hero, well under the size limit. */
export const INFO_PHOTO_WIDTH = 1600;
const CONCURRENCY = 4;
/** Stop starting new downloads after this long; finishing onboarding matters more. */
const BUDGET_MS = 20_000;

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

export async function seedInformativeImages(args: {
  tenantId: string;
  userId: string;
  plan: InfoImagePlan;
  /** Service slugs in payload order (plan.services[i] belongs to serviceSlugs[i]). */
  serviceSlugs: string[];
  fetchPhoto?: FetchInfoPhoto;
}): Promise<InfoImageSeedResult> {
  const result: InfoImageSeedResult = { hero: false, gallery: 0, services: 0 };
  const { tenantId, userId, plan } = args;
  const get = args.fetchPhoto ?? fetchPhoto;
  const started = Date.now();
  const stored = new Map<string, string>();
  const queue = planPhotos(plan);

  async function worker() {
    for (let p = queue.shift(); p; p = queue.shift()) {
      if (Date.now() - started > BUDGET_MS) return;
      try {
        const bytes = await get(infoPhotoDownloadUrl(p));
        const item = await registerImportedImage(tenantId, userId, { bytes, filename: `${p.id}.jpg`, folder: "seed", alt: infoPhotoAlt(p), width: null, height: null });
        stored.set(p.id, item.path);
      } catch (err) {
        logger.warn("informative.seed_image_skipped", { tenantId, photoId: p.id, message: err instanceof Error ? err.message.slice(0, 200) : "unknown" });
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (!stored.size) return result;
    const supabase = await createSupabaseServerClient();

    const heroPath = stored.get(plan.hero.id);
    if (heroPath) {
      const { data, error } = await supabase.from("info_sites").update({ hero_image_path: heroPath }).eq("tenant_id", tenantId).is("hero_image_path", null).select("tenant_id");
      if (error) logger.warn("informative.seed_hero_failed", { tenantId, code: error.code });
      else result.hero = (data ?? []).length > 0;
    }

    const { count } = await supabase.from("info_gallery_items").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).is("deleted_at", null);
    if (!count) {
      const rows = plan.gallery.flatMap((p, i) => {
        const path = stored.get(p.id);
        return path ? [{ tenant_id: tenantId, image_path: path, alt: infoPhotoAlt(p), caption: null, album: null, sort_order: i }] : [];
      });
      if (rows.length) {
        const { error } = await supabase.from("info_gallery_items").insert(rows);
        if (error) logger.warn("informative.seed_gallery_failed", { tenantId, code: error.code });
        else result.gallery = rows.length;
      }
    }

    for (const [i, slug] of args.serviceSlugs.entries()) {
      const photo = plan.services[i];
      const path = photo ? stored.get(photo.id) : undefined;
      if (!path) continue;
      const { data, error } = await supabase.from("info_services").update({ image_path: path }).eq("tenant_id", tenantId).eq("slug", slug).is("image_path", null).select("id");
      if (error) logger.warn("informative.seed_service_image_failed", { tenantId, code: error.code });
      else result.services += (data ?? []).length;
    }
  } catch (err) {
    logger.warn("informative.seed_images_failed", { tenantId, message: err instanceof Error ? err.message.slice(0, 200) : "unknown" });
  }
  return result;
}
