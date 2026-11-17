"use server";

import { revalidatePath } from "next/cache";
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
import { audit } from "@/lib/audit";
import { listMemberships, membershipPermissions } from "@/lib/tenant/membership";
import type { TenantPermission } from "@/lib/permissions/matrix";
import { assertEmailVerifiedForOnboarding } from "@/features/onboarding/email-gate";
import { buildSiteWithAi, siteIsNew } from "../ai/server";
import { importInformativeImagesBatch } from "../images/seed";
import type { InformativeContext } from "../server/context";
import { informativeOnboardingAllowed } from "../server/onboarding-gate";
import { findInformativeTheme } from "../themes/registry";
import { completeDraftSchema, DEFAULT_INFO_LOCALE, infoLocaleSchema, LOGO_DATA_URL_RE, LOGO_MAX_BYTES, storeSlug } from "./draft";
import { completionInfo, type FinishInfo } from "./completion";
import { buildCompletionPayload } from "./payload";
import { findOnboardingMembership, PHOTO_BATCH_SIZE } from "./phases";

const INFORMATIVE_PANEL = "/informative";

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
 * Phased finish (phases.ts; Workers Free = 10 ms CPU per request). The browser calls these in
 * order, each small and idempotent: create/resume → details (logo + language) → images (batches)
 * → ai (optional) → finish. Every phase: validate → verified session → tenant from the person's
 * OWN membership (by the address the create phase returned; never a tenant id from the request)
 * → permission → rate limit → execute.
 */

const slugOnly = z.object({ slug: storeSlug });

/** The person's own INFORMATIVE membership with this address, as a panel context. */
async function onboardingContext(slug: string): Promise<InformativeContext> {
  const user = await requireUserWithRetry("/start/informative/account");
  await assertAllowed();
  await rateLimit("info-finish", user.id, 120, 3600);
  const memberships = await listMemberships(user.id);
  const m = findOnboardingMembership(memberships, slug);
  if (!m) throw new AppError("NOT_FOUND", { context: { op: "informative.onboarding.site" } });
  return {
    user,
    tenantId: m.tenantId,
    tenantName: m.tenantName,
    tenantSlug: m.tenantSlug,
    tenantStatus: m.tenantStatus,
    role: m.role,
    permissions: membershipPermissions(m),
    memberships,
    websiteType: "INFORMATIVE",
  };
}

function need(ctx: InformativeContext, permission: TenantPermission): void {
  if (!ctx.permissions.has(permission)) throw new AppError("FORBIDDEN", { context: { permission } });
}

/** Payload of a draft, validated (the logo is not needed here; the client sends it only to "details"). */
function draftPayload(raw: unknown) {
  const draft = parseInput(completeDraftSchema, raw);
  const theme = findInformativeTheme(draft.themeId);
  if (!theme) throw new AppError("VALIDATION", { fieldErrors: { themeId: ["Choose a theme"] } });
  return { draft, theme, payload: buildCompletionPayload(draft, theme) };
}

/**
 * Phase "create": one transaction (complete_informative_onboarding) creates the tenant
 * (INFORMATIVE), site (DRAFT), default pages and starter / sample services. When this person
 * already owns the site at this address (a retry after a lost response or a killed Worker), it is
 * resumed without touching the database again.
 */
export async function createInformativeSiteAction(input: { draft: unknown }): Promise<ActionResult<{ slug: string; tenantId: string; themeId: string; resumed: boolean }>> {
  return runAction("informative.onboarding.create", async () => {
    const user = await requireUserWithRetry("/start/informative/account");
    await assertAllowed();
    await assertEmailVerifiedForOnboarding();
    const { draft, theme, payload } = draftPayload(input?.draft);

    const existing = findOnboardingMembership(await listMemberships(user.id), draft.basic.slug, { ownerOnly: true });
    if (existing) {
      await rateLimit("info-finish", user.id, 120, 3600);
      await setActiveTenant(existing.tenantId);
      return { slug: existing.tenantSlug, tenantId: existing.tenantId, themeId: theme.id, resumed: true };
    }

    await rateLimit("info-complete", user.id, 10, 3600);
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
    logger.info("informative_onboarding_site_created", { tenantId, themeId: theme.id, samples: payload.usedSamples });
    return { slug: draft.basic.slug, tenantId, themeId: theme.id, resumed: false };
  });
}

const detailsSchema = z.object({
  slug: storeSlug,
  logoDataUrl: z.string().max(700_000).regex(LOGO_DATA_URL_RE).nullable().default(null),
  locale: infoLocaleSchema.default(DEFAULT_INFO_LOCALE),
});

/** Phase "details": logo (only when the site has none yet) and the onboarding language. Best effort. */
export async function saveInformativeSiteDetailsAction(input: unknown): Promise<ActionResult<{ logo: boolean }>> {
  return runAction("informative.onboarding.details", async () => {
    const parsed = parseInput(detailsSchema, input);
    const ctx = await onboardingContext(parsed.slug);
    need(ctx, "settings.write");
    await saveLocale(ctx.tenantId, parsed.locale);
    if (!parsed.logoDataUrl) return { logo: false };
    const { data } = await (await createSupabaseServerClient()).from("info_sites").select("logo_path").eq("tenant_id", ctx.tenantId).maybeSingle();
    if (data?.logo_path) return { logo: true };
    return { logo: await saveLogo(ctx.tenantId, parsed.logoDataUrl) };
  });
}

