/**
 * Zod-free validation of the public (`NEXT_PUBLIC_*`) env. `@/lib/env/public` runs in the browser
 * (storefront image URLs, the Supabase browser client), and importing zod there shipped ~90 KB gzip
 * of validator to every shopper. Server code still validates the same variables with zod through
 * `serverEnvSchema` (schema.ts), which shares the hostname rules below. Pure module, unit tested.
 */

export type PublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: string;
  NEXT_PUBLIC_PLATFORM_URL?: string;
};

export const HOSTNAME_PATTERN = /^(localhost|([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)$/;
export const HOSTNAME_MESSAGE = "must be a bare hostname such as pictocart.in or localhost (no scheme, port or path)";

/** `https://www.example.in/` -> `example.in`: scheme, path/trailing slash and a leading `www.` are dropped. */
export function normalizeRootDomain(v: string): string {
  return v.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "").replace(/^www\./, "");
}

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n  - ${issues.join("\n  - ")}`);
    this.name = "EnvValidationError";
  }
}

function isUrl(v: string): boolean {
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

/** Same rules as `publicEnvSchema`. Empty strings count as unset; errors name variables, never values. */
export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const get = (k: string) => (source[k] === "" ? undefined : source[k]);
  const issues: string[] = [];
  const url = get("NEXT_PUBLIC_SUPABASE_URL");
  if (!url || !isUrl(url)) issues.push("NEXT_PUBLIC_SUPABASE_URL: Invalid URL");
  const key = get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!key || key.length < 20) issues.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: Too small: expected string to have >=20 characters");
  const rawRoot = get("NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN");
  const root = rawRoot === undefined ? undefined : normalizeRootDomain(rawRoot.trim().toLowerCase());
  if (root === undefined || !HOSTNAME_PATTERN.test(root)) issues.push(`NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: ${HOSTNAME_MESSAGE}`);
  const platformUrl = get("NEXT_PUBLIC_PLATFORM_URL");
  if (platformUrl !== undefined && !isUrl(platformUrl)) issues.push("NEXT_PUBLIC_PLATFORM_URL: Invalid URL");
  if (issues.length) throw new EnvValidationError(issues);
  return {
    NEXT_PUBLIC_SUPABASE_URL: url!,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key!,
    NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: root!,
    ...(platformUrl !== undefined ? { NEXT_PUBLIC_PLATFORM_URL: platformUrl } : {}),
  };
}
