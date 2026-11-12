import { notFound } from "next/navigation";
import { requireStorefront } from "@/features/storefront/server/context";
import { redirectOrNotFound } from "@/features/storefront/server/redirects";
// INFORMATIVE: branch point — see docs/informative/PLAN.md (/:customPageSlug)
import { informativeTenantFor } from "@/features/informative/public/branch";
import { informativeRoute } from "@/features/informative/public/paths";

/** Unknown storefront paths: honour the store's URL redirects, else 404. */
export default async function StoreCatchAll({ params }: PageProps<"/store/[host]/[...rest]">) {
  const { host, rest } = await params;
  // INFORMATIVE: branch point. A custom page of an Informative Website, else 404.
  const info = await informativeTenantFor(host);
  if (info) {
    const route = informativeRoute(`/${rest.join("/")}`);
    if (route?.kind !== "custom" && route?.kind !== "privacy") notFound();
    const { InformativeRoutePage } = await import("@/features/informative/public/render");
    return <InformativeRoutePage tenant={info} route={route} />;
  }
  const sf = await requireStorefront(host);
  return redirectOrNotFound(sf.tenant.tenantId, `/${rest.map(encodeURIComponent).join("/")}`);
}
