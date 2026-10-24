import type { ThemeConfig, LayoutKey, TemplateKey } from "@/features/theme/schema/config";
import { LAYOUT_KEYS, TEMPLATE_KEYS } from "@/features/theme/schema/config";
import type { SectionGroup, SectionInstance } from "@/features/theme/sections/types";
import { splitAtPageContent } from "@/features/theme/render/split";

/**
 * Canvas slots (pure). A slot is one rendered run of sections on a storefront page:
 *
 *   layout.header | layout.footer               the shared header / footer groups
 *   templates.<key>                             a whole template (home, or a template without PageContent)
 *   templates.<key>.before | .after             the parts of a template around the page's own content
 *   pages.<pageId>                              a site-builder page
 *   templates.home                              "/": the home template, or the sections of the page set
 *                                               as the homepage (config.homePageId; list pages.<id>)
 *   handle.<handle>                             /pages/<handle> in the preview when the server had no
 *                                               such theme page yet (an unsaved new page)
 *
 * A slot belongs to one section LIST (the slot key without .before/.after); the builder edits the
 * list and the canvas re-renders every slot of that list.
 */

export const SLOT_KEY_RE = /^(layout\.(header|footer)|templates\.[a-zA-Z]{2,20}(\.(before|after))?|pages\.[a-z0-9][a-z0-9-]{2,39}|handle\.[a-z0-9][a-z0-9-]{0,59})$/;

export type ListKey = `layout.${LayoutKey}` | `templates.${TemplateKey}` | `pages.${string}`;

export function listKeyOf(slot: string): ListKey | null {
  if (!SLOT_KEY_RE.test(slot) || slot.startsWith("handle.")) return null;
  return slot.replace(/\.(before|after)$/, "") as ListKey;
}

export function getList(config: ThemeConfig, key: ListKey): SectionInstance[] | null {
  const [area, name] = key.split(".") as [string, string];
  if (area === "layout") return (LAYOUT_KEYS as readonly string[]).includes(name) ? config.layout[name as LayoutKey] : null;
  if (area === "templates") return (TEMPLATE_KEYS as readonly string[]).includes(name) ? config.templates[name as TemplateKey] : null;
  if (area === "pages") return config.pages.find((p) => p.id === name)?.sections ?? null;
  return null;
}

export function setList(config: ThemeConfig, key: ListKey, list: SectionInstance[]): ThemeConfig {
  const [area, name] = key.split(".") as [string, string];
  if (area === "layout") return { ...config, layout: { ...config.layout, [name]: list } };
  if (area === "templates") return { ...config, templates: { ...config.templates, [name]: list } };
  if (area === "pages") return { ...config, pages: config.pages.map((p) => (p.id === name ? { ...p, sections: list } : p)) };
  return config;
}

/** Section group that governs what may be added to a list. */
export function groupOfList(key: ListKey): SectionGroup {
  const [area, name] = key.split(".") as [string, string];
  if (area === "pages") return "custom";
  return name as SectionGroup;
}

/** The list a slot's sections belong to (handle slots resolve to their page), or null. */
export function slotList(config: ThemeConfig, slot: string): ListKey | null {
  // A page chosen as the homepage renders in the home slot ("/").
  if (slot === "templates.home" && config.homePageId && config.pages.some((p) => p.id === config.homePageId)) return `pages.${config.homePageId}`;
  if (slot.startsWith("handle.") && SLOT_KEY_RE.test(slot)) {
    const page = config.pages.find((p) => p.handle === slot.slice(7));
    return page ? `pages.${page.id}` : null;
  }
  return listKeyOf(slot);
}

/** The sections a slot renders, or null for an unknown slot. */
export function slotSections(config: ThemeConfig, slot: string): SectionInstance[] | null {
  const key = slotList(config, slot);
  if (!key) return null;
  const list = getList(config, key);
  if (!list) return null;
  if (slot.endsWith(".before")) return splitAtPageContent(list)[0];
  if (slot.endsWith(".after")) return splitAtPageContent(list)[1];
  return list;
}

/**
 * The section list a page slot shows for `doc` (the builder's document). The home slot shows the
 * chosen homepage ("pages.<id>") and handle slots show a builder page, so mapping by slot name alone
 * missed their edits (Bugs 2.0 #11).
 */
export function slotListOf(doc: unknown, slot: string): string {
  if (doc && typeof doc === "object" && Array.isArray((doc as { pages?: unknown }).pages)) {
    try {
      const key = slotList(doc as ThemeConfig, slot);
      if (key) return key;
    } catch {
      // fall through to the slot name
    }
  }
  return listKeyOf(slot) ?? slot;
}
