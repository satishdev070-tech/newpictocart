import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMp4, sniffImage } from "@/lib/storage/upload";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { assertPlatformPermission, type PlatformContext } from "@/lib/platform/access";
import { audit } from "@/lib/audit";
import type { Json } from "@/lib/supabase/database.types";
import { BRANDING_BUCKET, brandImageUrl } from "../public-config";
import type { StepMediaKind } from "@/features/marketing-site/landing";
import { publicEnv } from "@/lib/env/public";

const MAX_BYTES = 25 * 1024 * 1024;

function storageError(message: string): AppError {
  const missing = /bucket not found/i.test(message);
  logger.warn("platform.landing_media_upload_failed", { error: message });
  return new AppError("VALIDATION", {
    fieldErrors: {
      file: [
        missing
          ? "The platform-branding storage bucket is missing. Apply migrations (including 20261102006000), then try again."
          : `Storage refused the upload (${message.slice(0, 120)}).`,
      ],
    },
  });
}

export type LandingAssetResult = { url: string; path: string; mediaKind: StepMediaKind };

/**
 * Uploads an image/GIF/MP4 for landing CMS fields. Uses the signed-in platform admin client
 * (storage RLS checks platform.settings.manage). Returns a public https URL for the CMS.
 */
export async function uploadLandingAsset(ctx: PlatformContext, file: File): Promise<LandingAssetResult> {
  assertPlatformPermission(ctx, "platform.settings.manage");
  const fail = (message: string) => new AppError("VALIDATION", { fieldErrors: { file: [message] } });
  if (!(file instanceof File) || file.size === 0) throw fail("Choose an image, GIF or MP4 to upload");
  if (file.size > MAX_BYTES) throw fail("Files must be 25 MB or smaller");

  const bytes = new Uint8Array(await file.arrayBuffer());
  let mime: string;
  let ext: string;
  let mediaKind: StepMediaKind;

  const sniffed = sniffImage(bytes);
  if (sniffed) {
    mime = sniffed.mime;
    ext = sniffed.ext;
    mediaKind = sniffed.mime === "image/gif" ? "gif" : "image";
  } else if (isMp4(bytes)) {
    mime = "video/mp4";
    ext = "mp4";
    mediaKind = "video";
  } else {
    throw fail("Use a JPG, PNG, WebP, GIF or MP4 file");
  }

  const supabase = await createSupabaseServerClient();
  const path = `landing/${randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BRANDING_BUCKET).upload(path, bytes, {
    contentType: mime,
    cacheControl: "31536000",
    upsert: false,
  });
  if (upErr) throw storageError(upErr.message);

  const url = brandImageUrl(publicEnv().NEXT_PUBLIC_SUPABASE_URL, { path, width: null, height: null });
  await audit({
    tenantId: null,
    actorUserId: ctx.user.id,
    actorType: "platform",
    action: "platform_landing_media.uploaded",
    entityType: "platform_setting",
    entityId: "public.marketing.landing",
    metadata: { path, mime, mediaKind } as Record<string, Json | undefined>,
  });
  return { url, path, mediaKind };
}
