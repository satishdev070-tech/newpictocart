/**
 * Website type (pure, unit tested). The ONE place the discriminator values are defined; use these
 * constants instead of string literals. Stored in `tenants.website_type` (migration 8000), fixed at
 * creation. Anything missing, unknown or malformed reads as ONLINE_STORE, so every code path that
 * does not know about website type keeps behaving like the Online Store.
 * See docs/informative/PLAN.md.
 */

export const WEBSITE_TYPE = {
  ONLINE_STORE: "ONLINE_STORE",
  INFORMATIVE: "INFORMATIVE",
} as const;

export const WEBSITE_TYPES = [WEBSITE_TYPE.ONLINE_STORE, WEBSITE_TYPE.INFORMATIVE] as const;
export type WebsiteType = (typeof WEBSITE_TYPES)[number];
export const DEFAULT_WEBSITE_TYPE: WebsiteType = WEBSITE_TYPE.ONLINE_STORE;

export function isWebsiteType(v: unknown): v is WebsiteType {
  return typeof v === "string" && (WEBSITE_TYPES as readonly string[]).includes(v);
}

/** Any stored value → a type. Missing / unknown / malformed = ONLINE_STORE. */
export function parseWebsiteType(v: unknown): WebsiteType {
  return isWebsiteType(v) ? v : DEFAULT_WEBSITE_TYPE;
}

export const isInformativeWebsite = (t: WebsiteType | null | undefined): boolean => t === WEBSITE_TYPE.INFORMATIVE;

/** Home of the Informative seller panel. */
export const INFORMATIVE_HOME = "/informative/dashboard";
/** Path prefix of the Informative seller panel (platform host only). */
export const INFORMATIVE_PANEL_PREFIX = "/informative";

export function isInformativePanelPath(path: string): boolean {
  return path === INFORMATIVE_PANEL_PREFIX || path.startsWith(`${INFORMATIVE_PANEL_PREFIX}/`) || path.startsWith(`${INFORMATIVE_PANEL_PREFIX}?`);
}

/** True when there is at least one store and every one of them is an Informative Website. */
export function allInformative(types: readonly unknown[]): boolean {
  return types.length > 0 && types.every((t) => parseWebsiteType(t) === WEBSITE_TYPE.INFORMATIVE);
}
