import type { CSSProperties } from "react";
import type { HeaderSettings } from "@/features/theme/schema/tokens";
import type { HeaderStyle } from "@/features/theme/sections/variants";

/**
 * Header logo sizing and placement (pure, shared by the storefront header and tests).
 *
 * Back-compat: while every new header field is at its default (sizes 0, positions "auto") the
 * header renders through the original code paths with the original logo styles.
 */

export type HeaderLayout = "logo-left" | "logo-center" | "logo-left-nav-center";
export type DesktopLogoPos = "left" | "center" | "center-stacked" | "right";
export type MobileLogoPos = "left" | "center";

type LogoFields = Pick<HeaderSettings, "logoMaxWidth" | "logoWidth" | "logoWidthMobile" | "logoHeight" | "logoHeightMobile" | "logoPosition" | "mobileLogoPosition">;

/** True when the seller chose a placement in the builder (otherwise the legacy layouts render). */
export function hasCustomLogoPosition(h: LogoFields): boolean {
  return h.logoPosition !== "auto" || h.mobileLogoPosition !== "auto";
}

/** Placement per breakpoint; "auto" resolves to what the Header section's layout shows today. */
export function resolveLogoPositions(h: LogoFields, layout: HeaderLayout): { desktop: DesktopLogoPos; mobile: MobileLogoPos } {
  const desktop: DesktopLogoPos = h.logoPosition === "auto" ? (layout === "logo-center" ? "center-stacked" : "left") : h.logoPosition;
  const mobile: MobileLogoPos = h.mobileLogoPosition === "auto" ? (layout === "logo-center" ? "center" : "left") : h.mobileLogoPosition;
  return { desktop, mobile };
}

export function hasCustomLogoSize(h: LogoFields): boolean {
  return h.logoWidth > 0 || h.logoWidthMobile > 0 || h.logoHeight > 0 || h.logoHeightMobile > 0;
}

/** Height limits used when the seller sets a width but leaves the height on auto. */
export const AUTO_LOGO_HEIGHT = { desktop: 200, mobile: 72 } as const;

const OBJECT_POSITION: Record<DesktopLogoPos, string> = { left: "left center", center: "center", "center-stacked": "center", right: "right center" };

/** Editorial header (no size set): an oversized logo, up to 1.5x the width cap and this tall on desktop. */
export const EDITORIAL_LOGO = { widthScale: 1.5, maxWidth: 400, height: { desktop: 96, mobile: 56 } } as const;

/**
 * Inline style + class for the logo <img>.
 * - Legacy (no size set): exactly the original style (max-width + fixed max-height, intrinsic size).
 *   The Editorial header style instead gets an oversized logo (class sf-logo-lg, per-breakpoint limits).
 * - Sized: an exact width per breakpoint (the slider really drives the size, small files scale up),
 *   height limited by max-height with object-fit: contain, so the logo is never squashed. The
 *   optimised logo file is 960px wide, enough for a crisp 400px logo on 2x screens.
 *   Mobile width defaults to the desktop width, but at most 40% of the header width.
 */
export function logoImageProps(
  h: LogoFields,
  opts: { aspectRatio?: string; legacyMaxHeight: number; positions: { desktop: DesktopLogoPos; mobile: MobileLogoPos }; headerStyle?: HeaderStyle },
): { className: string; style: CSSProperties } {
  if (!hasCustomLogoSize(h)) {
    if (opts.headerStyle === "editorial") {
      const vars = {
        "--sf-logo-max-w": `${Math.min(Math.round(h.logoMaxWidth * EDITORIAL_LOGO.widthScale), EDITORIAL_LOGO.maxWidth)}px`,
        "--sf-logo-max-h": `${Math.max(EDITORIAL_LOGO.height.desktop, opts.legacyMaxHeight)}px`,
        "--sf-logo-max-h-m": `${Math.max(EDITORIAL_LOGO.height.mobile, opts.legacyMaxHeight)}px`,
      } as CSSProperties;
      return { className: "sf-logo-lg", style: { ...vars, aspectRatio: opts.aspectRatio } };
    }
    return { className: "h-auto w-auto object-contain", style: { maxWidth: h.logoMaxWidth, maxHeight: opts.legacyMaxHeight, aspectRatio: opts.aspectRatio } };
  }
  const wDesktop = h.logoWidth || h.logoMaxWidth;
  const vars = {
    "--sf-logo-w": `${wDesktop}px`,
    "--sf-logo-w-m": h.logoWidthMobile ? `${h.logoWidthMobile}px` : `min(${wDesktop}px, 40cqi)`,
    "--sf-logo-h": `${h.logoHeight || AUTO_LOGO_HEIGHT.desktop}px`,
    "--sf-logo-h-m": `${h.logoHeightMobile || AUTO_LOGO_HEIGHT.mobile}px`,
    "--sf-logo-pos": OBJECT_POSITION[opts.positions.desktop],
    "--sf-logo-pos-m": OBJECT_POSITION[opts.positions.mobile],
  } as CSSProperties;
  return { className: "sf-logo-img", style: { ...vars, aspectRatio: opts.aspectRatio } };
}

/** Splits a menu for the "logo centred, menu around it" placement (first half left of the logo). */
export function splitMenu<T>(items: readonly T[]): [T[], T[]] {
  const half = Math.ceil(items.length / 2);
  return [items.slice(0, half), items.slice(half)];
}
