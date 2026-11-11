import type { MetadataRoute } from "next";
import { siteOrigin } from "@/features/marketing-site/site";

/**
 * Platform sitemap (public marketing pages only; sign-in, sign-up and onboarding are excluded).
 * Served on the platform host; on store hosts the proxy rewrites /sitemap.xml to the store's own.
 *
 * The theme catalog and feature-page loader are imported INSIDE the handler on purpose: the
 * Worker build links metadata routes into the always-loaded RSC entry, so top-level imports here
 * made every cold isolate parse ~300 KB of theme presets, the marketing content and the Redis
 * client before serving any page (Error 1102, docs/DEPLOY_CLOUDFLARE_WORKERS.md). Guarded by
 * tests/unit/next/root-metadata-imports.test.ts.
 */
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const pages: { path: string; priority: number }[] = [
    { path: "/", priority: 1 },
    { path: "/features", priority: 0.8 },
    { path: "/themes", priority: 0.8 },
    { path: "/how-it-works", priority: 0.7 },
    { path: "/pricing", priority: 0.8 },
    { path: "/terms", priority: 0.2 },
    { path: "/privacy", priority: 0.2 },
  ];
  const [{ ecommerceMarketplaceThemes }, { getFeaturePages }] = await Promise.all([
    import("@/features/theme/marketplace/catalog"),
    import("@/features/marketing-site/server/feature-pages"),
  ]);
  const featureDoc = await getFeaturePages();
  const featurePaths = featureDoc.pages
    .filter((p) => p.published && p.slug !== "theme-marketplace")
    .map((p) => ({ path: `/features/${p.slug}`, priority: 0.65 }));
  return [
    ...pages.map((p) => ({ url: `${origin}${p.path}`, changeFrequency: "weekly" as const, priority: p.priority })),
    ...featurePaths.map((p) => ({ url: `${origin}${p.path}`, changeFrequency: "weekly" as const, priority: p.priority })),
    ...ecommerceMarketplaceThemes().map((t) => ({ url: `${origin}/themes/${t.key}`, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
