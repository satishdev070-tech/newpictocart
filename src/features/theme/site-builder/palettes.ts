import type { ThemeConfig } from "@/features/theme/schema/config";
import { tokensSchema, type ThemeTokens } from "@/features/theme/schema/tokens";
import { HEX_COLOR_RE } from "@/features/theme/schema/primitives";

/**
 * Site builder "Theme settings" helpers (pure; unit tested): curated colour palettes and the
 * design-token-only application of a marketplace theme preset.
 */

export type ColorKey = keyof ThemeTokens["colors"];
export const COLOR_KEYS: readonly ColorKey[] = ["primary", "secondary", "accent", "background", "text", "border", "sale"];
export const COLOR_LABELS: Record<ColorKey, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  background: "Background",
  text: "Text",
  border: "Borders",
  sale: "Sale price",
};

export type Palette = { key: string; name: string; colors: Record<ColorKey, string> };

export const PALETTES: readonly Palette[] = [
  { key: "ivory-ink", name: "Ivory & ink", colors: { primary: "#1f1a17", secondary: "#7a2e1f", accent: "#b4532a", background: "#fbf8f3", text: "#1f1a17", border: "#e6ded3", sale: "#9f2a1c" } },
  { key: "monochrome", name: "Monochrome", colors: { primary: "#111111", secondary: "#3f3f46", accent: "#111111", background: "#ffffff", text: "#18181b", border: "#e4e4e7", sale: "#b91c1c" } },
  { key: "rose-marigold", name: "Rose & marigold", colors: { primary: "#c2185b", secondary: "#ff9f1c", accent: "#ff9f1c", background: "#fff9f4", text: "#2d1b24", border: "#f3d9d2", sale: "#d62839" } },
  { key: "forest", name: "Forest", colors: { primary: "#1f3d2b", secondary: "#5b7f4a", accent: "#c08a2e", background: "#f6f4ec", text: "#1c2a20", border: "#dcd8c8", sale: "#a3361f" } },
  { key: "ocean", name: "Ocean", colors: { primary: "#0b3c5d", secondary: "#328cc1", accent: "#d9b310", background: "#f5f9fc", text: "#0f2433", border: "#d6e3ec", sale: "#c0392b" } },
  { key: "midnight-gold", name: "Midnight gold", colors: { primary: "#c9a24a", secondary: "#8a6d2f", accent: "#e3c27a", background: "#121212", text: "#f2ede4", border: "#2e2a24", sale: "#e0614a" } },
  { key: "terracotta", name: "Terracotta", colors: { primary: "#8c3b24", secondary: "#c4683f", accent: "#d9a441", background: "#faf3ec", text: "#3a2318", border: "#ead8c8", sale: "#a12b1b" } },
  { key: "lavender", name: "Lavender", colors: { primary: "#5b4b8a", secondary: "#9a86c9", accent: "#e58fa6", background: "#faf8ff", text: "#2a2440", border: "#e6e0f3", sale: "#c2334d" } },
  { key: "citrus", name: "Citrus pop", colors: { primary: "#ff5a1f", secondary: "#ffb400", accent: "#00a676", background: "#fffdf7", text: "#1e1e1e", border: "#f1e6cf", sale: "#e02424" } },
  { key: "sage-blush", name: "Sage & blush", colors: { primary: "#6b7f6a", secondary: "#c9a49a", accent: "#b9785f", background: "#f8f6f2", text: "#2f3330", border: "#e3e0d8", sale: "#a8432f" } },
];

/** Replace the theme colours (invalid hex values are ignored; the result is a new config). */
export function applyPalette(config: ThemeConfig, colors: Partial<Record<ColorKey, string>>): ThemeConfig {
  const next = { ...config.tokens.colors };
  for (const k of COLOR_KEYS) {
    const v = colors[k];
    if (typeof v === "string" && HEX_COLOR_RE.test(v)) next[k] = v.toLowerCase();
  }
  return { ...config, tokens: { ...config.tokens, colors: next } };
}

