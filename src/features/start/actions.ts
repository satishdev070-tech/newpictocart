"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { EnvValidationError } from "@/lib/env/schema";
import { requireUserWithRetry } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { publicEnv } from "@/lib/env/public";
import { mapStartFinalizeError } from "@/features/start/finalize-error";
import { isValidStoreSlug } from "@/lib/tenant/host";
import { setActiveTenant } from "@/lib/tenant/active";
import { clientIpKey, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/observability/logger";
import { isIndustry, type IndustrySlug } from "@/features/stores/industries";
import { informativeSitesEnabled } from "@/features/stores/informative-flag";
import { DEFAULT_SITE_MODE } from "@/features/stores/site-mode";
import { isThemeKey } from "@/features/marketing-site/themes";
import { isSarvamConfigured, chatTurn } from "@/lib/sarvam/client";
import { isSarvamLocaleCode, type SarvamLocaleCode } from "@/lib/sarvam/locales";
import type { Json } from "@/lib/supabase/database.types";
import { toMinor } from "@/lib/money";
import { minorToDb } from "@/features/settings/fields";
import { assertEmailVerifiedForOnboarding } from "@/features/onboarding/email-gate";
import { listOwnedStores, ownerContext } from "@/features/onboarding/server";
import {
  isStoreSeeded,
  markStoreSeeded,
  requireSeedPlan,
  seedCategoriesPhase,
  seedContentPhase,
  seedImagesPhase,
  seedNavigationPhase,
  seedPlanPhase,
  seedProductsPhase,
  seedThemeMergePhase,
  seedThemePhase,
  type SeedPlanInput,
} from "@/features/onboarding/seed/phases";
import type { ReadyStorePlan } from "@/features/onboarding/seed/schemas";
import type { SessionUser } from "@/lib/auth/session";
import { listMemberships, membershipPermissions, type TenantContext } from "@/lib/tenant/membership";
import { CATALOG_STEPS, type CatalogStep } from "./finalize-phases";
import { pickBestMarketplaceTheme, listRankedMarketplaceThemes } from "@/features/onboarding/seed/theme-pick";
import { parseVoiceFactsJson, suggestSlugFromName } from "@/features/onboarding/voice/facts";
import { parseTaraHistory, runTaraTurn } from "@/features/onboarding/voice/turn";
import { voiceTurnInputSchema } from "@/features/onboarding/voice/schemas";
import type { VoiceTurnData } from "@/features/onboarding/voice/actions";
import { MARKETPLACE_THEMES } from "@/features/theme/marketplace/catalog";
import { themeSiteType } from "@/features/theme/marketplace/types";
import { themeShot } from "@/features/marketing-site/theme-shots";
import { themeStockThumbUrl } from "@/features/theme/layouts/imagery";
import { isStartIntentId } from "./intents";
import { buildSeedBrief } from "./brief";
import { parseStartDraft, draftCategory, draftSiteMode, draftStoreName, draftSeedSubcategory, draftProductsServices, type StartDraft } from "./draft/schema";
import { selectStartThemeOptions, type StartThemeOptions } from "./theme-options";

export async function startVoiceTurnAction(
  _prev: ActionResult<VoiceTurnData> | null,
  fd: FormData,
): Promise<ActionResult<VoiceTurnData>> {
  return runAction("start.voiceTurn", async () => {
    await rateLimit("start-voice", await clientIpKey(), 20, 3600);
    if (!isSarvamConfigured()) {
      throw new AppError("VALIDATION", {
        fieldErrors: { _form: ["Voice isn't set up on this platform yet. Use the form option instead."] },
        context: { reason: "sarvam_not_configured" },
      });
    }
    const raw = formToObject(fd);
    const input = parseInput(voiceTurnInputSchema, raw);
    const locale = input.locale as SarvamLocaleCode;
    const facts = parseVoiceFactsJson(input.factsJson);
    const audio = raw.audio instanceof File ? raw.audio : null;
    return runTaraTurn({ locale, facts, text: input.text, audio, history: parseTaraHistory(raw.historyJson) });
  });
}

const suggestSchema = z.object({
  locale: z.string().refine(isSarvamLocaleCode),
  kind: z.enum(["tagline", "productTitle"]),
  hint: z.string().max(200).optional(),
  category: z.string().optional(),
});

function localTemplate(kind: "tagline" | "productTitle", hint?: string, category?: string): string {
  if (kind === "productTitle" && hint) return hint;
  if (kind === "tagline") {
    if (category === "fashion" || category === "handicrafts") return "Handcrafted with care in India";
    if (category === "grocery" || category === "gourmet") return "Fresh flavours, delivered to your door";
    return "Quality you can trust";
  }
  return hint?.trim() || "Handmade with love";
}

export async function startSuggestAction(
  _prev: ActionResult<{ text: string }> | null,
  fd: FormData,
): Promise<ActionResult<{ text: string }>> {
  return runAction("start.suggest", async () => {
    await rateLimit("start-suggest", await clientIpKey(), 40, 3600);
    const input = parseInput(suggestSchema, formToObject(fd));
    const fallback = localTemplate(input.kind, input.hint, input.category);
    if (!isSarvamConfigured()) return { text: fallback };
    try {
      const locale = input.locale as SarvamLocaleCode;
      const prompt =
        input.kind === "tagline"
          ? `Write a short storefront tagline (max 12 words) in the locale ${locale} for a ${input.category ?? "general"} business. Reply with tagline only.`
          : `Suggest a product title in locale ${locale} for: ${input.hint ?? "handmade item"}. Reply with title only.`;
      const turn = await chatTurn({
        messages: [{ role: "user", content: prompt }],
        responseFormat: "text",
        temperature: 0.5,
        languageCode: locale,
      });
      const text = turn.content.trim().slice(0, 160);
      return { text: text || fallback };
    } catch (err) {
      logger.warn("start.suggest_failed", { err: err instanceof Error ? err.message : "unknown" });
      return { text: fallback };
    }
  });
}

async function markDraft(tenantId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("stores").update({ launch_status: "draft" }).eq("tenant_id", tenantId);
  if (error) logger.error("start.draft_failed", { tenantId, code: error.code });
}

async function setCategory(tenantId: string, slug: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: cat } = await supabase.from("store_categories").select("id").eq("slug", slug).maybeSingle();
  if (!cat) return;
  const { error } = await supabase.from("stores").update({ category_id: cat.id }).eq("tenant_id", tenantId);
  if (error) logger.warn("start.category_failed", { tenantId, code: error.code });
}

