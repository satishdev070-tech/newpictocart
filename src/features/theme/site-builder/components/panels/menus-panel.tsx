"use client";

import { useMemo, useState } from "react";
import { CornerDownRight, GripVertical, Pencil, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_MENU_ITEMS, type ThemeLink, type ThemeMenu, type ThemeMenuItem } from "@/features/theme/schema/links";
import type { ThemeConfig } from "@/features/theme/schema/config";
import { useBuilder } from "../../context";
import { newId, setMenu } from "../../ops";
import { EMPTY_LINK, LinkDialog } from "../link-dialog";
import { FieldRow, IconButton, MoreMenu, PanelFrame, Row, input, useReorder } from "../ui";

/**
 * Navigation panel: edit the header and footer menus. Menus come from the database until the
 * first edit, which copies the menu into the theme (config.menus[handle]); from then on the
 * storefront renders the theme copy, so menu edits follow the theme's draft → publish flow.
 */

const MAX_CHILDREN = 20;

type MenuSlot = { handle: string; label: string };

/** Menus the theme renders: the header menu and every footer menu, labelled. */
export function themeMenuSlots(config: ThemeConfig): MenuSlot[] {
  const out: MenuSlot[] = [];
  const add = (handle: unknown, label: string) => {
    if (typeof handle === "string" && handle && !out.some((m) => m.handle === handle)) out.push({ handle, label });
  };
  add(config.header.menuHandle, "Header menu");
  for (const s of config.layout.header) add((s.settings as { menuHandle?: unknown }).menuHandle, s.type === "MegaMenu" ? "Mega menu" : "Header menu");
  const footerHandles: string[] = [];
  for (const s of config.layout.footer) {
    const st = s.settings as { menuHandles?: unknown; menuHandle?: unknown };
    if (Array.isArray(st.menuHandles)) for (const h of st.menuHandles) if (typeof h === "string") footerHandles.push(h);
    if (typeof st.menuHandle === "string") footerHandles.push(st.menuHandle);
  }
  const uniqueFooter = footerHandles.filter((h, i) => footerHandles.indexOf(h) === i && !out.some((m) => m.handle === h));
  uniqueFooter.forEach((h, i) => add(h, uniqueFooter.length > 1 ? `Footer menu ${i + 1}` : "Footer menu"));
  return out;
}

type Editing = { kind: "new" } | { kind: "newChild"; parent: number } | { kind: "item"; index: number } | { kind: "child"; parent: number; index: number };

function countItems(menu: ThemeMenu): number {
  return menu.items.reduce((n, it) => n + 1 + it.children.length, 0);
}

