import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
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
import { getPublicPlatformConfig } from "@/features/platform/server/public-config";
import { clearStartDraftCookieServer } from "@/features/start/draft/clear-server";
import { logger } from "@/lib/observability/logger";
import { logSpan, timeAsync } from "@/lib/observability/timing";
import { isNextControlFlowError } from "@/lib/next/control-flow";
import { PROXY_CLAIMS_MS_HEADER, REQUEST_ID_HEADER } from "@/lib/tenant/routing";

type SearchParams = Record<string, string | string[] | undefined>;

type SignInSession = {
  panelLanding: string | null;
  signedInNoStore: boolean;
};

async function tryObsHeaders(): Promise<{ requestId?: string; proxyClaimsMs?: number }> {
  try {
    const h = await headers();
    const requestId = h.get(REQUEST_ID_HEADER) ?? undefined;
    const raw = h.get(PROXY_CLAIMS_MS_HEADER);
    const parsed = raw != null ? Number(raw) : NaN;
    const proxyClaimsMs = Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
    return { requestId, proxyClaimsMs };
  } catch {
    return {};
  }
}

/**
 * Session + landing for the shared Login page. Fail-soft: never throw into (auth)/error.tsx for
 * transient Supabase/config blips — the form still renders.
 */
async function loadSignInSession(requested: string): Promise<SignInSession> {
  const pageStarted = performance.now();
  const { requestId, proxyClaimsMs } = await tryObsHeaders();
  try {
    // Correlate with proxy.claims when the proxy forwarded x-pc-claims-ms (cookie present).
    // Does not skip getSessionUser — JWT is still verified in RSC; this only aids timing evidence.
    if (proxyClaimsMs != null) {
      logSpan({ span: "proxy.claims.header", ms: proxyClaimsMs, requestId });
    }
    const { result: user, ms: sessionMs } = await timeAsync("sign_in.getSessionUser", () => getSessionUser());
    logSpan({ span: "sign_in.getSessionUser", ms: sessionMs, requestId });

    let signedInLanding: string | null = null;
    let landingMs = 0;
    if (user) {
      const landing = await timeAsync("sign_in.landingPathFor", () => landingPathFor(user.id, requested));
      landingMs = landing.ms;
      logSpan({ span: "sign_in.landingPathFor", ms: landingMs, requestId });
      signedInLanding = landing.result;
    }
    const panelLanding =
      signedInLanding && (isAdminPath(signedInLanding) || isSellerPath(signedInLanding)) ? signedInLanding : null;
    const signedInNoStore = Boolean(user && signedInLanding && isOnboardingPath(signedInLanding));
    try {
      const { observeLoginPage } = await import("@/features/observability/observe-login");
      const spans = [
        ...(proxyClaimsMs != null
          ? [{ name: "proxy.claims.header", startMs: 0, endMs: proxyClaimsMs, status: "ok" as const }]
          : []),
        { name: "sign_in.getSessionUser", startMs: 0, endMs: sessionMs, status: "ok" as const },
        ...(user
          ? [{ name: "sign_in.landingPathFor", startMs: sessionMs, endMs: sessionMs + landingMs, status: "ok" as const }]
          : []),
      ];
      observeLoginPage({
        requestId,
        durationMs: performance.now() - pageStarted,
        status: 200,
        spans,
      });
    } catch {
      // observability must never break sign-in
    }
    return { panelLanding, signedInNoStore };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    logger.error("auth.sign_in_page_failed", { error: err });
    try {
      const { observeLoginPage } = await import("@/features/observability/observe-login");
      observeLoginPage({ requestId, durationMs: performance.now() - pageStarted, status: 500 });
    } catch {
      // ignore
    }
    return { panelLanding: null, signedInNoStore: false };
  }
}

/**
 * The one sign-in page for sellers and platform staff (served at /login and /seller/login;
 * /admin/login redirects here). The account decides where it lands after sign-in: platform staff →
 * /admin, store members → /dashboard (lib/auth/role-routing.ts), never which URL was used.
 *
 * Already signed-in store owners / staff bounce to their panel via **server** `redirect()`
 * after clearing the `/start` draft cookie (avoids paying for a full login RSC shell + client
 * `router.replace`). Signed-in no-store accounts stay on this form — auto-sending them to
 * `/start/lang` made Login look broken when merchants clicked marketing Login with an abandoned session.
 *
 * Google is streamed so it cannot block first paint; auth asides no longer import the theme catalogue.
 */
export async function SharedSignInPage({ searchParams }: { searchParams: SearchParams }) {
  const requested = typeof searchParams.next === "string" ? safeRedirectPath(searchParams.next, "") : "";
  const error = searchParams.error;
  const toConsole = isAdminPath(requested);
  // Warm React.cache'd public config in parallel with session (Google slot / brand share it).
  // Does not change auth behavior — only overlaps I/O with loadSignInSession.
  const publicConfigWarm = getPublicPlatformConfig();
  const { panelLanding, signedInNoStore } = await loadSignInSession(requested);
  void publicConfigWarm;

  if (panelLanding) {
    try {
      await clearStartDraftCookieServer();
    } catch {
      // cookie mutate can fail outside a mutable request — still redirect
    }
    redirect(panelLanding);
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
