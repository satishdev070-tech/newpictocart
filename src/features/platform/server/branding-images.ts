import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sniffImage } from "@/lib/storage/upload";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { assertPlatformPermission, type PlatformContext } from "@/lib/platform/access";
import { audit } from "@/lib/audit";
import type { Json } from "@/lib/supabase/database.types";
import {
  BRANDING_BUCKET,
  checkBrandImageSize,
  maxBytesFor,
  brandSlotKey,
  isIco,
  parseBrandImage,
  type BrandImage,
  type BrandSlot,
} from "../public-config";

function platformAudit(ctx: PlatformContext, entry: { action: `${string}.${string}`; entityType: string; entityId: string; metadata?: Record<string, Json | undefined> }) {
  return audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", ...entry });
}

/** Turns storage errors into something an admin can act on (the usual cause: migration 2500 not applied). */
function storageError(message: string): AppError {
  const missing = /bucket not found/i.test(message);
  logger.warn("platform.branding_upload_failed", { error: message });
  return new AppError("VALIDATION", {
    fieldErrors: {
      file: [
        missing
          ? "The “platform-branding” storage bucket doesn't exist yet. Run supabase/dev/apply-2500.sql in the Supabase SQL editor, then upload again."
          : `Storage refused the upload (${message.slice(0, 120)}). If this persists, re-run supabase/dev/apply-2500.sql, which sets the bucket's permissions.`,
      ],
    },
  });
}

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * Uploads a logo / favicon to the public branding bucket with the signed-in admin's client (the
 * storage policy checks platform.settings.manage too) and points the setting at it. The previous
 * file is removed afterwards. SVG is not accepted (script risk).
 *
 * Lives in this write-only module so auth/marketing read paths never load `sharp`.
 */
export async function uploadBrandImage(ctx: PlatformContext, slot: BrandSlot, file: File): Promise<void> {
  assertPlatformPermission(ctx, "platform.settings.manage");
  const fail = (message: string) => new AppError("VALIDATION", { fieldErrors: { file: [message] } });
  if (!(file instanceof File) || file.size === 0) throw fail("Choose an image to upload");
  if (file.size > maxBytesFor(slot)) throw fail(`Images must be ${maxBytesFor(slot) / 1024 / 1024} MB or smaller`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImage(bytes);
  let mime: string;
  let ext: string;
  if (sniffed && EXT[sniffed.mime]) {
    mime = sniffed.mime;
    ext = EXT[sniffed.mime]!;
  } else if (slot === "favicon" && isIco(bytes)) {
    mime = "image/x-icon";
    ext = "ico";
  } else {
    throw fail(slot === "favicon" ? "Use a PNG, ICO, JPG or WebP file" : "Use a PNG, JPG or WebP file (SVG isn't accepted)");
  }
  let width: number | null = null;
  let height: number | null = null;
  if (ext !== "ico") {
    try {
      const meta = await sharp(bytes).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch {
      throw fail("That image couldn't be read");
    }
    const sizeError = checkBrandImageSize(slot, width, height);
    if (sizeError) throw fail(sizeError);
  }
  // Logos often ship with wide transparent/white margins, which make them look tiny in a 48px
  // header. Trim borders of the corner colour so the visible mark fills the height.
  let body: Uint8Array = bytes;
  if (slot === "header_logo" || slot === "footer_logo") {
    try {
      const { data, info } = await sharp(bytes)
        .trim({ threshold: 12 })
        .toFormat(ext === "jpg" ? "jpeg" : (ext as "png" | "webp"))
        .toBuffer({ resolveWithObject: true });
      if (info.width >= 16 && info.height >= 16) {
        body = new Uint8Array(data);
        width = info.width;
        height = info.height;
      }
    } catch {
      // Nothing to trim (or a single-colour image): keep the original.
    }
  }

  const supabase = await createSupabaseServerClient();
  const path = `branding/${slot}/${randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BRANDING_BUCKET).upload(path, body, { contentType: mime, cacheControl: "31536000", upsert: false });
  if (upErr) throw storageError(upErr.message);

  const key = brandSlotKey(slot);
  const { data: before } = await supabase.from("platform_settings").select("value").eq("key", key).maybeSingle();
  const value: BrandImage = { path, width, height };
  const { error } = await supabase.from("platform_settings").upsert({ key, value: value as unknown as Json, updated_by: ctx.user.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    await supabase.storage.from(BRANDING_BUCKET).remove([path]);
    throw new AppError("VALIDATION", { fieldErrors: { file: ["The image uploaded but couldn't be saved as a setting. Check that you have the platform settings permission."] }, context: { db: error.message } });
  }
  const old = parseBrandImage(before?.value);
  if (old && old.path !== path) await supabase.storage.from(BRANDING_BUCKET).remove([old.path]);
  await platformAudit(ctx, { action: "platform_branding.updated", entityType: "platform_setting", entityId: key, metadata: { slot, width, height, replaced: Boolean(old) } });
}

/** Removes a logo / favicon; the site falls back to the text wordmark / default icon. */
export async function clearBrandImage(ctx: PlatformContext, slot: BrandSlot): Promise<void> {
  assertPlatformPermission(ctx, "platform.settings.manage");
  const supabase = await createSupabaseServerClient();
  const key = brandSlotKey(slot);
  const { data: before } = await supabase.from("platform_settings").select("value").eq("key", key).maybeSingle();
  const { error } = await supabase.from("platform_settings").delete().eq("key", key);
  if (error) throw new AppError("INTERNAL", { cause: error });
  const old = parseBrandImage(before?.value);
  if (old) await supabase.storage.from(BRANDING_BUCKET).remove([old.path]);
  await platformAudit(ctx, { action: "platform_branding.cleared", entityType: "platform_setting", entityId: key, metadata: { slot } });
}