export function MenusPanel() {
  const { config, apply, dbMenus, setPanel } = useBuilder();
  const slots = useMemo(() => themeMenuSlots(config), [config]);
  const [picked, setPicked] = useState<string | null>(null);
  const handle = picked && slots.some((s) => s.handle === picked) ? picked : (slots[0]?.handle ?? null);
  const [editing, setEditing] = useState<Editing | null>(null);

  const own = handle ? config.menus[handle] : undefined;
  const menu: ThemeMenu | null = handle ? (own ?? dbMenus[handle] ?? { title: slots.find((s) => s.handle === handle)?.label ?? "Menu", items: [] }) : null;

  const commit = (next: ThemeMenu, coalesce?: string) => {
    if (!handle) return;
    apply((c) => setMenu(c, handle, next), coalesce);
  };
  const setItems = (items: ThemeMenuItem[]) => menu && commit({ ...menu, items });

  const reorder = useReorder((from, to) => {
    if (!menu) return;
    const items = [...menu.items];
    const [it] = items.splice(from, 1);
    items.splice(to, 0, it!);
    setItems(items);
  });

  const full = menu ? countItems(menu) >= MAX_MENU_ITEMS : true;

  const editInitial = (): { title: string; link: ThemeLink; highlight: boolean } => {
    if (!menu || !editing) return { title: "", link: EMPTY_LINK, highlight: false };
    if (editing.kind === "item") {
      const it = menu.items[editing.index]!;
      return { title: it.title, link: it.link, highlight: it.highlight };
    }
    if (editing.kind === "child") {
      const it = menu.items[editing.parent]!.children[editing.index]!;
      return { title: it.title, link: it.link, highlight: it.highlight };
    }
    return { title: "", link: EMPTY_LINK, highlight: false };
  };

  const onSave = (title: string, link: ThemeLink, { highlight }: { highlight: boolean }) => {
    if (!menu || !editing) return;
    const items = [...menu.items];
    if (editing.kind === "new") items.push({ id: newId("m"), title, link, highlight, children: [] });
    else if (editing.kind === "item") items[editing.index] = { ...items[editing.index]!, title, link, highlight };
    else if (editing.kind === "newChild") {
      const p = items[editing.parent]!;
      items[editing.parent] = { ...p, children: [...p.children, { id: newId("m"), title, link, highlight }] };
    } else {
      const p = items[editing.parent]!;
      const children = [...p.children];
      children[editing.index] = { ...children[editing.index]!, title, link, highlight };
      items[editing.parent] = { ...p, children };
    }
    setItems(items);
  };

  const duplicate = (i: number) => {
    if (!menu || full) return;
    const src = menu.items[i]!;
    const copy: ThemeMenuItem = { ...structuredClone(src), id: newId("m"), children: src.children.map((c) => ({ ...structuredClone(c), id: newId("m") })) };
    if (countItems(menu) + 1 + copy.children.length > MAX_MENU_ITEMS) copy.children = [];
    setItems([...menu.items.slice(0, i + 1), copy, ...menu.items.slice(i + 1)]);
  };
  const duplicateChild = (p: number, i: number) => {
    if (!menu || full) return;
    const parent = menu.items[p]!;
    if (parent.children.length >= MAX_CHILDREN) return;
    const children = [...parent.children.slice(0, i + 1), { ...structuredClone(parent.children[i]!), id: newId("m") }, ...parent.children.slice(i + 1)];
    setItems(menu.items.map((it, j) => (j === p ? { ...it, children } : it)));
  };
  const removeChild = (p: number, i: number) => menu && setItems(menu.items.map((it, j) => (j === p ? { ...it, children: it.children.filter((_, k) => k !== i) } : it)));
  const moveChild = (p: number, i: number, delta: number) => {
    if (!menu) return;
    const children = [...menu.items[p]!.children];
    const j = i + delta;
    if (j < 0 || j >= children.length) return;
    [children[i], children[j]] = [children[j]!, children[i]!];
    setItems(menu.items.map((it, k) => (k === p ? { ...it, children } : it)));
  };
  /** Turn a sub-item into a top-level item right after its parent. */
  const promote = (p: number, i: number) => {
    if (!menu) return;
    const child = menu.items[p]!.children[i]!;
    const items = menu.items.map((it, k) => (k === p ? { ...it, children: it.children.filter((_, j) => j !== i) } : it));
    items.splice(p + 1, 0, { ...child, children: [] });
    setItems(items);
  };
  /** Nest a top-level item (without its own sub-items) under the item above it. */
  const nest = (i: number) => {
    if (!menu || i === 0) return;
    const it = menu.items[i]!;
    const parent = menu.items[i - 1]!;
    if (it.children.length || parent.children.length >= MAX_CHILDREN) return;
    const { children: _c, ...child } = it;
    const items = menu.items.filter((_, k) => k !== i).map((x, k) => (k === i - 1 ? { ...x, children: [...x.children, child] } : x));
    setItems(items);
  };

  return (
    <PanelFrame title="Navigation" subtitle="Header and footer menus" onClose={() => setPanel(null)}>
      {slots.length === 0 || !handle || !menu ? (
        <p className="text-small text-muted">This theme shows no menus. Add a Header or Footer section with a menu first.</p>
      ) : (
        <div className="space-y-4">
          <FieldRow label="Menu" htmlFor="sb-menu-pick">
            <select id="sb-menu-pick" className={input} value={handle} onChange={(e) => setPicked(e.target.value)}>
              {slots.map((s) => (
                <option key={s.handle} value={s.handle}>
                  {s.label} ({s.handle})
                </option>
              ))}
            </select>
          </FieldRow>

          {own ? (
            <div className="flex items-start justify-between gap-2 rounded-lg bg-accent-soft px-3 py-2 text-xs">
              <span>Edits apply when you publish the theme.</span>
              <button
                type="button"
                onClick={() => apply((c) => setMenu(c, handle, null))}
                className="inline-flex shrink-0 items-center gap-1 font-medium text-accent hover:underline"
                title={dbMenus[handle] ? "Use the menu from Content → Menus again" : "Remove the theme's copy of this menu"}
              >
                <RotateCcw className="size-3.5" />
                Reset to database menu
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted">{dbMenus[handle] ? "Showing the menu from your store's menus. Your first edit copies it into this theme." : "This menu is empty. Add items to create it in this theme."}</p>
          )}

          <ul className="space-y-1.5" aria-label={`${menu.title} items`}>
            {menu.items.map((it, i) => (
              <li key={it.id} {...reorder.itemProps(i)} className="space-y-1.5">
                <Row>
                  <span {...reorder.handleProps(i)}>
                    <GripVertical className="size-4" />
                  </span>
                  <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => setEditing({ kind: "item", index: i })}>
                    {it.title}
                    {it.highlight ? <span className="ml-1.5 rounded bg-accent-soft px-1 text-xs text-accent">highlight</span> : null}
                    {it.link.type === "none" ? <span className="ml-1.5 text-xs text-muted">(not a link)</span> : null}
                  </button>
                  <IconButton label={`Edit ${it.title}`} onClick={() => setEditing({ kind: "item", index: i })}>
                    <Pencil />
                  </IconButton>
                  <MoreMenu
                    items={[
                      { label: "Add sub-item", onSelect: () => setEditing({ kind: "newChild", parent: i }), disabled: full || it.children.length >= MAX_CHILDREN },
                      { label: "Move under item above", onSelect: () => nest(i), disabled: i === 0 || it.children.length > 0 },
                      { label: "Duplicate", onSelect: () => duplicate(i), disabled: full },
                      { label: "Delete", onSelect: () => setItems(menu.items.filter((_, k) => k !== i)), danger: true },
                    ]}
                  />
                </Row>
                {it.children.length ? (
                  <ul className="ml-5 space-y-1.5">
                    {it.children.map((c, j) => (
                      <li key={c.id}>
                        <Row>
                          <CornerDownRight className="size-3.5 shrink-0 text-muted" />
                          <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => setEditing({ kind: "child", parent: i, index: j })}>
                            {c.title}
                          </button>
                          <IconButton label={`Edit ${c.title}`} onClick={() => setEditing({ kind: "child", parent: i, index: j })}>
                            <Pencil />
                          </IconButton>
                          <MoreMenu
                            items={[
                              { label: "Move up", onSelect: () => moveChild(i, j, -1), disabled: j === 0 },
                              { label: "Move down", onSelect: () => moveChild(i, j, 1), disabled: j === it.children.length - 1 },
                              { label: "Move to top level", onSelect: () => promote(i, j) },
                              { label: "Duplicate", onSelect: () => duplicateChild(i, j), disabled: full || it.children.length >= MAX_CHILDREN },
                              { label: "Delete", onSelect: () => removeChild(i, j), danger: true },
                            ]}
                          />
                        </Row>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          {menu.items.length === 0 ? <p className="text-small text-muted">No items yet.</p> : null}

          <Button variant="secondary" className="w-full" disabled={full} onClick={() => setEditing({ kind: "new" })}>
            <Plus />
            Add menu item
          </Button>
          {full ? <p className="text-xs text-muted">A menu can have at most {MAX_MENU_ITEMS} items.</p> : null}
        </div>
      )}

      <LinkDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.kind === "new" || editing?.kind === "newChild" ? "Add menu item" : "Update menu"}
        initial={editInitial()}
        onSave={onSave}
        showHighlight
      />
    </PanelFrame>
  );
}
