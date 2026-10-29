import type { ThemeConfig, ThemePage } from "@/features/theme/schema/config";
import { groupAllows, MAX_SECTIONS_PER_GROUP } from "@/features/theme/schema/config";
import { SECTION_DEFINITIONS, defaultSettings } from "@/features/theme/sections/definitions";
import type { SectionInstance, SectionStyle, SectionType } from "@/features/theme/sections/types";
import type { ThemeMenu } from "@/features/theme/schema/links";
import type { PageMeta, Popup } from "@/features/theme/schema/site";
import { MAX_THEME_PAGES, MAX_POPUPS } from "@/features/theme/schema/site";
import { getList, groupOfList, setList, type ListKey } from "./slots";

/**
 * Pure theme-document operations used by the site builder. Every function returns a NEW config
 * (or the same object when nothing changed), so the undo history can keep snapshots.
 */

/** Short url-safe id matching SECTION_ID_RE (`s` + 9 base36 chars). */
export function newId(prefix = "s"): string {
  const rand = Array.from({ length: 9 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
  return `${prefix}${rand}`;
}

function mapList(config: ThemeConfig, key: ListKey, fn: (list: SectionInstance[]) => SectionInstance[]): ThemeConfig {
  const list = getList(config, key);
  if (!list) return config;
  const next = fn(list);
  return next === list ? config : setList(config, key, next);
}

export function findSection(config: ThemeConfig, key: ListKey, id: string): SectionInstance | null {
  return getList(config, key)?.find((s) => s.id === id) ?? null;
}

/** Move a section by `delta` positions (−1 up, +1 down). */
export function moveSection(config: ThemeConfig, key: ListKey, id: string, delta: number): ThemeConfig {
  return mapList(config, key, (list) => {
    const i = list.findIndex((s) => s.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return list;
    const next = [...list];
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item!);
    return next;
  });
}

/** Move a section to an absolute index (drag and drop in Layers). */
export function moveSectionTo(config: ThemeConfig, key: ListKey, id: string, index: number): ThemeConfig {
  return mapList(config, key, (list) => {
    const i = list.findIndex((s) => s.id === id);
    if (i < 0) return list;
    const next = [...list];
    const [item] = next.splice(i, 1);
    next.splice(Math.max(0, Math.min(index, next.length)), 0, item!);
    return next;
  });
}

export function canAddSection(config: ThemeConfig, key: ListKey, type: SectionType): boolean {
  const list = getList(config, key);
  if (!list || list.length >= MAX_SECTIONS_PER_GROUP) return false;
  if (!groupAllows(type, groupOfList(key))) return false;
  const def = SECTION_DEFINITIONS[type] as { singleton?: boolean };
  return !(def.singleton && list.some((s) => s.type === type));
}

export function duplicateSection(config: ThemeConfig, key: ListKey, id: string): { config: ThemeConfig; newId: string | null } {
  const src = findSection(config, key, id);
  if (!src || !canAddSection(config, key, src.type)) return { config, newId: null };
  const copy: SectionInstance = { ...structuredClone(src), id: newId() };
  return {
    config: mapList(config, key, (list) => {
      const i = list.findIndex((s) => s.id === id);
      return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)];
    }),
    newId: copy.id,
  };
}

export function removeSection(config: ThemeConfig, key: ListKey, id: string): ThemeConfig {
  return mapList(config, key, (list) => (list.some((s) => s.id === id) ? list.filter((s) => s.id !== id) : list));
}

/** Hide on both devices, or show again on both. */
export function toggleHidden(config: ThemeConfig, key: ListKey, id: string): ThemeConfig {
  return updateSection(config, key, id, (s) => {
    const hidden = !s.visibility.desktop && !s.visibility.mobile;
    return { ...s, visibility: { desktop: hidden, mobile: hidden } };
  });
}

export function updateSection(config: ThemeConfig, key: ListKey, id: string, fn: (s: SectionInstance) => SectionInstance): ThemeConfig {
  return mapList(config, key, (list) => {
    const i = list.findIndex((s) => s.id === id);
    if (i < 0) return list;
    const next = [...list];
    next[i] = fn(list[i]!);
    return next;
  });
}

export function setSectionSettings(config: ThemeConfig, key: ListKey, id: string, patch: Record<string, unknown>): ThemeConfig {
  return updateSection(config, key, id, (s) => ({ ...s, settings: { ...(s.settings as Record<string, unknown>), ...patch } }));
}

/** Colour overrides; all-empty removes the style object. */
export function setSectionStyle(config: ThemeConfig, key: ListKey, id: string, patch: Partial<SectionStyle>): ThemeConfig {
  return updateSection(config, key, id, (s) => {
    const style = { background: "", text: "", accent: "", ...s.style, ...patch };
    const { style: _drop, ...rest } = s;
    return style.background || style.text || style.accent ? { ...rest, style } : rest;
  });
}

/**
 * Insert a new section of `type` relative to `anchorId` (null = at the end, or the start for
 * "before"). `settings` lets the AI insert pre-filled content; it is merged over the defaults.
 */
