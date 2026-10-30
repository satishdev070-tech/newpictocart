import { z } from "zod";
import type { CSSProperties } from "react";
import { HEX_COLOR_RE, hexColor } from "./primitives";
import { FONT_KEYS, FONT_STACKS, type FontKey } from "./tokens";

/**
 * Per-text look overrides for Hero slides and RichText (Phase D). Structured settings only — never
 * free HTML. Every key is defaulted / optional-absent so themes saved before these fields render
 * unchanged. Applied as careful inline styles + CSS variables (see textLookVars / textLookStyle).
 */

export const TEXT_FONTS = ["default", "heading", "body"] as const;
export type TextFont = (typeof TEXT_FONTS)[number];
export const TEXT_WEIGHTS = ["default", "300", "400", "500", "600", "700", "800"] as const;
export type TextWeight = (typeof TEXT_WEIGHTS)[number];
export const TEXT_ALIGNS = ["default", "left", "center", "right"] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

/** Text roles that get their own look on Hero slides / RichText. */
export const TEXT_ROLES = ["heading", "subheading", "body", "cta", "eyebrow"] as const;
export type TextRole = (typeof TEXT_ROLES)[number];

/** Limits shared by schema, panel steppers and canvas resize. */
export const TEXT_LOOK_LIMITS = {
  size: { min: 0, max: 120 },
  /** Width as % of the text column; 0 = auto (theme). */
  widthPct: { min: 0, max: 100 },
  /** Phone clamp: never wider than this % of the column on small screens. */
  mobileMaxWidthPct: 100,
  /** Soft minimum readable width (%) when the seller has set a width. */
  mobileMinWidthPct: 40,
} as const;

const size = z.coerce.number().int().min(TEXT_LOOK_LIMITS.size.min).max(TEXT_LOOK_LIMITS.size.max).default(0);
const widthPct = z.coerce.number().int().min(TEXT_LOOK_LIMITS.widthPct.min).max(TEXT_LOOK_LIMITS.widthPct.max).default(0);
/** Empty string or #rrggbb (hexColor rejects anything that could break out of a CSS declaration). */
const color = z.union([z.literal(""), hexColor]).default("");
/** Concrete FONT_STACKS key, or "" to use `font` (theme default / heading / body role). */
const fontKey = z.union([z.literal(""), z.enum(FONT_KEYS)]).default("");

export const textLookSchema = z.object({
  font: z.enum(TEXT_FONTS).default("default"),
  /** Optional concrete stack; when set it wins over `font` role mapping (backward compatible). */
  fontKey,
  weight: z.enum(TEXT_WEIGHTS).default("default"),
  /** Desktop size in px; 0 = theme default. Phones get 80% (never below 12px). */
  size,
  /** Empty = inherit from the section / theme. */
  color,
  align: z.enum(TEXT_ALIGNS).default("default"),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  /** Text-box width as % of the column; 0 = auto. Canvas resize + panel steppers write this. */
  widthPct,
});
export type TextLook = z.infer<typeof textLookSchema>;

export const DEFAULT_TEXT_LOOK: TextLook = {
  font: "default",
  fontKey: "",
  weight: "default",
  size: 0,
  color: "",
  align: "default",
  bold: false,
  italic: false,
  underline: false,
  widthPct: 0,
};

/** Drops values that match the defaults so the saved JSON stays small. Undefined when nothing set. */
export function normalizeTextLook(look: TextLook | undefined | null): TextLook | undefined {
  if (!look) return undefined;
  const out: Partial<TextLook> = {};
  if (look.font !== "default") out.font = look.font;
  if (look.fontKey) out.fontKey = look.fontKey;
  if (look.weight !== "default") out.weight = look.weight;
  if (look.size > 0) out.size = look.size;
  if (look.color) out.color = look.color;
  if (look.align !== "default") out.align = look.align;
  if (look.bold) out.bold = true;
  if (look.italic) out.italic = true;
  if (look.underline) out.underline = true;
  if (look.widthPct > 0) out.widthPct = look.widthPct;
  return Object.keys(out).length ? ({ ...DEFAULT_TEXT_LOOK, ...out } satisfies TextLook) : undefined;
}

/** Parses a raw look; invalid input → issues + undefined (the rest of the section still renders). */
export function parseTextLook(raw: unknown): { look?: TextLook; error?: z.ZodError } {
  if (raw === undefined || raw === null || raw === "") return {};
  const r = textLookSchema.safeParse(raw);
  if (!r.success) return { error: r.error };
  return { look: normalizeTextLook(r.data) };
}

