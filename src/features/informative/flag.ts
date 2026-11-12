/**
 * FEATURE_INFORMATIVE_WEBSITE (pure parse + a process.env read; unit tested).
 *
 * - "off" (default, also any unknown value): Step 0 hidden, Informative panel routes 404, no
 *   Informative site can be created. Informative accounts created while it was on see a
 *   maintenance page instead of breaking.
 * - "internal": as "all", but only platform staff (active platform_memberships row) may CREATE an
 *   Informative Website (rollout stage 2).
 * - "all": every new signup may choose Informative Website (rollout stage 3).
 *
 * Read on the server at request time (not a NEXT_PUBLIC_ build-time value) and passed to client
 * components as props, so it can be flipped without a rebuild. Rollback = "off".
 */

export const INFORMATIVE_FLAG_MODES = ["off", "internal", "all"] as const;
export type InformativeFlagMode = (typeof INFORMATIVE_FLAG_MODES)[number];

export function parseInformativeFlag(raw: unknown): InformativeFlagMode {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "all") return "all";
  if (v === "internal") return "internal";
  return "off";
}

/** Server-side current mode. */
export function informativeFlagMode(): InformativeFlagMode {
  return parseInformativeFlag(process.env.FEATURE_INFORMATIVE_WEBSITE);
}

export const informativeFlagOn = (mode: InformativeFlagMode): boolean => mode !== "off";

/** May this person create (onboard) an Informative Website right now? */
export function canCreateInformative(mode: InformativeFlagMode, who: { platformStaff: boolean }): boolean {
  if (mode === "all") return true;
  if (mode === "internal") return who.platformStaff;
  return false;
}
