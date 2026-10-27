import "server-only";
import { cache } from "react";
import type { Json } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { mapDbError } from "@/lib/supabase/errors";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { findMarketplaceTheme } from "../../marketplace/catalog";
import { cachedMarketplacePublic, MARKETPLACE_CUSTOM_THEMES_TAG } from "../../marketplace/cache";
import type { MarketplaceTheme } from "../../marketplace/types";
import { builtThemeSchema, themeKeyFor, toMarketplaceTheme, type BuiltTheme } from "../schema";

/**
 * Custom marketplace themes in public.themes (migration 1500 + 3100). Reads for sellers use the
 * public client (RLS: published rows only); admin reads and every write use the signed-in user's
 * client, so RLS (platform.settings.manage) is enforced on top of the action's permission check.
 */

export type StoredTheme = { theme: BuiltTheme; published: boolean; source: "manual" | "ai" | "duplicate"; createdAt: string; updatedAt: string; publishedAt: string | null };

type Row = { key: string; config: Json; active: boolean; source: string; created_at: string; updated_at: string; published_at: string | null };
const COLUMNS = "key, config, active, source, created_at, updated_at, published_at";

function fromRow(row: Row): StoredTheme | null {
  const parsed = builtThemeSchema.safeParse({ ...(row.config as object), key: row.key });
  if (!parsed.success) {
    logger.warn("theme_builder.bad_row", { key: row.key, issues: parsed.error.issues.slice(0, 3).map((i) => i.path.join(".")) });
    return null;
  }
  return { theme: parsed.data, published: row.active, source: (["manual", "ai", "duplicate"].includes(row.source) ? row.source : "manual") as StoredTheme["source"], createdAt: row.created_at, updatedAt: row.updated_at, publishedAt: row.published_at };
}

/** Every custom theme, drafts included (platform staff; RLS hides drafts from anyone else). */
export async function listCustomThemes(): Promise<StoredTheme[]> {
  const { data, error } = await (await createSupabaseServerClient()).from("themes").select(COLUMNS).order("updated_at", { ascending: false }).limit(500);
  if (error) throw mapDbError(error);
  return (data as Row[]).map(fromRow).filter((t): t is StoredTheme => !!t);
}

export async function getCustomTheme(key: string): Promise<StoredTheme | null> {
  const { data, error } = await (await createSupabaseServerClient()).from("themes").select(COLUMNS).eq("key", key).maybeSingle();
  if (error) throw mapDbError(error);
  return data ? fromRow(data as Row) : null;
}

/** DB load for published custom themes (production Data Cache, 300 s). */
const loadPublishedCustomThemes = cachedMarketplacePublic(
  "custom-themes",
  async (): Promise<MarketplaceTheme[]> => {
    try {
      const { data, error } = await createSupabasePublicClient().from("themes").select(COLUMNS).eq("active", true).order("position").order("published_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data as Row[]).flatMap((r) => {
        const t = fromRow(r);
        // A built-in key always wins (keys are checked on save; this guards against hand-made rows).
        return t && !findMarketplaceTheme(t.theme.key) ? [toMarketplaceTheme(t.theme, (r.published_at ?? r.created_at).slice(0, 10))] : [];
      });
    } catch (err) {
      logger.warn("theme_builder.catalogue_failed", { error: err instanceof Error ? err.message : String(err) });
      return [];
    }
  },
  [MARKETPLACE_CUSTOM_THEMES_TAG],
  300,
);

/** Published custom themes as marketplace entries (sellers' catalogue). Never throws. */
export const publishedCustomThemes = cache(loadPublishedCustomThemes);

async function keyTaken(key: string): Promise<boolean> {
  if (findMarketplaceTheme(key)) return true;
  const { data, error } = await (await createSupabaseServerClient()).from("themes").select("key").eq("key", key).maybeSingle();
  if (error) throw mapDbError(error);
  return !!data;
}

/** A free key for a new theme name (checks built-in and stored keys). */
export async function newThemeKey(name: string): Promise<string> {
  const base = themeKeyFor(name, () => false);
  if (!(await keyTaken(base))) return base;
  for (let i = 0; i < 5; i++) {
    const k = themeKeyFor(name, (x) => x === base);
    if (!(await keyTaken(k))) return k;
  }
  throw new AppError("CONFLICT", { message: "Couldn't find a free key for this theme name." });
}

const toConfig = (t: BuiltTheme): Json => {
  const { key: _key, ...rest } = t;
  return rest as unknown as Json;
};

export async function insertCustomTheme(t: BuiltTheme, opts: { source: StoredTheme["source"]; userId: string; publish?: boolean }) {
  if (findMarketplaceTheme(t.key)) throw new AppError("CONFLICT", { message: "That key belongs to a built-in theme." });
  const { error } = await (await createSupabaseServerClient())
    .from("themes")
    .insert({
      key: t.key,
      name: t.name,
      tagline: t.tagline || null,
      description: t.description || null,
      category: t.industry,
      style: t.style,
      tags: t.bestFor,
      features: t.features,
      config: toConfig(t),
      active: !!opts.publish,
      published_at: opts.publish ? new Date().toISOString() : null,
      source: opts.source,
      source_url: t.reference.url,
      created_by: opts.userId,
      author: "Pictocart",
    });
  if (error) throw mapDbError(error);
}

export async function updateCustomTheme(t: BuiltTheme, publish?: boolean) {
  const patch = {
    name: t.name,
    tagline: t.tagline || null,
    description: t.description || null,
    category: t.industry,
    style: t.style,
    tags: t.bestFor,
    features: t.features,
    config: toConfig(t),
    ...(publish === undefined ? {} : { active: publish, published_at: publish ? new Date().toISOString() : null }),
  };
  const { data, error } = await (await createSupabaseServerClient()).from("themes").update(patch).eq("key", t.key).select("key");
  if (error) throw mapDbError(error);
  if (!data?.length) throw new AppError("NOT_FOUND");
}

export async function setCustomThemePublished(key: string, publish: boolean) {
  const { data, error } = await (await createSupabaseServerClient())
    .from("themes")
    .update({ active: publish, published_at: publish ? new Date().toISOString() : null })
    .eq("key", key)
    .select("key");
  if (error) throw mapDbError(error);
  if (!data?.length) throw new AppError("NOT_FOUND");
}

export async function deleteCustomTheme(key: string) {
  const { data, error } = await (await createSupabaseServerClient()).from("themes").delete().eq("key", key).select("key");
  if (error) throw mapDbError(error);
  if (!data?.length) throw new AppError("NOT_FOUND");
}
