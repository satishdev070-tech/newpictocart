"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { requireUserWithRetry } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import type { Json } from "@/lib/supabase/database.types";
import { publicEnv } from "@/lib/env/public";
import { isValidStoreSlug } from "@/lib/tenant/host";
import { setActiveTenant } from "@/lib/tenant/active";
import { clientIpKey, rateLimit } from "@/lib/rate-limit";
import { uploadTenantImage } from "@/lib/storage/upload";
import { logger } from "@/lib/observability/logger";
import { assertEmailVerifiedForOnboarding } from "@/features/onboarding/email-gate";
import { informativeOnboardingAllowed } from "../server/onboarding-gate";
import { findInformativeTheme } from "../themes/registry";
import { INFORMATIVE_HOME } from "../website-type";
import { completeDraftSchema, LOGO_MAX_BYTES } from "./draft";
import { buildCompletionPayload } from "./payload";

/**
 * Informative onboarding server actions (docs/informative/PLAN.md §Onboarding). Flag-gated: with
 * FEATURE_INFORMATIVE_WEBSITE off (or `internal` for non-staff) every action is refused.
 */

async function assertAllowed(): Promise<void> {
  if (!(await informativeOnboardingAllowed())) {
    throw new AppError("FORBIDDEN", { fieldErrors: { _form: ["Informative websites aren't available yet."] }, context: { reason: "flag" } });
  }
}

export type SlugCheck = { slug: string; available: boolean; reason: "ok" | "invalid" | "taken" };

/** Step 1 live address check (Q10). Rate-limited per IP; never reveals more than taken / free. */
export async function checkInformativeSlugAction(input: { slug: string }): Promise<ActionResult<SlugCheck>> {
  return runAction("informative.checkSlug", async () => {
    await assertAllowed();
    const { slug } = parseInput(z.object({ slug: z.string().trim().toLowerCase().max(63) }), input);
    if (!isValidStoreSlug(slug)) return { slug, available: false, reason: "invalid" as const };
    await rateLimit("info-slug", await clientIpKey(), 60, 600);
    const { data, error } = await (await createSupabaseServerClient()).rpc("store_slug_available", { p_slug: slug });
    if (error) throw mapDbError(error, { op: "store_slug_available" });
    return { slug, available: data === true, reason: data === true ? ("ok" as const) : ("taken" as const) };
  });
}

/**
 * Step 4 completion: one transaction (complete_informative_onboarding) creates the tenant
 * (INFORMATIVE), site (DRAFT), default pages and starter / sample services. Idempotent. The logo is
 * uploaded afterwards (best effort, `informative/` prefix) because storage is not transactional.
 */
export async function completeInformativeOnboardingAction(input: { draft: unknown }): Promise<ActionResult<{ redirectTo: string; tenantId: string; themeId: string }>> {
  return runAction("informative.completeOnboarding", async () => {
    const user = await requireUserWithRetry("/start/informative/account");
    await assertAllowed();
    await assertEmailVerifiedForOnboarding();
    await rateLimit("info-complete", user.id, 10, 3600);
    const draft = parseInput(completeDraftSchema, input.draft);
    const theme = findInformativeTheme(draft.themeId);
    if (!theme) throw new AppError("VALIDATION", { fieldErrors: { themeId: ["Choose a theme"] } });

    const payload = buildCompletionPayload(draft, theme);
    const supabase = await createSupabaseServerClient();
    const args = {
      p_name: draft.basic.businessName,
      p_slug: draft.basic.slug,
      p_root_domain: publicEnv().NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN,
      p_site: payload.site,
      // Plain JSON (section props are bounded JSON objects validated by the section schema).
      p_pages: payload.pages as unknown as Json,
      p_services: payload.services,
    };
    let { data: tenantId, error } = await supabase.rpc("complete_informative_onboarding", args);
    // A concurrent double submit loses the slug race: the retry returns the site the first one made.
    if (error?.code === "23505") ({ data: tenantId, error } = await supabase.rpc("complete_informative_onboarding", args));
    if (error) {
      if (error.code === "23505") throw new AppError("VALIDATION", { fieldErrors: { slug: ["That address is taken. Go back and pick another."] } });
      if (error.code === "54000") throw new AppError("VALIDATION", { fieldErrors: { _form: ["You've reached the maximum number of sites for one account."] } });
      throw mapDbError(error, { op: "complete_informative_onboarding" });
    }
    if (!tenantId) throw new AppError("INTERNAL", { context: { op: "complete_informative_onboarding" } });

    await setActiveTenant(tenantId);
    if (draft.logoDataUrl) await saveLogo(tenantId, draft.logoDataUrl);

    logger.info("informative_onboarding_completed", { tenantId, themeId: theme.id, samples: payload.usedSamples });
    return { redirectTo: `${INFORMATIVE_HOME}?welcome=1`, tenantId, themeId: theme.id };
  });
}

async function saveLogo(tenantId: string, dataUrl: string): Promise<void> {
  try {
    const [, meta = "", b64 = ""] = /^data:([^;]+);base64,(.*)$/.exec(dataUrl) ?? [];
    const bytes = Buffer.from(b64, "base64");
    if (!bytes.length || bytes.length > LOGO_MAX_BYTES) return;
    const ext = meta === "image/png" ? "png" : meta === "image/webp" ? "webp" : "jpg";
    // uploadTenantImage sniffs the bytes (never trusts the declared type) and uses the member's RLS session.
    const { path } = await uploadTenantImage(tenantId, "informative", new File([bytes], `logo.${ext}`, { type: meta }));
    const { error } = await (await createSupabaseServerClient()).from("info_sites").update({ logo_path: path }).eq("tenant_id", tenantId);
    if (error) logger.warn("informative.logo_save_failed", { tenantId, code: error.code });
  } catch (err) {
    logger.warn("informative.logo_upload_failed", { tenantId, err: err instanceof Error ? err.message : "unknown" });
  }
}
