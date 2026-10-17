"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { renderCanvasAction } from "../canvas-actions";
import { CANVAS_TAG, parseHostMessage, type CanvasMessage, type SectionAction } from "../protocol";
import { listKeyOf } from "../slots";
import { setSlotOverrides } from "./store";
import { popupSchema, type Popup } from "../../schema/site";

/**
 * The storefront half of the site builder. Mounted by the store layout in theme preview only, and
 * inert unless the page is framed by the builder (window.parent on the platform origin).
 *
 *  - Renders the builder's unsaved theme: on a "theme" message it asks renderCanvasAction for the
 *    affected slots and swaps them in (CanvasSlot), plus the token CSS.
 *  - Draws the on-canvas chrome: hover / selection outlines, the section toolbar (Edit, Change
 *    design, settings, colours, move, ⋮ duplicate / hide / delete) and "+" / "Add with AI" inserts.
 *    Actions are posted to the builder, which owns the theme and the undo history.
 */

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Box = { top: number; left: number; width: number; height: number };
type Target = { id: string; slot: string; pageContent: boolean };

const ORANGE = "#f97316";
const Z = 2147483000;

function sectionEl(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(id)}"]`);
}

/** Bounding box of a section wrapper; wrappers are often display:contents, so union the children. */
function boxOf(el: HTMLElement): Box | null {
  let rects: DOMRect[] = [];
  if (getComputedStyle(el).display === "contents") {
    for (const c of Array.from(el.children)) {
      const r = c.getBoundingClientRect();
      if (r.width || r.height) rects.push(r);
    }
  } else rects = [el.getBoundingClientRect()];
  if (!rects.length) return null;
  const top = Math.min(...rects.map((r) => r.top));
  const left = Math.min(...rects.map((r) => r.left));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const right = Math.max(...rects.map((r) => r.right));
  return { top, left, width: right - left, height: bottom - top };
}

function targetOf(el: Element | null): Target | null {
  const s = el?.closest<HTMLElement>("[data-section-id]");
  if (!s) return null;
  return { id: s.dataset.sectionId!, slot: s.dataset.builderSlotItem ?? "", pageContent: s.hasAttribute("data-builder-page-content") };
}

function pageSlots(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-builder-slot]")).map((e) => e.dataset.builderSlot!);
}

const btn: CSSProperties = {
  font: "500 12px/1 system-ui, -apple-system, Segoe UI, sans-serif",
  background: "#fff",
  color: "#1c1917",
  border: "1px solid #e7e5e4",
  borderRadius: 6,
  padding: "6px 9px",
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(0,0,0,.08)",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  whiteSpace: "nowrap",
};

