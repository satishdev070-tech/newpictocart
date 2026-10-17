import { publicEnv } from "@/lib/env/public";

/** Origin of the platform app (seller dashboard, auth emails). */
export function platformOrigin(): string {
  const env = publicEnv();
  if (env.NEXT_PUBLIC_PLATFORM_URL) return env.NEXT_PUBLIC_PLATFORM_URL.replace(/\/$/, "");
  const root = env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN;
  return root === "localhost" ? "http://localhost:3000" : `https://${root}`;
}

/** Public URL of a storefront host (http for *.localhost in development). */
export function storeOrigin(host: string): string {
  if (host === "localhost" || host.endsWith(".localhost")) {
    // Local dev: same port as the platform app (NEXT_PUBLIC_PLATFORM_URL=http://localhost:3001 → :3001).
    const m = /^http:\/\/localhost:(\d+)/.exec(publicEnv().NEXT_PUBLIC_PLATFORM_URL ?? "");
    return `http://${host}:${m?.[1] ?? "3000"}`;
  }
  return `https://${host}`;
}

/** Platform subdomain for a store slug. */
export function storeSubdomain(slug: string): string {
  return `${slug}.${publicEnv().NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN}`;
}
