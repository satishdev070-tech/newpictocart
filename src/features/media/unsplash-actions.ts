"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { can, requireTenant, type TenantContext } from "@/lib/tenant/membership";
import { assertPlatformPermission, getPlatformContext, type PlatformContext } from "@/lib/platform/access";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { FOLDER_PATTERN } from "./rules";
import { registerImportedImage, type MediaItem } from "./server/media";
import { downloadUnsplashImage, featuredUnsplashPhotos, resolveUnsplashPhoto, searchUnsplash, trackUnsplashDownload, unsplashEnabled } from "./unsplash/server";
import { importedFilename, unsplashCredit, type UnsplashPhoto } from "./unsplash/photos";

/**
 * Unsplash in the media library. Sellers browse and import (a copy goes into their own library,
 * so every place that uses the media picker works unchanged); super admins browse and copy a
 * hotlink URL for the marketing site. Each insert/copy calls Unsplash's download endpoint, as the
 * API guidelines require. Searches are rate limited per store/user (the API allows 50 req/hour in
 * demo mode, 5000 in production) and cached server-side.
 */

export type UnsplashListing = { photos: UnsplashPhoto[]; total: number; pages: number; featured: boolean; apiEnabled: boolean };

/** An error whose message the UI shows (fieldErrors._form; AppError messages are log-only). */
const fail = (code: "NOT_FOUND" | "INTERNAL", message: string) => new AppError(code, { message, fieldErrors: { _form: [message] } });

const listSchema = z.object({ q: z.string().trim().max(80).optional(), page: z.number().int().min(1).max(50).optional() });
const idSchema = z.string().trim().min(6).max(64).regex(/^[A-Za-z0-9_-]+$/, "Invalid photo");

async function listing(input: z.infer<typeof listSchema>, bucket: string, subject: string): Promise<UnsplashListing> {
  const apiEnabled = unsplashEnabled();
  if (!input.q) {
    const photos = await featuredUnsplashPhotos();
    return { photos, total: photos.length, pages: 1, featured: true, apiEnabled };
  }
  // Only real API calls count; cached pages come back from Next's fetch cache.
  if (apiEnabled) await rateLimit(bucket, subject, 60, 3600);
  try {
    return { ...(await searchUnsplash(input.q, input.page ?? 1)), featured: false, apiEnabled };
  } catch {
    throw fail("INTERNAL", "Unsplash search is unavailable right now. Please try again in a minute.");
  }
}

/** Anyone who can add images somewhere (catalogue, content or theme) may use Unsplash photos. */
async function mediaWriter(): Promise<TenantContext> {
  const ctx = await requireTenant();
  if (!(can(ctx, "catalog.write") || can(ctx, "content.write") || can(ctx, "theme.edit"))) throw new AppError("FORBIDDEN");
  return ctx;
}

async function platformActor(): Promise<PlatformContext> {
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  assertPlatformPermission(ctx, "platform.settings.manage");
  return ctx;
}

/** Store media library: the photos the platform uses (empty search) or an Unsplash search. */
export async function listUnsplashAction(input: { q?: string; page?: number }): Promise<ActionResult<UnsplashListing>> {
  return runAction("media.unsplash.list", async () => {
    const ctx = await mediaWriter();
    return listing(parseInput(listSchema, input), "unsplash:search", ctx.tenantId);
  });
}

/** Imports an Unsplash photo into the store's media library and returns the new media item. */
export async function importUnsplashAction(input: { id: string; folder?: string }): Promise<ActionResult<{ item: MediaItem }>> {
  const result = await runAction("media.unsplash.import", async () => {
    const ctx = await mediaWriter();
    const v = parseInput(z.object({ id: idSchema, folder: z.string().trim().toLowerCase().regex(FOLDER_PATTERN).optional() }), input);
    await rateLimit("media:upload", ctx.tenantId, 300, 3600);
    const resolved = await resolveUnsplashPhoto(v.id);
    if (!resolved) throw fail("NOT_FOUND", "That Unsplash photo isn't available any more.");
    let image: Awaited<ReturnType<typeof downloadUnsplashImage>>;
    try {
      image = await downloadUnsplashImage(resolved);
    } catch {
      throw fail("INTERNAL", "Couldn't download the photo from Unsplash. Please try again.");
    }
    const { photo } = resolved;
    const item = await registerImportedImage(ctx.tenantId, ctx.user.id, {
      bytes: image.bytes,
      filename: importedFilename(photo),
      folder: v.folder || "unsplash",
      // Alt text carries the credit, so it stays with the image wherever it's used.
      alt: `${photo.alt.slice(0, 220)} (${unsplashCredit(photo)})`,
      width: image.width,
      height: image.height,
    });
    await trackUnsplashDownload(resolved.downloadLocation);
    await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "media.unsplash_imported", entityType: "media", entityId: item.id, metadata: { unsplashId: photo.id } });
    return { item };
  });
  if (result.ok) refresh();
  return result;
}

/** Super-admin media library: same listing, for the marketing site and landing CMS. */
export async function adminListUnsplashAction(input: { q?: string; page?: number }): Promise<ActionResult<UnsplashListing>> {
  return runAction("platform.unsplash.list", async () => {
    const ctx = await platformActor();
    return listing(parseInput(listSchema, input), "unsplash:search:platform", ctx.user.id);
  });
}

/** Super admin "Copy URL": records the use with Unsplash and returns the hotlink URL and credit. */
export async function adminUseUnsplashAction(input: { id: string }): Promise<ActionResult<{ url: string; credit: string }>> {
  return runAction("platform.unsplash.use", async () => {
    await platformActor();
    const v = parseInput(z.object({ id: idSchema }), input);
    const resolved = await resolveUnsplashPhoto(v.id);
    if (!resolved) throw fail("NOT_FOUND", "That Unsplash photo isn't available any more.");
    await trackUnsplashDownload(resolved.downloadLocation);
    const p = resolved.photo;
    return { url: p.full, credit: unsplashCredit(p) };
  });
}
