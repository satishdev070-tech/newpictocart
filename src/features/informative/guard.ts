import type { InformativeFlagMode } from "./flag";
import type { WebsiteType } from "./website-type";

/**
 * InformativeRouteGuard decision (pure, unit tested). The server wrapper in ./server/context.ts
 * feeds it the flag, the session and the ACTIVE store's type (from the member's own memberships,
 * never request input).
 *
 * Flag off: Informative accounts get a maintenance page instead of breaking; everyone else 404s.
 * Flag on: signed out → login; no store → onboarding; Online Store → store dashboard
 * (Informative APIs reject Store accounts); Informative → render.
 */
export type InformativePanelDecision = "render" | "maintenance" | "not-found" | "login" | "onboarding" | "store-dashboard";

export function informativePanelDecision(input: {
  mode: InformativeFlagMode;
  signedIn: boolean;
  activeType: WebsiteType | null;
}): InformativePanelDecision {
  if (input.mode === "off") return input.activeType === "INFORMATIVE" ? "maintenance" : "not-found";
  if (!input.signedIn) return "login";
  if (input.activeType === null) return "onboarding";
  return input.activeType === "INFORMATIVE" ? "render" : "store-dashboard";
}
