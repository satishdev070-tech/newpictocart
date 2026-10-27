import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { RETURN_PHOTO_BUCKET } from "../return-photos";

const TTL_SECONDS = 60 * 30;

/**
 * Short-lived URLs for return photos, signed with the VIEWER's session: storage RLS decides
 * (staff with orders.read, or the order's own customer). Unreadable paths are left out.
 */
export async function signReturnPhotos(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths)];
  if (!unique.length) return out;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(RETURN_PHOTO_BUCKET).createSignedUrls(unique, TTL_SECONDS);
  if (error) {
    logger.warn("return_photos.sign_failed", { error: error.message });
    return out;
  }
  for (const row of data ?? []) if (row.path && row.signedUrl && !row.error) out.set(row.path, row.signedUrl);
  return out;
}

/** Lightbox items for one return's photos, in upload order. */
export function photoItems(paths: string[], urls: Map<string, string>, returnLabel: string) {
  return paths.flatMap((p, n) => {
    const src = urls.get(p);
    return src ? [{ src, alt: `${returnLabel} photo ${n + 1}` }] : [];
  });
}