async function setSiteMode(tenantId: string, siteMode: "ecommerce" | "informative"): Promise<void> {
  const { error } = await (await createSupabaseServerClient()).from("stores").update({ site_mode: siteMode }).eq("tenant_id", tenantId);
  if (error) logger.warn("start.site_mode_failed", { tenantId, code: error.code });
}

function resolveSlug(name: string): string {
  let slug = suggestSlugFromName(name);
  if (!slug || slug.length < 3 || !isValidStoreSlug(slug)) {
    slug = slug && slug.length >= 2 ? `${slug}-store`.slice(0, 63) : "my-store";
  }
  if (!isValidStoreSlug(slug)) return "my-store";
  return slug;
}

function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return null;
}

async function applyOptionalPrefs(tenantId: string, draft: StartDraft): Promise<void> {
  const supabase = await createSupabaseServerClient();
  try {
    const { data: store } = await supabase.from("stores").select("integrations, address").eq("tenant_id", tenantId).maybeSingle();
    const integrations = { ...((store?.integrations as Record<string, unknown>) ?? {}) };
    if (draft.payment.upi.trim()) {
      integrations.seller_upi = draft.payment.upi.trim();
    }
    const address = { ...((store?.address as Record<string, unknown>) ?? {}) };
    const city = draft.business.city.trim() || draft.voice.facts.city?.trim();
    if (city) address.city = city;
    const whatsapp = normalizeWhatsapp(draft.business.whatsapp);
    const tagline = draft.business.tagline.trim() || draft.voice.facts.tagline?.trim();
    const { error } = await supabase
      .from("stores")
      .update({
        integrations: integrations as Json,
        ...(city ? { address: address as Json } : {}),
        ...(whatsapp ? { whatsapp } : {}),
        ...(tagline ? { tagline: tagline.slice(0, 160) } : {}),
      })
      .eq("tenant_id", tenantId);
    if (error) logger.warn("start.store_prefs_failed", { tenantId, code: error.code });

    const cod = draft.payment.cod;
    await supabase
      .from("stores")
      .update({
        cod_settings: { enabled: cod, fee: minorToDb(0), min_order: minorToDb(0), max_order: null },
      })
      .eq("tenant_id", tenantId);

    const { count: existingRates } = await supabase
      .from("shipping_rates")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    if ((existingRates ?? 0) === 0) {
      const shipping = draft.payment.shipping;
      const rows =
        shipping === "flat"
          ? [{ name: "Standard shipping", price: toMinor(60), min: 0, max: null as number | null }]
          : shipping === "courier"
            ? [{ name: "Standard courier", price: toMinor(80), min: 0, max: null as number | null }]
            : [
                { name: "Shipping under ₹499", price: toMinor(60), min: 0, max: toMinor(498.99) },
                { name: "Free above ₹499", price: 0, min: toMinor(499), max: null },
              ];
      for (const [position, row] of rows.entries()) {
        await supabase.from("shipping_rates").insert({
          tenant_id: tenantId,
          name: row.name,
          price: minorToDb(row.price),
          min_subtotal: minorToDb(row.min),
          max_subtotal: row.max === null ? null : minorToDb(row.max),
          min_weight_grams: 0,
          max_weight_grams: null,
          pincode_prefixes: [],
          estimated_days_min: 3,
          estimated_days_max: 7,
          cod_allowed: cod,
          active: true,
          position,
        });
      }
    }
  } catch (err) {
    logger.warn("start.optional_prefs_failed", { tenantId, err: err instanceof Error ? err.message : "unknown" });
  }
}

