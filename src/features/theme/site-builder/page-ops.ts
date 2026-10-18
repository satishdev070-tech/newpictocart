import type { ThemeConfig } from "@/features/theme/schema/config";
import type { ThemeLink, ThemeMenu, ThemeMenuItem } from "@/features/theme/schema/links";
import { MAX_MENU_ITEMS } from "@/features/theme/schema/links";
import type { BuiltinTitleKey } from "@/features/theme/schema/site";
import { newId, setMenu } from "./ops";
import type { BuilderPage } from "./pages";

/**
 * Pages panel operations (pure): homepage choice, renaming built-in pages and nesting a page under
 * another one in the header menu ("Set as subitem"). Like ops.ts, every function returns a new
 * config (or the same object when nothing changed).
 */

const MAX_CHILDREN = 20;

/** Use a site-builder page as "/" (null / "" = back to the home template). */
export function setHomePage(config: ThemeConfig, pageId: string | null): ThemeConfig {
  const id = pageId && config.pages.some((p) => p.id === pageId) ? pageId : "";
  return id === config.homePageId ? config : { ...config, homePageId: id };
}

export function setBuiltinTitle(config: ThemeConfig, key: BuiltinTitleKey, title: string): ThemeConfig {
  const value = title.trim().slice(0, 60);
  return value === config.builtinTitles[key] ? config : { ...config, builtinTitles: { ...config.builtinTitles, [key]: value } };
}

const BUILTIN_KEYS = new Set(["contact", "faq", "blog"]);

/** The menu link that opens a builder page, or null when a menu can't link to it. */
export function pageLink(config: ThemeConfig, page: BuilderPage): ThemeLink | null {
  const base = { url: "", anchor: "", newTab: false };
  if (page.key === "home") return { ...base, type: "home", ref: "" };
  if (page.themePageId) {
    const p = config.pages.find((x) => x.id === page.themePageId);
    return p ? { ...base, type: "page", ref: `theme:${p.handle}` } : null;
  }
  if (page.key.startsWith("content:")) return { ...base, type: "page", ref: page.key.slice(8) };
  if (BUILTIN_KEYS.has(page.key)) return { ...base, type: "page", ref: `builtin:${page.key}` };
  return null;
}

const sameLink = (a: ThemeLink, b: ThemeLink) => a.type === b.type && a.ref === b.ref;

/** The header menu as the theme renders it: the theme copy, else the database menu, else empty. */
export function headerMenu(config: ThemeConfig, dbMenus: Record<string, ThemeMenu>): { handle: string; menu: ThemeMenu } | null {
  const handle = config.header.menuHandle;
  if (!handle) return null;
  return { handle, menu: config.menus[handle] ?? dbMenus[handle] ?? { title: "Main menu", items: [] } };
}

/** Title of the top-level item `link` is nested under in `menu`, or null (top level / absent). */
export function menuParentTitle(menu: ThemeMenu, link: ThemeLink): string | null {
  for (const it of menu.items) if (it.children.some((c) => sameLink(c.link, link))) return it.title;
  return null;
}

/** Index of the top-level item `link` is nested under, or -1. */
export function menuParentIndex(menu: ThemeMenu, link: ThemeLink): number {
  return menu.items.findIndex((it) => it.children.some((c) => sameLink(c.link, link)));
}

const count = (items: ThemeMenuItem[]) => items.reduce((n, it) => n + 1 + it.children.length, 0);

/**
 * Nest `child` under `parent` in the header menu (parent null = move it to the top level). The
 * parent gets a top-level item when it has none; the child's existing item (anywhere in the menu)
 * moves with its title and sub-items flattened into the parent. The database menu is copied into
 * the theme on first use (same as editing it in the Menus panel). Returns `error` when the menu is
 * full or the pages can't be linked.
 */
export function nestPageInMenu(
  config: ThemeConfig,
  dbMenus: Record<string, ThemeMenu>,
  child: { title: string; link: ThemeLink },
  parent: { title: string; link: ThemeLink } | null,
): { config: ThemeConfig; error?: string } {
  const hm = headerMenu(config, dbMenus);
  if (!hm) return { config, error: "Your header has no menu to add pages to." };
  if (parent && sameLink(parent.link, child.link)) return { config, error: "A page can't be its own subitem." };

  // Already a top-level item: nothing to move.
  if (!parent && hm.menu.items.some((it) => sameLink(it.link, child.link))) return { config };
  // Menus are two levels deep: a page that has its own subitems can't become one.
  if (parent && hm.menu.items.some((it) => sameLink(it.link, child.link) && it.children.length > 0)) {
    return { config, error: "This page has its own subitems in the menu. Move them first." };
  }
  // Take the child's item out wherever it is.
  let existing: Omit<ThemeMenuItem, "children"> | null = null;
  const items: ThemeMenuItem[] = [];
  for (const it of hm.menu.items) {
    if (sameLink(it.link, child.link)) {
      existing ??= { id: it.id, title: it.title, link: it.link, highlight: it.highlight };
      continue;
    }
    const kids = it.children.filter((c) => {
      if (!sameLink(c.link, child.link)) return true;
      existing ??= c;
      return false;
    });
    items.push(kids.length === it.children.length ? it : { ...it, children: kids });
  }
  const moved = existing ?? { id: newId("m"), title: child.title.slice(0, 60) || "Page", link: child.link, highlight: false };

  let next: ThemeMenuItem[];
  if (!parent) {
    next = [...items, { ...moved, children: [] }];
  } else {
    let pi = items.findIndex((it) => sameLink(it.link, parent.link));
    if (pi < 0) {
      // The parent may itself be a sub-item: promote it to the top level first.
      let promoted: ThemeMenuItem | null = null;
      for (let i = 0; i < items.length && !promoted; i++) {
        const c = items[i]!.children.find((x) => sameLink(x.link, parent.link));
        if (c) {
          items[i] = { ...items[i]!, children: items[i]!.children.filter((x) => x !== c) };
          promoted = { ...c, children: [] };
        }
      }
      items.push(promoted ?? { id: newId("m"), title: parent.title.slice(0, 60) || "Page", link: parent.link, highlight: false, children: [] });
      pi = items.length - 1;
    }
    const p = items[pi]!;
    if (p.children.length >= MAX_CHILDREN) return { config, error: `A menu item can have at most ${MAX_CHILDREN} subitems.` };
    next = items.map((it, i) => (i === pi ? { ...it, children: [...it.children, moved] } : it));
  }
  if (count(next) > MAX_MENU_ITEMS) return { config, error: `A menu can have at most ${MAX_MENU_ITEMS} items.` };
  return { config: setMenu(config, hm.handle, { ...hm.menu, items: next }) };
}
