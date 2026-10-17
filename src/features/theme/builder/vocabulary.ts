import type { z } from "zod";
import { SECTION_DEFINITIONS } from "../sections/definitions";
import { SECTION_TYPES, type SectionType } from "../sections/types";
import { isStyleSetting } from "../marketplace/apply";

/**
 * What the AI builder (and the marketplace theme editor) may set on a section: its STYLE settings
 * only (enums, numbers, booleans that don't point at store content), read from the section's zod
 * schema so the vocabulary can't drift from the renderer. Pure; safe in client bundles.
 */

export type StyleField = { key: string; kind: "enum"; options: string[] } | { key: string; kind: "number"; min: number; max: number } | { key: string; kind: "boolean" };

/** Section types a marketplace home page may use (chrome and markers are set by the preset itself). */
const NOT_ON_HOME = new Set<SectionType>(["AnnouncementBar", "Header", "MegaMenu", "Footer", "PageContent"]);
export const HOME_SECTION_TYPES: readonly SectionType[] = SECTION_TYPES.filter((t) => !NOT_ON_HOME.has(t) && (SECTION_DEFINITIONS[t].groups as readonly string[]).includes("home"));
export const isHomeSectionType = (t: string): t is SectionType => (HOME_SECTION_TYPES as readonly string[]).includes(t);

type Def = { type?: string; innerType?: z.ZodType; entries?: Record<string, string>; values?: unknown[] };
const defOf = (s: unknown): Def | undefined => (s as { _zod?: { def?: Def } })?._zod?.def;

/** Unwraps default/prefault/optional/catch wrappers. */
function inner(s: z.ZodType): z.ZodType {
  let cur = s;
  for (let i = 0; i < 5; i++) {
    const d = defOf(cur);
    if (d && (d.type === "default" || d.type === "prefault" || d.type === "optional" || d.type === "catch" || d.type === "nullable") && d.innerType) cur = d.innerType;
    else break;
  }
  return cur;
}

export function fieldSchema(type: SectionType, key: string): z.ZodType | null {
  const shape = (SECTION_DEFINITIONS[type].schema as unknown as { shape?: Record<string, z.ZodType> }).shape;
  return shape?.[key] ?? null;
}

const cache = new Map<SectionType, StyleField[]>();

/** Style settings of a section type with their allowed values. */
export function styleFieldsFor(type: SectionType): StyleField[] {
  const hit = cache.get(type);
  if (hit) return hit;
  const shape = (SECTION_DEFINITIONS[type].schema as unknown as { shape?: Record<string, z.ZodType> }).shape ?? {};
  const out: StyleField[] = [];
  for (const [key, s] of Object.entries(shape)) {
    if (!isStyleSetting(type, key)) continue;
    const base = inner(s);
    const d = defOf(base);
    if (d?.type === "enum") out.push({ key, kind: "enum", options: Object.values(d.entries ?? {}) });
    else if (d?.type === "number") {
      const n = base as unknown as { minValue?: number | null; maxValue?: number | null };
      out.push({ key, kind: "number", min: Number.isFinite(n.minValue) ? Number(n.minValue) : 0, max: Number.isFinite(n.maxValue) ? Number(n.maxValue) : 100 });
    } else if (d?.type === "boolean") out.push({ key, kind: "boolean" });
  }
  cache.set(type, out);
  return out;
}

/** Layout-defining keys, listed first in the prompt and shown as the main control in the editor. */
export const LAYOUT_KEYS = ["variant", "layout", "style", "height", "columns", "cardRatio", "mediaRatio", "panelTone", "tone", "shape", "imagePosition", "spacing", "limit"] as const;

/** Compact vocabulary for the prompt: `Type: key=a|b|c; key=1..12; key=bool`. */
export function vocabularyText(): string {
  return HOME_SECTION_TYPES.map((t) => {
    const fields = styleFieldsFor(t)
      .filter((f) => (LAYOUT_KEYS as readonly string[]).includes(f.key) || f.kind === "enum")
      .slice(0, 14)
      .map((f) => (f.kind === "enum" ? `${f.key}=${f.options.join("|")}` : f.kind === "number" ? `${f.key}=${f.min}..${f.max}` : `${f.key}=true|false`));
    return `- ${t}: ${fields.join("; ") || "(no style settings)"}`;
  }).join("\n");
}

/** Chrome (announcement / header / footer) option lists, from the section schemas. */
export function chromeOptions() {
  const opts = (type: SectionType, key: string) => {
    const f = styleFieldsFor(type).find((x) => x.key === key);
    return f?.kind === "enum" ? f.options : [];
  };
  return {
    announcementTone: opts("AnnouncementBar", "tone"),
    announcementMode: opts("AnnouncementBar", "mode"),
    headerStyle: opts("Header", "style"),
    menuStyle: opts("Header", "menuStyle"),
    footerTone: opts("Footer", "tone"),
    footerLayout: opts("Footer", "layout"),
  };
}
