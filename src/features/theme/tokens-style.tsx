import { FONT_STACKS, type ThemeTokens } from "./schema/tokens";
import { HEX_COLOR_RE } from "./schema/primitives";
import { TYPE_LEVELS, type TypeLevel, type Typography } from "./schema/site";

/**
 * Theme tokens -> CSS custom properties, scoped to the storefront root ([data-sf-root]).
 * Only validated values reach the CSS: hex colours (re-checked here), enumerated keys mapped
 * to fixed strings in code. Seller-typed text never becomes CSS.
 */

const CONTAINER: Record<ThemeTokens["containerWidth"], string> = { narrow: "1080px", default: "1280px", wide: "1440px", full: "100%" };
const SECTION_Y: Record<ThemeTokens["spacing"], [string, string]> = {
  compact: ["2.5rem", "3.5rem"],
  comfortable: ["3.5rem", "5rem"],
  airy: ["4rem", "7rem"],
};
const BUTTON_RADIUS: Record<ThemeTokens["buttonShape"], string> = { square: "0px", rounded: "8px", pill: "999px" };
const CARD_RADIUS: Record<ThemeTokens["cardRadius"], string> = { none: "0px", sm: "4px", md: "10px", lg: "18px" };

function safeHex(v: string, fallback: string): string {
  return HEX_COLOR_RE.test(v) ? v.toLowerCase() : fallback;
}

/** Relative luminance (WCAG) of a #rrggbb colour. */
export function luminance(hex: string): number {
  const n = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * n(1) + 0.7152 * n(3) + 0.0722 * n(5);
}

/** Readable foreground (near-black or near-white) for text on the given background. */
export function readableOn(hex: string): string {
  const l = luminance(hex);
  const contrastWhite = 1.05 / (l + 0.05);
  const contrastBlack = (l + 0.05) / 0.05;
  return contrastWhite >= contrastBlack ? "#ffffff" : "#141414";
}

export function themeCssVariables(tokens: ThemeTokens): Record<`--sf-${string}`, string> {
  const c = tokens.colors;
  const primary = safeHex(c.primary, "#1f1a17");
  const accent = safeHex(c.accent, "#b4532a");
  const secondary = safeHex(c.secondary, "#7a2e1f");
  const bg = safeHex(c.background, "#ffffff");
  const text = safeHex(c.text, "#141414");
  const [sectionY, sectionYLg] = SECTION_Y[tokens.spacing] ?? SECTION_Y.comfortable;
  return {
    "--sf-primary": primary,
    "--sf-primary-fg": readableOn(primary),
    "--sf-secondary": secondary,
    "--sf-secondary-fg": readableOn(secondary),
    "--sf-accent": accent,
    "--sf-accent-fg": readableOn(accent),
    "--sf-bg": bg,
    "--sf-text": text,
    "--sf-border": safeHex(c.border, "#e5e5e5"),
    "--sf-sale": safeHex(c.sale, "#b42318"),
    "--sf-muted": `color-mix(in srgb, ${text} 62%, ${bg})`,
    "--sf-surface": `color-mix(in srgb, ${text} 4%, ${bg})`,
    "--sf-font-heading": (FONT_STACKS[tokens.headingFont] ?? FONT_STACKS["classic-serif"]).stack,
    "--sf-font-body": (FONT_STACKS[tokens.bodyFont] ?? FONT_STACKS["modern-sans"]).stack,
    "--sf-heading-case": tokens.headingCase === "uppercase" ? "uppercase" : "none",
    "--sf-heading-tracking": tokens.headingCase === "uppercase" ? "0.08em" : "-0.01em",
    "--sf-radius-btn": BUTTON_RADIUS[tokens.buttonShape] ?? "0px",
    "--sf-radius-card": CARD_RADIUS[tokens.cardRadius] ?? "0px",
    "--sf-container": CONTAINER[tokens.containerWidth] ?? "1280px",
    "--sf-section-y": sectionY,
    "--sf-section-y-lg": sectionYLg,
  };
}

const LEVEL_SELECTOR: Record<TypeLevel, string> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  p: "p",
  small: "small,.text-xs,.text-sm",
};

/**
 * Site builder type scale. Only levels the seller changed emit CSS (numbers and enumerations only).
 * Unlayered, so it wins over the layered utility classes the sections use; phones get 80%.
 */
export function typographyCss(t: Typography | undefined, selector = "[data-sf-root]"): string {
  if (!t) return "";
  let desktop = "";
  let mobile = "";
  for (const level of TYPE_LEVELS) {
    const s = t[level];
    if (!s) continue;
    const decl: string[] = [];
    if (Number.isInteger(s.size) && s.size > 0) decl.push(`font-size:${s.size}px`);
    if (/^[3-8]00$/.test(s.weight)) decl.push(`font-weight:${s.weight}`);
    if (s.font === "heading") decl.push("font-family:var(--sf-font-heading)");
    if (s.font === "body") decl.push("font-family:var(--sf-font-body)");
    if (Number.isInteger(s.lineHeight) && s.lineHeight > 0) decl.push(`line-height:${(s.lineHeight / 100).toFixed(2)}`);
    if (!decl.length) continue;
    const sel = LEVEL_SELECTOR[level].split(",").map((x) => `${selector} ${x}`).join(",");
    desktop += `${sel}{${decl.join(";")}}`;
    if (s.size > 0) mobile += `${sel}{font-size:${Math.max(12, Math.round(s.size * 0.8))}px}`;
  }
  return desktop + (mobile ? `@media (max-width:767px){${mobile}}` : "");
}

/** CSS text for the tokens; exported for tests. */
export function themeCss(tokens: ThemeTokens, selector = "[data-sf-root]"): string {
  const vars = themeCssVariables(tokens);
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  return `${selector}{${body}}${typographyCss(tokens.typography, selector)}`;
}

/**
 * Emits the tenant's theme tokens as a scoped <style>. Render once inside the storefront root
 * (store/[host]/layout.tsx does this; C's cart/checkout/account pages inherit it).
 */
export function ThemeTokensStyle({ tokens, selector = "[data-sf-root]" }: { tokens: ThemeTokens; selector?: "[data-sf-root]" | "[data-sf-preview]" }) {
  const css = <style>{themeCss(tokens, selector)}</style>;
  if (tokens.finish !== "refined") return css;
  // Opt-in polish: a marker right after the <style> so CSS can scope with the sibling combinator
  // ([data-sf-finish="refined"] ~ * …) instead of a costly :has() over the whole page.
  return (
    <>
      {css}
      <i hidden data-sf-finish="refined" />
    </>
  );
}
