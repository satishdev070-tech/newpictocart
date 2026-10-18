import type { Metadata } from "next";
import { getRenderContext } from "@/features/theme/render/load";
import { getPageBySlug } from "@/features/storefront/server/content";
import { redirectOrNotFound } from "@/features/storefront/server/redirects";
import { buildPageMetadata } from "@/features/storefront/seo";
import { paths } from "@/features/storefront/urls";
import { ContentBlocks } from "@/features/storefront/components/content-blocks";
import { Breadcrumbs } from "@/features/storefront/components/breadcrumbs";
import { TemplateFrame, ThemeSlot } from "@/features/theme/render/slot";
import { CanvasSlot } from "@/features/theme/site-builder/canvas/canvas-slot";
import { assetUrl } from "@/lib/storage/assets";

export async function generateMetadata({ params }: PageProps<"/store/[host]/pages/[slug]">): Promise<Metadata> {
  const { host, slug } = await params;
  const { sf } = await getRenderContext(host);
  const built = sf.theme.pages.find((p) => p.handle === slug);
  if (built) {
    return buildPageMetadata({
      primaryHost: sf.tenant.primaryHost,
      path: paths.page(built.handle),
      // The homepage is also reachable here; search engines should index it once, at "/".
      canonical: sf.theme.homePageId === built.id ? "/" : undefined,
      title: built.seoTitle || built.title,
      description: built.seoDescription || undefined,
      imageUrl: assetUrl(built.socialImagePath),
      siteName: sf.store.name,
      noindex: sf.preview || built.noindex,
    });
  }
  const page = await getPageBySlug(sf.tenant.tenantId, slug);
  if (!page) return {};
  return buildPageMetadata({ primaryHost: sf.tenant.primaryHost, path: paths.page(page.slug), title: page.seo.title || page.title, description: page.seo.description, siteName: sf.store.name, noindex: page.seo.noindex });
}

export default async function StorePage({ params }: PageProps<"/store/[host]/pages/[slug]">) {
  const { host, slug } = await params;
  const ctx = await getRenderContext(host);
  const { sf } = ctx;
  // Pages built in the site builder (theme document) take precedence over content pages.
  const built = sf.theme.pages.find((p) => p.handle === slug);
  if (built) {
    return (
      <>
        <h1 className="sr-only">{built.title}</h1>
        <ThemeSlot slot={`pages.${built.id}`} sections={built.sections} ctx={ctx} />
      </>
    );
  }
  const page = await getPageBySlug(sf.tenant.tenantId, slug);
  // Theme preview: a page added in the site builder but not saved yet has no server copy. Give the
  // canvas a slot addressed by handle so it can render the unsaved page here.
  const safeHandle = /^[a-z0-9][a-z0-9-]{0,59}$/.test(slug) ? slug : null;
  if (!page && sf.preview && safeHandle) return <CanvasSlot slot={`handle.${safeHandle}`}>{null}</CanvasSlot>;
  if (!page) return redirectOrNotFound(sf.tenant.tenantId, paths.page(slug));
  const content = (
    <TemplateFrame template="page" ctx={ctx}>
      <article className="sf-container sf-section mx-auto max-w-3xl space-y-6">
        <Breadcrumbs primaryHost={sf.tenant.primaryHost} items={[{ name: "Home", path: "/" }, { name: page.title, path: paths.page(page.slug) }]} />
        <h1 className="sf-heading text-4xl">{page.title}</h1>
        <ContentBlocks blocks={page.blocks} />
      </article>
    </TemplateFrame>
  );
  return sf.preview && safeHandle ? <CanvasSlot slot={`handle.${safeHandle}`}>{content}</CanvasSlot> : content;
}
