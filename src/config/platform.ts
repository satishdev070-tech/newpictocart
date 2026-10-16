/** Platform-level constants (not tenant data). */
export const PLATFORM_NAME = "Pictocart";
export const PLATFORM_TAGLINE = "Launch your online store in 5 minutes";

/**
 * Official logo file, served from /public (transparent PNG, trimmed). A logo uploaded in
 * /admin/branding takes precedence over this file. See docs/BRAND.md.
 */
export const PLATFORM_LOGO: { src: string; width: number; height: number } | null = { src: "/brand/pictocart-logo.png", width: 583, height: 192 };

/** Square brand mark (camera + cart), used for the favicon and compact placements. */
export const PLATFORM_ICON = "/brand/pictocart-icon.png";