function Icon({ d }: { d: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  drop: "M12 2.7s6 6.5 6 11.3a6 6 0 0 1-12 0c0-4.8 6-11.3 6-11.3Z",
  up: "M12 19V5 M5 12l7-7 7 7",
  down: "M12 5v14 M19 12l-7 7-7-7",
  more: "M12 5h.01 M12 12h.01 M12 19h.01",
  plus: "M12 5v14 M5 12h14",
  spark: "M12 3l1.8 4.6L18 9.5l-4.2 1.9L12 16l-1.8-4.6L6 9.5l4.2-1.9Z M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z",
};

export function CanvasBridge({ platformOrigin }: { platformOrigin: string }) {
  const [framed, setFramed] = useState(false);
  const [hover, setHover] = useState<Target | null>(null);
  const [selected, setSelected] = useState<Target | null>(null);
  const [boxes, setBoxes] = useState<{ hover: Box | null; selected: Box | null }>({ hover: null, selected: null });
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const latestRev = useRef(0);
  const latestPopups = useRef<Popup[]>([]);
  const openPopup = useRef<string | null>(null);
  const styleEl = useRef<HTMLStyleElement | null>(null);

  const post = useCallback(
    (msg: DistributiveOmit<CanvasMessage, "tag">) => {
      window.parent.postMessage({ ...msg, tag: CANVAS_TAG }, platformOrigin);
    },
    [platformOrigin],
  );

  useEffect(() => {
    if (window.parent === window) return;
    setFramed(true);
    document.documentElement.dataset.builderCanvas = "";
    post({ type: "ready", path: location.pathname + location.search, slots: pageSlots() });
  }, [post]);

  // Messages from the builder.
  useEffect(() => {
    if (!framed) return;
    const onMessage = async (e: MessageEvent) => {
      if (e.source !== window.parent || e.origin !== platformOrigin) return;
      const msg = parseHostMessage(e.data);
      if (!msg) return;
      if (msg.type === "select") {
        if (!msg.sectionId) return setSelected(null);
        const el = sectionEl(msg.sectionId);
        const t = targetOf(el);
        setSelected(t);
        return;
      }
      if (msg.type === "scrollTo") {
        const el = sectionEl(msg.sectionId);
        const b = el && boxOf(el);
        if (b) window.scrollTo({ top: Math.max(0, b.top + window.scrollY - 80), behavior: "smooth" });
        return;
      }
      if (msg.type === "popup") {
        openPopup.current = msg.popupId;
        const popup = latestPopups.current.find((p) => p.id === msg.popupId);
        window.dispatchEvent(new CustomEvent("pc:popup", { detail: { id: msg.popupId, popup } }));
        return;
      }
      // theme
      latestRev.current = msg.rev;
      try {
        const popups = (JSON.parse(msg.config) as { popups?: unknown }).popups;
        // Display only; the storefront renders popup fields as text (see render/site-extras.tsx).
        const parsed = Array.isArray(popups) ? popups.map((p) => popupSchema.safeParse(p)).filter((r) => r.success).map((r) => r.data) : [];
        latestPopups.current = parsed;
        const live = parsed.find((p) => p.id === openPopup.current);
        if (live) window.dispatchEvent(new CustomEvent("pc:popup", { detail: { id: live.id, popup: live } }));
      } catch {
        latestPopups.current = [];
      }
      const slots = pageSlots().filter((s) => msg.changedLists === "all" || msg.changedLists.includes(listKeyOf(s) ?? ""));
      setBusy(true);
      try {
        const r = await renderCanvasAction({ config: msg.config, slots });
        if (msg.rev !== latestRev.current) return; // a newer edit is on its way
        if (!r.ok) return post({ type: "rendered", rev: msg.rev, ok: false, error: r.error.message });
        if (!styleEl.current) {
          styleEl.current = document.createElement("style");
          styleEl.current.dataset.builderTokens = "";
          document.querySelector("[data-sf-root]")?.prepend(styleEl.current);
        }
        // The override must come after the server <style>; the root's first child is that style.
        const root = document.querySelector("[data-sf-root]");
        const server = root?.querySelector("style:not([data-builder-tokens])");
        if (server && styleEl.current.previousElementSibling !== server) server.after(styleEl.current);
        styleEl.current.textContent = r.data.css;
        setSlotOverrides(r.data.slots);
        post({ type: "rendered", rev: msg.rev, ok: true });
      } catch {
        post({ type: "rendered", rev: msg.rev, ok: false, error: "The preview couldn't be updated." });
      } finally {
        if (msg.rev === latestRev.current) setBusy(false);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [framed, platformOrigin, post]);

  // Hover + click-to-select (clicks inside sections never navigate while editing).
  useEffect(() => {
    if (!framed) return;
    const onMove = (e: MouseEvent) => {
      const el = e.target as Element;
      if (el.closest("[data-builder-chrome]")) return;
      setHover(targetOf(el));
    };
    const onLeave = () => setHover(null);
    const onClick = (e: MouseEvent) => {
      const el = e.target as Element;
      if (el.closest("[data-builder-chrome]")) return;
      const t = targetOf(el);
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      setSelected(t);
      setMenuOpen(false);
      post({ type: "select", slot: t.slot, sectionId: t.id });
    };
    document.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("click", onClick, true);
    };
  }, [framed, post]);

  // Keep the outlines glued to their sections (scroll, resize, re-render).
  useEffect(() => {
    if (!framed) return;
    let raf = 0;
    const tick = () => {
      const h = hover ? sectionEl(hover.id) : null;
      const s = selected ? sectionEl(selected.id) : null;
      const next = { hover: h ? boxOf(h) : null, selected: s ? boxOf(s) : null };
      setBoxes((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [framed, hover, selected]);

  if (!framed) return null;

  const active = hover ?? selected;
  const activeBox = hover ? boxes.hover : boxes.selected;
  const act = (action: SectionAction) => {
    if (!active) return;
    setMenuOpen(false);
    if (action === "edit" || action === "design" || action === "settings" || action === "colors") setSelected(active);
    post({ type: "action", slot: active.slot, sectionId: active.id, action });
  };
  const insert = (where: "before" | "after", ai: boolean) => active && post({ type: "insert", slot: active.slot, sectionId: active.id, where, ai });

  const outline = (b: Box, solid: boolean): CSSProperties => ({
    position: "fixed",
    top: b.top,
    left: b.left,
    width: b.width,
    height: b.height,
    outline: `2px ${solid ? "solid" : "dashed"} ${ORANGE}`,
    outlineOffset: -2,
    background: solid ? "rgba(249,115,22,.04)" : "transparent",
    pointerEvents: "none",
    zIndex: Z,
  });
  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const compact = vw < 560;

  return (
    <div data-builder-chrome aria-hidden={false} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: Z }}>
      {boxes.hover && hover && hover.id !== selected?.id ? <div style={outline(boxes.hover, false)} /> : null}
      {boxes.selected && selected ? <div style={outline(boxes.selected, true)} /> : null}
      {active && activeBox ? (
        <>
          {/* Insert before */}
          <div style={{ position: "fixed", top: Math.max(4, activeBox.top - 14), left: activeBox.left + activeBox.width / 2, transform: "translateX(-50%)", display: "flex", gap: 6, pointerEvents: "auto", zIndex: Z + 1 }}>
            <button type="button" title="Add a section above" style={{ ...btn, borderRadius: 999, padding: 6, background: ORANGE, color: "#fff", borderColor: ORANGE }} onClick={() => insert("before", false)}>
              <Icon d={ICONS.plus} />
            </button>
            <button type="button" title="Add a section above with AI" style={{ ...btn, borderRadius: 999 }} onClick={() => insert("before", true)}>
              <Icon d={ICONS.spark} /> {compact ? "AI" : "Add with AI"}
            </button>
          </div>
          {/* Toolbar */}
          <div
            role="toolbar"
            aria-label="Section"
            style={{ position: "fixed", top: Math.min(Math.max(activeBox.top + 26, 30), window.innerHeight - 44), left: activeBox.left + activeBox.width / 2, transform: "translateX(-50%)", display: "flex", gap: 4, pointerEvents: "auto", zIndex: Z + 1, flexWrap: "nowrap" }}
          >
            {active.pageContent ? (
              <span style={{ ...btn, cursor: "default" }}>Page content</span>
            ) : (
              <>
                <button type="button" style={btn} onClick={() => act("edit")}>Edit</button>
                {!compact ? <button type="button" style={btn} onClick={() => act("design")}>Change design</button> : null}
                <button type="button" style={btn} title="Section settings" aria-label="Section settings" onClick={() => act("settings")}><Icon d={ICONS.gear} /></button>
                <button type="button" style={btn} title="Colours" aria-label="Colours" onClick={() => act("colors")}><Icon d={ICONS.drop} /></button>
              </>
            )}
            <button type="button" style={btn} title="Move up" aria-label="Move up" onClick={() => act("up")}><Icon d={ICONS.up} /></button>
            <button type="button" style={btn} title="Move down" aria-label="Move down" onClick={() => act("down")}><Icon d={ICONS.down} /></button>
            {!active.pageContent ? (
              <span style={{ position: "relative" }}>
                <button type="button" style={btn} title="More" aria-label="More actions" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}><Icon d={ICONS.more} /></button>
                {menuOpen ? (
                  <span role="menu" style={{ position: "absolute", right: 0, top: "110%", background: "#fff", border: "1px solid #e7e5e4", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.12)", padding: 4, display: "flex", flexDirection: "column", minWidth: 130 }}>
                    {compact ? <button type="button" role="menuitem" style={{ ...btn, border: 0, boxShadow: "none" }} onClick={() => act("design")}>Change design</button> : null}
                    <button type="button" role="menuitem" style={{ ...btn, border: 0, boxShadow: "none" }} onClick={() => act("duplicate")}>Duplicate</button>
                    <button type="button" role="menuitem" style={{ ...btn, border: 0, boxShadow: "none" }} onClick={() => act("hide")}>Hide</button>
                    <button type="button" role="menuitem" style={{ ...btn, border: 0, boxShadow: "none", color: "#b91c1c" }} onClick={() => act("delete")}>Delete</button>
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
          {/* Insert after */}
          <div style={{ position: "fixed", top: Math.min(activeBox.top + activeBox.height - 14, window.innerHeight - 30), left: activeBox.left + activeBox.width / 2, transform: "translateX(-50%)", pointerEvents: "auto", zIndex: Z + 1 }}>
            <button type="button" title="Add a section below" style={{ ...btn, borderRadius: 999, padding: 6, background: ORANGE, color: "#fff", borderColor: ORANGE }} onClick={() => insert("after", false)}>
              <Icon d={ICONS.plus} />
            </button>
          </div>
        </>
      ) : null}
      {busy ? (
        <div style={{ position: "fixed", right: 10, bottom: 10, ...btn, pointerEvents: "none" }}>Updating preview…</div>
      ) : null}
    </div>
  );
}
