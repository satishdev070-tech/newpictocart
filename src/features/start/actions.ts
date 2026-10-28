"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { publicEnv } from "@/lib/env/public";
import { isValidStoreSlug } from "@/lib/tenant/host";
import { setActiveTenant } from "@/lib/tenant/active";
import { clientIpKey, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/observability/logger";
import { isIndustry, type IndustrySlug } from "@/features/stores/industries";
import { DEFAULT_SITE_MODE } from "@/features/stores/site-mode";
import { isThemeKey } from "@/features/marketing-site/themes";
import { isSarvamConfigured, chatTurn } from "@/lib/sarvam/client";
import { isSarvamLocaleCode, type SarvamLocaleCode } from "@/lib/sarvam/locales";
import type { Json } from "@/lib/supabase/database.types";
import { toMinor } from "@/lib/money";
import { minorToDb } from "@/features/settings/fields";
import { assertEmailVerifiedForOnboarding } from "@/features/onboarding/email-gate";
import { listOwnedStores, ownerContext } from "@/features/onboarding/server";
import { seedReadyStore } from "@/features/onboarding/seed/pipeline";
import { backfillSeedImages } from "@/features/onboarding/seed/persist";
import { pickBestMarketplaceTheme, listRankedMarketplaceThemes } from "@/features/onboarding/seed/theme-pick";
import { suggestSlugFromName } from "@/features/onboarding/voice/facts";
import { parseTaraHistory, runTaraTurn } from "@/features/onboarding/voice/turn";
import { voiceTurnInputSchema } from "@/features/onboarding/voice/schemas";
import type { VoiceTurnData } from "@/features/onboarding/voice/actions";
import { EMPTY_FACTS, mergeFacts, mapCategoryToIndustry, mapSiteMode, type VoiceFacts } from "@/features/onboarding/voice/facts";
import { MARKETPLACE_THEMES } from "@/features/theme/marketplace/catalog";
import { themeSiteType } from "@/features/theme/marketplace/types";
import { themeShot } from "@/features/marketing-site/theme-shots";
import { isStartIntentId } from "./intents";
import { buildSeedBrief } from "./brief";
import { parseStartDraft, draftCategory, draftSiteMode, draftStoreName, type StartDraft } from "./draft/schema";
import { selectStartThemeOptions, type StartThemeOptions } from "./theme-options";

function parseFactsJson(raw: unknown): VoiceFacts {
  if (typeof raw !== "string" || !raw.trim()) return { ...EMPTY_FACTS };
  try {
    const parsed = JSON.parse(raw) as Partial<VoiceFacts>;
    return mergeFacts(EMPTY_FACTS, {
      name: typeof parsed.name === "string" ? parsed.name : null,
      category: mapCategoryToIndustry(typeof parsed.category === "string" ? parsed.category : null),
      subcategory: typeof parsed.subcategory === "string" ? parsed.subcategory : null,
      productsServices: typeof parsed.productsServices === "string" ? parsed.productsServices : null,
      siteMode: mapSiteMode(typeof parsed.siteMode === "string" ? parsed.siteMode : null),
      tagline: typeof parsed.tagline === "string" ? parsed.tagline : null,
      city: typeof parsed.city === "string" ? parsed.city : null,
    });
  } catch {
    return { ...EMPTY_FACTS };
  }
}

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
    const facts = parseFactsJson(input.factsJson);
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

const finalizeSchema = z.object({
  draftJson: z.string().max(100_000),
});

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
    throw mapDbError(error);
  }
  const tenantId = data;
  if (!tenantId) throw new AppError("INTERNAL");
  return { tenantId, slug };
}

function finishError(err: unknown): never {
  const context = err instanceof AppError ? err.context : undefined;
  logger.error("start.finalize_failed", {
    code: err instanceof AppError ? err.code : "throw",
    context,
    message: err instanceof Error ? err.message.slice(0, 300) : "unknown",
  });
  if (err instanceof AppError) {
    const line = err.fieldErrors?._form?.[0] ?? err.fieldErrors?.slug?.[0];
    if (line) throw err;
    throw new AppError(err.code === "INTERNAL" ? "VALIDATION" : err.code, {
      fieldErrors: { _form: [err.code === "INTERNAL" ? "The store could not be finished. Try again." : err.publicMessage] },
      context,
    });
  }
  throw new AppError("VALIDATION", { fieldErrors: { _form: ["The store could not be finished. Try again."] } });
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

    return selectStartThemeOptions(ranked, preferred, (key) => themeShot(key, "desktop"));
  });
}

export async function finalizeStartDraftAction(
  _prev: ActionResult<FinalizeStartResult> | null,
  fd: FormData,
): Promise<ActionResult<FinalizeStartResult>> {
  return runAction("start.finalize", async () => {
    const user = await requireUser("/start");
    await assertEmailVerifiedForOnboarding();
    await rateLimit("start-finalize", user.id, 10, 3600);
    const { draftJson } = parseInput(finalizeSchema, formToObject(fd));
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
    const siteMode = draftSiteMode(draft) ?? DEFAULT_SITE_MODE;
    const slugWanted = resolveSlug(storeName);

    let tenantId: string;
    let slug: string;
    let name = storeName;
    try {
      const owned = await listOwnedStores(user.id);
      if (owned.length > 0) {
        const match = owned.find((s) => s.slug === slugWanted) ?? owned[0]!;
        tenantId = match.tenantId;
        slug = match.slug;
        name = match.name;
      } else {
        const created = await createOrResumeStore(user.id, storeName, slugWanted);
        tenantId = created.tenantId;
        slug = created.slug;
        await markDraft(tenantId);
        await setCategory(tenantId, industry);
        await setSiteMode(tenantId, siteMode);
      }

      const ctx = await ownerContext(user, tenantId);
      if (!ctx) throw new AppError("FORBIDDEN", { fieldErrors: { _form: ["You don't have permission to finish this store."] } });

      if (owned.length === 0 || !(await shouldSkipSeed(tenantId))) {
        await setCategory(tenantId, industry);
        await setSiteMode(tenantId, siteMode);
      }

      await applyOptionalPrefs(tenantId, draft);

      const skipSeed = await shouldSkipSeed(tenantId);
      if (!skipSeed) {
        const themeKey = draft.theme && isThemeKey(draft.theme) ? draft.theme : undefined;
        await seedReadyStore(ctx, {
          tenantId,
          storeName: name,
          industry,
          brief: buildSeedBrief(draft),
          locale: draft.locale,
          applyTheme: true,
          themeKey,
        });
      } else {
        await backfillSeedImages(ctx, industry);
      }
    } catch (err) {
      finishError(err);
    }

    await setActiveTenant(tenantId);

    const supabase = await createSupabaseServerClient();
    const meta: Record<string, unknown> = {};
    if (isSarvamLocaleCode(draft.locale)) meta.onboarding_locale = draft.locale;
    if (draft.intent && isStartIntentId(draft.intent)) meta.onboarding_intent = draft.intent;
    if (Object.keys(meta).length) {
      const { error } = await supabase.auth.updateUser({ data: meta });
      if (error) logger.warn("start.metadata_failed", { code: error.code });
    }

    return { slug, name };
  });
}
