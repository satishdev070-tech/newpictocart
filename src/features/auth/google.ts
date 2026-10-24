import "server-only";
import { publicEnv } from "@/lib/env/public";
import { logger } from "@/lib/observability/logger";
import { getPublicPlatformConfig } from "@/features/platform/server/public-config";

/**
 * True when the Google provider is switched on in Supabase Auth (Authentication → Providers).
 * Reads the public /auth/v1/settings endpoint, cached for 5 minutes, so the "Continue with
 * Google" button only appears once it can actually work.
 */
export async function googleAuthEnabled(): Promise<boolean> {
  const env = publicEnv();
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return false;
    const j = (await res.json()) as { external?: Record<string, boolean> };
    return j.external?.google === true;
  } catch (err) {
    logger.warn("auth.settings_unavailable", { error: err });
    return false;
  }
}

/**
 * Whether to show "Continue with Google" to sellers or store customers: the provider must be on
 * in Supabase Auth AND not switched off for that audience in the platform console (/admin/sign-in).
 */
export async function googleSignInAvailable(audience: "sellers" | "shoppers"): Promise<boolean> {
  const config = await getPublicPlatformConfig();
  if (!(audience === "sellers" ? config.googleForSellers : config.googleForShoppers)) return false;
  return googleAuthEnabled();
}

let cachedClientId: { value: string | null; at: number } | null = null;
const CLIENT_ID_RE = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

/**
 * Google OAuth client id for Google Identity Services sign-in (GoogleIdentityButton), or null to use
 * the classic redirect. On only with GOOGLE_IDENTITY_SIGNIN=on (this site must first be an
 * "Authorised JavaScript origin" of the client in Google Cloud). The id is
 * NEXT_PUBLIC_GOOGLE_SIGNIN_CLIENT_ID, else read from the Location of Supabase's public
 * /auth/v1/authorize?provider=google redirect (the same client Supabase verifies tokens for).
 */
export async function googleIdentityClientId(): Promise<string | null> {
  if (process.env.GOOGLE_IDENTITY_SIGNIN !== "on") return null;
  const fromEnv = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN_CLIENT_ID?.trim();
  if (fromEnv && CLIENT_ID_RE.test(fromEnv)) return fromEnv;
  if (cachedClientId && Date.now() - cachedClientId.at < 12 * 3600_000) return cachedClientId.value;
  const env = publicEnv();
  let value: string | null = null;
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/auth/v1/authorize?provider=google`, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(4000) });
    const location = res.headers.get("location");
    const id = location ? new URL(location).searchParams.get("client_id") : null;
    value = id && CLIENT_ID_RE.test(id) ? id : null;
  } catch (err) {
    logger.warn("auth.google_client_id_unavailable", { error: err });
  }
  cachedClientId = { value, at: Date.now() };
  return value;
}
