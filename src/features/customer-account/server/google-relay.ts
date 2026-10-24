import "server-only";
import { publicEnv } from "@/lib/env/public";
import { platformHostAliases } from "@/lib/platform/hosts";
import { classifyHost } from "@/lib/tenant/host";
import { tenantDirectory } from "@/lib/tenant/directory";
import { safeRedirectPath } from "@/lib/http/safe-redirect";

/**
 * Store (shopper) Google sign-in relayed through the platform host.
 *
 * Supabase only returns to redirect URLs on its allow-list, and store subdomains aren't on it, so
 * a Google sign-in started on a store never came back ("Google doesn't work" on storefronts). The
 * relay starts and finishes the OAuth flow on the platform (already allowed), then hands the shopper
 * back to THEIR store with a single-use sign-in token, verified by the store's own
 * /account/auth/callback (which links the existing customer profile by email, or creates one).
 */

const HOST_RE = /^[a-z0-9.-]{3,253}(:\d{2,5})?$/;

/** The store host to return to, only if it is a store we serve (never a foreign host). */
export async function verifiedStoreHost(raw: string | null): Promise<string | null> {
  const host = (raw ?? "").trim().toLowerCase();
  if (!HOST_RE.test(host)) return null;
  const c = classifyHost(host, publicEnv().NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN, platformHostAliases());
  if (c.kind !== "store-subdomain" && c.kind !== "custom-domain") return null;
  const tenant = await tenantDirectory.findByHost(c.host).catch(() => null);
  return tenant ? host : null;
}

/** Store path to land on after sign-in (defaults to the customer's profile). Pure. */
export function relayNext(raw: string | null): string {
  return safeRedirectPath(raw, "/account");
}

/** Platform callback URL for the relay (host + next travel in the query). Pure. */
export function relayCallbackUrl(platform: string, host: string, next: string): string {
  const u = new URL("/auth/store-google/callback", platform);
  u.searchParams.set("host", host);
  u.searchParams.set("next", next);
  return u.toString();
}

/** The store's own callback with a single-use token hash (type "email"). Pure. */
export function storeHandoffUrl(storeOriginUrl: string, tokenHash: string, next: string): string {
  const u = new URL("/account/auth/callback", storeOriginUrl);
  u.searchParams.set("token_hash", tokenHash);
  u.searchParams.set("type", "email");
  u.searchParams.set("next", next);
  return u.toString();
}
