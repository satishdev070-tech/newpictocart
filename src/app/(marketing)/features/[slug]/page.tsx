import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildMarketingMetadata } from "@/features/marketing-site/seo";
import { siteOrigin } from "@/features/marketing-site/site";
import { FeaturePageView } from "@/features/marketing-site/components/feature-page-view";
import { DEFAULT_FEATURE_PAGES } from "@/features/marketing-site/feature-pages";
import { getFeaturePage, getFeaturePages } from "@/features/marketing-site/server/feature-pages";

export const revalidate = 300;

export async function generateStaticParams() {
  const doc = await getFeaturePages();
  return doc.pages.filter((p) => p.published).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getFeaturePage(slug);
  if (!page) return { title: "Feature" };
  return buildMarketingMetadata({
    title: page.seoTitle || page.title,
    description: page.seoDescription || page.summary,
    path: `/features/${page.slug}`,
    origin: siteOrigin(),
  });
}

export default async function FeatureDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getFeaturePage(slug);
  if (!page) {
    // Fallback: allow seed pages even if cache empty
    const seed = DEFAULT_FEATURE_PAGES.pages.find((p) => p.slug === slug && p.published);
    if (!seed) notFound();
    return <FeaturePageView page={seed} />;
  }
  return <FeaturePageView page={page} />;
}
