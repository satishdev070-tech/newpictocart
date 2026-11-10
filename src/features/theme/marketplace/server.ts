import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tenantDirectory } from "@/lib/tenant/directory";
import { storefrontAvailability } from "@/lib/tenant/context";
import { storeSubdomain } from "@/lib/platform/urls";
import { isIndustry, type IndustrySlug } from "@/features/stores/industries";
import { cachedMarketplacePublic, MARKETPLACE_DEMO_ORIGINS_TAG } from "./cache";
import { canPreviewThemes, SHOWCASE_STORES } from "./showcase";

/** Sorted showcase slugs — stable cache key for the common Live Preview catalogue load. */
const SHOWCASE_SLUGS = Object.keys(SHOWCASE_STORES).sort();
const SHOWCASE_SLUG_SET = new Set(SHOWCASE_SLUGS);

/**
 * Module-scoped loader so every request reuses the same `unstable_cache` / Redis entry
 * (`demo-origins:showcase`) instead of allocating a new factory per call.
 */
const loadShowcaseDemoOrigins = cachedMarketplacePublic(
  "demo-origins:showcase",
  async () => {
    const found = await Promise.all(
      SHOWCASE_SLUGS.map(async (slug) => {
        const t = await tenantDirectory.findByHost(storeSubdomain(slug));
        return t && storefrontAvailability(t.status) === "open" && canPreviewThemes(t) ? slug : null;
      }),
    );
    return found.filter((s): s is string => !!s);
  },
  [MARKETPLACE_DEMO_ORIGINS_TAG],
  300,
);

async function resolveOpenDemos(slugs: string[]): Promise<string[]> {
  const found = await Promise.all(
    slugs.map(async (slug) => {
      const t = await tenantDirectory.findByHost(storeSubdomain(slug));
      return t && storefrontAvailability(t.status) === "open" && canPreviewThemes(t) ? slug : null;
    }),
  );
  return found.filter((s): s is string => !!s);
}

/**
 * Demo slugs whose store exists and is open, so Live Preview is only offered where it works
 * (no dead iframes while a showcase store hasn't been seeded yet).
 * Looks the demo host up in the tenant directory directly: resolveStorefrontTenant() only accepts
 * the host of the CURRENT request, which on the dashboard is the platform host, so it always
 * returned null here and no Live Preview buttons were ever shown.
 *
 * When `slugs` is the showcase set (or a subset of it), uses one stable cached loader. Other
 * args still resolve, but without minting a new cache factory per request.
 */
export async function liveDemoOrigins(slugs: string[]): Promise<Set<string>> {
  const unique = [...new Set(slugs.filter(Boolean))].sort();
  if (!unique.length) return new Set();

  const subsetOfShowcase = unique.every((s) => SHOWCASE_SLUG_SET.has(s));
  if (subsetOfShowcase) {
    const open = await loadShowcaseDemoOrigins();
    if (unique.length === SHOWCASE_SLUGS.length && unique.every((s, i) => s === SHOWCASE_SLUGS[i])) {
      return new Set(open);
    }
    const wanted = new Set(unique);
    return new Set(open.filter((s) => wanted.has(s)));
  }

  return new Set(await resolveOpenDemos(unique));
}

/** The seller's store category (migration 1800), or null when unset / not migrated yet. */
export async function getStoreIndustry(tenantId: string): Promise<IndustrySlug | null> {
  const { data, error } = await (await createSupabaseServerClient()).from("stores").select("store_categories(slug)").eq("tenant_id", tenantId).maybeSingle();
  if (error || !data) return null;
  const rel = (data as { store_categories: { slug: string } | { slug: string }[] | null }).store_categories;
  const slug = Array.isArray(rel) ? rel[0]?.slug : rel?.slug;
  return slug && isIndustry(slug) ? slug : null;
}