const imagesSchema = z.object({
  slug: storeSlug,
  draft: z.unknown(),
  skip: z.array(z.string().max(80)).max(20).default([]),
});

/**
 * Phase "images": imports at most PHOTO_BATCH_SIZE curated photos per call and returns how many
 * are left; the browser calls again until `remaining` is 0. Never overwrites existing images.
 */
export async function importInformativePhotosAction(input: unknown): Promise<ActionResult<{ imported: number; failed: string[]; remaining: number }>> {
  return runAction("informative.onboarding.images", async () => {
    const parsed = parseInput(imagesSchema, input);
    const { payload } = draftPayload(parsed.draft);
    const ctx = await onboardingContext(parsed.slug);
    need(ctx, "content.write");
    const r = await importInformativeImagesBatch({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      plan: payload.images,
      serviceSlugs: payload.services.map((s) => s.slug),
      skip: parsed.skip,
      batchSize: PHOTO_BATCH_SIZE,
    });
    return { imported: r.imported.length, failed: r.failed, remaining: r.remaining };
  });
}

const aiSchema = z.object({ slug: storeSlug, locale: infoLocaleSchema.default(DEFAULT_INFO_LOCALE) });

/**
 * Phase "ai" (optional): the AI writes the site, free right after signup. When AI isn't available
 * it is skipped (built: false) and the ready-made services, prices and FAQs stay. Runs once per
 * site: a retry after success is a no-op (options.onboardingAiAt).
 */
export async function buildInformativeOnboardingAiAction(input: unknown): Promise<ActionResult<{ built: boolean; reason?: string }>> {
  return runAction("informative.onboarding.ai", async () => {
    const parsed = parseInput(aiSchema, input);
    const ctx = await onboardingContext(parsed.slug);
    need(ctx, "content.write");
    need(ctx, "settings.write");
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("info_sites").select("options").eq("tenant_id", ctx.tenantId).maybeSingle();
    const options = data?.options && typeof data.options === "object" && !Array.isArray(data.options) ? (data.options as Record<string, Json | undefined>) : {};
    if (options.onboardingAiAt) return { built: true, reason: "already" };
    if (!(await siteIsNew(ctx.tenantId))) return { built: false, reason: "not_new" };
    const r = await buildSiteWithAi(ctx, { free: true, locale: parsed.locale });
    if (r.built) {
      const { error } = await supabase.from("info_sites").update({ options: { ...options, onboardingAiAt: new Date().toISOString() } }).eq("tenant_id", ctx.tenantId);
      if (error) logger.warn("informative.ai_marker_failed", { tenantId: ctx.tenantId, code: error.code });
      await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "informative.ai_site_built", entityType: "info_site", entityId: ctx.tenantId, metadata: { free: true } });
    }
    return r;
  });
}

/** Phase "finish": what the ready panel needs (publish allowed? already live?). Makes this site the active one. */
export async function finishInformativeOnboardingAction(input: unknown): Promise<ActionResult<FinishInfo>> {
  return runAction("informative.onboarding.finish", async () => {
    const { slug } = parseInput(slugOnly, input);
    const ctx = await onboardingContext(slug);
    await setActiveTenant(ctx.tenantId);
    const { data } = await (await createSupabaseServerClient()).from("info_sites").select("status, theme_id").eq("tenant_id", ctx.tenantId).maybeSingle();
    if (!data) throw new AppError("NOT_FOUND", { context: { op: "informative.onboarding.finish" } });
    revalidatePath(INFORMATIVE_PANEL, "layout");
    logger.info("informative_onboarding_completed", { tenantId: ctx.tenantId, themeId: data.theme_id });
    return completionInfo(ctx.permissions, data.status === "PUBLISHED", data.theme_id);
  });
}

/** Keeps the onboarding language with the site (merged into options; best effort). */
async function saveLocale(tenantId: string, locale: string): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("info_sites").select("options").eq("tenant_id", tenantId).maybeSingle();
    const current = data?.options && typeof data.options === "object" && !Array.isArray(data.options) ? data.options : {};
    if ((current as Record<string, Json | undefined>).locale === locale) return;
    const { error } = await supabase.from("info_sites").update({ options: { ...current, locale } }).eq("tenant_id", tenantId);
    if (error) logger.warn("informative.locale_save_failed", { tenantId, code: error.code });
  } catch (err) {
    logger.warn("informative.locale_save_failed", { tenantId, err: err instanceof Error ? err.message : "unknown" });
  }
}

async function saveLogo(tenantId: string, dataUrl: string): Promise<boolean> {
  try {
    const [, meta = "", b64 = ""] = /^data:([^;]+);base64,(.*)$/.exec(dataUrl) ?? [];
    const bytes = Buffer.from(b64, "base64");
    if (!bytes.length || bytes.length > LOGO_MAX_BYTES) return false;
    const ext = meta === "image/png" ? "png" : meta === "image/webp" ? "webp" : "jpg";
    // uploadTenantImage sniffs the bytes (never trusts the declared type) and uses the member's RLS session.
    const { path } = await uploadTenantImage(tenantId, "informative", new File([bytes], `logo.${ext}`, { type: meta }));
    const { error } = await (await createSupabaseServerClient()).from("info_sites").update({ logo_path: path }).eq("tenant_id", tenantId);
    if (error) logger.warn("informative.logo_save_failed", { tenantId, code: error.code });
    return !error;
  } catch (err) {
    logger.warn("informative.logo_upload_failed", { tenantId, err: err instanceof Error ? err.message : "unknown" });
    return false;
  }
}
