import type { Metadata } from "next";
import { after } from "next/server";
import { getRenderContext } from "@/features/theme/render/load";
import { ThemeSlot } from "@/features/theme/render/slot";
import { buildPageMetadata, jsonLdString, toDescription, websiteJsonLd } from "@/features/storefront/seo";
import { canonicalUrl } from "@/features/storefront/urls";
import { assetUrl } from "@/lib/storage/assets";
import { trackStoreEvent } from "@/features/storefront/server/events";
import type { ThemeConfig, ThemePage } from "@/features/theme/schema/config";

/** The site-builder page chosen as the homepage (Pages panel → Set as homepage), if any. */
function homePage(theme: ThemeConfig): ThemePage | null {
  return (theme.homePageId && theme.pages.find((p) => p.id === theme.homePageId)) || null;
}

export async function generateMetadata({ params }: PageProps<"/store/[host]">): Promise<Metadata> {
  const { host } = await params;
  const { sf } = await getRenderContext(host);
  // A site-builder page set as the homepage contributes its own SEO fields when it has them.
  const home = homePage(sf.theme);
  const title = home?.seoTitle || sf.store.seo.title || sf.store.name;
  const meta = buildPageMetadata({
    primaryHost: sf.tenant.primaryHost,
    path: "/",
    title,
    description: toDescription(home?.seoDescription || sf.store.seo.description || sf.store.tagline),
    imageUrl: assetUrl(home?.socialImagePath || sf.store.seo.ogImagePath),
    siteName: sf.store.name,
    noindex: sf.preview || Boolean(home?.noindex),
  });
  // Absolute: the store's home title must not pick up the platform's "… · Pictocart" template.
  return { ...meta, title: { absolute: title } };
}

export default async function StorefrontHome({ params }: PageProps<"/store/[host]">) {
  const { host } = await params;
  const ctx = await getRenderContext(host);
  const { sf } = ctx;
  const home = homePage(sf.theme);
  after(() => trackStoreEvent({ tenantId: sf.tenant.tenantId, name: "page_view", path: "/" }));
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: sf.store.name,
    url: canonicalUrl(sf.tenant.primaryHost, "/"),
    logo: assetUrl(sf.store.logoPath) ?? undefined,
    sameAs: sf.store.social.map((s) => s.url),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(org) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(websiteJsonLd(sf.tenant.primaryHost, sf.store.name)) }} />
      <h1 className="sr-only">{sf.store.name}</h1>
      {/* Same slot either way, so the builder can switch the homepage without reloading the canvas. */}
      {home ? <ThemeSlot slot="templates.home" list={`pages.${home.id}`} sections={home.sections} ctx={ctx} /> : <ThemeSlot slot="templates.home" sections={sf.theme.templates.home} ctx={ctx} />}
    </>
  );
}
