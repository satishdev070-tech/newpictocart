"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { renderCanvasAction } from "../canvas-actions";
import { CANVAS_TAG, parseHostMessage, type CanvasMessage, type SectionAction } from "../protocol";
import { listKeyOf, slotListOf } from "../slots";
import { setSlotOverrides } from "./store";
import { EMPTY_SLOT_INSERT_EVENT } from "./empty-slot";
import { embedsSchema, popupSchema, type Popup } from "../../schema/site";
import { centeredLeft, headerFloor, menuOpensUp, toolbarTop, type Rect } from "./chrome-layout";
import { tokensSchema } from "../../schema/tokens";
import { themeCss } from "../../tokens-style";

/**
 * The storefront half of the site builder. Mounted by the store layout in theme preview only, and
 * inert unless the page is framed by the builder (window.parent on one of the platform origins:
 * the platform URL, with and without "www.", and configured aliases).
 *
 *  - Renders the builder's unsaved theme: on a "theme" message it asks renderCanvasAction for the
 *    affected slots and swaps them in (CanvasSlot). Colour / font / spacing changes are applied
 *    immediately in the browser (themeCss), with no server round trip.
 *  - Draws the on-canvas chrome: hover / selection outlines, the section toolbar (Edit, Change
 *    design, settings, colours, move, ⋮ duplicate / hide / delete) and "+" / "Add with AI" inserts.
 *    Actions are posted to the builder, which owns the theme and the undo history.
 */

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Box = Rect;
type Target = { id: string; slot: string; pageContent: boolean; type: string };
type Boxes = { hover: Box | null; selected: Box | null; header: Box | null; busy: Box[]; toolbar: { w: number; h: number } };

const Z = 2147483000;
const NO_BOXES: Boxes = { hover: null, selected: null, header: null, busy: [], toolbar: { w: 0, h: 32 } };
/** At most this many sections shimmer while a slot re-renders. */
const MAX_SHIMMER = 12;

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
  return { id: s.dataset.sectionId!, slot: s.dataset.builderSlotItem ?? "", pageContent: s.hasAttribute("data-builder-page-content"), type: s.dataset.section ?? "" };
}

/** Union box of the store header sections (layout.header slot), or null. */
function headerBox(): Box | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-builder-slot-item="layout.header"]'));
  const boxes = els.map(boxOf).filter((b): b is Box => !!b && b.height > 0);
  if (!boxes.length) return null;
  const top = Math.min(...boxes.map((b) => b.top));
  const bottom = Math.max(...boxes.map((b) => b.top + b.height));
  const left = Math.min(...boxes.map((b) => b.left));
  const right = Math.max(...boxes.map((b) => b.left + b.width));
  return { top, left, width: right - left, height: bottom - top };
}

/** "HeroSlideshow" → "Hero slideshow". */
function humanize(type: string): string {
  const w = type.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return w ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : "Section";
}

function pageSlots(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-builder-slot]")).map((e) => e.dataset.builderSlot!);
}

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
  pencil: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
  layout: "M3 3h18v18H3Z M3 9h18 M9 9v12",
  copy: "M9 9h11v11H9Z M5 15H4V4h11v1",
  eyeOff: "M3 3l18 18 M10.6 10.6a2 2 0 0 0 2.8 2.8 M9.9 5.1A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9 M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 5.4-1.6",
  trash: "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6",
};

