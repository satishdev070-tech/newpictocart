import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMarketingMetadata, faqJsonLd, organizationJsonLd, serializeJsonLd, softwareApplicationJsonLd } from "@/features/marketing-site/seo";
import { siteOrigin } from "@/features/marketing-site/site";
import { getMarketingPlans } from "@/features/marketing-site/server/plans";
import { getLandingContent } from "@/features/marketing-site/server/landing";
import { findTheme, SHOWCASE_INDUSTRIES, showcaseThemes } from "@/features/marketing-site/themes";
import { MARKETPLACE_THEME_COUNT } from "@/features/theme/marketplace/catalog";
import { themeCardImage } from "@/features/theme/layouts/imagery";
import { stripHighlights, themesShown, type SectionKey } from "@/features/marketing-site/landing";
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
  // One theme per industry; the CMS sets how many (default 8 = two rows of four).
  const themes = showcaseThemes(SHOWCASE_INDUSTRIES).slice(0, themesShown(content.themes));
  const hero = findTheme(HERO_THEME) ?? themes[0];
  const plans = await getMarketingPlans();
  // Per-theme hero (rotated stock), shown when the theme has no captured screenshot.
  const themeImages = new Map(themes.flatMap((t) => {
    const img = themeCardImage(t);
    return img ? [[t.key, img] as const] : [];
  }));
  const tokens = { themes: MARKETPLACE_THEME_COUNT };
  // Hero fallback slideshow (when the CMS has no slides or image): the hero theme, then the showcase.
  const heroThemes = [...(hero ? [hero] : []), ...themes.filter((t) => t.key !== hero?.key)].slice(0, 4);

  const sections: Record<SectionKey, () => ReactNode> = {
    hero: () => <LandingHero content={content.hero} themes={heroThemes} tokens={tokens} />,
    trust: () => <TrustStrip content={content.trust} />,
    solutions: () => <Solutions content={content.solutions} />,
    steps: () => <Steps content={content.steps} />,
    faq: () => <LandingFaq content={content.faq} />,
    features: () => <Features content={content.features} />,
    themes: () => <LandingThemes content={content.themes} themes={themes} images={themeImages} />,
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
