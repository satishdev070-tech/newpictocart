import type { Metadata } from "next";
import Link from "next/link";
import { can, requireTenantPermission } from "@/lib/tenant/membership";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { PageHeader } from "@/components/ui/layout";
import { getEntitlements } from "@/features/platform";
import { getThemeKeys } from "@/features/theme/server/queries";
import { getMarketplaceThemes } from "@/features/theme/marketplace/registry";
import { INDUSTRIES, isIndustry, industryShort } from "@/features/stores/industries";
import { MarketplaceBrowser, type MarketplaceCard } from "@/features/theme/marketplace/components/marketplace-browser";
import { getStoreIndustry, liveDemoOrigins } from "@/features/theme/marketplace/server";
import { livePreviewUrl } from "@/features/theme/marketplace/live-preview";

export const metadata: Metadata = { title: "Theme marketplace" };

export default async function ThemesPage({ searchParams }: PageProps<"/dashboard/themes">) {
  const ctx = await requireTenantPermission("theme.edit");
  const sp = await searchParams;
  const themes = await getMarketplaceThemes();
  const demos = [...new Set(themes.flatMap((t) => (t.demo ? [t.demo] : [])))];
  const [keys, ent, own, live] = await Promise.all([getThemeKeys(ctx.tenantId), getEntitlements(ctx.tenantId), getStoreIndustry(ctx.tenantId), liveDemoOrigins(demos)]);
  const enabled = ent.isEnabled("theme_marketplace");
  const asked = typeof sp.industry === "string" && isIndustry(sp.industry) ? sp.industry : "";

  const counts = new Map<string, number>();
  for (const t of themes) counts.set(t.industry, (counts.get(t.industry) ?? 0) + 1);
  const industries = INDUSTRIES.filter((i) => counts.has(i.slug)).map((i) => ({ slug: i.slug, label: i.short, count: counts.get(i.slug)! }));

  const cards: MarketplaceCard[] = themes.map((t, order) => {
    const demoHost = t.demo && live.has(t.demo) ? storeSubdomain(t.demo) : null;
    return {
      key: t.key,
      name: t.name,
      tagline: t.tagline,
      industry: t.industry,
      industryLabel: industryShort(t.industry),
      siteType: t.siteType,
      style: t.style,
      bestFor: t.bestFor,
      added: t.added,
      order,
      preset: t.preset,
      previewUrl: demoHost ? livePreviewUrl(storeOrigin(demoHost), t.key) : null,
      status: keys.published === t.key ? "live" : keys.draft === t.key ? "draft" : null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Theme marketplace"
        description={`${themes.length} themes across ${industries.length} industries. Live Preview opens a demo store in the theme; applying one creates a draft with your own text, images and products, and your live store only changes when you publish.`}
        actions={
          <Link href="/dashboard/theme" className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-small font-medium hover:bg-surface-secondary">
            Customize current theme
          </Link>
        }
      />
      {!enabled ? <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-small text-warning">The theme marketplace isn&apos;t included in your plan. You can still preview themes and customize your current theme.</p> : null}
      <MarketplaceBrowser themes={cards} industries={industries} initialIndustry={asked} recommended={own} enabled={enabled} canPublish={can(ctx, "theme.publish")} />
    </div>
  );
}