/** Chrome styles (classes, so buttons get hover / focus states); scoped under [data-builder-chrome]. */
const CHROME_CSS = `
[data-builder-chrome] .pcb-btn{box-sizing:border-box;margin:0;height:32px;min-width:32px;padding:0 11px;display:inline-flex;align-items:center;justify-content:center;gap:6px;
  font:500 12.5px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:0;text-transform:none;color:#1c1917;background:#fff;
  border:1px solid rgba(28,25,23,.08);border-radius:10px;box-shadow:0 1px 2px rgba(28,25,23,.06),0 6px 16px -4px rgba(28,25,23,.18);
  cursor:pointer;white-space:nowrap;transition:background-color .15s,color .15s,transform .15s,box-shadow .15s}
[data-builder-chrome] .pcb-btn:hover{background:#fff7ed;color:#c2410c}
[data-builder-chrome] .pcb-btn:focus-visible,[data-builder-chrome] .pcb-item:focus-visible{outline:2px solid #f97316;outline-offset:2px}
[data-builder-chrome] .pcb-btn[aria-expanded="true"]{background:#fff7ed;color:#c2410c}
[data-builder-chrome] .pcb-icon{width:32px;padding:0}
[data-builder-chrome] .pcb-static{cursor:default;color:#57534e}
[data-builder-chrome] .pcb-static:hover{background:#fff;color:#57534e}
[data-builder-chrome] .pcb-plus{width:30px;min-width:30px;height:30px;padding:0;border-radius:999px;color:#fff;background:#f97316;border-color:#f97316;
  box-shadow:0 0 0 3px rgba(255,255,255,.9),0 6px 16px -2px rgba(249,115,22,.55)}
[data-builder-chrome] .pcb-plus:hover{background:#ea580c;color:#fff;transform:scale(1.08)}
[data-builder-chrome] .pcb-ai{height:30px;padding:0 13px 0 10px;border-radius:999px;font-weight:600;border:1.5px solid transparent;
  background:linear-gradient(#fff,#fff) padding-box,linear-gradient(90deg,#f97316,#ec4899 55%,#8b5cf6) border-box}
[data-builder-chrome] .pcb-ai:hover{color:#1c1917;background:linear-gradient(#fff7ed,#fff7ed) padding-box,linear-gradient(90deg,#f97316,#ec4899 55%,#8b5cf6) border-box}
[data-builder-chrome] .pcb-ai svg{color:#ec4899}
[data-builder-chrome] .pcb-menu{position:absolute;right:0;display:flex;flex-direction:column;min-width:160px;padding:4px;background:#fff;
  border:1px solid rgba(28,25,23,.08);border-radius:12px;box-shadow:0 16px 36px -8px rgba(28,25,23,.25)}
[data-builder-chrome] .pcb-item{box-sizing:border-box;margin:0;height:34px;padding:0 10px;display:flex;align-items:center;gap:9px;border:0;border-radius:8px;
  background:transparent;color:#1c1917;font:500 12.5px/1 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:left;cursor:pointer;white-space:nowrap}
[data-builder-chrome] .pcb-item:hover{background:#fff7ed;color:#c2410c}
[data-builder-chrome] .pcb-danger{color:#b91c1c}
[data-builder-chrome] .pcb-danger:hover{background:#fef2f2;color:#991b1b}
[data-builder-chrome] .pcb-chip{display:inline-flex;align-items:center;gap:6px;max-width:260px;padding:5px 10px;border-radius:999px;
  font:600 11px/1.1 system-ui,-apple-system,"Segoe UI",sans-serif;color:#9a3412;background:rgba(255,255,255,.96);border:1px solid rgba(249,115,22,.35);
  box-shadow:0 4px 12px -2px rgba(28,25,23,.15);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
[data-builder-chrome] .pcb-chip[data-on]{color:#fff;background:#f97316;border-color:#f97316}
[data-builder-chrome] .pcb-chip i{flex:none;width:6px;height:6px;border-radius:99px;background:currentColor;opacity:.75}
@keyframes pcb-shimmer{from{background-position:130% 0}to{background-position:-30% 0}}
@keyframes pcb-fade{from{opacity:0}to{opacity:1}}
[data-builder-chrome] .pcb-shimmer{background:linear-gradient(100deg,rgba(255,255,255,.22) 30%,rgba(255,237,213,.7) 50%,rgba(255,255,255,.22) 70%);
  background-size:250% 100%;animation:pcb-shimmer 1.2s linear infinite,pcb-fade .2s ease-out}
[data-builder-chrome] .pcb-fade{animation:pcb-fade .15s ease-out}
@media (prefers-reduced-motion: reduce){
  [data-builder-chrome] .pcb-shimmer{animation:none;background:rgba(255,255,255,.35)}
  [data-builder-chrome] .pcb-fade{animation:none}
  [data-builder-chrome] .pcb-btn,[data-builder-chrome] .pcb-plus{transition:none;transform:none}
}`;

