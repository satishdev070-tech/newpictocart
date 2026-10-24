import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MerchantSignIn } from "@/features/auth/merchant-auth";
import { googleSignInAction } from "@/features/auth/actions";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { googleIdentityClientId, googleSignInAvailable } from "@/features/auth/google";
import { GoogleIdentityButton } from "@/components/auth/google-identity";

import { getSessionUser } from "@/lib/auth/session";
import { landingPathFor } from "@/lib/auth/landing";
import { safeRedirectPath } from "@/lib/http/safe-redirect";
import { AuthHeading, AuthSplit } from "@/components/auth/auth-split";
import { MerchantAside } from "@/components/auth/auth-asides";

export const metadata: Metadata = { title: "Merchant sign in", robots: { index: false } };

export default async function SellerLoginPage({ searchParams }: PageProps<"/seller/login">) {
  const sp = await searchParams;
  const requested = typeof sp.next === "string" ? safeRedirectPath(sp.next, "") : "";
  const user = await getSessionUser();
  if (user) redirect(requested || (await landingPathFor(user.id)));
  const google = await googleSignInAvailable("sellers");
  const gisClientId = google ? await googleIdentityClientId() : null;
  return (
    <AuthSplit variant="merchant" aside={<MerchantAside mode="login" />}>
      <AuthHeading eyebrow="Merchant login" title="Sign in to your store" description="Manage products, orders and your storefront." />
      {sp.error ? (
        <p role="alert" className="mb-5 rounded-md border border-error/25 bg-error/10 px-3 py-2 text-small text-error">
          {sp.error === "google" ? "Google sign-in didn't complete. Please try again or use your email." : "That sign-in link is invalid or has expired. Please sign in again."}
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
        <a href="/seller/register" className="font-semibold text-accent underline-offset-2 hover:underline">
          Create your store
        </a>
      </p>
      <p className="mt-8 text-caption text-subtle">Shopping at a store? Sign in on that store&apos;s website instead.</p>
    </AuthSplit>
  );
}
