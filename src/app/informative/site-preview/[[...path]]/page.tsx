import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { informativeRoute } from "@/features/informative/public/paths";
import { InformativeRoutePage } from "@/features/informative/public/render";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { storeSubdomain } from "@/lib/platform/urls";

export const metadata: Metadata = { title: "Website preview", robots: { index: false, follow: false } };

/**
 * Owner / staff preview of the website exactly as publishing will show it, drafts included
 * ("Preview renders the draft in a new tab"). Platform host + the member's own session (RLS
 * store.read), so no secret-key client and no cross-domain cookie is involved.
 */
export default async function InformativeSitePreviewPage({ params }: PageProps<"/informative/site-preview/[[...path]]">) {
  const ctx = await requireInformativeTenant();
  const { path } = await params;
  const route = informativeRoute(`/${(path ?? []).join("/")}`);
  if (!route) notFound();
  const host = storeSubdomain(ctx.tenantSlug);
  return (
    <InformativeRoutePage
      tenant={{ tenantId: ctx.tenantId, slug: ctx.tenantSlug, name: ctx.tenantName, status: ctx.tenantStatus, host, primaryHost: host, websiteType: "INFORMATIVE" }}
      route={route}
      mode={{ kind: "preview", base: "/informative/site-preview" }}
    />
  );
}
