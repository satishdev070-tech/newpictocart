import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { platformOrigin, storeOrigin } from "@/lib/platform/urls";
import { logger } from "@/lib/observability/logger";
import { relayNext, storeHandoffUrl, verifiedStoreHost } from "@/features/customer-account/server/google-relay";

/**
 * End of the store Google sign-in relay on the platform: exchange the OAuth code, sign the shopper
 * straight back out of the platform host, and send them to their store with a single-use token
 * (admin generateLink: no email is sent). The store callback verifies it and opens /account.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const host = await verifiedStoreHost(url.searchParams.get("host"));
  if (!host) return NextResponse.redirect(new URL("/", platformOrigin()));
  const next = relayNext(url.searchParams.get("next"));
  const store = storeOrigin(host);
  const fail = NextResponse.redirect(new URL("/account/login?error=google", store));

  const code = url.searchParams.get("code");
  if (!code) return fail;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const email = data.user?.email?.trim().toLowerCase();
  // The shopper only needs a session on the store host, not on the platform.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  if (error || !email) {
    logger.warn("store_google.exchange_failed", { code: error?.code ?? null });
    return fail;
  }

  const link = await createSupabaseAdminClient().auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) {
    logger.warn("store_google.handoff_failed", { code: link.error?.code ?? null });
    return fail;
  }
  return NextResponse.redirect(storeHandoffUrl(store, tokenHash, next));
}
