"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { listMedia, registerImportedImage, type MediaItem } from "@/features/media/server/media";
import { downloadUnsplashImage, resolveUnsplashPhoto, trackUnsplashDownload } from "@/features/media/unsplash/server";
import { API_ID_RE, importedFilename, unsplashCredit } from "@/features/media/unsplash/photos";
import { requireInformativeTenant, type InformativeContext } from "../server/context";
import { searchPickerPhotos } from "./unsplash";
import type { ImportedImage, PickerSearch } from "./types";

/**
 * Website editor image picker: Unsplash search and import into the tenant's media library.
 * Tenant = the member's own membership (requireInformativeTenant), permission content.write.
 * The browser only ever sends an Unsplash photo id: the photo is looked up through the Unsplash
 * API by the server, downloaded only from images.unsplash.com, its download endpoint is called
 * (API guidelines), and the copy is stored with the member's own session (Storage + table RLS).
 */

const fail = (code: "NOT_FOUND" | "INTERNAL" | "RATE_LIMITED", message: string) => new AppError(code, { message, fieldErrors: { _form: [message] } });

const searchSchema = z.object({ query: z.string().trim().max(80).default(""), page: z.number().int().min(1).max(50).default(1) });
/** An Unsplash photo id — never a URL (no ":", "/" or "."). */
const importSchema = z.object({ id: z.string().trim().regex(API_ID_RE, "Choose a photo from the Unsplash results.") });

async function contentWriter(): Promise<InformativeContext> {
  const ctx = await requireInformativeTenant();
  if (!ctx.permissions.has("content.write")) throw new AppError("FORBIDDEN", { context: { permission: "content.write" } });
  return ctx;
}

async function limited(bucket: string, subject: string, limit: number, windowSeconds: number, message: string) {
  try {
    await rateLimit(bucket, subject, limit, windowSeconds);
  } catch (err) {
    if (err instanceof AppError && err.code === "RATE_LIMITED") throw fail("RATE_LIMITED", message);
    throw err;
  }
}

export async function searchUnsplashAction(input: { query: string; page?: number }): Promise<ActionResult<PickerSearch>> {
  return runAction("informative.media.unsplash.search", async () => {
    const v = parseInput(searchSchema, input);
    const ctx = await contentWriter();
    if (v.query) await limited("unsplash:search", ctx.tenantId, 120, 3600, "You've searched Unsplash a lot in the last hour. Try again a little later.");
    try {
      return await searchPickerPhotos(v.query, v.page);
    } catch {
      throw fail("INTERNAL", "Unsplash search is unavailable right now. Please try again in a minute.");
    }
  });
}

export async function importUnsplashImageAction(input: { id: string }): Promise<ActionResult<ImportedImage>> {
  return runAction("informative.media.unsplash.import", async () => {
    const v = parseInput(importSchema, input);
    const ctx = await contentWriter();
    await limited("media:upload", ctx.tenantId, 300, 3600, "You've added a lot of images in the last hour. Try again a little later.");
    const resolved = await resolveUnsplashPhoto(v.id);
    if (!resolved) throw fail("NOT_FOUND", "That Unsplash photo isn't available any more. Choose another one.");
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
      folder: "unsplash",
      // Alt text carries the credit, so it stays with the image wherever it's used.
      alt: `${photo.alt.slice(0, 220)} (${unsplashCredit(photo)})`,
      width: image.width,
      height: image.height,
    });
    await trackUnsplashDownload(resolved.downloadLocation);
    await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "media.unsplash_imported", entityType: "media", entityId: item.id, metadata: { unsplashId: photo.id, source: "informative_editor" } });
    return { path: item.path, url: item.url, alt: item.alt };
  });
}

/**
 * "My images" tab: the tenant's media library for an Informative Website. The store's
 * listMediaAction resolves its tenant with requireTenant(), which redirects Informative tenants
 * to their panel, so the picker uses this action instead (same query, informative tenant guard).
 */
export async function listInformativeMediaAction(input: { page?: number; pageSize?: number }): Promise<ActionResult<{ items: MediaItem[]; total: number }>> {
  return runAction("informative.media.list", async () => {
    const ctx = await requireInformativeTenant();
    if (!ctx.permissions.has("content.write")) throw new AppError("FORBIDDEN", { context: { permission: "content.write" } });
    const q = parseInput(z.object({ page: z.number().int().min(1).max(1000).optional(), pageSize: z.number().int().min(1).max(96).optional() }), input);
    const r = await listMedia(ctx.tenantId, { ...q, sort: "newest" });
    return { items: r.items, total: r.total };
  });
}
