import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenant/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { getEntitlements } from "@/features/platform";
import { assetsBelongToTenant, parseThemeConfigStrict } from "../schema/config";
import { getThemeEditorData } from "./queries";
import { findAnyMarketplaceTheme } from "../marketplace/registry";
import { applyThemePreset } from "../marketplace/apply";
import { modeAfterThemeApply, parseSiteMode } from "@/features/stores/site-mode";

/*
 * Server-only (NOT a server action): callers pass an already-authorised TenantContext. Used by
 * the dashboard marketplace actions and by seller onboarding. Writes a DRAFT only; the live store
 * changes when the seller publishes.
 */
/** Build or replace the active store's draft with a marketplace preset. */
export async function applyMarketplaceThemeToDraft(ctx: TenantContext, key: string) {
  const ent = await getEntitlements(ctx.tenantId);
  if (!ent.isEnabled("theme_marketplace")) throw new AppError("FORBIDDEN", { message: "The theme marketplace isn't available on your plan." });
  const theme = await findAnyMarketplaceTheme(key);
  if (!theme) throw new AppError("NOT_FOUND");

  const data = await getThemeEditorData(ctx.tenantId);
  const parsed = parseThemeConfigStrict(applyThemePreset(data.config, theme.preset));
  if (!parsed.ok) throw new AppError("INTERNAL", { message: "This theme couldn't be applied to your store. Please contact support.", context: { issues: parsed.issues.slice(0, 5) } });
  if (!assetsBelongToTenant(parsed.config, ctx.tenantId)) throw new AppError("VALIDATION", { fieldErrors: { _form: ["Some images don't belong to this store."] } });

  const supabase = await createSupabaseServerClient();
  const { data: draft, error: draftError } = await supabase.from("theme_versions").select("id").eq("tenant_id", ctx.tenantId).eq("status", "draft").maybeSingle();
  if (draftError) throw mapDbError(draftError);
  if (draft) {
    const { error } = await supabase.from("theme_versions").update({ config: parsed.config as unknown as Json, theme_key: theme.key, label: theme.name }).eq("id", draft.id).eq("tenant_id", ctx.tenantId).eq("status", "draft");
    if (error) throw mapDbError(error);
  } else {
    const { data: latest, error: latestError } = await supabase.from("theme_versions").select("version").eq("tenant_id", ctx.tenantId).order("version", { ascending: false }).limit(1).maybeSingle();
    if (latestError) throw mapDbError(latestError);
    const { error } = await supabase
      .from("theme_versions")
      .insert({ tenant_id: ctx.tenantId, theme_key: theme.key, label: theme.name, version: (latest?.version ?? 0) + 1, status: "draft", config: parsed.config as unknown as Json, created_by: ctx.user.id });
    if (error) throw mapDbError(error);
  }

  // An informative preset turns a brand-new, empty store into a brochure website. Stores that
  // already have products keep their selected mode, so applying a visual preset never hides an
  // established shop. The column is additive; if an older database has not applied migration
  // 3300 yet, applying a theme still succeeds exactly as it did before.
  if (theme.siteType === "informative") {
    const [{ data: store, error: storeError }, { count, error: productError }] = await Promise.all([
      supabase.from("stores").select("site_mode").eq("tenant_id", ctx.tenantId).maybeSingle(),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId),
    ]);
    if (productError) throw mapDbError(productError);
    if (!storeError && store) {
      const nextMode = modeAfterThemeApply(parseSiteMode(store.site_mode), theme.siteType, (count ?? 0) > 0);
      if (nextMode !== store.site_mode) {
        const { error } = await supabase.from("stores").update({ site_mode: nextMode }).eq("tenant_id", ctx.tenantId);
        if (error) throw mapDbError(error);
      }
    }
  }
  return { supabase, theme };
}

