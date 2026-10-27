import { parsePublicEnv, type PublicEnv } from "./public-parse";

let cached: PublicEnv | undefined;

/**
 * Validated public env (zod-free: this module reaches the browser). `NEXT_PUBLIC_*` values must be
 * referenced literally so Next.js can inline them into the browser bundle.
 */
export function publicEnv(): PublicEnv {
  cached ??= parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN,
    NEXT_PUBLIC_PLATFORM_URL: process.env.NEXT_PUBLIC_PLATFORM_URL,
  });
  return cached;
}
