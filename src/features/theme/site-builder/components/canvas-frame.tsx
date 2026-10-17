"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { AlertTriangle, LoaderCircle, Lock, RotateCw } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ThemeConfig } from "@/features/theme/schema/config";
import { refreshPreviewUrlAction } from "@/features/theme/actions";
import { previewEntryUrl } from "@/features/theme/preview";
import { useBuilder, type SectionTab } from "../context";
import { changedLists, duplicateSection, moveSection, removeSection, toggleHidden } from "../ops";
import { pageForPath, type BuilderPage } from "../pages";
import { HOST_TAG, parseCanvasMessage, type CanvasMessage, type HostMessage } from "../protocol";
import { listKeyOf } from "../slots";

/**
 * The canvas: the storefront (store origin) in an iframe, entered through the theme preview route so
 * it renders the saved draft, then kept in sync with the builder's unsaved document over postMessage
 * (protocol.ts). Messages are accepted only from this iframe's window on the store origin.
 */

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export const DEVICE_WIDTH = { desktop: 1280, mobile: 390 } as const;
const THEME_DEBOUNCE_MS = 250;
/** Refresh the preview token when it expires within this many seconds. */
const TOKEN_MARGIN_S = 5 * 60;

/** Origin of a URL string, or null if it is not an http(s) URL. */
export function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.origin : null;
  } catch {
    return null;
  }
}

/** Token from a preview entry URL (`/preview?token=…`). */
export function tokenOf(url: string): string | null {
  try {
    return new URL(url).searchParams.get("token");
  } catch {
    return null;
  }
}

/** A preview entry URL (from refreshPreviewUrlAction) re-targeted at `path` on the store origin. */
export function previewUrlFor(url: string, storeOrigin: string, path: string): string {
  const token = tokenOf(url);
  return token ? previewEntryUrl(storeOrigin, token, path) : url;
}

/** Path without query, hash or trailing slash ("/" stays "/"). */
export function cleanPath(path: string): string {
  return path.split("?")[0]!.split("#")[0]!.replace(/\/$/, "") || "/";
}

/** Whether the canvas, currently at `canvasPath`, already shows `page` (no navigation needed). */
export function canvasShowsPage(pages: BuilderPage[], canvasPath: string, page: BuilderPage): boolean {
  if (cleanPath(canvasPath) === cleanPath(page.path)) return true;
  return pageForPath(pages, canvasPath)?.key === page.key;
}

/** Scale that fits a `frameWidth` device into `available` px, never above 1. */
export function fitScale(available: number, frameWidth: number): number {
  return available > 0 ? Math.min(1, available / frameWidth) : 1;
}

