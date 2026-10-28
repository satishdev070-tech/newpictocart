import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/http/safe-redirect";
import { LOGIN_PATH, landingPathFor } from "@/lib/auth/landing";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Email confirmation, magic links and password recovery on the platform host. Accepts PKCE
 * (`?code=`) and token-hash (`?token_hash=&type=`) links; the latter are what our Send Email hook
 * (Resend) produces, and they work in any browser, not only the one that started the flow.
 * Without a usable `next`, the account decides: platform staff → /admin, sellers → /dashboard.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const requested = safeRedirectPath(url.searchParams.get("next"), "");
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const supabase = await createSupabaseServerClient();
  let userId: string | null = null;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) userId = data.user?.id ?? null;
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) userId = data.user?.id ?? null;
  }
  if (!userId) return NextResponse.redirect(new URL(`${LOGIN_PATH}?error=link`, url.origin));
  const next = type === "recovery" ? requested || "/reset-password" : await landingPathFor(userId, requested, supabase);
  return NextResponse.redirect(new URL(next, url.origin));
}
