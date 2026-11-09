import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, Eye } from "lucide-react";
import { buildMarketingMetadata } from "@/features/marketing-site/seo";
import { siteOrigin } from "@/features/marketing-site/site";
import { findTheme, themePreviewHref, themesHref } from "@/features/marketing-site/themes";
import { livePreviewUrls } from "@/features/marketing-site/server/themes";
import { ThemeDevicePreview } from "@/features/marketing-site/components/theme-card";
import { ButtonLink, Container } from "@/features/marketing-site/components/ui";
import { THEME_STYLE_LABELS } from "@/features/theme/marketplace/types";
import { FONT_STACKS, type FontKey } from "@/features/theme/schema/tokens";
import { industryName } from "@/features/stores/industries";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/themes/[key]">): Promise<Metadata> {
  const t = findTheme((await params).key);
  if (!t) return { title: "Theme not found", robots: { index: false } };
  return buildMarketingMetadata({ title: `${t.name} theme`, description: `${t.name}: ${t.tagline}. ${t.description}`.slice(0, 300), path: `/themes/${t.key}`, origin: siteOrigin() });
}

const COLOR_LABELS: Record<string, string> = { primary: "Primary", secondary: "Secondary", accent: "Accent", background: "Background", text: "Text", border: "Border", sale: "Sale" };

export default async function ThemeDetailPage({ params }: PageProps<"/themes/[key]">) {
  const t = findTheme((await params).key);
  if (!t) notFound();
  const previewUrl = (await livePreviewUrls([t])).get(t.key) ?? null;
  const colors = Object.entries(t.preset.tokens.colors).filter(([k]) => k in COLOR_LABELS);
  const heading = FONT_STACKS[t.preset.tokens.headingFont as FontKey];
  const body = FONT_STACKS[t.preset.tokens.bodyFont as FontKey];

  return (
    <>
      <section className="bg-gradient-to-b from-mk-bg to-mk-elev-1 pt-10 pb-16" aria-labelledby="theme-title">
        <Container>
          <Link
            href={themesHref({ industry: t.industry })}
            className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-mk-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent"
          >
            <ArrowLeft aria-hidden className="size-4" /> {industryName(t.industry)} themes
          </Link>
          <div className="mt-8 grid items-start gap-12 lg:grid-cols-[1.25fr_1fr]">
            <div className="pb-8">
              <ThemeDevicePreview theme={t} previewUrl={previewUrl} size="large" eager live />
              <p className="mt-12 text-sm text-mk-muted">
                {previewUrl
                  ? "Select Live preview to try the theme on a demo store, or Preview Theme for the full-size preview."
                  : "Preview drawn from the theme's own colours, fonts and layout. Select Preview Theme for a full-size sample store."}{" "}
                Your text, images and products replace the samples.
              </p>
            </div>
            <div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-mk-accent-tint px-2.5 py-1 text-mk-accent">{industryName(t.industry)}</span>
                <span className="rounded-full bg-mk-elev-2 px-2.5 py-1 text-mk-muted">{THEME_STYLE_LABELS[t.style]}</span>
              </div>
              <p className="mk-label mt-6 text-mk-dim">Theme</p>
              <h1 id="theme-title" className="mk-display-lg mt-3 text-balance text-mk-text">
                {t.name}
              </h1>
              <p className="mt-2 text-lg font-medium text-mk-text/80">{t.tagline}</p>
              <p className="mt-4 leading-relaxed text-mk-muted">{t.description}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={`/themes/${t.key}/use`} prefetch={false} size="lg" track={{ id: `use_${t.key}`, location: "theme_detail" }}>
                  Use This Theme
                </ButtonLink>
                <ButtonLink href={themePreviewHref(t.key)} external variant="secondary" size="lg" track={{ event: "theme_preview", id: t.key, location: "theme_detail" }}>
                  <Eye aria-hidden className="size-4" /> Preview Theme <ExternalLink aria-hidden className="size-3.5" />
                </ButtonLink>
              </div>
              <p className="mt-3 text-sm text-mk-muted">Using a theme creates a draft for your store. Nothing goes live until you publish.</p>

              <dl className="mt-10 grid gap-8 rounded-mk-lg border border-mk-line bg-mk-elev-1 p-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-semibold text-mk-text">Best for</dt>
                  <dd className="mt-3">
                    <ul className="space-y-2 text-sm text-mk-muted">
                      {t.bestFor.map((b) => (
                        <li key={b} className="flex gap-2">
                          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-mk-accent" /> {b}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-mk-text">Highlights</dt>
                  <dd className="mt-3">
                    <ul className="space-y-2 text-sm text-mk-muted">
                      {t.features.map((f) => (
                        <li key={f} className="flex gap-2">
                          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-mk-accent" /> {f}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-mk-text">Colours</dt>
                  <dd className="mt-3 flex flex-wrap gap-2">
                    {colors.map(([k, v]) => (
                      <span key={k} className="flex items-center gap-2 rounded-full border border-mk-line bg-mk-elev-2 py-1 pr-3 pl-1 text-xs text-mk-muted">
                        <span className="size-5 rounded-full border border-mk-line" style={{ background: v }} aria-hidden />
                        {COLOR_LABELS[k]}
                      </span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-mk-text">Fonts</dt>
                  <dd className="mt-3 space-y-1 text-sm text-mk-muted">
                    {heading ? <p style={{ fontFamily: heading.stack }}>Headings: {heading.label.split(" (")[0]}</p> : null}
                    {body ? <p style={{ fontFamily: body.stack }}>Text: {body.label.split(" (")[0]}</p> : null}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