async function shouldSkipSeed(tenantId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const [{ count: products }, { count: audits }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("action", "onboarding.ready_store_seeded"),
  ]);
  return (products ?? 0) >= 1 && (audits ?? 0) >= 1;
}

async function createOrResumeStore(userId: string, name: string, slug: string): Promise<{ tenantId: string; slug: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_tenant", {
    p_name: name,
    p_slug: slug,
    p_root_domain: publicEnv().NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN,
  });
  if (error) {
    if (error.code === "23505") {
      const mine = (await listOwnedStores(userId)).find((s) => s.slug === slug);
      if (mine) return { tenantId: mine.tenantId, slug: mine.slug };
      const alt = `${slug}-2`.slice(0, 63);
      if (isValidStoreSlug(alt)) {
        return createOrResumeStore(userId, name, alt);
      }
      throw new AppError("VALIDATION", { fieldErrors: { slug: ["That store address is taken. Try another name."] } });
    }
    if (error.code === "54000") {
      throw new AppError("VALIDATION", { fieldErrors: { _form: ["You've reached the maximum number of stores for one account."] } });
    }
    throw mapDbError(error, { operation: "create_tenant" });
  }
  const tenantId = data;
  if (!tenantId) throw new AppError("INTERNAL", { context: { operation: "create_tenant" } });
  return { tenantId, slug };
}

function finishError(err: unknown): never {
  const mapped = mapStartFinalizeError(err);
  logger.error("start.finalize_failed", {
    code: err instanceof AppError ? err.code : err instanceof EnvValidationError ? "env_invalid" : "throw",
    mappedCode: mapped.code,
    context: mapped.context ?? (err instanceof AppError ? err.context : undefined),
    message: err instanceof Error ? err.message.slice(0, 300) : "unknown",
  });
  throw mapped;
}

export type FinalizeStartResult = { slug: string; name: string };

const listThemeOptionsSchema = z.object({
  industry: z.string().max(64).nullable().optional(),
  preferredTheme: z.string().max(80).nullable().optional(),
});

/**
 * AI-recommended marketplace theme + a few alternatives for the start Theme screen.
 * Uses the same industry ranking as `pickBestMarketplaceTheme` (ecommerce only). No secrets.
 */
