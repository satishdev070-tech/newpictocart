import localFont from "next/font/local";

/**
 * Platform fonts, self-hosted from @fontsource packages (ADR-019: no build-time font downloads).
 * Inter for application UI, Fraunces for brand/marketing display type. Exposed as CSS variables
 * consumed by globals.css (--font-sans / --font-display).
 */
export const inter = localFont({
  // Normal only — italic face (~50KB) is unused by marketing/platform UI (font-brand is Inter).
  src: [{ path: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", style: "normal", weight: "100 900" }],
  variable: "--font-inter",
  display: "swap",
  // Not preloaded: the root layout is shared with every storefront, and a preload here made each
  // store download ~97 KB of Inter that its theme never uses. The variable stays on <html> (the
  // "modern-sans" theme stack and the platform UI use it), so pages that render Inter still load it.
  preload: false,
});

/** Marketing site display face (dark editorial headings). Imported only by the (marketing) layout. */
export const interTight = localFont({
  src: [{ path: "../../node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2", style: "normal", weight: "100 900" }],
  variable: "--font-inter-tight",
  display: "swap",
  adjustFontFallback: "Arial",
});

/** Marketing mono labels (section eyebrows, step numbers, tags). */
export const jetbrainsMono = localFont({
  src: [{ path: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2", style: "normal", weight: "100 800" }],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: false,
});

export const fraunces = localFont({
  src: [{ path: "../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2", style: "normal", weight: "100 900" }],
  variable: "--font-fraunces",
  display: "swap",
  preload: false,
});
