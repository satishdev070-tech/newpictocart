import "server-only";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { informativeFontVariables } from "@/app/informative-fonts";
import { buildPageMetadata, jsonLdString, sitemapXml, toDescription, type SitemapEntry } from "@/features/storefront/seo";
import { canonicalUrl } from "@/features/storefront/urls";
import { assetUrl } from "@/lib/storage/assets";
import { INTERNAL_PATH_HEADER } from "@/lib/tenant/routing";
import type { ResolvedTenant } from "@/lib/tenant/context";
import { defaultPageSections } from "../defaults";
import { informativeFlagMode, informativeFlagOn } from "../flag";
import type { PageSection } from "../sections";
import { getDraftSite, getPublishedSite, type SiteBundle } from "../server/public";
import { InformativeSite } from "../site/renderer";
import { ServiceDetail } from "../site/service-detail";
import { WhatsAppBeacon } from "./whatsapp-beacon";
import { buildSiteView } from "../site/view";
import { themeOrDefault } from "../themes/registry";
import { informativeRoute, routePath, type InformativeRoute } from "./paths";

/**
 * Public Informative Website rendering (docs/informative/PLAN.md "Public site"). Imported lazily
 * (`await import`) by the storefront's branch points, so Online Store requests never evaluate it.
 */

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** The owner's preview never sends enquiries. */
const PREVIEW_FORM_NOTE = "Preview: the enquiry form works on your live website.";

function privacyText(name: string): string {
  return [
    `${name} uses the details you send through this website's enquiry form (your name, phone number, email address and message) only to reply to your enquiry and arrange the service you asked about.`,
    "We don't sell your details or share them with anyone else for marketing. We keep enquiries only as long as we need them to help you, and you can ask us to delete yours at any time using the contact details on this website.",
  ].join("\n\n");
}

function Plain({ title, text }: { title: string; text: string }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="text-muted">{text}</p>
    </main>
  );
}

/**
 * Storefront layout branch for INFORMATIVE tenants: flag off → maintenance (never broken, never the
 * store UI); any store-only path → 404; DRAFT → "coming soon"; otherwise the page renders the site.
 */
export async function InformativeStoreGate({ tenant, children }: { tenant: ResolvedTenant; children: ReactNode }) {
  if (!informativeFlagOn(informativeFlagMode())) return <Plain title={tenant.name} text="This website is being updated. Please check back soon." />;
  const path = (await headers()).get(INTERNAL_PATH_HEADER);
  if (path !== null && !informativeRoute(path)) notFound();
  const bundle = await getPublishedSite(tenant.tenantId);
  if (!bundle) return <Plain title={tenant.name} text="Coming soon. This website is getting ready to open." />;
  return <>{children}</>;
}

export async function informativeLayoutMetadata(tenant: ResolvedTenant): Promise<Metadata> {
  const bundle = informativeFlagOn(informativeFlagMode()) ? await getPublishedSite(tenant.tenantId) : null;
  if (!bundle) return { title: { absolute: `${tenant.name} · Coming soon` }, robots: { index: false, follow: false } };
  const icon = assetUrl(bundle.site.faviconPath) ?? assetUrl(bundle.site.logoPath);
  return {
    metadataBase: new URL(canonicalUrl(tenant.primaryHost, "/")),
    title: { default: bundle.site.seo.title || bundle.site.businessName, template: `%s · ${bundle.site.businessName}` },
    applicationName: bundle.site.businessName,
    icons: icon ? { icon } : undefined,
    robots: tenant.host !== tenant.primaryHost ? { index: false, follow: true } : undefined,
  };
}

type Mode = { kind: "public" } | { kind: "preview"; base: string };

function linkFor(mode: Mode) {
  return mode.kind === "public" ? (p: string) => p : (p: string) => `${mode.base}${p === "/" ? "" : p}`;
}

type Resolved = { title: string | null; sections: PageSection[]; seo: { title: string | null; description: string | null; image: string | null }; serviceSlug?: string };