export function insertSection(
  config: ThemeConfig,
  key: ListKey,
  type: SectionType,
  anchorId: string | null,
  where: "before" | "after",
  settings: Record<string, unknown> = {},
): { config: ThemeConfig; newId: string | null } {
  if (!canAddSection(config, key, type)) return { config, newId: null };
  const s: SectionInstance = { id: newId(), type, settings: { ...defaultSettings(type), ...settings }, visibility: { desktop: true, mobile: true } };
  return {
    config: mapList(config, key, (list) => {
      const i = anchorId ? list.findIndex((x) => x.id === anchorId) : -1;
      if (i < 0) return where === "before" ? [s, ...list] : [...list, s];
      const at = where === "before" ? i : i + 1;
      return [...list.slice(0, at), s, ...list.slice(at)];
    }),
    newId: s.id,
  };
}

/** Section types that may be added to a list (for the "+" picker). */
export function addableTypes(config: ThemeConfig, key: ListKey): SectionType[] {
  return (Object.keys(SECTION_DEFINITIONS) as SectionType[]).filter((t) => t !== "PageContent" && canAddSection(config, key, t));
}

// -----------------------------------------------------------------------------
// List items (Section data → Manage list)
// -----------------------------------------------------------------------------

type Item = Record<string, unknown>;
const listOf = (s: SectionInstance, field: string): Item[] => {
  const v = (s.settings as Record<string, unknown>)[field];
  return Array.isArray(v) ? (v as Item[]) : [];
};

export function updateItems(config: ThemeConfig, key: ListKey, id: string, field: string, fn: (items: Item[]) => Item[]): ThemeConfig {
  return updateSection(config, key, id, (s) => ({ ...s, settings: { ...(s.settings as Record<string, unknown>), [field]: fn(listOf(s, field)) } }));
}

export const moveItem = (items: Item[], from: number, to: number): Item[] => {
  if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it!);
  return next;
};
export const copyItem = (items: Item[], i: number, max: number): Item[] => (i < 0 || i >= items.length || items.length >= max ? items : [...items.slice(0, i + 1), structuredClone(items[i]!), ...items.slice(i + 1)]);
export const removeItem = (items: Item[], i: number, min = 0): Item[] => (items.length <= min ? items : items.filter((_, j) => j !== i));

// -----------------------------------------------------------------------------
// Pages, popups, menus, tokens
// -----------------------------------------------------------------------------

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "page"
  );
}

/**
 * A free page handle based on `base` (base, base-2, base-3 …). `reserved` = slugs already used by
 * the store's content pages: a theme page with the same handle would hide that page.
 */
export function uniqueHandle(config: ThemeConfig, base: string, exceptId?: string, reserved: readonly string[] = []): string {
  const taken = new Set([...config.pages.filter((p) => p.id !== exceptId).map((p) => p.handle), ...reserved]);
  const root = slugify(base);
  if (!taken.has(root) && !["home", "index", "new", "edit", "preview"].includes(root)) return root;
  for (let n = 2; n < 1000; n++) if (!taken.has(`${root}-${n}`)) return `${root}-${n}`;
  return `${root}-${Date.now() % 100000}`;
}

export function addPage(config: ThemeConfig, title: string, sections: Omit<SectionInstance, "id">[] = [], reserved: readonly string[] = []): { config: ThemeConfig; page: ThemePage | null } {
  if (config.pages.length >= MAX_THEME_PAGES) return { config, page: null };
  const page: ThemePage = {
    id: newId("p"),
    handle: uniqueHandle(config, title, undefined, reserved),
    title: title.trim().slice(0, 80) || "New page",
    seoTitle: "",
    seoDescription: "",
    socialImagePath: "",
    noindex: false,
    sections: sections.map((s) => ({ ...s, id: newId() })),
  };
  return { config: { ...config, pages: [...config.pages, page] }, page };
}

export function updatePageMeta(config: ThemeConfig, id: string, patch: Partial<Omit<PageMeta, "id">>, reserved: readonly string[] = []): ThemeConfig {
  return { ...config, pages: config.pages.map((p) => (p.id === id ? { ...p, ...patch, ...(patch.handle !== undefined ? { handle: uniqueHandle(config, patch.handle, id, reserved) } : {}) } : p)) };
}

export function removePage(config: ThemeConfig, id: string): ThemeConfig {
  return { ...config, pages: config.pages.filter((p) => p.id !== id), homePageId: config.homePageId === id ? "" : config.homePageId };
}

export function duplicatePage(config: ThemeConfig, id: string, reserved: readonly string[] = []): { config: ThemeConfig; page: ThemePage | null } {
  const src = config.pages.find((p) => p.id === id);
  if (!src) return { config, page: null };
  return addPage(config, `${src.title} copy`, src.sections.map(({ id: _id, ...rest }) => structuredClone(rest)), reserved);
}

