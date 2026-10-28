import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { isNextControlFlowError } from "@/lib/next/control-flow";
import { isAdminPath, landingFor, type AccountAccess } from "./role-routing";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** One sign-in page for sellers and platform staff; the account decides where it lands. */
export const LOGIN_PATH = "/login";
/** Old entry points, kept working: /seller/login renders the same page, /admin/login redirects. */
export const SELLER_LOGIN_PATH = "/seller/login";
export const ADMIN_LOGIN_PATH = "/admin/login";

/** Login page for a protected path (sellers and staff share it). */
export function loginPathFor(next: string): string {
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}

/**
 * Platform and store access of the signed-in user. Read with the user's own session (RLS: members
 * see only their own membership rows), never from request input. Null when the lookup failed.
 */
export async function accountAccessFor(userId: string, client?: SupabaseServerClient): Promise<AccountAccess | null> {
  try {
    const supabase = client ?? (await createSupabaseServerClient());
    const [tenant, platform] = await Promise.all([
      supabase.from("tenant_memberships").select("tenant_id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active"),
      supabase.from("platform_memberships").select("status").eq("user_id", userId).maybeSingle(),
    ]);
    return { platformStaff: platform.data?.status === "active", storeCount: tenant.count ?? 0 };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    logger.warn("auth.landing_unavailable", { error: err });
    return null;
  }
}

/**
 * Destination after sign-in. Platform staff → admin console, sellers → dashboard, nobody →
 * onboarding. A requested `next` (already safeRedirectPath'd) is honoured only when the account
 * can use that panel (see role-routing.ts).
 */
export async function landingPathFor(userId: string, requested?: string | null, client?: SupabaseServerClient): Promise<string> {
  const access = await accountAccessFor(userId, client);
  if (!access) return requested && !isAdminPath(requested) ? requested : "/onboarding";
  return landingFor(access, requested);
}