function resolve(bundle: SiteBundle, route: InformativeRoute): Resolved | null {
  const theme = themeOrDefault(bundle.site.themeId);
  const byType = (t: string) => bundle.pages.find((p) => p.type === t) ?? null;
  const pageSeo = (p: { seo: { title: string | null; description: string | null } } | null) => ({ title: p?.seo.title ?? null, description: p?.seo.description ?? null, image: null });
  switch (route.kind) {
    case "home": {
      const p = byType("HOME");
      return { title: null, sections: p?.sections.length ? p.sections : defaultPageSections(theme, "HOME"), seo: pageSeo(p) };
    }
    case "about":
    case "services":
    case "contact": {
      const p = byType(route.kind.toUpperCase());
      if (!p) return null;
      if (route.kind === "services" && !bundle.services.length) return null;
      return { title: p.title, sections: p.sections, seo: pageSeo(p) };
    }
    case "gallery":
      return bundle.gallery.length ? { title: "Gallery", sections: [{ id: "gallery-0", type: "gallery", props: {}, order: 0, visible: true }], seo: { title: null, description: null, image: null } } : null;
    case "privacy":
      return {
        title: "Privacy",
        sections: [{ id: "privacy-0", type: "rich_text", props: { text: bundle.site.options.privacyText || privacyText(bundle.site.businessName) }, order: 0, visible: true }],
        seo: { title: "Privacy", description: null, image: null },
      };
    case "custom": {
      const p = bundle.pages.find((x) => x.type === "CUSTOM" && x.slug === route.slug);
      return p ? { title: p.title, sections: p.sections, seo: pageSeo(p) } : null;
    }
    case "service": {
      const s = bundle.services.find((x) => x.slug === route.slug);
      if (!s) return null;
      const cta: PageSection[] = [
        { id: "enquiry-0", type: "enquiry_form", props: { heading: `Ask about ${s.name}`, serviceId: s.id }, order: 0, visible: true },
        { id: "testimonials-0", type: "testimonials", props: {}, order: 1, visible: true },
      ];
      return { title: s.name, sections: cta, seo: { title: s.seo.title, description: s.seo.description ?? s.shortDescription, image: assetUrl(s.imagePath) }, serviceSlug: s.slug };
    }
  }
}

function localBusinessLd(tenant: ResolvedTenant, b: SiteBundle) {
  const s = b.site;
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: s.businessName,
    description: s.tagline ?? s.about ?? undefined,
    url: canonicalUrl(tenant.primaryHost, "/"),
    image: assetUrl(s.heroImagePath) ?? assetUrl(s.logoPath) ?? undefined,
    logo: assetUrl(s.logoPath) ?? undefined,
    telephone: s.contact.phone ?? undefined,
    email: s.contact.email ?? undefined,
    address: s.contact.city || s.contact.address ? { "@type": "PostalAddress", streetAddress: s.contact.address ?? undefined, addressLocality: s.contact.city ?? undefined, addressCountry: "IN" } : undefined,
    openingHoursSpecification: s.hours.filter((h) => !h.closed).map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DAY[h.day], opens: h.open, closes: h.close })),
    sameAs: Object.values(s.socialLinks),
  };
}

function serviceLd(tenant: ResolvedTenant, b: SiteBundle, slug: string) {
  const sv = b.services.find((x) => x.slug === slug)!;
  const priced = sv.pricePaise != null && (sv.priceType === "FIXED" || sv.priceType === "STARTING_FROM");
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: sv.name,
    description: sv.shortDescription ?? sv.description ?? undefined,
    url: canonicalUrl(tenant.primaryHost, `/services/${sv.slug}`),
    provider: { "@type": "LocalBusiness", name: b.site.businessName, url: canonicalUrl(tenant.primaryHost, "/") },
    areaServed: b.site.contact.city ?? undefined,
    offers: priced ? { "@type": "Offer", priceCurrency: "INR", price: (sv.pricePaise! / 100).toFixed(2) } : undefined,
  };
}

