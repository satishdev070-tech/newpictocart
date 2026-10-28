import type { Metadata } from "next";
import { Suspense } from "react";
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
import { toMarketplaceCardMockup } from "@/features/theme/marketplace/card-mockup";
import { getStoreIndustry, liveDemoOrigins } from "@/features/theme/marketplace/server";
import { SHOWCASE_STORES } from "@/features/theme/marketplace/showcase";
import { livePreviewUrl } from "@/features/theme/marketplace/live-preview";
import { themeSiteType } from "@/features/theme/marketplace/types";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Theme marketplace" };

function withPreviewUrls(cards: MarketplaceCard[], live: Set<string>, demos: Record<string, string | null>): MarketplaceCard[] {
  return cards.map((c) => {
    const demo = demos[c.key] ?? null;
    const demoHost = demo && live.has(demo) ? storeSubdomain(demo) : null;
    return {
      ...c,
      previewUrl: themeSiteType(c) === "informative" ? null : demoHost ? livePreviewUrl(storeOrigin(demoHost), c.key) : null,
    };
  });
}

function ThemesCatalogue({
  cards,
  industries,
  initialIndustry,
  recommended,
  enabled,
  canPublish,
  publishedIsDefault,
}: {
  cards: MarketplaceCard[];
  industries: { slug: string; label: string; count: number }[];
  initialIndustry: string;
  recommended: string | null;
  enabled: boolean;
  canPublish: boolean;
  publishedIsDefault: boolean;
}) {
  const current = cards.find((c) => c.status === "live") ?? null;
  const others = current ? cards.filter((c) => c !== current) : cards;
  return (
    <>
      <section aria-labelledby="current-theme" data-tour="theme-current" className="space-y-3">
        <h2 id="current-theme" className="text-h3 font-semibold">Current theme</h2>
        {current ? (
          <CurrentThemeCard theme={current} />
        ) : (
          <p className="rounded-lg border border-border bg-surface p-4 text-small text-muted">
            {publishedIsDefault ? "Your live store uses the built-in Aangan theme." : "Your live store uses a custom design that isn't in the marketplace."}{" "}
            <Link href="/dashboard/theme" className="font-medium text-accent hover:underline">Customize it</Link>
          </p>
        )}
      </section>
      <section aria-labelledby="other-themes" data-tour="theme-browse" className="space-y-3">
        <h2 id="other-themes" className="text-h3 font-semibold">{current ? "Other themes" : "All themes"}</h2>
        <MarketplaceBrowser themes={others} industries={industries} initialIndustry={initialIndustry} recommended={recommended} enabled={enabled} canPublish={canPublish} />
      </section>
    </>
  );
}

/** Awaits open demo hosts, then paints Live Preview URLs — streamed under Suspense so the catalogue shell can paint first. */
async function ThemesCatalogueWithDemos({
  cards,
  demos,
  industries,
  initialIndustry,
  recommended,
  enabled,
  canPublish,
  publishedIsDefault,
}: {
  cards: MarketplaceCard[];
  demos: Record<string, string | null>;
  industries: { slug: string; label: string; count: number }[];
  initialIndustry: string;
  recommended: string | null;
  enabled: boolean;
  canPublish: boolean;
  publishedIsDefault: boolean;
}) {
  const live = await liveDemoOrigins(Object.keys(SHOWCASE_STORES));
  return (
    <ThemesCatalogue
      cards={withPreviewUrls(cards, live, demos)}
      industries={industries}
      initialIndustry={initialIndustry}
      recommended={recommended}
      enabled={enabled}
      canPublish={canPublish}
      publishedIsDefault={publishedIsDefault}
    />
  );
}

export default async function ThemesPage({ searchParams }: PageProps<"/dashboard/themes">) {
  const ctx = await requireTenantPermission("theme.edit");
  const { t } = await getI18n();
  const sp = await searchParams;
  // Catalogue + tenant reads first so the page can stream; open demos load under Suspense.
  const [themes, keys, ent, own] = await Promise.all([
    getMarketplaceThemes(),
    getThemeKeys(ctx.tenantId),
    getEntitlements(ctx.tenantId),
    getStoreIndustry(ctx.tenantId),
  ]);
  const enabled = ent.isEnabled("theme_marketplace");
  const asked = typeof sp.industry === "string" && isIndustry(sp.industry) ? sp.industry : "";

  const counts = new Map<string, number>();
  // Counts match the catalogue below, which leaves out the live theme (shown in "Current theme").
  for (const theme of themes) if (theme.key !== keys.published) counts.set(theme.industry, (counts.get(theme.industry) ?? 0) + 1);
  const industries = INDUSTRIES.filter((i) => counts.has(i.slug)).map((i) => ({ slug: i.slug, label: i.short, count: counts.get(i.slug)! }));

  const demos: Record<string, string | null> = {};
  const cards: MarketplaceCard[] = themes.map((theme, order) => {
    demos[theme.key] = theme.demo;
    return {
      key: theme.key,
      name: theme.name,
      tagline: theme.tagline,
      industry: theme.industry,
      industryLabel: industryShort(theme.industry),
      siteType: theme.siteType,
      style: theme.style,
      bestFor: theme.bestFor,
      added: theme.added,
      order,
      mockup: toMarketplaceCardMockup(theme.preset),
      previewUrl: null,
      status: keys.published === theme.key ? "live" : keys.draft === theme.key ? "draft" : null,
    };
  });

  const shell = {
    industries,
    initialIndustry: asked,
    recommended: own,
    enabled,
    canPublish: can(ctx, "theme.publish"),
    publishedIsDefault: !keys.published || keys.published === DEFAULT_THEME_KEY,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.themes.title")}
        description={`${themes.length} themes across ${industries.length} industries. Live Preview opens a demo store in the theme; applying one creates a draft with your own text, images and products, and your live store only changes when you publish.`}
        actions={
          <Link href="/dashboard/theme" className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-small font-medium hover:bg-surface-secondary">
            Customize current theme
          </Link>
        }
      />
      {!enabled ? <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-small text-warning">The theme marketplace isn&apos;t included in your plan. You can still preview themes and customize your current theme.</p> : null}
      <Suspense fallback={<ThemesCatalogue cards={cards} {...shell} />}>
        <ThemesCatalogueWithDemos cards={cards} demos={demos} {...shell} />
      </Suspense>
    </div>
  );
}
