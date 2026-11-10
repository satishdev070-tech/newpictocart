import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/http/safe-redirect";
import { logger } from "@/lib/observability/logger";
import { isNextControlFlowError } from "@/lib/next/control-flow";
import { loginPathFor } from "./landing";

export type SessionUser = { id: string; email: string | null; displayName: string | null };

/** Verified JWT claims (getClaims validates the signature) or null. Memoised per request. */
const getVerifiedClaims = cache(async () => {
  try {
    const { data, error } = await (await createSupabaseServerClient()).auth.getClaims();
    return error || !data?.claims?.sub ? null : data.claims;
  } catch (err) {
    // cookies()/headers() during static generation must keep bubbling so the route stays dynamic.
    if (isNextControlFlowError(err)) throw err;
    logger.warn("auth.session_unavailable", { error: err });
    return null;
  }
});

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
  if (!claims) return null;
  try {
    const { data: profile } = await (await createSupabaseServerClient()).from("profiles").select("display_name, status").eq("id", claims.sub).maybeSingle();
    if (profile?.status === "disabled") return null;
    return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null, displayName: profile?.display_name ?? null };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    logger.warn("auth.session_unavailable", { error: err });
    return null;
  }
});

/** Redirects to the seller (or, for /admin paths, platform console) login when signed out. `next` must be a same-origin path. */
export async function requireUser(next = "/dashboard"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(loginPathFor(safeRedirectPath(next, "/dashboard")));
  return user;
}
