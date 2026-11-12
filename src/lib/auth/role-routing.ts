/**
 * Where an account goes after signing in on the shared /login page (pure, unit tested).
 * Access is read server-side from the user's own membership rows, never from which page or
 * button was used: platform staff → the console, store members → the seller dashboard,
 * everyone else → /start (store setup journey).
 */
// INFORMATIVE: branch point — see docs/informative/PLAN.md (post-login redirect)
import { INFORMATIVE_HOME, isInformativePanelPath } from "@/features/informative/website-type";

export type AccountAccess = {
  /** Active platform_memberships row (super admin, support or finance). */
  platformStaff: boolean;
  /** Number of active tenant_memberships rows. */
  storeCount: number;
  /**
   * INFORMATIVE: branch point. True when every store of the account is an Informative Website.
   * Unset (flag off, lookup failed, older callers) = behave exactly as before.
   */
  informativeOnly?: boolean;
};

export const ADMIN_HOME = "/admin";
export const SELLER_HOME = "/dashboard";
/** No-store accounts land on the five-screen /start journey (legacy /onboarding redirects here). */
export const ONBOARDING_HOME = "/start";

export function isAdminPath(path: string): boolean {
  return path === ADMIN_HOME || path.startsWith(`${ADMIN_HOME}/`) || path.startsWith(`${ADMIN_HOME}?`);
}

export function isSellerPath(path: string): boolean {
  return path === SELLER_HOME || path.startsWith(`${SELLER_HOME}/`) || path.startsWith(`${SELLER_HOME}?`);
}

/** Store-setup journey paths (`/start`, legacy `/onboarding`). */
export function isOnboardingPath(path: string): boolean {
  return (
    path === ONBOARDING_HOME ||
    path.startsWith(`${ONBOARDING_HOME}/`) ||
    path.startsWith(`${ONBOARDING_HOME}?`) ||
    path === "/onboarding" ||
    path.startsWith("/onboarding/") ||
    path.startsWith("/onboarding?")
  );
}

/** Default panel for an account with no requested destination. */
export function defaultLanding(access: AccountAccess): string {
  if (access.platformStaff) return ADMIN_HOME;
  if (access.storeCount > 0) return access.informativeOnly ? INFORMATIVE_HOME : SELLER_HOME;
  return ONBOARDING_HOME;
}

/**
 * A requested `next` (already passed through safeRedirectPath) wins only when the account can use
 * it: the console only for platform staff, the dashboard only for store members. Onboarding
 * destinations (`/start`, `/onboarding`) are ignored for accounts that already have a home panel
 * (staff → admin, store owners → seller). Other same-origin paths (marketing, invites) are kept.
 */
export function landingFor(access: AccountAccess, requested?: string | null): string {
  const next = requested?.trim() ?? "";
  if (!next || next === "/") return defaultLanding(access);
  if (isAdminPath(next)) return access.platformStaff ? next : defaultLanding(access);
  if (isSellerPath(next)) return access.storeCount > 0 ? next : defaultLanding(access);
  // INFORMATIVE: branch point. The panel's own guard re-checks the active store's type.
  if (isInformativePanelPath(next)) return access.storeCount > 0 ? next : defaultLanding(access);
  if (isOnboardingPath(next)) {
    if (access.platformStaff) return ADMIN_HOME;
    if (access.storeCount > 0) return defaultLanding(access);
  }
  return next;
}

/** Both panels exist for this account, so the sidebar shows the Admin ⇄ Seller switch. */
export function canSwitchPanels(access: AccountAccess): boolean {
  return access.platformStaff && access.storeCount > 0;
}
