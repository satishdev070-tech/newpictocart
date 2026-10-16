import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMarketingMetadata, faqJsonLd, organizationJsonLd, serializeJsonLd, softwareApplicationJsonLd } from "@/features/marketing-site/seo";
import { siteOrigin } from "@/features/marketing-site/site";
import { getMarketingPlans } from "@/features/marketing-site/server/plans";
import { livePreviewUrls } from "@/features/marketing-site/server/themes";
import { getCategoryImages } from "@/lib/unsplash";
import { getLandingContent } from "@/features/marketing-site/server/landing";
import { findTheme, showcaseThemes } from "@/features/marketing-site/themes";
import { MARKETPLACE_THEMES } from "@/features/theme/marketplace/catalog";
import { stripHighlights, type SectionKey } from "@/features/marketing-site/landing";
import {
  Features,
  LandingCategories,
  LandingCta,
  LandingFaq,
  LandingHero,
  LandingPricing,
  LandingThemes,
  Solutions,
  Steps,
  Testimonials,
  TrustStrip,
} from "@/features/marketing-site/components/landing-sections";

export const revalidate = 3600;

/** Industries featured in the theme showcase (one theme each, from the real catalogue). */
const SHOWCASE_INDUSTRIES = ["fashion", "gourmet", "jewellery", "beauty", "furniture", "electronics", "handicrafts", "general"];
const HERO_THEME = "contemporary-ethnic";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getLandingContent();
  return buildMarketingMetadata({ title: stripHighlights(seo.title), absoluteTitle: true, description: seo.description, path: "/", origin: siteOrigin() });
}

/**
 * Home page. Every section, its order and visibility come from the landing CMS
 * (/admin/landing); themes and plans come from the live catalogue and the Plans console.
 */
export default async function HomePage() {
  const origin = siteOrigin();
  const content = await getLandingContent();
  const themes = showcaseThemes(SHOWCASE_INDUSTRIES).slice(0, content.themes.count);
  const hero = findTheme(HERO_THEME) ?? themes[0];
  const [plans, previews, themeImages] = await Promise.all([
    getMarketingPlans(),
    livePreviewUrls([...themes, ...(hero ? [hero] : [])]),
    // Category photo per showcase theme, shown when the theme has no captured screenshot.
    getCategoryImages(themes.map((t) => t.industry)),
  ]);
  const tokens = { themes: MARKETPLACE_THEMES.length };
  // Hero fallback slideshow (when the CMS has no slides or image): the hero theme, then the showcase.
  const heroThemes = [...(hero ? [hero] : []), ...themes.filter((t) => t.key !== hero?.key)].slice(0, 4);

  const sections: Record<SectionKey, () => ReactNode> = {
    hero: () => <LandingHero content={content.hero} themes={heroThemes} tokens={tokens} />,
    trust: () => <TrustStrip content={content.trust} />,
    solutions: () => <Solutions content={content.solutions} />,
    steps: () => <Steps content={content.steps} />,
    faq: () => <LandingFaq content={content.faq} />,
    features: () => <Features content={content.features} />,
    themes: () => <LandingThemes content={content.themes} themes={themes} previews={previews} images={themeImages} />,
    categories: () => <LandingCategories content={content.categories} />,
    pricing: () => <LandingPricing content={content.pricing} plans={plans} />,
    testimonials: () => <Testimonials content={content.testimonials} />,
    cta: () => <LandingCta content={content.cta} />,
  };
  const visible = content.order.filter((key) => content[key].enabled);
  const faqs = content.faq.enabled ? content.faq.items : [];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd([organizationJsonLd(origin), softwareApplicationJsonLd(origin, plans), ...(faqs.length ? [faqJsonLd(faqs)] : [])]) }} />
      {visible.map((key) => (
        <div key={key} data-section={key}>
          {sections[key]()}
        </div>
      ))}
    </>
  );
}
