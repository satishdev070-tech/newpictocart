/**
 * Collapsed/expanded sidebar preference, kept in a cookie (one per panel) so the server renders
 * the right width on the first paint: no flash from expanded to collapsed after hydration.
 * The value is only a UI preference; nothing trusts it.
 */
export type SidebarPanel = "seller" | "admin";

export const SIDEBAR_COOKIE: Record<SidebarPanel, string> = { seller: "pc_sidebar_seller", admin: "pc_sidebar_admin" };

const ONE_YEAR = 60 * 60 * 24 * 365;

/** "1" means collapsed; anything else (missing, "0", junk) means expanded. */
export function parseSidebarCollapsed(raw: string | null | undefined): boolean {
  return raw?.trim() === "1";
}

/** document.cookie assignment for the preference (client side). */
export function sidebarCookie(panel: SidebarPanel, collapsed: boolean): string {
  return `${SIDEBAR_COOKIE[panel]}=${collapsed ? "1" : "0"}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}
