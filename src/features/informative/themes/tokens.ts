import { AA_TEXT, ensureContrast, ensureFill, mix, readableOn } from "./color";
import { findFontPair, fontStack, type FontKey } from "./fonts";
import type { ThemeConfig } from "./types";

/**
 * Token → CSS variable pipeline (pure, unit tested). Applied as an inline `style` on the site root,
 * so a seller's own primary/secondary colours and font pair override the theme defaults. Every
 * text colour is derived to meet WCAG AA (4.5:1) against the surfaces it sits on, including after
 * a seller override.
 */
export type ThemeOverrides = { primaryColor?: string | null; secondaryColor?: string | null; fontPair?: string | null };

const RADIUS = { none: "0px", sm: "4px", md: "8px", lg: "14px", xl: "22px" } as const;
const SHADOW = {
  none: "none",
  soft: "0 1px 2px rgb(0 0 0 / 0.05), 0 4px 16px rgb(0 0 0 / 0.06)",
  medium: "0 2px 4px rgb(0 0 0 / 0.08), 0 12px 32px rgb(0 0 0 / 0.12)",
  glow: "0 0 0 1px rgb(255 255 255 / 0.06), 0 8px 40px rgb(0 0 0 / 0.5)",
} as const;
const SECTION_Y = { compact: "3.5rem", comfortable: "5rem", airy: "6.5rem" } as const;

export type ResolvedColors = {
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  /** Primary as readable text (links, eyebrows) on background AND surface. */
  link: string;
  border: string;
};

export function resolveColors(theme: ThemeConfig, o: ThemeOverrides = {}): ResolvedColors {
  const c = theme.tokens.colors;
  // Fills that no text colour can read on (mid-tones) are darkened just enough for white text.
  const primary = ensureFill(o.primaryColor ?? c.primary);
  const secondary = ensureFill(o.secondaryColor ?? c.secondary);
  const bgs = [c.background, c.surface];
  return {
    primary,
    onPrimary: readableOn(primary),
    secondary,
    onSecondary: readableOn(secondary),
    accent: c.accent,
    background: c.background,
    surface: c.surface,
    text: ensureContrast(c.text, bgs, AA_TEXT),
    muted: ensureContrast(c.mutedText, bgs, AA_TEXT),
    link: ensureContrast(primary, bgs, AA_TEXT),
    border: mix(c.background, c.text, theme.tokens.dark ? 0.22 : 0.14),
  };
}

export function resolveFonts(theme: ThemeConfig, o: ThemeOverrides = {}): { heading: FontKey; body: FontKey } {
  const pair = findFontPair(o.fontPair);
  return pair ? { heading: pair.heading, body: pair.body } : theme.tokens.fonts;
}

export function themeCssVars(theme: ThemeConfig, o: ThemeOverrides = {}): Record<string, string> {
  const col = resolveColors(theme, o);
  const f = resolveFonts(theme, o);
  return {
    "--if-primary": col.primary,
    "--if-on-primary": col.onPrimary,
    "--if-secondary": col.secondary,
    "--if-on-secondary": col.onSecondary,
    "--if-accent": col.accent,
    "--if-bg": col.background,
    "--if-surface": col.surface,
    "--if-text": col.text,
    "--if-muted": col.muted,
    "--if-link": col.link,
    "--if-border": col.border,
    "--if-font-heading": fontStack(f.heading),
    "--if-font-body": fontStack(f.body),
    "--if-radius": RADIUS[theme.tokens.radius],
    "--if-shadow": SHADOW[theme.tokens.shadow],
    "--if-section-y": SECTION_Y[theme.tokens.spacing],
    "--if-heading-case": theme.tokens.headingCase === "uppercase" ? "uppercase" : "none",
  };
}
