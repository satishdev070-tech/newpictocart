import { redirect } from "next/navigation";
import { MerchantSignIn } from "@/features/auth/merchant-auth";
import { ClearStartDraftOnLogin } from "@/features/auth/clear-start-draft-on-login";
import { googleSignInAction } from "@/features/auth/actions";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { googleIdentityClientId, googleSignInAvailable } from "@/features/auth/google";
import { GoogleIdentityButton } from "@/components/auth/google-identity";
import { getSessionUser } from "@/lib/auth/session";
import { landingPathFor } from "@/lib/auth/landing";
import { isAdminPath } from "@/lib/auth/role-routing";
import { safeRedirectPath } from "@/lib/http/safe-redirect";
import { AuthHeading, AuthSplit } from "@/components/auth/auth-split";
import { ConsoleAside, MerchantAside } from "@/components/auth/auth-asides";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The one sign-in page for sellers and platform staff (served at /login and /seller/login;
 * /admin/login redirects here). The account decides where it lands after sign-in: platform staff →
 * /admin, store members → /dashboard (lib/auth/role-routing.ts), never which URL was used.
 */
export async function SharedSignInPage({ searchParams }: { searchParams: SearchParams }) {
  const requested = typeof searchParams.next === "string" ? safeRedirectPath(searchParams.next, "") : "";
  const user = await getSessionUser();
  if (user) redirect(await landingPathFor(user.id, requested));
  const toConsole = isAdminPath(requested);
  const google = await googleSignInAvailable("sellers");
  const gisClientId = google ? await googleIdentityClientId() : null;
  const error = searchParams.error;
  return (
    <AuthSplit variant={toConsole ? "console" : "merchant"} aside={toConsole ? <ConsoleAside /> : <MerchantAside mode="login" />}>
      <ClearStartDraftOnLogin />
      <AuthHeading
        eyebrow={toConsole ? "Platform console" : "Sign in"}
        title={toConsole ? "Sign in to continue" : "Sign in to Pictocart"}
        description="One sign-in for sellers and platform admins. We open your store dashboard or the admin console based on your account."
      />
      {error ? (
        <p role="alert" className="mb-5 rounded-md border border-error/25 bg-error/10 px-3 py-2 text-small text-error">
          {error === "google" ? "Google sign-in didn't complete. Please try again or use your email." : "That sign-in link is invalid or has expired. Please sign in again."}
        </p>
      ) : null}
      {google ? (
        <>
          {gisClientId ? (
            <GoogleIdentityButton clientId={gisClientId} next={requested || undefined} fallback={<GoogleButton action={googleSignInAction} next={requested} />} />
          ) : (
            <GoogleButton action={googleSignInAction} next={requested} />
          )}
          <OrDivider />
        </>
      ) : null}
      <MerchantSignIn next={requested || undefined} />
      <p className="mt-6 text-center text-small text-muted">
        New to Pictocart?{" "}
        <a href="/start" className="font-semibold text-accent underline-offset-2 hover:underline">
          Create your store
        </a>
      </p>
      <p className="mt-8 text-caption text-subtle">Shopping at a store? Sign in on that store&apos;s website instead.</p>
    </AuthSplit>
  );
}
