import type { ThemeConfig } from "@/features/theme/schema/config";
import { LAYOUT_KEYS, TEMPLATE_KEYS } from "@/features/theme/schema/config";
import { SECTION_DEFINITIONS } from "@/features/theme/sections/definitions";
import type { EditorField, SectionDefinition, SectionInstance } from "@/features/theme/sections/types";

/**
 * Canvas label chips (pure): the name shown at a section's bottom-right on the canvas,
 * e.g. "Hero / Slideshow" (section label / chosen layout variant).
 */

/** Max labels sent to the canvas in one message (protocol.ts clamps to the same). */
export const MAX_CHIP_LABELS = 500;

/** "HeroSlideshow" → "Hero slideshow" (fallback when a type has no definition). */
export function humanizeType(type: string): string {
  const words = type.replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1).toLowerCase() : "Section";
}

/** Chip text for one section. */
export function sectionChipLabel(section: Pick<SectionInstance, "type" | "settings">): string {
  const def = (SECTION_DEFINITIONS as Record<string, SectionDefinition | undefined>)[section.type];
  if (!def) return humanizeType(section.type);
  const variant = def.fields.find((f): f is Extract<EditorField, { kind: "select" }> => f.kind === "select" && f.display === "variants");
  if (!variant) return def.label;
  const value = (section.settings as Record<string, unknown> | undefined)?.[variant.key];
  const option = variant.options.find((o) => o.value === value) ?? variant.options[0];
  return option && option.label.toLowerCase() !== def.label.toLowerCase() ? `${def.label} / ${option.label}` : def.label;
}

/** Chip labels for every section in the document, by section id. */
export function sectionChipLabels(config: ThemeConfig): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (list: readonly SectionInstance[] | undefined) => {
    for (const s of list ?? []) {
      if (Object.keys(out).length >= MAX_CHIP_LABELS) return;
      out[s.id] = sectionChipLabel(s);
    }
  };
  for (const k of LAYOUT_KEYS) add(config.layout[k]);
  for (const k of TEMPLATE_KEYS) add(config.templates[k]);
  for (const p of config.pages) add(p.sections);
  return out;
}