export function CanvasFrame() {
  const b = useBuilder();
  const origin = useMemo(() => originOf(b.store.origin), [b.store.origin]);
  const host = origin ? new URL(origin).host : b.store.origin;

  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  /** Where the canvas should load; `n` forces a reload of the same path. */
  const [target, setTarget] = useState(() => ({ path: b.page.path, n: 0 }));
  const [src, setSrc] = useState<string | null>(null);
  /** Bumped on every navigation so the iframe reloads even for the same URL. */
  const [loads, setLoads] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [canvasPath, setCanvasPath] = useState<string | null>(null);
  const [status, setStatus] = useState<{ updating: boolean; error: string | null }>({ updating: false, error: null });

  const token = useRef<{ token: string; expiresAt: number } | null>(null);
  const canvasPathRef = useRef<string | null>(null);
  /** The document the canvas currently renders (null until the first "ready"). */
  const shown = useRef<ThemeConfig | null>(null);
  const rev = useRef(0);
  /** The next selection change came from the canvas (don't scroll it). */
  const selectFromCanvas = useRef(false);

  // Measure the canvas area.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const post = useEffectEvent((msg: DistributiveOmit<HostMessage, "tag">) => {
    if (!origin) return;
    frame.current?.contentWindow?.postMessage({ ...msg, tag: HOST_TAG }, origin);
  });

  /** Post the current document to the canvas (`all` forces every slot to re-render). */
  const postTheme = useEffectEvent((all: boolean) => {
    const prev = shown.current;
    const config = b.config;
    const lists = all || !prev ? "all" : changedLists(prev, config);
    shown.current = config;
    if (Array.isArray(lists) && lists.length === 0) return;
    rev.current += 1;
    post({ type: "theme", rev: rev.current, config: JSON.stringify(config), changedLists: lists });
    setStatus({ updating: true, error: null });
  });

  // Load the canvas at `target` (first load, page changes, reload).
  useEffect(() => {
    if (!origin) return;
    let live = true;
    /** A preview entry URL for the target path, refreshing the token when it is close to expiry. */
    const entryUrl = async (): Promise<string | null> => {
      const t = token.current;
      if (t && t.expiresAt - Date.now() / 1000 > TOKEN_MARGIN_S) return previewEntryUrl(origin, t.token, target.path);
      const r = await refreshPreviewUrlAction();
      if (!live) return null;
      const tok = r.ok ? tokenOf(r.data.url) : null;
      if (!r.ok || !tok) {
        setLoadError(r.ok ? "The preview link could not be created." : r.error.message);
        return null;
      }
      token.current = { token: tok, expiresAt: r.data.expiresAt };
      setLoadError(null);
      return previewEntryUrl(origin, tok, target.path);
    };
    void entryUrl().then((url) => {
      if (!live || !url) return;
      setReady(false);
      setStatus({ updating: false, error: null });
      setSrc(url);
      setLoads((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, [target, origin]);

  // Page picked in the builder: navigate unless the canvas is already there (adjusted during render).
  const [seenPage, setSeenPage] = useState(b.page.key);
  if (seenPage !== b.page.key) {
    setSeenPage(b.page.key);
    const there = canvasPath ? canvasShowsPage(b.pages, canvasPath, b.page) : cleanPath(target.path) === cleanPath(b.page.path);
    if (!there) setTarget((t) => ({ path: b.page.path, n: t.n + 1 }));
  }

  // Open (or close) the page's popup on the canvas.
  useEffect(() => {
    if (ready) post({ type: "popup", popupId: b.page.popupId ?? null });
  }, [b.page.popupId, ready]);

  // Keep the canvas on the latest document (debounced).
  useEffect(() => {
    if (!ready || shown.current === b.config) return;
    const t = setTimeout(() => postTheme(false), THEME_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [b.config, ready]);

  // Mirror the selection on the canvas (and scroll to it when it was picked in a panel).
  const onSelection = useEffectEvent(() => {
    const id = b.selected?.sectionId ?? null;
    post({ type: "select", sectionId: id });
    if (id && !selectFromCanvas.current) post({ type: "scrollTo", sectionId: id });
    selectFromCanvas.current = false;
  });
  useEffect(() => {
    if (ready) onSelection();
  }, [b.selected?.list, b.selected?.sectionId, ready]);

  const onCanvasMessage = useEffectEvent((msg: CanvasMessage) => {
    switch (msg.type) {
      case "ready": {
        canvasPathRef.current = msg.path;
        setCanvasPath(msg.path);
        // In-canvas navigation to another registry page: follow it.
        let page = b.page;
        if (!canvasShowsPage(b.pages, msg.path, b.page)) {
          const mapped = pageForPath(b.pages, msg.path);
          if (mapped) {
            b.setPageKey(mapped.key);
            page = mapped;
          }
        }
        // A fresh load renders the saved draft: send unsaved edits.
        if (b.dirty) postTheme(true);
        else {
          shown.current = b.config;
          setStatus({ updating: false, error: null });
        }
        if (page.key === b.page.key && b.selected) post({ type: "select", sectionId: b.selected.sectionId });
        if (page.popupId) post({ type: "popup", popupId: page.popupId });
        setReady(true);
        return;
      }
      case "rendered":
        if (msg.rev === rev.current) setStatus({ updating: false, error: msg.ok ? null : (msg.error ?? "The canvas couldn't update.") });
        return;
      case "select": {
        const list = listKeyOf(msg.slot);
        if (!list) return;
        const ref = { list, sectionId: msg.sectionId };
        selectFromCanvas.current = true;
        b.select(ref);
        b.setPanel({ kind: "section", ref, tab: "edit" });
        return;
      }
      case "action": {
        const list = listKeyOf(msg.slot);
        if (!list) return;
        const id = msg.sectionId;
        switch (msg.action) {
          case "edit":
          case "design":
          case "settings":
          case "colors": {
            const ref = { list, sectionId: id };
            selectFromCanvas.current = true;
            b.select(ref);
            b.setPanel({ kind: "section", ref, tab: msg.action satisfies SectionTab });
            return;
          }
          case "up":
          case "down":
            b.apply((c) => moveSection(c, list, id, msg.action === "up" ? -1 : 1));
            return;
          case "duplicate": {
            const r = duplicateSection(b.config, list, id);
            if (!r.newId) return;
            b.apply(r.config);
            selectFromCanvas.current = true;
            b.select({ list, sectionId: r.newId });
            return;
          }
          case "hide":
            b.apply((c) => toggleHidden(c, list, id));
            return;
          case "delete": {
            if (!confirm("Delete this section?")) return;
            b.apply((c) => removeSection(c, list, id));
            if (b.selected?.sectionId === id) b.select(null);
            if (b.panel?.kind === "section" && b.panel.ref.sectionId === id) b.setPanel({ kind: "layers" });
            return;
          }
        }
        return;
      }
      case "insert": {
        const list = listKeyOf(msg.slot);
        if (!list) return;
        b.setPanel({ kind: "insert", list, anchorId: msg.sectionId, where: msg.where, ai: msg.ai });
        return;
      }
    }
  });

  useEffect(() => {
    if (!origin) return;
    const onMessage = (e: MessageEvent) => {
      const win = frame.current?.contentWindow;
      if (!win || e.source !== win || e.origin !== origin) return;
      const msg = parseCanvasMessage(e.data);
      if (msg) onCanvasMessage(msg);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin]);

  const reload = () => {
    shown.current = null;
    setTarget((t) => ({ path: canvasPathRef.current ?? b.page.path, n: t.n + 1 }));
  };

  // Device sizing: desktop renders 1280px wide scaled to fit; mobile is a 390px phone, never upscaled.
  const mobile = b.device === "mobile";
  const width = DEVICE_WIDTH[b.device];
  const bezel = mobile ? 12 : 0;
  const scale = mobile ? fitScale(size.w - 48, width + 2 * bezel) : fitScale(size.w, width);
  const frameH = mobile ? Math.max(480, Math.min(844, (size.h - 48) / scale - 2 * bezel)) : size.h / scale;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-secondary">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 text-xs">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-surface-secondary px-2.5 py-1 text-muted">
          <Lock aria-hidden className="size-3 shrink-0" />
          <span className="truncate">
            <span className="text-foreground">{host}</span>
            {canvasPath ?? b.page.path}
          </span>
        </div>
        {status.error ? (
          <span role="alert" className="flex items-center gap-1 text-error" title={status.error}>
            <AlertTriangle aria-hidden className="size-3.5" />
            <span className="max-w-60 truncate">{status.error}</span>
          </span>
        ) : status.updating || (src && !ready) ? (
          <span role="status" className="flex items-center gap-1 text-muted">
            <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> {ready ? "Updating…" : "Loading…"}
          </span>
        ) : null}
        <button type="button" onClick={reload} aria-label="Reload canvas" title="Reload canvas" className="grid size-6 place-items-center rounded-md text-muted hover:bg-surface-secondary hover:text-foreground">
          <RotateCw aria-hidden className="size-3.5" />
        </button>
      </div>

      <div ref={box} className={cn("relative min-h-0 flex-1", mobile ? "overflow-auto" : "overflow-hidden")}>
        {loadError ? (
          <div className="grid h-full place-items-center p-6 text-center">
            <div className="space-y-2">
              <p className="text-small text-error">{loadError}</p>
              <button type="button" onClick={reload} className="text-small font-medium text-accent hover:underline">
                Try again
              </button>
            </div>
          </div>
        ) : !origin ? (
          <p className="grid h-full place-items-center text-small text-error">This store has no valid address.</p>
        ) : src && size.w ? (
          <div
            className={cn("absolute top-0", scale < 1 ? "left-1/2 origin-top" : "inset-x-0 mx-auto w-fit", mobile && "mt-6 rounded-[2.25rem] border border-border-strong bg-foreground/90 shadow-xl")}
            // No transform at 100%: sharper text, and pointer/devtools hit-testing stays exact.
            style={{ padding: bezel, transform: scale < 1 ? `translateX(-50%) scale(${scale})` : undefined }}
          >
            <iframe
              key={loads}
              ref={frame}
              src={src}
              title={`Store canvas (${b.device})`}
              className={cn("block border-0 bg-white", mobile && "rounded-[1.6rem]")}
              style={{ width, height: frameH }}
            />
          </div>
        ) : (
          <p className="grid h-full place-items-center text-small text-muted">Loading your store…</p>
        )}
      </div>
    </div>
  );
}
