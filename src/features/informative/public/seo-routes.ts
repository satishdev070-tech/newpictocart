import "server-only";
import { sitemapXml, type SitemapEntry } from "@/features/storefront/seo";
import { canonicalUrl } from "@/features/storefront/urls";
import type { ResolvedTenant } from "@/lib/tenant/context";
import { informativeFlagMode, informativeFlagOn } from "../flag";
import { getPublishedSite } from "../server/public";

/**
 * sitemap.xml / robots.txt for Informative Websites. Kept apart from render.tsx because route
 * handlers can't evaluate `next/font` (the renderer imports the theme fonts).
 */

/** sitemap.xml for a published Informative Website (404 while it is a draft). */
export async function informativeSitemap(tenant: ResolvedTenant): Promise<Response> {
  const bundle = informativeFlagOn(informativeFlagMode()) ? await getPublishedSite(tenant.tenantId) : null;
  if (!bundle) return new Response("Not found", { status: 404 });
  const entries: SitemapEntry[] = [{ path: "/", lastModified: bundle.site.updatedAt }];
  for (const p of bundle.pages) {
    if (p.type === "HOME") continue;
    if (p.type === "SERVICES" && !bundle.services.length) continue;
    entries.push({ path: p.type === "CUSTOM" ? `/${p.slug}` : `/${p.type.toLowerCase()}` });
  }
  for (const s of bundle.services) entries.push({ path: `/services/${s.slug}` });
  if (bundle.gallery.length) entries.push({ path: "/gallery" });
  return new Response(sitemapXml(tenant.primaryHost, entries), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

/** robots.txt: indexable only when published, on the primary host, with the flag on. */
export async function informativeRobots(tenant: ResolvedTenant): Promise<Response> {
  const bundle = informativeFlagOn(informativeFlagMode()) ? await getPublishedSite(tenant.tenantId) : null;
  const body = bundle && tenant.host === tenant.primaryHost ? `User-agent: *\nAllow: /\n\nSitemap: ${canonicalUrl(tenant.primaryHost, "/sitemap.xml")}\n` : "User-agent: *\nDisallow: /\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
