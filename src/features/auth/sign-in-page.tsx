import Link from "next/link";
import { MerchantSignIn } from "@/features/auth/merchant-auth";
import { ClearStartDraftOnLogin } from "@/features/auth/clear-start-draft-on-login";
import { signOutAction } from "@/features/auth/actions";
import { GoogleSignInSlot } from "@/components/auth/google-sign-in-slot";
import { getSessionUser } from "@/lib/auth/session";
import { landingPathFor } from "@/lib/auth/landing";
import { isAdminPath, isOnboardingPath, isSellerPath } from "@/lib/auth/role-routing";
import { safeRedirectPath } from "@/lib/http/safe-redirect";
import { AuthHeading, AuthSplit } from "@/components/auth/auth-split";
import { ConsoleAside, MerchantAside } from "@/components/auth/auth-asides";
import { logger } from "@/lib/observability/logger";
import { isNextControlFlowError } from "@/lib/next/control-flow";

type SearchParams = Record<string, string | string[] | undefined>;

type SignInSession = {
  panelLanding: string | null;
  signedInNoStore: boolean;
};

/**
 * Session + landing for the shared Login page. Fail-soft: never throw into (auth)/error.tsx for
 * transient Supabase/config blips — the form still renders.
 */
async function loadSignInSession(requested: string): Promise<SignInSession> {
  try {
    const user = await getSessionUser();
    const signedInLanding = user ? await landingPathFor(user.id, requested) : null;
    const panelLanding =
      signedInLanding && (isAdminPath(signedInLanding) || isSellerPath(signedInLanding)) ? signedInLanding : null;
    const signedInNoStore = Boolean(user && signedInLanding && isOnboardingPath(signedInLanding));
    return { panelLanding, signedInNoStore };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    logger.error("auth.sign_in_page_failed", { error: err });
    return { panelLanding: null, signedInNoStore: false };
  }
}

/**
 * The one sign-in page for sellers and platform staff (served at /login and /seller/login;
 * /admin/login redirects here). The account decides where it lands after sign-in: platform staff →
 * /admin, store members → /dashboard (lib/auth/role-routing.ts), never which URL was used.
 *
 * Already signed-in store owners / staff bounce to their panel (after clearing any /start draft).
 * Signed-in no-store accounts stay on this form — auto-sending them to /start/lang made Login look
 * broken when merchants clicked the marketing Login button with an abandoned session.
 *
 * Google is streamed so it cannot block first paint; auth asides no longer import the theme catalogue.
 */
export async function SharedSignInPage({ searchParams }: { searchParams: SearchParams }) {
  const requested = typeof searchParams.next === "string" ? safeRedirectPath(searchParams.next, "") : "";
  const error = searchParams.error;
  const toConsole = isAdminPath(requested);
  const { panelLanding, signedInNoStore } = await loadSignInSession(requested);

  if (panelLanding) {
    return <ClearStartDraftOnLogin signedInLanding={panelLanding} />;
  }

  return (
    <AuthSplit variant={toConsole ? "console" : "merchant"} aside={toConsole ? <ConsoleAside /> : <MerchantAside mode="login" />}>
      <ClearStartDraftOnLogin />
      <AuthHeading
        eyebrow={toConsole ? "Platform console" : "Sign in"}
        title={toConsole ? "Sign in to continue" : "Sign in to Pictocart"}
        description="One sign-in for sellers and platform admins. We open your store dashboard or the admin console based on your account."
      />
      {signedInNoStore ? (
        <div className="mb-5 rounded-md border border-border bg-surface-secondary px-3 py-3 text-small text-foreground">
          <p className="font-medium">You&apos;re already signed in.</p>
          <p className="mt-1 text-muted">
            <Link href="/start" className="font-semibold text-accent underline-offset-2 hover:underline">
              Continue creating your store
            </Link>
            {" · "}
            <form action={signOutAction} className="inline">
              <button type="submit" className="font-semibold text-accent underline-offset-2 hover:underline">
                Sign out
              </button>
            </form>{" "}
            to use a different account.
          </p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mb-5 rounded-md border border-error/25 bg-error/10 px-3 py-2 text-small text-error">
          {error === "google" ? "Google sign-in didn't complete. Please try again or use your email." : "That sign-in link is invalid or has expired. Please sign in again."}
        </p>
      ) : null}
      <GoogleSignInSlot next={requested || undefined} />
      <MerchantSignIn next={requested || undefined} />
      <p className="mt-6 text-center text-small text-muted">
        New to Pictocart?{" "}
        <Link href="/start" className="font-semibold text-accent underline-offset-2 hover:underline">
          Create your store
        </Link>
      </p>
      <p className="mt-8 text-caption text-subtle">Shopping at a store? Sign in on that store&apos;s website instead.</p>
    </AuthSplit>
  );
}
