import type { Metadata } from "next";
import { requireStorefront } from "@/features/storefront/server/context";
import { redirectOrNotFound } from "@/features/storefront/server/redirects";
import { informativeTenantFor } from "@/features/informative/public/branch";

/**
 * INFORMATIVE: new public route (docs/informative/PLAN.md). Informative Websites render the Gallery page; for an
 * Online Store this path behaves exactly as before this route existed: the store's own URL
 * redirects, else 404 (same helper as the catch-all).
 */
export async function generateMetadata({ params }: PageProps<"/store/[host]/gallery">): Promise<Metadata> {
  const p = await params;
  const info = await informativeTenantFor(p.host);
  if (!info) return {};
  return (await import("@/features/informative/public/render")).informativeRouteMetadata(info, { kind: "gallery" });
}

export default async function Page({ params }: PageProps<"/store/[host]/gallery">) {
  const p = await params;
  const info = await informativeTenantFor(p.host);
  if (info) {
    const { InformativeRoutePage } = await import("@/features/informative/public/render");
    return <InformativeRoutePage tenant={info} route={{ kind: "gallery" }} />;
  }
  const sf = await requireStorefront(p.host);
  return redirectOrNotFound(sf.tenant.tenantId, "/gallery");
}