/** Zod field used inside section schemas: accepts partials, always yields a full TextLook. */
export const textLookField = textLookSchema.prefault({});

/** Whether any override is active (for the editor "Reset" affordance). */
export function textLookChanged(look: TextLook | undefined | null): boolean {
  return normalizeTextLook(look) !== undefined;
}

/**
 * Phone width for a desktop %: keep the seller's intent but never exceed the column and never
 * shrink below a readable floor when a width is set.
 */
export function clampTextWidthPct(widthPct: number, device: "desktop" | "mobile"): number {
  if (!Number.isInteger(widthPct) || widthPct <= 0) return 0;
  const capped = Math.min(TEXT_LOOK_LIMITS.widthPct.max, Math.max(TEXT_LOOK_LIMITS.widthPct.min, widthPct));
  if (device === "desktop") return capped;
  return Math.min(TEXT_LOOK_LIMITS.mobileMaxWidthPct, Math.max(TEXT_LOOK_LIMITS.mobileMinWidthPct, capped));
}

/** Merge a patch onto a look (editor / canvas resize). */
export function patchTextLook(current: unknown, patch: Partial<TextLook>): TextLook {
  const base = textLookSchema.parse(current ?? {});
  return textLookSchema.parse({ ...base, ...patch });
}

const FONT_CSS: Record<Exclude<TextFont, "default">, string> = {
  heading: "var(--sf-font-heading)",
  body: "var(--sf-font-body)",
};

/** Resolve the CSS font-family for a look: concrete `fontKey` wins over role `font`. */
export function textLookFontFamily(look: TextLook | undefined | null): string | undefined {
  if (!look) return undefined;
  const key = look.fontKey;
  if (key && (FONT_KEYS as readonly string[]).includes(key)) return FONT_STACKS[key as FontKey].stack;
  if (look.font !== "default") return FONT_CSS[look.font];
  return undefined;
}

/**
 * Inline style map for a text look. Only emits properties that differ from the theme default so
 * Tailwind / sf-* classes keep winning when the seller hasn't overridden them.
 */
export function textLookStyle(look: TextLook | undefined | null, opts?: { device?: "desktop" | "mobile" }): CSSProperties | undefined {
  if (!look) return undefined;
  const device = opts?.device ?? "desktop";
  const style: CSSProperties = {};
  const family = textLookFontFamily(look);
  if (family) style.fontFamily = family;
  if (look.bold) style.fontWeight = 700;
  else if (look.weight !== "default" && /^[3-8]00$/.test(look.weight)) style.fontWeight = Number(look.weight);
  if (Number.isInteger(look.size) && look.size > 0) {
    const px = device === "mobile" ? Math.max(12, Math.round(look.size * 0.8)) : look.size;
    style.fontSize = `${px}px`;
  }
  if (look.color && HEX_COLOR_RE.test(look.color)) style.color = look.color;
  if (look.align !== "default") style.textAlign = look.align;
  if (look.italic) style.fontStyle = "italic";
  if (look.underline) style.textDecorationLine = "underline";
  const w = clampTextWidthPct(look.widthPct, device);
  if (w > 0) {
    style.width = `${w}%`;
    style.maxWidth = "100%";
    // Keep CSS var for storefront.css mobile clamp (preview device may still be desktop CSS).
    (style as CSSProperties & Record<string, string>)["--pc-text-w"] = `${look.widthPct}%`;
  }
  return Object.keys(style).length ? style : undefined;
}

/**
 * Data attributes for canvas selection / resize chrome and the storefront mobile clamp rule.
 * `role` is the text field key (heading | subheading | body | cta); `item` is an optional list index.
 */
export function textLookAttrs(
  role: TextRole,
  look: TextLook | undefined | null,
  itemIndex?: number,
): Record<string, string> {
  const attrs: Record<string, string> = { "data-pc-text": role };
  if (typeof itemIndex === "number" && Number.isInteger(itemIndex) && itemIndex >= 0) {
    attrs["data-pc-text-item"] = String(itemIndex);
  }
  const w = look?.widthPct ?? 0;
  if (Number.isInteger(w) && w > 0) attrs["data-pc-text-width"] = String(w);
  return attrs;
}

/** CSS custom properties only (when a wrapper already has other inline styles). */
export function textLookVars(look: TextLook | undefined | null): Record<string, string> | undefined {
  const w = look?.widthPct ?? 0;
  if (!Number.isInteger(w) || w <= 0) return undefined;
  return { "--pc-text-w": `${w}%` };
}

/** Safe colour string for the colour input (rejects non-hex). */
export function safeTextColor(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v === "") return "";
  return hexColor.safeParse(v).success ? v : "";
}
