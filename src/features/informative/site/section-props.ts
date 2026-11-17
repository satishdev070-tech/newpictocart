import type { CSSProperties } from "react";
import { assetUrl } from "@/lib/storage/assets";

/**
 * Per-section settings the Website editor writes into `section.props` (docs/informative/EDITOR_PLAN.md).
 * Everything is optional: absent props keep the theme's default rendering. Pure helpers, no I/O,
 * so they are safe in server components and easy to test.
 */
export type Props = Record<string, unknown>;

export const str = (p: Props, key: string, max = 2000): string | null => {
  const v = p[key];
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
};

export const bool = (p: Props, key: string): boolean | null => (typeof p[key] === "boolean" ? (p[key] as boolean) : null);

export const int = (p: Props, key: string, min: number, max: number): number | null => {
  const v = p[key];
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null;
};

export function oneOf<T extends string>(p: Props, key: string, allowed: readonly T[]): T | null {
  const v = p[key];
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

/** Tenant media path (from the image picker) or an Unsplash CDN URL → displayable URL. */
export function imageUrl(p: Props, key: string): string | null {
  const v = str(p, key, 600);
  if (!v) return null;
  if (/^https:\/\/images\.unsplash\.com\//.test(v)) return v;
  if (/^https?:\/\//i.test(v) || v.startsWith("//") || v.includes("..")) return null;
  return assetUrl(v);
}

const SAFE_HREF = /^(\/[^\s]*|#[A-Za-z0-9_-]+|https:\/\/[^\s]+|tel:\+?[0-9 ()-]{3,20}|mailto:[^\s@]+@[^\s@]+|https:\/\/wa\.me\/[0-9]+[^\s]*)$/;

export type LinkProp = { label: string; href: string };

/** `{label, href}` with a safe href (site path, #anchor, https, tel:, mailto:). */
export function link(p: Props, key: string): LinkProp | null {
  const v = p[key];
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const label = typeof o.label === "string" ? o.label.trim().slice(0, 60) : "";
  const href = typeof o.href === "string" ? o.href.trim().slice(0, 500) : "";
  if (!label || !href || !SAFE_HREF.test(href)) return null;
  return { label, href };
}

/** Repeatable items: keeps objects only, caps the count, maps each with `pick`, drops empties. */
export function items<T>(p: Props, key: string, max: number, pick: (o: Record<string, unknown>) => T | null): T[] {
  const v = p[key];
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const it of v.slice(0, max)) {
    if (!it || typeof it !== "object") continue;
    const r = pick(it as Record<string, unknown>);
    if (r) out.push(r);
  }
  return out;
}

export const s = (o: Record<string, unknown>, k: string, max = 400): string => (typeof o[k] === "string" ? (o[k] as string).trim().slice(0, max) : "");

// ---- Common settings (every section) ------------------------------------------------------------

export const BACKGROUNDS = ["default", "surface", "accent", "dark", "image"] as const;
export const SPACINGS = ["compact", "normal", "spacious"] as const;
export const ALIGNS = ["left", "center"] as const;

const SPACING_Y: Record<(typeof SPACINGS)[number], string | null> = { compact: "2.5rem", normal: null, spacious: "7rem" };

/**
 * Wrapper style for a section's common settings. Backgrounds work by re-pointing the theme's CSS
 * variables, so every section type follows them without per-type code (and text keeps contrast).
 */
export function wrapperStyle(p: Props): { style?: CSSProperties; bgImage: string | null; className?: string } {
  const bg = oneOf(p, "background", BACKGROUNDS);
  const spacing = oneOf(p, "spacing", SPACINGS);
  const vars: Record<string, string> = {};
  const y = spacing ? SPACING_Y[spacing] : null;
  if (y) vars["--if-section-y"] = y;
  let bgImage: string | null = null;
  if (bg === "surface") vars["--if-bg"] = "var(--if-surface)";
  if (bg === "default") vars["--if-surface"] = "var(--if-bg)";
  if (bg === "accent" || bg === "dark" || bg === "image") {
    const base = bg === "accent" ? "var(--if-primary)" : bg === "dark" ? "#0b0b0d" : "transparent";
    const fg = bg === "accent" ? "var(--if-on-primary)" : "#ffffff";
    Object.assign(vars, {
      "--if-bg": base,
      "--if-surface": bg === "image" ? "rgb(0 0 0 / 0.35)" : base,
      "--if-text": fg,
      "--if-muted": bg === "accent" ? "var(--if-on-primary)" : "rgb(255 255 255 / 0.82)",
      "--if-link": fg,
      "--if-border": "rgb(255 255 255 / 0.22)",
    });
    if (bg === "image") bgImage = imageUrl(p, "backgroundImage");
  }
  return {
    style: Object.keys(vars).length ? (vars as CSSProperties) : undefined,
    bgImage,
    className: bg === "accent" || bg === "dark" || bg === "image" ? "text-(--if-text)" : undefined,
  };
}

export const alignOf = (p: Props, fallback: "left" | "center" = "left"): "left" | "center" => oneOf(p, "align", ALIGNS) ?? fallback;

/** `**bold**` → segments for safe React rendering (no HTML injection). */
export function boldSegments(line: string): { text: string; bold: boolean }[] {
  const out: { text: string; bold: boolean }[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), bold: false });
    out.push({ text: m[1]!, bold: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), bold: false });
  return out;
}
