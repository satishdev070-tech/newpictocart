import { normalizeHost } from "@/lib/tenant/host";

/**
 * Hostnames, besides `{root}` and `www.{root}`, that serve the platform app. Pure (edge/node
 * safe, no `server-only`) so the proxy and unit tests share it. Every entry is an exact hostname;
 * nothing here is a suffix or wildcard, so `*.vercel.app` as a whole is never trusted.
 *
 * Sources, in order:
 *  - the host of `NEXT_PUBLIC_PLATFORM_URL` (where auth emails and OAuth callbacks send users)
 *  - `PLATFORM_HOST_ALIASES`: comma-separated bare hostnames, e.g. `saas-ecom-puce.vercel.app`
 *  - Vercel's own deployment, branch and production URLs (`VERCEL_URL`, `VERCEL_BRANCH_URL`,
 *    `VERCEL_PROJECT_PRODUCTION_URL`), only when they are `*.vercel.app` names Vercel generated
 *    for this project.
 *  - Cloudflare Workers preview / workers.dev host (`CF_PAGES_URL` host, `WORKERS_DEV_HOST`, or
 *    bare `*.workers.dev` from `CLOUDFLARE_WORKERS_HOST`) so vinext canaries serve the platform.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` is the project's shortest production domain, which can be a
 * seller's custom domain once those are attached; the `*.vercel.app` check ignores it then.
 */
export function platformHostAliases(source: Record<string, string | undefined> = process.env): string[] {
  const hosts = new Set<string>();
  const add = (value: string | null | undefined) => {
    const host = normalizeHost(value);
    if (host) hosts.add(host);
  };

  const url = source.NEXT_PUBLIC_PLATFORM_URL;
  if (url) {
    try {
      add(new URL(url).host);
    } catch {
      // Invalid URLs are reported by env validation; never let them reroute traffic here.
    }
  }
  for (const entry of (source.PLATFORM_HOST_ALIASES ?? "").split(",")) add(entry);
  for (const value of [source.VERCEL_URL, source.VERCEL_BRANCH_URL, source.VERCEL_PROJECT_PRODUCTION_URL]) {
    const host = normalizeHost(value);
    if (host?.endsWith(".vercel.app")) hosts.add(host);
  }
  const cfPages = source.CF_PAGES_URL;
  if (cfPages) {
    try {
      add(new URL(cfPages).host);
    } catch {
      /* ignore */
    }
  }
  for (const value of [source.WORKERS_DEV_HOST, source.CLOUDFLARE_WORKERS_HOST]) {
    const host = normalizeHost(value);
    if (host?.endsWith(".workers.dev")) hosts.add(host);
  }
  return [...hosts];
}