/** The builder's origin: the framing page's origin when it is an allowed platform origin. */
function parentOriginOf(allowed: readonly string[]): string | null {
  const fromAncestors = (location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins?.[0];
  if (fromAncestors && allowed.includes(fromAncestors)) return fromAncestors;
  try {
    const ref = document.referrer ? new URL(document.referrer).origin : null;
    if (ref && allowed.includes(ref)) return ref;
  } catch {
    // ignore
  }
  return null;
}

export function CanvasBridge({ platformOrigins }: { platformOrigins: string[] }) {
  const [framed, setFramed] = useState(false);
  /** The builder's origin once known (ancestorOrigins / referrer, then the first valid message). */
  const parentOrigin = useRef<string | null>(null);
  /** Latest preview token from the builder (authorises renders without relying on the cookie). */
  const previewToken = useRef<string | undefined>(undefined);
  const [hover, setHover] = useState<Target | null>(null);
  const [selected, setSelected] = useState<Target | null>(null);
  const [boxes, setBoxes] = useState<Boxes>(NO_BOXES);
  const [menuOpen, setMenuOpen] = useState(false);
  /** Slots re-rendering right now ("all" = a theme-wide change), or null. */
  const [busy, setBusy] = useState<string[] | "all" | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const toolbarRef = useRef<HTMLDivElement>(null);
  /** Id of the hovered section (read by the pointer listener). */
  const hoverId = useRef<string | null>(null);
  const latestPopups = useRef<Popup[]>([]);
  const openPopup = useRef<string | null>(null);
  const styleEl = useRef<HTMLStyleElement | null>(null);

  const post = useCallback(
    (msg: DistributiveOmit<CanvasMessage, "tag">) => {
      parentOrigin.current ??= parentOriginOf(platformOrigins);
      // Unknown parent (no ancestorOrigins, no referrer): post to each allowed origin; the browser
      // drops every copy whose origin doesn't match the real parent. Messages carry no secrets.
      for (const o of parentOrigin.current ? [parentOrigin.current] : platformOrigins) window.parent.postMessage({ ...msg, tag: CANVAS_TAG }, o);
    },
    [platformOrigins],
  );

  /** Theme CSS override (after the server's <style>, so it wins). */
  const applyCss = useCallback((css: string) => {
    if (!styleEl.current) {
      styleEl.current = document.createElement("style");
      styleEl.current.dataset.builderTokens = "";
      document.querySelector("[data-sf-root]")?.prepend(styleEl.current);
    }
    const root = document.querySelector("[data-sf-root]");
    const server = root?.querySelector("style:not([data-builder-tokens])");
    if (server && styleEl.current.previousElementSibling !== server) server.after(styleEl.current);
    if (styleEl.current.textContent !== css) styleEl.current.textContent = css;
  }, []);

  /** Instant feedback for colours, fonts and spacing: the CSS is computed here from the tokens. */
  const applyTokens = useCallback(
    (tokens: unknown) => {
      const parsed = tokensSchema.safeParse(tokens ?? {});
      if (!parsed.success) return;
      applyCss(themeCss(parsed.data));
      const root = document.querySelector<HTMLElement>("[data-sf-root]");
      if (root) root.dataset.headingAlign = parsed.data.sectionHeadingAlign;
    },
    [applyCss],
  );

  /** The next document to render (edits merged while a render runs), and whether one is running. */
  const pending = useRef<{ rev: number; config: string; lists: string[] | "all" } | null>(null);
  const running = useRef(false);

  /** Renders queued documents one at a time, always applying results in order (see onMessage). */
  const drain = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (pending.current) {
        const job = pending.current;
        pending.current = null;
        let doc: unknown = null;
        try {
          doc = JSON.parse(job.config);
        } catch {
          doc = null;
        }
        const slots = pageSlots().filter((s) => job.lists === "all" || job.lists.includes(slotListOf(doc, s)));
        if (!slots.length) {
          post({ type: "rendered", rev: job.rev, ok: true });
          continue;
        }
        setBusy(job.lists === "all" ? "all" : slots);
        try {
          const r = await renderCanvasAction({ config: job.config, slots, token: previewToken.current });
          if (!r.ok) {
            post({ type: "rendered", rev: job.rev, ok: false, error: r.error.message, code: r.error.code === "FORBIDDEN" ? "forbidden" : "failed" });
            continue;
          }
          applyCss(r.data.css);
          // Applied even when a newer edit is queued: that job only re-renders the lists changed since
          // this one, so skipping this result would leave the other lists stale.
          setSlotOverrides(r.data.slots);
          post({ type: "rendered", rev: job.rev, ok: true });
        } catch {
          post({ type: "rendered", rev: job.rev, ok: false, error: "The preview couldn't be updated.", code: "failed" });
        }
      }
    } finally {
      running.current = false;
      setBusy(null);
    }
  }, [post, applyCss]);

  const pathname = usePathname();
  // "ready" on first load and after every in-canvas navigation (client-side links keep this mounted),
  // so the builder follows the page and re-sends unsaved edits for the new page's slots.
  useEffect(() => {
    if (window.parent === window) return;
    document.documentElement.dataset.builderCanvas = "";
    // Inside the builder the draft IS what's being edited: the "Previewing your unpublished theme"
    // strip is noise there (Bugs 2.0 #12). Outside the builder the layout decides whether to show it.
    if (!document.getElementById("pc-builder-canvas-css")) {
      const css = document.createElement("style");
      css.id = "pc-builder-canvas-css";
      css.textContent = "html[data-builder-canvas] [data-preview-banner]{display:none!important}";
      document.head.append(css);
    }
    const t = window.setTimeout(() => {
      setFramed(true);
      hoverId.current = null;
      setHover(null);
      setSelected(null);
      post({ type: "ready", path: location.pathname + location.search, slots: pageSlots() });
    }, 30);
    return () => clearTimeout(t);
  }, [post, pathname]);

  // Messages from the builder.
  useEffect(() => {
    if (!framed) return;
    const onMessage = async (e: MessageEvent) => {
      if (e.source !== window.parent || !platformOrigins.includes(e.origin)) return;
      const msg = parseHostMessage(e.data);
      if (!msg) return;
      parentOrigin.current = e.origin;
      if (msg.type === "hello") {
        post({ type: "ready", path: location.pathname + location.search, slots: pageSlots() });
        return;
      }
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
      if (msg.type === "labels") {
        setLabels(msg.labels);
        return;
      }
      if (msg.type === "popup") {
        openPopup.current = msg.popupId;
        const popup = latestPopups.current.find((p) => p.id === msg.popupId);
        window.dispatchEvent(new CustomEvent("pc:popup", { detail: { id: msg.popupId, popup } }));
        return;
      }
      // theme
      if (msg.token) previewToken.current = msg.token;
      try {
        const doc = JSON.parse(msg.config) as { popups?: unknown; embeds?: unknown; tokens?: unknown };
        applyTokens(doc.tokens);
        const popups = doc.popups;
        const embeds = embedsSchema.safeParse(doc.embeds ?? {});
        if (embeds.success) window.dispatchEvent(new CustomEvent("pc:embeds", { detail: embeds.data }));
        // Display only; the storefront renders popup fields as text (see render/site-extras.tsx).
        const parsed = Array.isArray(popups) ? popups.map((p) => popupSchema.safeParse(p)).filter((r) => r.success).map((r) => r.data) : [];
        latestPopups.current = parsed;
        const live = parsed.find((p) => p.id === openPopup.current);
        if (live) window.dispatchEvent(new CustomEvent("pc:popup", { detail: { id: live.id, popup: live } }));
      } catch {
        latestPopups.current = [];
      }
      // Queue the edit. Server actions from one page run one after another, so firing a render per
      // keystroke built a backlog ("Updating…" for seconds, Bugs 2.0 #13/#14). Edits that arrive while a
      // render is running are merged into one job (union of their changed lists) and only the newest
      // document is rendered next.
      const queued = pending.current;
      const lists: string[] | "all" =
        queued?.lists === "all" || msg.changedLists === "all" ? "all" : [...new Set([...(queued?.lists ?? []), ...msg.changedLists])];
      pending.current = { rev: msg.rev, config: msg.config, lists };
      void drain();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [framed, platformOrigins, post, drain, applyTokens]);

  // "Add a section" in an empty page slot (canvas/empty-slot.tsx): insert at the start of its list.
  useEffect(() => {
    if (!framed) return;
    const onEmptyInsert = (e: Event) => {
      const slot = (e as CustomEvent<{ slot?: unknown }>).detail?.slot;
      if (typeof slot === "string" && listKeyOf(slot)) post({ type: "insert", slot, sectionId: null, where: "after", ai: false });
    };
    window.addEventListener(EMPTY_SLOT_INSERT_EVENT, onEmptyInsert);
    return () => window.removeEventListener(EMPTY_SLOT_INSERT_EVENT, onEmptyInsert);
  }, [framed, post]);

  // Hover + click-to-select (clicks inside sections never navigate while editing).
  useEffect(() => {
    if (!framed) return;
    // Hover follows the pointer; switching between two sections waits a moment, so the pointer can
    // cross a gap (e.g. to a toolbar flipped below a short section) without the chrome jumping away.
    let timer: number | undefined;
    const apply = (t: Target | null) => {
      hoverId.current = t?.id ?? null;
      setHover(t);
    };
    const onMove = (e: MouseEvent) => {
      const el = e.target as Element;
      window.clearTimeout(timer);
      if (el.closest("[data-builder-chrome]")) return;
      const t = targetOf(el);
      if ((t?.id ?? null) === hoverId.current) return;
      if (hoverId.current === null) apply(t);
      else timer = window.setTimeout(() => apply(t), 140);
    };
    const onLeave = () => {
      window.clearTimeout(timer);
      apply(null);
    };
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
      window.clearTimeout(timer);
      document.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("click", onClick, true);
    };
  }, [framed, post]);

  // Close the ⋮ menu on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Keep the outlines glued to their sections (scroll, resize, re-render).
  useEffect(() => {
    if (!framed) return;
    let raf = 0;
    const tick = () => {
      const h = hover ? sectionEl(hover.id) : null;
      const s = selected ? sectionEl(selected.id) : null;
      const selectedBox = s ? boxOf(s) : null;
      // Shimmer: the selected section when its slot is re-rendering, else every section of the busy slots.
      let busyBoxes: Box[] = [];
      if (Array.isArray(busy) && busy.length) {
        if (selected && selectedBox && busy.includes(selected.slot)) busyBoxes = [selectedBox];
        else {
          const els = busy.flatMap((slot) => Array.from(document.querySelectorAll<HTMLElement>(`[data-builder-slot-item="${CSS.escape(slot)}"]`)));
          busyBoxes = els
            .slice(0, MAX_SHIMMER)
            .map(boxOf)
            .filter((b): b is Box => !!b && b.height > 0 && b.top < window.innerHeight && b.top + b.height > 0);
        }
      }
      const tb = toolbarRef.current;
      const next: Boxes = {
        hover: h ? boxOf(h) : null,
        selected: selectedBox,
        header: headerBox(),
        busy: busyBoxes,
        toolbar: tb ? { w: tb.offsetWidth, h: tb.offsetHeight || 32 } : NO_BOXES.toolbar,
      };
      setBoxes((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [framed, hover, selected, busy]);

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

  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const compact = vw < 560;
  const floor = headerFloor(boxes.header);
  const isHeader = (t: Target) => t.slot === "layout.header";
  const label = (t: Target) => (t.pageContent ? "Page content" : (labels[t.id] ?? humanize(t.type)));

  /** Translucent overlay with an orange tint: dashed-light on hover, solid with a soft gradient when selected. */
  const overlay = (b: Box, selectedLook: boolean): CSSProperties => ({
    position: "fixed",
    top: b.top,
    left: b.left,
    width: b.width,
    height: b.height,
    boxSizing: "border-box",
    border: selectedLook ? "2px solid #f97316" : "1.5px solid rgba(249,115,22,.55)",
    borderRadius: 2,
    background: selectedLook
      ? "linear-gradient(180deg, rgba(249,115,22,.12) 0%, rgba(249,115,22,.04) 28%, rgba(249,115,22,0) 55%, rgba(249,115,22,.07) 100%)"
      : "linear-gradient(180deg, rgba(249,115,22,.06) 0%, rgba(249,115,22,0) 40%)",
    boxShadow: selectedLook ? "inset 0 0 0 1px rgba(255,255,255,.55), 0 0 0 4px rgba(249,115,22,.12)" : "none",
    pointerEvents: "none",
    zIndex: Z,
  });

  const tbH = boxes.toolbar.h;
  const tbTop = active && activeBox ? toolbarTop({ box: activeBox, toolbarHeight: tbH, viewportHeight: vh, minTop: isHeader(active) ? 0 : floor, inHeader: isHeader(active) }) : 0;
  const tbLeft = activeBox ? centeredLeft(activeBox, boxes.toolbar.w, vw) : 0;
  const menuUp = menuOpensUp(tbTop, tbH, compact ? 160 : 124, vh);
  // "+ / Add with AI" on the top edge: hidden once the section top has scrolled under the header.
  const showBefore = !!active && !!activeBox && (isHeader(active) || activeBox.top >= floor - 2) && activeBox.top < vh - 40;
  const beforeTop = activeBox ? Math.max(4, activeBox.top - 15) : 0;
  const afterTop = activeBox ? activeBox.top + activeBox.height - 15 : 0;
  const showAfter = !!activeBox && afterTop > floor && afterTop < vh - 34;
  const chipBox = activeBox && activeBox.top + activeBox.height > floor + 40 ? activeBox : null;

  return (
    <div data-builder-chrome aria-hidden={false} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: Z }}>
      <style>{CHROME_CSS}</style>
      {boxes.busy.map((b, i) => (
        <div key={i} className="pcb-shimmer" style={{ position: "fixed", top: b.top, left: b.left, width: b.width, height: b.height, pointerEvents: "none", zIndex: Z }} />
      ))}
      {boxes.hover && hover && hover.id !== selected?.id ? <div className="pcb-fade" style={overlay(boxes.hover, false)} /> : null}
      {boxes.selected && selected ? <div style={overlay(boxes.selected, true)} /> : null}
      {active && activeBox ? (
        <>
          {/* Label chip (bottom-right) */}
          {chipBox ? (
            <span
              className="pcb-chip"
              data-on={active.id === selected?.id ? "" : undefined}
              style={{ position: "fixed", top: Math.min(chipBox.top + chipBox.height, vh) - 34, right: Math.max(8, vw - (chipBox.left + chipBox.width) + 10), maxWidth: Math.max(120, Math.min(260, chipBox.width - 24)), zIndex: Z + 1 }}
            >
              <i aria-hidden />
              {label(active)}
            </span>
          ) : null}
          {/* Insert before */}
          {showBefore ? (
            <div style={{ position: "fixed", top: beforeTop, left: activeBox.left + activeBox.width / 2, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8, pointerEvents: "auto", zIndex: Z + 2 }}>
              <button type="button" className="pcb-btn pcb-plus" title="Add a section above" aria-label="Add a section above" onClick={() => insert("before", false)}>
                <Icon d={ICONS.plus} />
              </button>
              <button type="button" className="pcb-btn pcb-ai" title="Add a section above with AI" onClick={() => insert("before", true)}>
                <Icon d={ICONS.spark} /> {compact ? "AI" : "Add with AI"}
              </button>
            </div>
          ) : null}
          {/* Toolbar */}
          <div
            ref={toolbarRef}
            role="toolbar"
            aria-label={`${label(active)} section`}
            style={{ position: "fixed", top: tbTop, left: tbLeft, display: "flex", alignItems: "center", gap: 6, pointerEvents: "auto", zIndex: Z + 3, flexWrap: "nowrap", visibility: boxes.toolbar.w ? "visible" : "hidden" }}
          >
            {active.pageContent ? (
              <span className="pcb-btn pcb-static">Page content</span>
            ) : (
              <>
                <button type="button" className="pcb-btn" onClick={() => act("edit")}>
                  <Icon d={ICONS.pencil} /> Edit
                </button>
                {!compact ? (
                  <button type="button" className="pcb-btn" onClick={() => act("design")}>
                    <Icon d={ICONS.layout} /> Change design
                  </button>
                ) : null}
                <button type="button" className="pcb-btn pcb-icon" title="Section settings" aria-label="Section settings" onClick={() => act("settings")}>
                  <Icon d={ICONS.gear} />
                </button>
                {!compact ? (
                  <button type="button" className="pcb-btn pcb-icon" title="Colours" aria-label="Colours" onClick={() => act("colors")}>
                    <Icon d={ICONS.drop} />
                  </button>
                ) : null}
              </>
            )}
            <button type="button" className="pcb-btn pcb-icon" title="Move up" aria-label="Move up" onClick={() => act("up")}>
              <Icon d={ICONS.up} />
            </button>
            <button type="button" className="pcb-btn pcb-icon" title="Move down" aria-label="Move down" onClick={() => act("down")}>
              <Icon d={ICONS.down} />
            </button>
            {!active.pageContent ? (
              <span style={{ position: "relative", display: "inline-flex" }}>
                <button type="button" className="pcb-btn pcb-icon" title="More" aria-label="More actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
                  <Icon d={ICONS.more} />
                </button>
                {menuOpen ? (
                  <span role="menu" className="pcb-menu pcb-fade" style={menuUp ? { bottom: "calc(100% + 6px)" } : { top: "calc(100% + 6px)" }}>
                    {compact ? (
                      <>
                        <button type="button" role="menuitem" className="pcb-item" onClick={() => act("design")}>
                          <Icon d={ICONS.layout} /> Change design
                        </button>
                        <button type="button" role="menuitem" className="pcb-item" onClick={() => act("colors")}>
                          <Icon d={ICONS.drop} /> Colours
                        </button>
                      </>
                    ) : null}
                    <button type="button" role="menuitem" className="pcb-item" onClick={() => act("duplicate")}>
                      <Icon d={ICONS.copy} /> Duplicate
                    </button>
                    <button type="button" role="menuitem" className="pcb-item" onClick={() => act("hide")}>
                      <Icon d={ICONS.eyeOff} /> Hide
                    </button>
                    <button type="button" role="menuitem" className="pcb-item pcb-danger" onClick={() => act("delete")}>
                      <Icon d={ICONS.trash} /> Delete
                    </button>
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
          {/* Insert after */}
          {showAfter ? (
            <div style={{ position: "fixed", top: afterTop, left: activeBox.left + activeBox.width / 2, transform: "translateX(-50%)", pointerEvents: "auto", zIndex: Z + 2 }}>
              <button type="button" className="pcb-btn pcb-plus" title="Add a section below" aria-label="Add a section below" onClick={() => insert("after", false)}>
                <Icon d={ICONS.plus} />
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
