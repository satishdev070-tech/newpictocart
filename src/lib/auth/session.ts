import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/http/safe-redirect";
import { logger } from "@/lib/observability/logger";
import { isNextControlFlowError } from "@/lib/next/control-flow";
import { loginPathFor } from "./landing";

export type SessionUser = { id: string; email: string | null; displayName: string | null };

/** Verified current user (JWT validated via getClaims) or null. Memoised per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims?.sub) return null;
    const { data: profile } = await supabase.from("profiles").select("display_name, status").eq("id", claims.sub).maybeSingle();
    if (profile?.status === "disabled") return null;
    return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null, displayName: profile?.display_name ?? null };
  } catch (err) {
    // cookies()/headers() during static generation must keep bubbling so the route stays dynamic.
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
