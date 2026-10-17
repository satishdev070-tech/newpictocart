import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buildMarketingMetadata } from "@/features/marketing-site/seo";
import { siteOrigin } from "@/features/marketing-site/site";
import { findTheme } from "@/features/marketing-site/themes";
import { livePreviewUrls } from "@/features/marketing-site/server/themes";
import { ButtonLink, Container } from "@/features/marketing-site/components/ui";
import { ThemePreviewStage } from "@/features/marketing-site/components/theme-preview-stage";
import { ThemeSampleStore, type SamplePhoto } from "@/features/marketing-site/components/theme-sample-store";
import { industryUnsplashPhotos } from "@/features/media/unsplash/server";
import { sizedUnsplashUrl } from "@/features/media/unsplash/photos";
import { getCategoryImage } from "@/lib/unsplash";
import { industryShort } from "@/features/stores/industries";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/themes/[key]/preview">): Promise<Metadata> {
  const t = findTheme((await params).key);
  if (!t) return { title: "Theme not found", robots: { index: false } };
  const meta = buildMarketingMetadata({ title: `Preview ${t.name} theme`, description: `See the ${t.name} theme on a store at desktop and phone size.`, path: `/themes/${t.key}/preview`, origin: siteOrigin() });
  // The detail page is the canonical, indexable page for a theme.
  return { ...meta, robots: { index: false, follow: true } };
}

/**
 * Theme preview that works for every theme: the live demo store with the theme applied in memory
 * when one is up (livePreviewUrls), otherwise a sample store rendered from the theme's preset with
 * the industry's Unsplash photos (credited below).
 */
export default async function ThemePreviewPage({ params }: PageProps<"/themes/[key]/preview">) {
  const t = findTheme((await params).key);
  if (!t) notFound();
  const [live, category, extra] = await Promise.all([livePreviewUrls([t]), getCategoryImage(t.industry), industryUnsplashPhotos(t.industry, 7)]);
  const liveUrl = live.get(t.key) ?? null;
  const photos: SamplePhoto[] = [
    { url: category.url.replace(/w=800&h=500/, "w=1600&h=900"), alt: category.alt },
    ...extra.filter((p) => !category.url.startsWith(p.base.split("?")[0]!)).map((p) => ({ url: sizedUnsplashUrl(p.base, 640), alt: p.alt })),
  ];
  const credits = [category.photographer?.name, ...extra.map((p) => p.photographer?.name)].filter((n): n is string => !!n);

  return (
    <section className="bg-gradient-to-b from-brand-soft/60 to-white pt-6 pb-14" aria-labelledby="preview-title">
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href={`/themes/${t.key}`} className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand">
              <ArrowLeft aria-hidden className="size-4" /> Theme details
            </Link>
            <h1 id="preview-title" className="mt-1 font-brand text-2xl font-extrabold tracking-tight text-brand-ink sm:text-3xl">
              {t.name} <span className="font-semibold text-muted">· {industryShort(t.industry)}</span>
            </h1>
          </div>
          <ButtonLink href={`/themes/${t.key}/use`} prefetch={false} track={{ id: `use_${t.key}`, location: "theme_preview" }}>
            Use This Theme
          </ButtonLink>
        </div>
        <div className="mt-5">
          <ThemePreviewStage liveUrl={liveUrl} title={`${t.name} theme preview`} sample={<ThemeSampleStore theme={t} photos={photos} />} />
        </div>
        <p className="mt-4 text-xs text-muted">
          Your own text, images and products replace the samples.
          {!liveUrl && photos.length ? (
            <>
              {" "}
              Sample photos from{" "}
              <a href={category.unsplashUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                Unsplash
              </a>
              {credits.length ? ` by ${[...new Set(credits)].slice(0, 6).join(", ")}` : ""}.
            </>
          ) : null}
        </p>
      </Container>
    </section>
  );
}