/** True when the config's colours equal the palette's. */
export function isPaletteActive(tokens: ThemeTokens, palette: Palette): boolean {
  return COLOR_KEYS.every((k) => tokens.colors[k].toLowerCase() === palette.colors[k].toLowerCase());
}

/** Normalise a colour search term (trim, lower-case, optional leading # stripped for hex matches). */
export function normalizeColourQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * Build a searchable string from a palette / theme colour set: name, colour role labels
 * (primary, accent…), and hex values with and without `#`.
 */
export function colourSearchHaystack(opts: {
  name?: string;
  colors?: Partial<Record<string, string>> | null;
  extra?: readonly string[];
}): string {
  const parts: string[] = [];
  if (opts.name) parts.push(opts.name);
  if (opts.colors) {
    for (const [k, v] of Object.entries(opts.colors)) {
      if (typeof v !== "string") continue;
      const label = COLOR_LABELS[k as ColorKey];
      if (label) parts.push(label, k);
      else parts.push(k);
      const hex = v.trim().toLowerCase();
      parts.push(hex);
      if (hex.startsWith("#")) parts.push(hex.slice(1));
    }
  }
  if (opts.extra) parts.push(...opts.extra);
  return parts.join(" ").toLowerCase();
}

/** True when `query` is empty or appears in the haystack (hex / name / role label). */
export function matchesColourSearch(query: string, haystack: string): boolean {
  const term = normalizeColourQuery(query);
  if (!term) return true;
  const h = haystack.toLowerCase();
  if (h.includes(term)) return true;
  // Allow matching "#abc" against haystack that stores "abc" (and vice versa).
  const bare = term.startsWith("#") ? term.slice(1) : term;
  return bare.length > 0 && (h.includes(bare) || h.includes(`#${bare}`));
}

/** Filter curated palettes by hex, colour role name, or palette name. */
export function filterPalettes(palettes: readonly Palette[], query: string): Palette[] {
  const term = normalizeColourQuery(query);
  if (!term) return [...palettes];
  return palettes.filter((p) => matchesColourSearch(term, colourSearchHaystack({ name: p.name, colors: p.colors, extra: [p.key] })));
}

/** Filter marketplace themes by name / tagline / industry / style plus colour hexes and roles. */
export function filterThemesByColourSearch<
  T extends { name: string; tagline?: string; industry?: string; style?: string; preset: { tokens: { colors?: Partial<Record<string, string>> } } },
>(themes: readonly T[], query: string): T[] {
  const term = normalizeColourQuery(query);
  if (!term) return [...themes];
  return themes.filter((t) =>
    matchesColourSearch(
      term,
      colourSearchHaystack({
        name: t.name,
        colors: t.preset.tokens.colors,
        extra: [t.tagline ?? "", t.industry ?? "", t.style ?? ""],
      }),
    ),
  );
}

/** Design tokens a theme preset may change (never typography overrides or stock-photo choice). */
export const PRESET_TOKEN_KEYS = ["headingFont", "bodyFont", "headingCase", "buttonShape", "buttonVariant", "cardRadius", "containerWidth", "spacing", "sectionHeadingAlign", "finish"] as const;

/**
 * Apply only the DESIGN TOKENS of a marketplace preset (colours, fonts, buttons, corners, width,
 * spacing, heading case…). Sections, header/product-card settings, menus, pages and popups are
 * untouched. Each value is validated against tokensSchema; invalid ones keep the current value.
 */
export function applyPresetTokens(config: ThemeConfig, presetTokens: Record<string, unknown> | null | undefined): ThemeConfig {
  if (!presetTokens || typeof presetTokens !== "object") return config;
  let tokens: ThemeTokens = config.tokens;
  for (const k of PRESET_TOKEN_KEYS) {
    if (!(k in presetTokens)) continue;
    const r = tokensSchema.safeParse({ ...tokens, [k]: presetTokens[k] });
    if (r.success) tokens = { ...tokens, [k]: r.data[k] };
  }
  const colors = presetTokens.colors;
  const withColors = colors && typeof colors === "object" ? applyPalette({ ...config, tokens }, colors as Partial<Record<ColorKey, string>>) : { ...config, tokens };
  return withColors;
}
