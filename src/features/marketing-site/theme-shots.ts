import manifest from "./theme-previews.json";

/**
 * Pre-captured screenshots of each theme (scripts/themes/capture-previews.mts), served from
 * /public as plain static files: no Image Optimization and no live store rendered per visitor.
 * Themes without a screenshot fall back to the token mockup. PURE.
 *
 * Files per theme: `<key>-desktop.webp` (1440×900 shot, 1200 px wide), `<key>-desktop-640.webp`
 * (card size, newer captures only) and `<key>-phone.webp` (390×844 shot, 390 px wide).
 */
export type ShotDevice = "desktop" | "phone";

/** Intrinsic size of each screenshot file (16:10 desktop, 390:844 phone): for width/height attrs. */
export const SHOT_SIZE: Record<ShotDevice, { width: number; height: number }> = {
  desktop: { width: 1200, height: 750 },
  phone: { width: 390, height: 844 },
};

const captured: Record<ShotDevice, ReadonlySet<string>> = {
  desktop: new Set(manifest.desktop as string[]),
  phone: new Set(manifest.phone as string[]),
};
const small: ReadonlySet<string> = new Set(((manifest as { desktopSmall?: string[] }).desktopSmall ?? []) as string[]);

export function themeShot(key: string, device: ShotDevice): string | null {
  return captured[device].has(key) ? `/theme-previews/${key}-${device}.webp` : null;
}

export const hasThemeShots = (key: string) => captured.desktop.has(key) && captured.phone.has(key);

/** `srcSet` for the desktop screenshot (640 w card size + 1200 w), or undefined when only one size exists. */
export function themeShotSrcSet(key: string): string | undefined {
  if (!captured.desktop.has(key) || !small.has(key)) return undefined;
  return `/theme-previews/${key}-desktop-640.webp 640w, /theme-previews/${key}-desktop.webp 1200w`;
}
