import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { platformOrigin, storeOrigin } from "@/lib/platform/urls";
import { clientIpKey, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/observability/logger";
import { getPublicPlatformConfig } from "@/features/platform/server/public-config";
import { relayCallbackUrl, relayNext, verifiedStoreHost } from "@/features/customer-account/server/google-relay";

/** Start of the store Google sign-in relay (see features/customer-account/server/google-relay.ts). */
export async function GET(request: NextRequest) {
  const host = await verifiedStoreHost(request.nextUrl.searchParams.get("host"));
  if (!host) return NextResponse.redirect(new URL("/", platformOrigin()));
  const next = relayNext(request.nextUrl.searchParams.get("next"));
  const back = new URL("/account/login?error=google", storeOrigin(host));
  try {
    await rateLimit("store-login:ip", await clientIpKey(), 20, 600);
  } catch {
    return NextResponse.redirect(back);
  }
  if (!(await getPublicPlatformConfig()).googleForShoppers) return NextResponse.redirect(back);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: relayCallbackUrl(platformOrigin(), host, next), queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) {
    logger.warn("store_google.start_failed", { code: error?.code ?? null });
    return NextResponse.redirect(back);
  }
  return NextResponse.redirect(data.url);
}
