import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EnvValidationError } from "@/lib/env/schema";
import { safeRedirectPath } from "@/lib/http/safe-redirect";
import { logger } from "@/lib/observability/logger";
import { logSpan, timeAsync } from "@/lib/observability/timing";
import { isNextControlFlowError } from "@/lib/next/control-flow";
import { REQUEST_ID_HEADER } from "@/lib/tenant/routing";
import { loginPathFor } from "./landing";

export type SessionUser = { id: string; email: string | null; displayName: string | null };

async function tryRequestId(): Promise<string | undefined> {
  try {
    return (await headers()).get(REQUEST_ID_HEADER) ?? undefined;
  } catch {
    return undefined;
  }
}

type Claims = { sub: string; email?: unknown };

function sessionReadFailed(err: unknown): null {
  // cookies()/headers() during static generation must keep bubbling so the route stays dynamic.
  if (isNextControlFlowError(err)) throw err;
  // Misconfigured Worker secrets should not look like “signed out”.
  if (err instanceof EnvValidationError) throw err;
  logger.warn("auth.session_unavailable", { error: err });
  return null;
}

/** Uncached JWT claims (getClaims validates the signature), or null when signed out. */
async function loadClaims(): Promise<Claims | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { result, ms } = await timeAsync("session.getClaims", () => supabase.auth.getClaims());
    logSpan({ span: "session.getClaims", ms, requestId: await tryRequestId() });
    const { data, error } = result;
    return error || !data?.claims?.sub ? null : data.claims;
  } catch (err) {
    return sessionReadFailed(err);
  }
}

/** The profile half of the session: disabled accounts count as signed out. */
async function userFromClaims(claims: Claims): Promise<SessionUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { result, ms } = await timeAsync("session.profile", () =>
      Promise.resolve(supabase.from("profiles").select("display_name, status").eq("id", claims.sub).maybeSingle()),
    );
    logSpan({ span: "session.profile", ms, requestId: await tryRequestId() });
    const profile = result.data;
    if (profile?.status === "disabled") return null;
    return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null, displayName: profile?.display_name ?? null };
  } catch (err) {
    return sessionReadFailed(err);
  }
}

/** Uncached session read (JWT via getClaims). Prefer {@link getSessionUser} except for post-auth retries. */
export async function loadSessionUser(): Promise<SessionUser | null> {
  const claims = await loadClaims();
  return claims ? userFromClaims(claims) : null;
}

/** Verified JWT claims, memoised per request. */
const getVerifiedClaims = cache(loadClaims);

/**
 * Id of the verified (JWT-validated) user, before the profile check. Lets callers start
 * user-scoped reads in parallel with `getSessionUser`; they must still require the session user.
 */
export async function getVerifiedUserId(): Promise<string | null> {
  return (await getVerifiedClaims())?.sub ?? null;
}

/** Verified current user (JWT validated via getClaims) or null. Memoised per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const claims = await getVerifiedClaims();
  return claims ? userFromClaims(claims) : null;
});

/** Redirects to the seller (or, for /admin paths, platform console) login when signed out. `next` must be a same-origin path. */
export async function requireUser(next = "/dashboard"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(loginPathFor(safeRedirectPath(next, "/dashboard")));
  return user;
}

/**
 * Like {@link requireUser}, but re-reads the session once (uncached) after a short delay.
 * Used after email OTP → redirect → finalize, when the first cookie read can race.
 */
export async function requireUserWithRetry(next = "/dashboard", delayMs = 150): Promise<SessionUser> {
  let user = await loadSessionUser();
  if (!user) {
    await new Promise((r) => setTimeout(r, delayMs));
    user = await loadSessionUser();
  }
  if (!user) redirect(loginPathFor(safeRedirectPath(next, "/dashboard")));
  return user;
}
