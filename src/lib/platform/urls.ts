import { platformHostAliases } from "./hosts";
import { publicEnv } from "@/lib/env/public";

/** Origin of the platform app (seller dashboard, auth emails). */
export function platformOrigin(): string {
  const env = publicEnv();
  if (env.NEXT_PUBLIC_PLATFORM_URL) return env.NEXT_PUBLIC_PLATFORM_URL.replace(/\/$/, "");
  const root = env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN;
  return root === "localhost" ? "http://localhost:3000" : `https://${root}`;
}

/** Public URL of a storefront host (http for *.localhost in development). */
export function storeOrigin(host: string, platformUrl?: string | null): string {
  if (host === "localhost" || host.endsWith(".localhost")) {
    // Local dev: same port as the platform app (NEXT_PUBLIC_PLATFORM_URL=http://localhost:3001 → :3001).
    const from = platformUrl === undefined ? publicEnv().NEXT_PUBLIC_PLATFORM_URL : platformUrl;
    const m = /^https?:\/\/localhost:(\d+)/.exec(from ?? "");
    return `http://${host}:${m?.[1] ?? "3000"}`;
  }
  return `https://${host}`;
}

/**
 * Address the live preview can load. The platform path `/store/{host}` is rejected unless the
 * request host is that store, so the iframe must open the store host itself.
 */
export function storefrontPreviewUrl(host: string, platformUrl?: string | null): string {
  return `${storeOrigin(host, platformUrl)}/`;
}

/** Platform subdomain for a store slug. */
export function storeSubdomain(slug: string): string {
  return `${slug}.${publicEnv().NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN}`;
}

/**
 * Origins the site builder may run on (the canvas accepts messages only from these): the platform
 * URL, the root domain with and without "www.", and configured / Vercel host aliases. Same list as
 * the store's frame-ancestors policy. Server only (reads PLATFORM_HOST_ALIASES).
 */
export function builderParentOrigins(): string[] {
  const env = publicEnv();
  const origin = platformOrigin();
  const out = new Set([origin]);
  const root = env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN;
  if (root && root !== "localhost") {
    out.add(`https://${root}`);
    out.add(`https://www.${root}`);
  }
  for (const host of platformHostAliases()) out.add(host.startsWith("localhost") || host.endsWith(".localhost") ? `http://${host}` : `https://${host}`);
  return [...out];
}
