import type { Metadata } from "next";
import Link from "next/link";
import { can, requireTenantPermission } from "@/lib/tenant/membership";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { PageHeader } from "@/components/ui/layout";
import { getEntitlements } from "@/features/platform";
import { getThemeKeys } from "@/features/theme/server/queries";
import { DEFAULT_THEME_KEY } from "@/features/theme/default-theme";
import { getMarketplaceThemes } from "@/features/theme/marketplace/registry";
import { INDUSTRIES, isIndustry, industryShort } from "@/features/stores/industries";
import { CurrentThemeCard, MarketplaceBrowser, type MarketplaceCard } from "@/features/theme/marketplace/components/marketplace-browser";
import { getStoreIndustry, liveDemoOrigins } from "@/features/theme/marketplace/server";
import { livePreviewUrl } from "@/features/theme/marketplace/live-preview";
import { themeSiteType } from "@/features/theme/marketplace/types";

export const metadata: Metadata = { title: "Theme marketplace" };

export default async function ThemesPage({ searchParams }: PageProps<"/dashboard/themes">) {
  const ctx = await requireTenantPermission("theme.edit");
  const sp = await searchParams;
  // Catalogue + tenant reads in one wave; demos wait on themes inside the same Promise.all.
  const themesPromise = getMarketplaceThemes();
  const [themes, keys, ent, own, live] = await Promise.all([
    themesPromise,
    getThemeKeys(ctx.tenantId),
    getEntitlements(ctx.tenantId),
    getStoreIndustry(ctx.tenantId),
    themesPromise.then((list) => liveDemoOrigins([...new Set(list.flatMap((t) => (t.demo ? [t.demo] : [])))])),
  ]);
  const enabled = ent.isEnabled("theme_marketplace");
  const asked = typeof sp.industry === "string" && isIndustry(sp.industry) ? sp.industry : "";

  const counts = new Map<string, number>();
  // Counts match the catalogue below, which leaves out the live theme (shown in "Current theme").
  for (const t of themes) if (t.key !== keys.published) counts.set(t.industry, (counts.get(t.industry) ?? 0) + 1);
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
      previewUrl: themeSiteType(t) === "informative" ? null : demoHost ? livePreviewUrl(storeOrigin(demoHost), t.key) : null,
      status: keys.published === t.key ? "live" : keys.draft === t.key ? "draft" : null,
    };
  });

  // The live theme gets its own section at the top; the catalogue below lists every other theme.
  const current = cards.find((c) => c.status === "live") ?? null;
  const others = current ? cards.filter((c) => c !== current) : cards;

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
      <section aria-labelledby="current-theme" className="space-y-3">
        <h2 id="current-theme" className="text-h3 font-semibold">Current theme</h2>
        {current ? (
          <CurrentThemeCard theme={current} />
        ) : (
          <p className="rounded-lg border border-border bg-surface p-4 text-small text-muted">
            {!keys.published || keys.published === DEFAULT_THEME_KEY ? "Your live store uses the built-in Aangan theme." : "Your live store uses a custom design that isn't in the marketplace."}{" "}
            <Link href="/dashboard/theme" className="font-medium text-accent hover:underline">Customize it</Link>
          </p>
        )}
      </section>
      <section aria-labelledby="other-themes" className="space-y-3">
        <h2 id="other-themes" className="text-h3 font-semibold">{current ? "Other themes" : "All themes"}</h2>
        <MarketplaceBrowser themes={others} industries={industries} initialIndustry={asked} recommended={own} enabled={enabled} canPublish={can(ctx, "theme.publish")} />
      </section>
    </div>
  );
}