export function newPopup(name = "New popup"): Popup {
  return {
    id: newId("u"),
    name,
    enabled: true,
    trigger: "delay",
    delaySeconds: 5,
    frequency: "session",
    where: "all",
    layout: "center",
    eyebrow: "",
    heading: "Get 10% off your first order",
    text: "Join our list for new arrivals and offers.",
    imagePath: "",
    imageAlt: "",
    ctaLabel: "Subscribe",
    ctaHref: "",
    newsletter: true,
    contentType: "newsletter",
    form: { fields: [], submitLabel: "Send", successMessage: "Thanks — we got your message." },
  };
}

export function upsertPopup(config: ThemeConfig, popup: Popup): ThemeConfig {
  const exists = config.popups.some((p) => p.id === popup.id);
  if (!exists && config.popups.length >= MAX_POPUPS) return config;
  return { ...config, popups: exists ? config.popups.map((p) => (p.id === popup.id ? popup : p)) : [...config.popups, popup] };
}

export function removePopup(config: ThemeConfig, id: string): ThemeConfig {
  return { ...config, popups: config.popups.filter((p) => p.id !== id) };
}

export function setMenu(config: ThemeConfig, handle: string, menu: ThemeMenu | null): ThemeConfig {
  const menus = { ...config.menus };
  if (menu) menus[handle] = menu;
  else delete menus[handle];
  return { ...config, menus };
}

export function setTokens(config: ThemeConfig, patch: Partial<ThemeConfig["tokens"]>): ThemeConfig {
  return { ...config, tokens: { ...config.tokens, ...patch } };
}

/** Lists whose rendering differs between two configs ("all" when shared parts changed). */
/** Token keys that change rendered markup (everything else only feeds the theme CSS variables). */
const MARKUP_TOKEN_KEYS = new Set<string>(["imagery"]);
/** Token keys the canvas applies itself without a server render (root data attributes). */
const ROOT_TOKEN_KEYS = new Set<string>(["sectionHeadingAlign"]);

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export type ChangePlan = {
  /** Slots to re-render on the server ("all" = every slot of the page). */
  lists: string[] | "all";
  /** Theme CSS (colours, fonts, spacing, …) or root attributes changed: the canvas applies them instantly. */
  css: boolean;
};

/**
 * What an edit needs on the canvas. Colour / font / spacing changes are CSS only (applied in the
 * browser, no server round trip); header settings re-render only the header and footer; section
 * edits re-render only their list. Only genuinely page-wide changes (menus, product cards, popups,
 * embeds, stock imagery) re-render every slot.
 */
export function changePlan(prev: ThemeConfig, next: ThemeConfig): ChangePlan {
  if (prev === next) return { lists: [], css: false };
  let css = false;
  let all = false;
  if (prev.tokens !== next.tokens) {
    const keys = new Set([...Object.keys(prev.tokens), ...Object.keys(next.tokens)]);
    for (const k of keys) {
      if (same((prev.tokens as Record<string, unknown>)[k], (next.tokens as Record<string, unknown>)[k])) continue;
      if (MARKUP_TOKEN_KEYS.has(k)) all = true;
      else css = true;
      if (ROOT_TOKEN_KEYS.has(k)) css = true;
    }
  }
  if (
    all ||
    prev.productCard !== next.productCard ||
    prev.menus !== next.menus ||
    prev.popups !== next.popups ||
    prev.homePageId !== next.homePageId ||
    prev.embeds !== next.embeds ||
    prev.builtinTitles !== next.builtinTitles ||
    // The logo also appears in some sections (footer brand, editorial blocks).
    prev.header.logoPath !== next.header.logoPath
  )
    return { lists: "all", css };
  const out: string[] = [];
  if (prev.header !== next.header) out.push("layout.header", "layout.footer");
  if (prev.layout.header !== next.layout.header && !out.includes("layout.header")) out.push("layout.header");
  if (prev.layout.footer !== next.layout.footer && !out.includes("layout.footer")) out.push("layout.footer");
  for (const k of Object.keys(next.templates) as (keyof ThemeConfig["templates"])[]) if (prev.templates[k] !== next.templates[k]) out.push(`templates.${k}`);
  if (prev.pages !== next.pages) {
    const before = new Map(prev.pages.map((p) => [p.id, p]));
    for (const p of next.pages) if (before.get(p.id)?.sections !== p.sections) out.push(`pages.${p.id}`);
    // "/" renders the homepage's sections in the templates.home slot (see slots.ts slotList).
    if (next.homePageId && out.includes(`pages.${next.homePageId}`) && !out.includes("templates.home")) out.push("templates.home");
  }
  // Something changed outside the section lists and tokens (a page renamed, a field added later):
  // re-render all rather than leave the canvas stale.
  if (!out.length && !css && prev.tokens === next.tokens) return { lists: "all", css };
  return { lists: out, css };
}

/** Slots an edit re-renders (see changePlan; CSS-only edits re-render nothing). */
export function changedLists(prev: ThemeConfig, next: ThemeConfig): string[] | "all" {
  return changePlan(prev, next).lists;
}
