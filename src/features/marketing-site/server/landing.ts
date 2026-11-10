import "server-only";
import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { mapDbError } from "@/lib/supabase/errors";
import { assertPlatformPermission, type PlatformContext } from "@/lib/platform/access";
import type { Json } from "@/lib/supabase/database.types";
import { cachedPublic, revalidatePublicTags } from "@/lib/cache/public-cache";
import { DEFAULT_LANDING, LANDING_KEY, parseLanding, validateLanding, type LandingContent } from "../landing";

export const LANDING_TAG = "platform-landing";

class LandingUnavailable extends Error {}

async function load(): Promise<LandingContent> {
  // Anon client + RLS (platform_settings_public_select): `public.*` keys are world-readable.
  const { data, error } = await createSupabasePublicClient().from("platform_settings").select("value").eq("key", LANDING_KEY).maybeSingle();
  if (error) {
    logger.warn("marketing.landing_unavailable", { code: error.code });
    throw new LandingUnavailable(); // not cached; defaults are used below
  }
  return parseLanding(data?.value ?? null);
}

const cached = cachedPublic("platform-landing", load, {
  tags: [LANDING_TAG],
  revalidateSeconds: 300,
  keyPrefix: "pub:v1",
});

/** Landing page content edited in /admin/landing. Never throws: any failure means the defaults. */
export const getLandingContent = cache(async (): Promise<LandingContent> => {
  try {
    return await cached();
  } catch {
    return DEFAULT_LANDING;
  }
});

/** Current document for the editor, read fresh (no cache) with the admin's own client. */
export async function loadLandingForAdmin(): Promise<{ content: LandingContent; stored: boolean }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("platform_settings").select("value").eq("key", LANDING_KEY).maybeSingle();
  if (error) throw mapDbError(error);
  return { content: parseLanding(data?.value ?? null), stored: Boolean(data) };
}

/** Saves the whole document (validated) with the admin's own client; RLS checks platform.settings.manage too. */
export async function saveLandingContent(ctx: PlatformContext, value: unknown): Promise<void> {
  assertPlatformPermission(ctx, "platform.settings.manage");
  const parsed = validateLanding(value);
  if (!parsed.ok) {
    const first = parsed.errors[0];
    throw new AppError("VALIDATION", { fieldErrors: { _form: [first ? `${first.path || "content"}: ${first.message}` : "Check the highlighted fields"] } });
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("platform_settings")
    .upsert({ key: LANDING_KEY, value: parsed.value as unknown as Json, updated_by: ctx.user.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw mapDbError(error);
  // The document is large, so the audit entry records that it changed, not the full before/after.
  await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "platform_setting.updated", entityType: "platform_setting", entityId: LANDING_KEY, metadata: { sections: parsed.value.order } });
}

/** Restores the defaults by removing the stored document. */
export async function resetLandingContent(ctx: PlatformContext): Promise<void> {
  assertPlatformPermission(ctx, "platform.settings.manage");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("platform_settings").delete().eq("key", LANDING_KEY);
  if (error) throw mapDbError(error);
  await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "platform_setting.updated", entityType: "platform_setting", entityId: LANDING_KEY, metadata: { reset: true } });
}

/** After a save: refresh the cached document and every marketing page (header/footer use it too). */
export function revalidateLanding() {
  revalidatePublicTags(LANDING_TAG);
  revalidatePath("/", "layout");
}
