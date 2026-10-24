import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requirePlatform } from "@/lib/platform/access";
import { Badge, Card, PageHeader } from "@/components/ui/layout";
import { buttonClass } from "@/components/ui/button";
import { industryName } from "@/features/stores/industries";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { findMarketplaceTheme } from "@/features/theme/marketplace/catalog";
import { THEME_STYLE_LABELS, type MarketplaceTheme } from "@/features/theme/marketplace/types";
import { ThemeMockup } from "@/features/theme/marketplace/mockup";
import { liveDemoOrigins } from "@/features/theme/marketplace/server";
import { livePreviewUrl } from "@/features/theme/marketplace/live-preview";
import { ThemeSampleStore } from "@/features/marketing-site/components/theme-sample-store";
import { getCustomTheme } from "@/features/theme/builder/server/store";
import { demoFor, toMarketplaceTheme } from "@/features/theme/builder/schema";
import { imageCredits } from "@/features/theme/builder/images";
import { DeleteThemeButton, DuplicateThemeButton, PublishThemeButton } from "@/features/theme/builder/components/admin-themes";

export async function generateMetadata({ params }: PageProps<"/admin/themes/[key]">): Promise<Metadata> {
  const { key } = await params;
  return { title: findMarketplaceTheme(key)?.name ?? "Theme" };
}

/** Preview of any marketplace theme (built-in or custom, drafts included) for platform staff. */
export default async function AdminThemePage({ params }: PageProps<"/admin/themes/[key]">) {
  await requirePlatform("platform.settings.manage");
  const { key } = await params;
  const builtIn = findMarketplaceTheme(key);
  const custom = builtIn ? null : await getCustomTheme(key);
  if (!builtIn && !custom) notFound();
  const t: MarketplaceTheme = builtIn ?? toMarketplaceTheme(custom!.theme, custom!.createdAt.slice(0, 10));
  const images = custom?.theme.images ?? [];
  const demo = t.demo ?? demoFor(t.industry);
  // Live Preview on a showcase store only works for published themes (drafts aren't public).
  const live = builtIn || custom?.published ? await liveDemoOrigins([demo]) : new Set<string>();
  const previewUrl = live.has(demo) ? livePreviewUrl(storeOrigin(storeSubdomain(demo)), t.key) : null;
  const seen = new Set<string>();
  const photos = [...images.filter((i) => i.slot === "hero"), ...images.filter((i) => i.slot !== "hero")]
    .filter((i) => !seen.has(i.id) && seen.add(i.id))
    .map((i) => ({ url: `${i.url}${i.url.includes("?") ? "&" : "?"}w=${i.slot === "hero" ? 1600 : 640}`, alt: i.alt }));
  const credits = imageCredits(images);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.name}
        description={t.tagline}
        back={<Link href="/admin/themes">← Themes</Link>}
        actions={
          <div className="flex flex-wrap items-start gap-2">
            {custom ? (
              <>
                <Link href={`/admin/themes/${t.key}/edit`} className={buttonClass({ variant: "primary", size: "sm" })}>
                  <Pencil aria-hidden /> Edit
                </Link>
                <PublishThemeButton themeKey={t.key} published={custom.published} />
                <DuplicateThemeButton themeKey={t.key} />
                <DeleteThemeButton themeKey={t.key} name={t.name} />
              </>
            ) : (
              <DuplicateThemeButton themeKey={t.key} label="Duplicate & edit" variant="primary" />
            )}
            {previewUrl ? (
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "secondary", size: "sm" })}>
                Live preview on {demo}
              </a>
            ) : null}
          </div>
        }
      />
      <div className="flex flex-wrap gap-2 text-small">
        {builtIn ? <Badge>Built-in</Badge> : custom!.published ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>}
        <Badge>{industryName(t.industry)}</Badge>
        <Badge>{THEME_STYLE_LABELS[t.style]}</Badge>
        {custom?.source === "ai" ? <Badge tone="info">AI from {custom.theme.reference.host ?? "screenshots"}</Badge> : null}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card title="Desktop layout">
          <div className="overflow-hidden rounded-md border border-border">
            <ThemeMockup preset={t.preset} name={t.name.split(" ")[0]!} tagline={t.tagline} size="large" />
          </div>
        </Card>
        <Card title="Phone">
          <div className="overflow-hidden rounded-md border border-border">
            <ThemeMockup preset={t.preset} name={t.name.split(" ")[0]!} tagline={t.tagline} size="phone" />
          </div>
        </Card>
      </div>
      <Card title="Sample store" description="Sample products; sellers' own content replaces them.">
        <div className="max-h-[80vh] overflow-auto rounded-md border border-border bg-white">
          <ThemeSampleStore theme={t} photos={photos} />
        </div>
        {credits.length ? (
          <p className="mt-3 text-caption text-muted">
            Photos from Unsplash by{" "}
            {credits.slice(0, 8).map((c, i) => (
              <span key={c.name}>
                {i ? ", " : ""}
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {c.name}
                </a>
              </span>
            ))}
            .
          </p>
        ) : null}
      </Card>
      {t.description ? (
        <Card title="About this theme">
          <p className="text-small text-muted">{t.description}</p>
          {t.features.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {t.features.map((f) => (
                <li key={f}>
                  <Badge>{f}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