/** Renders one public route (or the owner's draft preview of it). 404 for anything not published. */
export async function InformativeRoutePage({ tenant, route, mode = { kind: "public" } }: { tenant: ResolvedTenant; route: InformativeRoute; mode?: Mode }) {
  const bundle = mode.kind === "public" ? await getPublishedSite(tenant.tenantId) : await getDraftSite(tenant.tenantId);
  if (!bundle) notFound();
  const r = resolve(bundle, route);
  if (!r) notFound();
  const theme = themeOrDefault(bundle.site.themeId);
  const link = linkFor(mode);
  const view = buildSiteView(bundle, {
    asset: assetUrl,
    link,
    preview: mode.kind === "preview",
    formNote: PREVIEW_FORM_NOTE,
    enquiry: { successMessage: bundle.site.options.enquirySuccessMessage, showDateTime: bundle.site.options.showPreferredDateTime === true, privacyHref: link("/privacy") },
  });
  const ld: unknown[] = [];
  if (route.kind === "home" || route.kind === "contact") ld.push(localBusinessLd(tenant, bundle));
  if (r.serviceSlug) ld.push(serviceLd(tenant, bundle, r.serviceSlug));
  const service = r.serviceSlug ? bundle.services.find((s) => s.slug === r.serviceSlug)! : null;
  const banner =
    mode.kind === "preview" ? (
      <div role="status" className="bg-neutral-900 px-4 py-2 text-center text-xs text-white">
        Preview of your website{bundle.site.status === "DRAFT" ? " (draft: visitors see “coming soon”)" : ""}. <a href="/informative/dashboard" className="underline">Back to dashboard</a>
      </div>
    ) : null;
  return (
    <>
      {ld.map((x, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(x) }} />
      ))}
      <InformativeSite
        theme={theme}
        view={view}
        sections={r.sections}
        pageTitle={r.title}
        fontClassName={informativeFontVariables}
        banner={banner}
        before={service ? <ServiceDetail service={{ ...service, imageUrl: assetUrl(service.imagePath) }} view={view} contactHref="#enquiry" serviceId={service.id} /> : null}
      />
      {mode.kind === "public" ? <WhatsAppBeacon /> : null}
    </>
  );
}

export async function informativeRouteMetadata(tenant: ResolvedTenant, route: InformativeRoute): Promise<Metadata> {
  const bundle = await getPublishedSite(tenant.tenantId);
  const r = bundle ? resolve(bundle, route) : null;
  if (!bundle || !r) return { robots: { index: false, follow: false } };
  const s = bundle.site;
  const title = r.seo.title || (r.title ? r.title : s.seo.title || s.businessName);
  const meta = buildPageMetadata({
    primaryHost: tenant.primaryHost,
    path: routePath(route),
    title,
    description: toDescription(r.seo.description || s.seo.description || s.tagline || s.about),
    imageUrl: r.seo.image ?? assetUrl(s.seo.ogImagePath) ?? assetUrl(s.heroImagePath),
    siteName: s.businessName,
    noindex: tenant.host !== tenant.primaryHost,
  });
  return route.kind === "home" ? { ...meta, title: { absolute: title } } : meta;
}

/** sitemap.xml for a published Informative Website (404 while it is a draft). */
export async function informativeSitemap(tenant: ResolvedTenant): Promise<Response> {
  const bundle = informativeFlagOn(informativeFlagMode()) ? await getPublishedSite(tenant.tenantId) : null;
  if (!bundle) return new Response("Not found", { status: 404 });
  const entries: SitemapEntry[] = [{ path: "/", lastModified: bundle.site.updatedAt }];
  for (const p of bundle.pages) {
    if (p.type === "HOME") continue;
    if (p.type === "SERVICES" && !bundle.services.length) continue;
    entries.push({ path: p.type === "CUSTOM" ? `/${p.slug}` : `/${p.type.toLowerCase()}` });
  }
  for (const s of bundle.services) entries.push({ path: `/services/${s.slug}` });
  if (bundle.gallery.length) entries.push({ path: "/gallery" });
  return new Response(sitemapXml(tenant.primaryHost, entries), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

/** robots.txt: indexable only when published, on the primary host, with the flag on. */
export async function informativeRobots(tenant: ResolvedTenant): Promise<Response> {
  const bundle = informativeFlagOn(informativeFlagMode()) ? await getPublishedSite(tenant.tenantId) : null;
  const body = bundle && tenant.host === tenant.primaryHost ? `User-agent: *\nAllow: /\n\nSitemap: ${canonicalUrl(tenant.primaryHost, "/sitemap.xml")}\n` : "User-agent: *\nDisallow: /\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
