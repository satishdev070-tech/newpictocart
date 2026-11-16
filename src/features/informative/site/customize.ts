import type { PageSection, SectionType } from "../sections";
import type { HomeLayout } from "../schemas";

/**
 * Customizer section helpers (pure, unit tested). The HOME page's sections (info_pages.sections)
 * stay the single source of truth: the Customizer edits their order / visibility and the hero
 * text, so it and the Pages editor always agree.
 */

export type LayoutEntry = HomeLayout[number];

/** Sections → the Customizer's layout list. */
export function toLayout(sections: readonly PageSection[]): LayoutEntry[] {
  return [...sections].sort((a, b) => a.order - b.order).map((s) => ({ id: s.id, type: s.type, visible: s.visible }));
}

/**
 * Applies a layout to the stored sections: layout entries first, in layout order and with the
 * layout's visibility (props kept from the stored section; ids not stored yet become new empty
 * sections), then any stored section the layout doesn't mention, in its original order.
 * `order` is renumbered 0..n-1.
 */
export function applySectionLayout(base: readonly PageSection[], layout: readonly LayoutEntry[]): PageSection[] {
  const byId = new Map(base.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const out: PageSection[] = [];
  for (const e of layout) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const stored = byId.get(e.id);
    out.push(stored ? { ...stored, visible: e.visible } : { id: e.id, type: e.type, props: {}, order: 0, visible: e.visible });
  }
  const rest = [...base].sort((a, b) => a.order - b.order).filter((s) => !seen.has(s.id));
  return [...out, ...rest].map((s, i) => ({ ...s, order: i }));
}

/**
 * Sets the hero text on the first hero section (empty text removes the prop, so the hero falls back
 * to the business name / tagline). Other sections and other props are untouched.
 */
export function applyHeroText(sections: readonly PageSection[], text: { heading?: string | null; subheading?: string | null }): PageSection[] {
  const i = sections.findIndex((s) => s.type === "hero");
  if (i < 0) return [...sections];
  const props: Record<string, unknown> = { ...sections[i]!.props };
  for (const [key, v] of [["heading", text.heading], ["subheading", text.subheading]] as const) {
    if (typeof v === "string" && v.trim()) props[key] = v.trim();
    else delete props[key];
  }
  return sections.map((s, j) => (j === i ? { ...s, props } : s));
}

/** The first hero section's text (what the Customizer shows in its Hero fields). */
export function heroText(sections: readonly PageSection[]): { heading: string; subheading: string } {
  const hero = [...sections].sort((a, b) => a.order - b.order).find((s) => s.type === "hero");
  const get = (k: string) => (typeof hero?.props[k] === "string" ? (hero.props[k] as string) : "");
  return { heading: get("heading"), subheading: get("subheading") };
}

/** Smallest free `<type>-<n>` id. */
export function newSectionId(type: SectionType, taken: Iterable<string>): string {
  const used = new Set(taken);
  let n = 0;
  while (used.has(`${type}-${n}`)) n++;
  return `${type}-${n}`;
}

/** Moves item i one step up (-1) or down (+1); out of range returns the list unchanged. */
export function moveItem<T>(list: readonly T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return [...list];
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/**
 * "Reset to design defaults" for the home layout: the design's default section order, all visible,
 * reusing existing sections of each type (so their text is kept); sections the design doesn't use
 * are kept at the end, hidden.
 */
export function resetLayout(defaultTypes: readonly SectionType[], current: readonly LayoutEntry[]): LayoutEntry[] {
  const used = new Set<string>();
  const ids = new Set(current.map((e) => e.id));
  const out: LayoutEntry[] = defaultTypes.map((type) => {
    const match = current.find((e) => e.type === type && !used.has(e.id));
    const id = match?.id ?? newSectionId(type, ids);
    used.add(id);
    ids.add(id);
    return { id, type, visible: true };
  });
  return [...out, ...current.filter((e) => !used.has(e.id)).map((e) => ({ ...e, visible: false }))];
}
