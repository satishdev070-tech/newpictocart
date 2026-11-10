import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/http/safe-redirect";
import { LOGIN_PATH, landingPathFor } from "@/lib/auth/landing";

const TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/** token_hash confirmation (for email templates that use {{ .TokenHash }}). */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const requested = safeRedirectPath(url.searchParams.get("next"), "");
  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    const userId = data.user?.id;
    if (!error && userId) {
      const next = type === "recovery" ? requested || "/reset-password" : await landingPathFor(userId, requested, supabase);
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL(`${LOGIN_PATH}?error=link`, url.origin));
}
