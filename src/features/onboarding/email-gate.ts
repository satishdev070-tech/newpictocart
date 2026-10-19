import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Whether the signed-in seller must confirm email before voice / create-store.
 * Google (and other OAuth) users typically arrive with email_confirmed_at set;
 * password signups may not until they open the confirm link.
 */
export async function getEmailVerificationState(): Promise<{
  email: string | null;
  needsVerification: boolean;
}> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { email: null, needsVerification: true };
  const email = user.email?.trim() ?? null;
  // Identities from Google/OAuth count as verified even if the flag is briefly unset.
  const oauthVerified = (user.identities ?? []).some((i) => i.provider !== "email" && i.provider !== "phone");
  const confirmed = Boolean(user.email_confirmed_at) || oauthVerified;
  return { email, needsVerification: !confirmed };
}

export async function assertEmailVerifiedForOnboarding(): Promise<void> {
  const { AppError } = await import("@/lib/errors");
  const state = await getEmailVerificationState();
  if (state.needsVerification) {
    throw new AppError("FORBIDDEN", {
      fieldErrors: { _form: ["Confirm your email before creating a store. Check your inbox for the link."] },
      context: { reason: "email_unconfirmed" },
    });
  }
}
