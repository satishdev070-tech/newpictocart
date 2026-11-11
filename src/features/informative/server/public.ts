import "server-only";
import { cache } from "react";
import { cachedStorefront, storefrontTag } from "@/lib/cache/storefront";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { toFaq, toGalleryItem, toPage, toService, toSite, toTeamMember, toTestimonial, type InfoFaq, type InfoGalleryItem, type InfoPage, type InfoService, type InfoSite, type InfoTeamMember, type InfoTestimonial } from "../model";

/**
 * Everything one Informative Website renders. Public reads use the ANON client, so RLS (migration
 * 8100) returns only a PUBLISHED site of an open tenant and only active / visible / published,
 * non-deleted rows. The owner's draft preview uses the member's own session (staff read) with the
 * SAME visibility filters, so the preview shows exactly what publishing will show.
 */
export type SiteBundle = {
  site: InfoSite;
  services: InfoService[];
  pages: InfoPage[];
  gallery: InfoGalleryItem[];
  team: InfoTeamMember[];
  testimonials: InfoTestimonial[];
  faqs: InfoFaq[];
};

type Client = ReturnType<typeof createSupabasePublicClient> | Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function load(client: Client, tenantId: string, requirePublished: boolean): Promise<SiteBundle | null> {
  let siteQ = client.from("info_sites").select("*").eq("tenant_id", tenantId).is("deleted_at", null);
  if (requirePublished) siteQ = siteQ.eq("status", "PUBLISHED");
  const [site, services, pages, gallery, team, testimonials, faqs] = await Promise.all([
    siteQ.maybeSingle(),
    client.from("info_services").select("*").eq("tenant_id", tenantId).is("deleted_at", null).eq("is_active", true).order("sort_order").order("created_at"),
    client.from("info_pages").select("*").eq("tenant_id", tenantId).is("deleted_at", null).eq("is_published", true).order("sort_order"),
    client.from("info_gallery_items").select("*").eq("tenant_id", tenantId).is("deleted_at", null).order("sort_order").limit(60),
    client.from("info_team_members").select("*").eq("tenant_id", tenantId).is("deleted_at", null).eq("is_visible", true).order("sort_order"),
    client.from("info_testimonials").select("*").eq("tenant_id", tenantId).is("deleted_at", null).eq("is_visible", true).order("sort_order"),
    client.from("info_faqs").select("*").eq("tenant_id", tenantId).is("deleted_at", null).eq("is_visible", true).order("sort_order"),
  ]);
  const failed = [site, services, pages, gallery, team, testimonials, faqs].find((r) => r.error);
  if (failed?.error) {
    logger.warn("informative.public_load_failed", { tenantId, code: failed.error.code });
    throw new Error("informative site load failed");
  }
  if (!site.data) return null;
  return {
    site: toSite(site.data),
    services: (services.data ?? []).map(toService),
    pages: (pages.data ?? []).map(toPage),
    gallery: (gallery.data ?? []).map(toGalleryItem),
    team: (team.data ?? []).map(toTeamMember),
    testimonials: (testimonials.data ?? []).map(toTestimonial),
    faqs: (faqs.data ?? []).map(toFaq),
  };
}

class NotPublished extends Error {}

/** Cached per tenant (panel writes call revalidateStorefront). Misses / drafts are not cached. */
const publicLookup = cachedStorefront(
  "informative-site-v1",
  async (tenantId: string): Promise<SiteBundle> => {
    const bundle = await load(createSupabasePublicClient(), tenantId, true);
    if (!bundle) throw new NotPublished();
    return bundle;
  },
  (tenantId) => [storefrontTag(tenantId)],
);

/** The published site for a storefront request, or null while it is a draft. Memoised per request. */
export const getPublishedSite = cache(async (tenantId: string): Promise<SiteBundle | null> => {
  try {
    return await publicLookup(tenantId);
  } catch (e) {
    if (e instanceof NotPublished) return null;
    throw e;
  }
});

/** Owner / staff draft preview with the member's own session (RLS: store.read). Never cached. */
export const getDraftSite = cache(async (tenantId: string): Promise<SiteBundle | null> => load(await createSupabaseServerClient(), tenantId, false));