export async function listStartThemeOptionsAction(input: {
  industry?: string | null;
  preferredTheme?: string | null;
}): Promise<ActionResult<StartThemeOptions>> {
  return runAction("start.listThemeOptions", async () => {
    const parsed = parseInput(listThemeOptionsSchema, input);
    const industry = parsed.industry && isIndustry(parsed.industry) ? parsed.industry : "general";
    // Assert non-empty catalogue for this industry (throws INTERNAL like seed theme-pick).
    pickBestMarketplaceTheme(industry);
    const ranked = listRankedMarketplaceThemes(industry);
    const preferredKey = parsed.preferredTheme?.trim() || null;
    const preferred =
      preferredKey && isThemeKey(preferredKey)
        ? (MARKETPLACE_THEMES.find((t) => t.key === preferredKey && themeSiteType(t) === "ecommerce") ?? null)
        : null;

    return selectStartThemeOptions(ranked, preferred, (key) => {
      const shot = themeShot(key, "desktop");
      if (shot) return shot;
      const theme = MARKETPLACE_THEMES.find((t) => t.key === key);
      return theme ? themeStockThumbUrl(theme) : null;
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Phased finalize. Workers Free allows 10 ms CPU per request, so creating + seeding the store in
// one action was killed part-way (Error 1102). The client calls these in order (see
// finalize-phases.ts); each one is small and safe to re-run. The store is always one the signed-in
// user OWNS: the request may only name it by slug, and it is looked up in the user's memberships.
// ---------------------------------------------------------------------------------------------

type StartFacts = {
  draft: StartDraft;
  storeName: string;
  industry: IndustrySlug;
  siteMode: "ecommerce" | "informative";
};

async function startUser(): Promise<SessionUser> {
  let user: SessionUser;
  try {
    // Uncached retry: post-OTP cookie can miss on the first read of this action.
    user = await requireUserWithRetry("/start");
  } catch (err) {
    if (err instanceof EnvValidationError) {
      logger.error("start.finalize_env_invalid", { issues: err.issues.slice(0, 8) });
      throw new AppError("INTERNAL", {
        fieldErrors: { _form: ["Server configuration error — contact support."] },
        context: { reason: "env_invalid" },
      });
    }
    throw err;
  }
  await assertEmailVerifiedForOnboarding();
  return user;
}

function startFacts(draftJson: string): StartFacts {
  let draft: StartDraft | null = null;
  try {
    draft = parseStartDraft(JSON.parse(draftJson));
  } catch {
    draft = null;
  }
  if (!draft) {
    throw new AppError("VALIDATION", { fieldErrors: { _form: ["Your saved journey looks invalid. Start again from /start."] } });
  }
  const storeName = draftStoreName(draft);
  if (storeName.length < 2) {
    throw new AppError("VALIDATION", { fieldErrors: { _form: ["Add a business name before finishing."] } });
  }
  const industry = draftCategory(draft) ?? ("general" as IndustrySlug);
  if (!isIndustry(industry)) {
    throw new AppError("VALIDATION", { fieldErrors: { _form: ["Choose a business category."] } });
  }
  // New flows: Informational Website is gated; always persist ecommerce when the flag is off.
  const siteMode = informativeSitesEnabled() ? (draftSiteMode(draft) ?? DEFAULT_SITE_MODE) : DEFAULT_SITE_MODE;
  return { draft, storeName, industry, siteMode };
}

/** Owner context for the user's own store `slug` (from memberships, never trusted from the request). */
async function ownedStoreContext(user: SessionUser, slug: string): Promise<TenantContext> {
  const memberships = await listMemberships(user.id);
  const m = memberships.find((x) => x.tenantSlug === slug && x.role === "owner");
  if (!m) throw new AppError("FORBIDDEN", { fieldErrors: { _form: ["You don't have permission to finish this store."] } });
  return {
    user,
    tenantId: m.tenantId,
    tenantName: m.tenantName,
    tenantSlug: m.tenantSlug,
    tenantStatus: m.tenantStatus,
    role: m.role,
    customRoleName: null,
    permissions: membershipPermissions(m),
    memberships,
  };
}

function planInput(ctx: TenantContext, facts: StartFacts): SeedPlanInput {
  return {
    storeName: ctx.tenantName || facts.storeName,
    industry: facts.industry,
    subcategory: draftSeedSubcategory(facts.draft),
    niche: draftProductsServices(facts.draft) || null,
    brief: buildSeedBrief(facts.draft),
    locale: facts.draft.locale,
  };
}

export type StartStoreResult = FinalizeStartResult & { seeded: boolean };

/** Phase "store": create the store (or resume the one this user already owns), category, mode, prefs. */
async function createStorePhase(user: SessionUser, facts: StartFacts): Promise<StartStoreResult & { tenantId: string }> {
  const slugWanted = resolveSlug(facts.storeName);
  let tenantId: string;
  let slug: string;
  let name = facts.storeName;
  const owned = await listOwnedStores(user.id);
  if (owned.length > 0) {
    const match = owned.find((s) => s.slug === slugWanted) ?? owned[0]!;
    tenantId = match.tenantId;
    slug = match.slug;
    name = match.name;
  } else {
    const created = await createOrResumeStore(user.id, facts.storeName, slugWanted);
    tenantId = created.tenantId;
    slug = created.slug;
    await markDraft(tenantId);
  }
  const ctx = await ownerContext(user, tenantId);
  if (!ctx) throw new AppError("FORBIDDEN", { fieldErrors: { _form: ["You don't have permission to finish this store."] } });
  const seeded = await shouldSkipSeed(tenantId);
  if (!seeded) {
    await setCategory(tenantId, facts.industry);
    await setSiteMode(tenantId, facts.siteMode);
  }
  await applyOptionalPrefs(tenantId, facts.draft);
  return { tenantId, slug, name, seeded };
}

const storeInputSchema = z.object({ draftJson: z.string().max(100_000) });
const phaseInputSchema = z.object({
  draftJson: z.string().max(100_000),
  slug: z.string().trim().min(1).max(63),
});
const catalogInputSchema = phaseInputSchema.extend({ step: z.enum(CATALOG_STEPS) });
const imagesInputSchema = phaseInputSchema.extend({
  skip: z.array(z.string().max(80)).max(60).optional().default([]),
});

/** (a) Create or resume the seller's store. Returns its address so later phases can name it. */
export async function startCreateStoreAction(input: { draftJson: string }): Promise<ActionResult<StartStoreResult>> {
  return runAction("start.createStore", async () => {
    const { draftJson } = parseInput(storeInputSchema, input);
    const user = await startUser();
    await rateLimit("start-finalize", user.id, 20, 3600);
    const facts = startFacts(draftJson);
    try {
      const { slug, name, seeded } = await createStorePhase(user, facts);
      return { slug, name, seeded };
    } catch (err) {
      finishError(err);
    }
  });
}

async function runCatalogStep(ctx: TenantContext, facts: StartFacts, step: CatalogStep): Promise<void> {
  // A store seeded earlier keeps the catalogue the seller has since edited.
  if (await isStoreSeeded(ctx.tenantId)) return;
  if (step === "theme") {
    const themeKey = facts.draft.theme && isThemeKey(facts.draft.theme) ? facts.draft.theme : undefined;
    await seedThemePhase(ctx, facts.industry, themeKey);
    return;
  }
  const input = planInput(ctx, facts);
  if (step === "plan") {
    await seedPlanPhase(ctx, input);
    return;
  }
  const plan = await requireSeedPlan(ctx, input);
  if (step === "categories") await seedCategoriesPhase(ctx, plan);
  else if (step === "products") await seedProductsPhase(ctx, plan, facts.industry, input.storeName);
  else await seedNavigationPhase(ctx, plan, input.storeName);
}

/** (b) One catalogue step: theme | plan (AI, cached) | categories+collections | products | menu+SEO. */
export async function startSeedCatalogAction(input: { draftJson: string; slug: string; step: CatalogStep }): Promise<ActionResult<{ step: CatalogStep }>> {
  return runAction("start.seedCatalog", async () => {
    const v = parseInput(catalogInputSchema, input);
    const user = await startUser();
    await rateLimit("start-seed", user.id, 120, 3600);
    const facts = startFacts(v.draftJson);
    try {
      const ctx = await ownedStoreContext(user, v.slug);
      await runCatalogStep(ctx, facts, v.step);
    } catch (err) {
      finishError(err);
    }
    return { step: v.step };
  });
}

async function contentPlan(ctx: TenantContext, facts: StartFacts): Promise<ReadyStorePlan | null> {
  if (await isStoreSeeded(ctx.tenantId)) return null;
  return requireSeedPlan(ctx, planInput(ctx, facts));
}

/** (c) About / Contact pages and blog posts. */
export async function startSeedContentAction(input: { draftJson: string; slug: string }): Promise<ActionResult<{ done: true }>> {
  return runAction("start.seedContent", async () => {
    const v = parseInput(phaseInputSchema, input);
    const user = await startUser();
    await rateLimit("start-seed", user.id, 120, 3600);
    const facts = startFacts(v.draftJson);
    try {
      const ctx = await ownedStoreContext(user, v.slug);
      await seedContentPhase(ctx, await contentPlan(ctx, facts), ctx.tenantName || facts.storeName);
    } catch (err) {
      finishError(err);
    }
    return { done: true as const };
  });
}

/** (d) One small batch of sample photos (≤4). The client loops until `remaining` is 0. */
export async function startSeedImagesAction(input: {
  draftJson: string;
  slug: string;
  skip?: string[];
}): Promise<ActionResult<{ remaining: number; failed: string[] }>> {
  return runAction("start.seedImages", async () => {
    const v = parseInput(imagesInputSchema, input);
    const user = await startUser();
    await rateLimit("start-seed-images", user.id, 120, 3600);
    const facts = startFacts(v.draftJson);
    try {
      const ctx = await ownedStoreContext(user, v.slug);
      return await seedImagesPhase(ctx, facts.industry, v.skip);
    } catch (err) {
      finishError(err);
    }
  });
}

/** (d, end) Homepage copy + photos into the theme draft, then publish the theme. */
export async function startPublishThemeAction(input: { draftJson: string; slug: string }): Promise<ActionResult<{ done: true }>> {
  return runAction("start.publishTheme", async () => {
    const v = parseInput(phaseInputSchema, input);
    const user = await startUser();
    await rateLimit("start-seed", user.id, 120, 3600);
    const facts = startFacts(v.draftJson);
    try {
      const ctx = await ownedStoreContext(user, v.slug);
      await seedThemeMergePhase(ctx, await contentPlan(ctx, facts), facts.industry);
    } catch (err) {
      finishError(err);
    }
    return { done: true as const };
  });
}

async function finishPhase(ctx: TenantContext, facts: StartFacts): Promise<void> {
  await markStoreSeeded(ctx, { source: "start_phased", industry: facts.industry });
  await setActiveTenant(ctx.tenantId);
  const supabase = await createSupabaseServerClient();
  const meta: Record<string, unknown> = {};
  if (isSarvamLocaleCode(facts.draft.locale)) meta.onboarding_locale = facts.draft.locale;
  if (facts.draft.intent && isStartIntentId(facts.draft.intent)) meta.onboarding_intent = facts.draft.intent;
  if (Object.keys(meta).length) {
    const { error } = await supabase.auth.updateUser({ data: meta });
    if (error) logger.warn("start.metadata_failed", { code: error.code });
  }
}

/** (e) Mark the store seeded, make it the active store, save onboarding metadata. */
export async function startFinishAction(input: { draftJson: string; slug: string }): Promise<ActionResult<FinalizeStartResult>> {
  return runAction("start.finish", async () => {
    const v = parseInput(phaseInputSchema, input);
    const user = await startUser();
    await rateLimit("start-seed", user.id, 120, 3600);
    const facts = startFacts(v.draftJson);
    let ctx: TenantContext;
    try {
      ctx = await ownedStoreContext(user, v.slug);
    } catch (err) {
      finishError(err);
    }
    await finishPhase(ctx, facts);
    return { slug: ctx.tenantSlug, name: ctx.tenantName || facts.storeName };
  });
}

/**
 * Legacy one-request finalize (kept for compatibility). Runs the same phases in sequence, so it
 * still needs more than 10 ms CPU on Workers Free — the /start client uses the phased actions.
 */
export async function finalizeStartDraftAction(
  _prev: ActionResult<FinalizeStartResult> | null,
  fd: FormData,
): Promise<ActionResult<FinalizeStartResult>> {
  return runAction("start.finalize", async () => {
    const user = await startUser();
    await rateLimit("start-finalize", user.id, 10, 3600);
    const { draftJson } = parseInput(storeInputSchema, formToObject(fd));
    const facts = startFacts(draftJson);
    let ctx: TenantContext;
    let result: FinalizeStartResult;
    try {
      const store = await createStorePhase(user, facts);
      result = { slug: store.slug, name: store.name };
      const owner = await ownerContext(user, store.tenantId);
      if (!owner) throw new AppError("FORBIDDEN", { fieldErrors: { _form: ["You don't have permission to finish this store."] } });
      ctx = owner;
      if (!store.seeded) {
        for (const step of CATALOG_STEPS) await runCatalogStep(ctx, facts, step);
      }
      const plan = await contentPlan(ctx, facts);
      await seedContentPhase(ctx, plan, ctx.tenantName || facts.storeName);
      const skip: string[] = [];
      for (let i = 0; i < 20; i++) {
        const batch = await seedImagesPhase(ctx, facts.industry, skip);
        skip.push(...batch.failed);
        if (batch.remaining === 0) break;
      }
      await seedThemeMergePhase(ctx, plan, facts.industry);
    } catch (err) {
      finishError(err);
    }
    await finishPhase(ctx, facts);
    return result;
  });
}
