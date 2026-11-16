import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/layout";
import { demoContent } from "@/features/informative/demo";
import { defaultPageSections } from "@/features/informative/defaults";
import { Customizer } from "@/features/informative/panel/customizer";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { getCustomizeOptions, getSite, listPages } from "@/features/informative/server/repo";
import { heroText, toLayout } from "@/features/informative/site/customize";
import { INFORMATIVE_THEMES, themeOrDefault } from "@/features/informative/themes/registry";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { assetUrl } from "@/lib/storage/assets";

export const metadata: Metadata = { title: "Customize website" };

/** Live Customizer (theme.edit): design, colours, fonts, logo/favicon, hero and home sections. */
export default async function InformativeCustomizePage() {
  const ctx = await requireInformativeTenant();
  if (!ctx.permissions.has("theme.edit")) redirect("/informative/dashboard");
  const [site, pages, options] = await Promise.all([getSite(ctx), listPages(ctx), getCustomizeOptions(ctx)]);
  if (!site) redirect("/informative/dashboard");
  const home = pages.find((p) => p.type === "HOME");
  const homeSections = home?.sections.length ? home.sections : defaultPageSections(themeOrDefault(site.themeId), "HOME");
  const hero = heroText(homeSections);
  return (
    <>
      <PageHeader title="Customize website" description="Change how your website looks and see it update on the right. Save when you're happy." />
      <Customizer
        initial={{
          themeId: themeOrDefault(site.themeId).id,
          primaryColor: site.primaryColor,
          secondaryColor: site.secondaryColor,
          fontPair: site.fontPair,
          logoPath: site.logoPath,
          faviconPath: site.faviconPath,
          heroImagePath: site.heroImagePath,
          ctaLabel: options.ctaLabel ?? "",
          heroHeading: hero.heading,
          heroSubheading: hero.subheading,
          layout: toLayout(homeSections),
        }}
        images={{ logo: assetUrl(site.logoPath), favicon: assetUrl(site.faviconPath), hero: assetUrl(site.heroImagePath) }}
        themes={INFORMATIVE_THEMES.map((t) => ({
          id: t.id,
          name: t.name,
          bestFor: t.bestFor,
          primary: t.tokens.colors.primary,
          secondary: t.tokens.colors.secondary,
          background: t.tokens.colors.background,
          defaultSections: [...t.defaultSections],
        }))}
        canEditContent={ctx.permissions.has("content.write") && Boolean(home)}
        homeHasSections={Boolean(home?.sections.length)}
        storedSectionIds={home?.sections.map((s) => s.id) ?? []}
        placeholders={{ heading: site.businessName, subheading: site.tagline ?? "", ctaLabel: demoContent(site.category).ctaLabel }}
        status={site.status}
        canPublish={ctx.permissions.has("theme.publish")}
        liveUrl={storeOrigin(storeSubdomain(ctx.tenantSlug))}
      />
    </>
  );
}
