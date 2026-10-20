import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getRenderContext } from "@/features/theme/render/load";
import { getPageBySlug, type PageContent } from "@/features/storefront/server/content";
import { redirectOrNotFound } from "@/features/storefront/server/redirects";
import { buildPageMetadata } from "@/features/storefront/seo";
import { paths } from "@/features/storefront/urls";
import { ContentBlocks } from "@/features/storefront/components/content-blocks";
import { ContactPanel } from "@/features/storefront/components/contact-form";
import { Breadcrumbs } from "@/features/storefront/components/breadcrumbs";
import { TemplateFrame, ThemeSlot } from "@/features/theme/render/slot";
import { CanvasSlot } from "@/features/theme/site-builder/canvas/canvas-slot";
import { assetUrl } from "@/lib/storage/assets";
import type { Storefront } from "@/features/storefront/server/context";

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
  if (!page && (slug === "about" || slug === "contact")) {
    const title = slug === "about" ? "About" : "Contact";
    const description = slug === "about" ? sf.store.description?.trim() || `${sf.store.name} is an independent store.` : `Send a message to ${sf.store.name}.`;
    return buildPageMetadata({
      primaryHost: sf.tenant.primaryHost,
      path: paths.page(slug),
      title,
      description: description.slice(0, 320),
      siteName: sf.store.name,
      noindex: sf.preview,
    });
  }
  if (!page) return {};
  return buildPageMetadata({ primaryHost: sf.tenant.primaryHost, path: paths.page(page.slug), title: page.seo.title || page.title, description: page.seo.description, siteName: sf.store.name, noindex: page.seo.noindex });
}

function PageArticle({ ctx, title, slug, children }: { ctx: Awaited<ReturnType<typeof getRenderContext>>; title: string; slug: string; children: ReactNode }) {
  const { sf } = ctx;
  return (
    <TemplateFrame template="page" ctx={ctx}>
      <article className="sf-container sf-section mx-auto max-w-3xl space-y-6">
        <Breadcrumbs primaryHost={sf.tenant.primaryHost} items={[{ name: "Home", path: "/" }, { name: title, path: paths.page(slug) }]} />
        <h1 className="sf-heading text-4xl">{title}</h1>
        {children}
      </article>
    </TemplateFrame>
  );
}

function withPreview(sf: Storefront, slug: string, content: ReactNode) {
  const safeHandle = /^[a-z0-9][a-z0-9-]{0,59}$/.test(slug) ? slug : null;
  return sf.preview && safeHandle ? <CanvasSlot slot={`handle.${safeHandle}`}>{content}</CanvasSlot> : content;
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
  if (!page && slug === "about") {
    const text = sf.store.description?.trim() || `${sf.store.name} is an independent store.`;
    return withPreview(
      sf,
      slug,
      <PageArticle ctx={ctx} title="About" slug="about">
        <p className="whitespace-pre-line leading-relaxed">{text}</p>
      </PageArticle>,
    );
  }
  if (!page && slug === "contact") {
    return withPreview(
      sf,
      slug,
      <PageArticle ctx={ctx} title="Contact" slug="contact">
        <ContactPanel storeName={sf.store.name} address={sf.store.address} intro={<p className="leading-relaxed">Send a message and {sf.store.name} will get back to you.</p>} />
      </PageArticle>,
    );
  }
  // Theme preview: a page added in the site builder but not saved yet has no server copy. Give the
  // canvas a slot addressed by handle so it can render the unsaved page here.
  const safeHandle = /^[a-z0-9][a-z0-9-]{0,59}$/.test(slug) ? slug : null;
  if (!page && sf.preview && safeHandle) return <CanvasSlot slot={`handle.${safeHandle}`}>{null}</CanvasSlot>;
  if (!page) return redirectOrNotFound(sf.tenant.tenantId, paths.page(slug));
  return withPreview(sf, slug, <PublishedPage ctx={ctx} page={page} />);
}

function PublishedPage({ ctx, page }: { ctx: Awaited<ReturnType<typeof getRenderContext>>; page: PageContent }) {
  const { sf } = ctx;
  const showContact = page.slug === "contact" || page.kind === "contact";
  return (
    <PageArticle ctx={ctx} title={page.title} slug={page.slug}>
      <ContentBlocks blocks={page.blocks} />
      {showContact ? <ContactPanel storeName={sf.store.name} address={sf.store.address} /> : null}
    </PageArticle>
  );
}
