import "server-only";
import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import type { ResolvedTenant } from "@/lib/tenant/context";

/**
 * Storefront branch helper (light: no informative UI is imported here). The verified host's tenant
 * when it is an Informative Website, else null (every Online Store, and anything unresolved).
 * resolveStorefrontTenant is memoised per request, so store pages pay nothing extra.
 */
export async function informativeTenantFor(host: string): Promise<ResolvedTenant | null> {
  const t = await resolveStorefrontTenant(host);
  return t?.websiteType === "INFORMATIVE" ? t : null;
}
