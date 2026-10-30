"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, Lock, RotateCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { ThemeConfig } from "@/features/theme/schema/config";
import { refreshPreviewUrlAction } from "@/features/theme/actions";
import { previewEntryUrl } from "@/features/theme/preview";
import { useBuilder, type SectionTab } from "../context";
import { changePlan, duplicateSection, moveSection, removeSection, setTextLookWidth, toggleHidden } from "../ops";
import { pageForPath, type BuilderPage } from "../pages";
import { HOST_TAG, parseCanvasMessage, type CanvasMessage, type HostMessage } from "../protocol";
import { listKeyOf } from "../slots";
import { sectionChipLabels } from "../chip-labels";

/**
 * The canvas: the storefront (store origin) in an iframe, entered through the theme preview route so
 * it renders the saved draft, then kept in sync with the builder's unsaved document over postMessage
 * (protocol.ts). Messages are accepted only from this iframe's window on the store origin.
 */

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export const DEVICE_WIDTH = { desktop: 1280, mobile: 390 } as const;
/** Window event a panel dispatches to reload the canvas (store data it renders changed). */
export const CANVAS_RELOAD_EVENT = "pc:canvas-reload";
const THEME_DEBOUNCE_MS = 150;
/** No "rendered" answer for this long → the render is treated as lost and the canvas recovers. */
export const RENDER_WATCHDOG_MS = 20_000;
/** Automatic recoveries (reload / new preview token) before the error is shown with a Retry button. */
export const MAX_AUTO_RECOVERIES = 2;
/** Refresh the preview token when it expires within this many seconds. */
const TOKEN_MARGIN_S = 5 * 60;
/** While the canvas hasn't said "ready", ask it every this many ms ("hello"), at most HELLO_TRIES times. */
const HELLO_EVERY_MS = 1000;
export const HELLO_TRIES = 25;

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
  /** The document last handed to the canvas (state twin of `shown`, for the progress bar). */
  const [postedConfig, setPostedConfig] = useState<ThemeConfig | null>(null);
  /** The target whose entry URL was last loaded (differs from `target` while a page load is starting). */
  const [loadedTarget, setLoadedTarget] = useState<typeof target | null>(null);

  const token = useRef<{ token: string; expiresAt: number } | null>(null);
  const canvasPathRef = useRef<string | null>(null);
  /** The document the canvas currently renders (null until the first "ready"). */
  const shown = useRef<ThemeConfig | null>(null);
  const rev = useRef(0);
  /** The next selection change came from the canvas (don't scroll it). */
  const selectFromCanvas = useRef(false);
  /** Fires when a posted render never answers (Bugs 2.0 #13: "Updating…" forever). */
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Automatic recoveries since the last successful render. */
  const recoveries = useRef(0);
  /** "hello" pings while waiting for the canvas to say "ready". */
  const hello = useRef<ReturnType<typeof setInterval> | null>(null);
  const readyRef = useRef(false);
  /** A token refresh in flight (shared so concurrent callers wait for the same one). */
  const refreshing = useRef<Promise<boolean> | null>(null);

  // Measure the canvas area.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clearWatchdog = () => {
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = null;
  };
  const reload = () => {
    clearWatchdog();
    shown.current = null;
    setTarget((t) => ({ path: canvasPathRef.current ?? b.page.path, n: t.n + 1 }));
  };
  // Panels ask for a reload after changing store data the canvas renders (e.g. the WhatsApp number).
  const onReloadRequest = useEffectEvent(reload);
  useEffect(() => {
    const on = () => onReloadRequest();
    window.addEventListener(CANVAS_RELOAD_EVENT, on);
    return () => window.removeEventListener(CANVAS_RELOAD_EVENT, on);
  }, []);
  /**
   * The canvas couldn't render: reload it (with a fresh preview token when the old one was rejected,
   * Bugs 2.0 #14/#15 "You don't have permission"). Unsaved edits are re-sent when it is ready again.
   * After MAX_AUTO_RECOVERIES failures in a row the error stays with a Retry button.
   */
  const recover = useEffectEvent(({ expired, error }: { expired: boolean; error: string }) => {
    clearWatchdog();
    if (recoveries.current >= MAX_AUTO_RECOVERIES) {
      setStatus({ updating: false, error });
      return;
    }
    recoveries.current += 1;
    if (expired) token.current = null;
    setStatus({ updating: true, error: null });
    reload();
  });
  const armWatchdog = useEffectEvent((r: number) => {
    clearWatchdog();
    watchdog.current = setTimeout(() => {
      watchdog.current = null;
      if (r === rev.current) recover({ expired: false, error: "The preview is taking too long to update." });
    }, RENDER_WATCHDOG_MS);
  });
  useEffect(() => clearWatchdog, []);


  const post = useEffectEvent((msg: DistributiveOmit<HostMessage, "tag">) => {
    if (!origin) return;
    frame.current?.contentWindow?.postMessage({ ...msg, tag: HOST_TAG }, origin);
  });

  /**
   * A fresh preview token (renders are authorised by it, not only by the frame's cookie). Shared by
   * concurrent callers; false when it couldn't be renewed.
   */
  const renewToken = useEffectEvent((force: boolean): Promise<boolean> => {
    const t = token.current;
    if (!force && t && t.expiresAt - Date.now() / 1000 > TOKEN_MARGIN_S) return Promise.resolve(true);
    refreshing.current ??= refreshPreviewUrlAction()
      .then((r) => {
        const tok = r.ok ? tokenOf(r.data.url) : null;
        if (!r.ok || !tok) return false;
        token.current = { token: tok, expiresAt: r.data.expiresAt };
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing.current = null;
      });
    return refreshing.current;
  });

  /** Post the current document to the canvas (`all` forces every slot to re-render). */
  const postTheme = useEffectEvent((all: boolean) => {
    const prev = shown.current;
    const config = b.config;
    const plan = all || !prev ? { lists: "all" as const, css: true } : changePlan(prev, config);
    shown.current = config;
    setPostedConfig(config);
    // CSS-only edits (colours, fonts, spacing) are still posted: the canvas applies them instantly.
    if (Array.isArray(plan.lists) && plan.lists.length === 0 && !plan.css) return;
    rev.current += 1;
    const msg = { type: "theme" as const, rev: rev.current, config: JSON.stringify(config), changedLists: plan.lists };
    setStatus({ updating: true, error: null });
    armWatchdog(rev.current);
    // A token about to expire (e.g. after the tab slept) is renewed first, so the render isn't
    // rejected and a recovery isn't spent. Renewals are shared, so queued posts keep their order.
    const t = token.current;
    if (t && t.expiresAt - Date.now() / 1000 > TOKEN_MARGIN_S) post({ ...msg, token: t.token });
    else void renewToken(false).then(() => post({ ...msg, token: token.current?.token }));
  });

  const stopHello = () => {
    if (hello.current) clearInterval(hello.current);
    hello.current = null;
  };
  useEffect(() => stopHello, []);
  /**
   * The iframe loaded: ask the canvas "hello" until it answers "ready" (covers a missed ready, e.g.
   * posted before this page listened). No answer at all → the store couldn't open in edit mode.
   */
  const [frameLoaded, setFrameLoaded] = useState(0);
  useEffect(() => {
    if (!frameLoaded) return;
    stopHello();
    if (readyRef.current) return;
    let tries = 0;
    hello.current = setInterval(() => {
      if (readyRef.current) return stopHello();
      tries += 1;
      if (tries > HELLO_TRIES) {
        stopHello();
        recover({ expired: true, error: "The store preview didn't connect. Retry to continue." });
        return;
      }
      post({ type: "hello" });
    }, HELLO_EVERY_MS);
    return stopHello;
  }, [frameLoaded]);

  // Renew the preview token in the background while the builder is open (long sessions).
  useEffect(() => {
    const t = setInterval(() => void renewToken(false), 60_000);
    return () => clearInterval(t);
  }, []);

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
      setLoadedTarget(target);
      readyRef.current = false;
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

  // Section names for the canvas label chips.
  const labels = useMemo(() => sectionChipLabels(b.config), [b.config]);
  useEffect(() => {
    if (ready) post({ type: "labels", labels });
  }, [labels, ready]);

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
        stopHello();
        readyRef.current = true;
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
          setPostedConfig(b.config);
          setStatus({ updating: false, error: null });
        }
        if (page.key === b.page.key && b.selected) post({ type: "select", sectionId: b.selected.sectionId });
        if (page.popupId) post({ type: "popup", popupId: page.popupId });
        setReady(true);
        return;
      }
      case "leaving":
        // The frame's next load starts the hello loop again (see frameLoaded).
        readyRef.current = false;
        setReady(false);
        return;
      case "rendered":
        if (msg.rev !== rev.current) return;
        clearWatchdog();
        if (msg.ok) {
          recoveries.current = 0;
          setStatus({ updating: false, error: null });
        } else if (msg.code === "forbidden") {
          // The preview token or cookie was rejected: renew the token and resend, without a reload.
          if (recoveries.current < MAX_AUTO_RECOVERIES) {
            recoveries.current += 1;
            void renewToken(true).then((ok) => (ok ? postTheme(true) : recover({ expired: true, error: "Your preview session expired. Retry to continue." })));
          } else recover({ expired: true, error: "Your preview session expired. Retry to continue." });
        }
        else recover({ expired: false, error: msg.error ?? "The canvas couldn't update." });
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
      case "textSelect": {
        const list = listKeyOf(msg.slot);
        if (!list) return;
        const ref = { list, sectionId: msg.sectionId };
        selectFromCanvas.current = true;
        b.select(ref);
        // Open Edit and focus the matching TextStyleField (Heading / Sub-heading / …).
        b.setPanel({ kind: "section", ref, tab: "edit", textRole: msg.role, ...(msg.itemIndex !== undefined ? { itemIndex: msg.itemIndex } : {}) });
        return;
      }
      case "textResize": {
        const list = listKeyOf(msg.slot);
        if (!list) return;
        b.apply(
          (c) => setTextLookWidth(c, list, msg.sectionId, msg.role, msg.widthPct, msg.itemIndex),
          `sec.${msg.sectionId}.text.${msg.role}.width`,
        );
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

  /** Manual retry: start the automatic recoveries over. */
  const retry = () => {
    recoveries.current = 0;
    if (status.error?.includes("expired")) token.current = null;
    setStatus({ updating: true, error: null });
    reload();
  };

  // Device sizing: desktop renders 1280px wide scaled to fit; mobile is a 390px phone, never upscaled.
  const mobile = b.device === "mobile";
  const width = DEVICE_WIDTH[b.device];
  const bezel = mobile ? 12 : 0;
  const scale = mobile ? fitScale(size.w - 48, width + 2 * bezel) : fitScale(size.w, width);
  const frameH = mobile ? Math.max(480, Math.min(844, (size.h - 48) / scale - 2 * bezel)) : size.h / scale;

  // Progress: a page is loading, or an edit is on its way to / rendering in the canvas.
  const loading = !!origin && !loadError && (loadedTarget !== target || !ready);
  const updating = ready && !status.error && (status.updating || (postedConfig !== null && postedConfig !== b.config));
  const busy = loading || updating;
  const progress = useRenderProgress(busy, status.error, updating && !loading);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-secondary">
      <style>{PROGRESS_CSS}</style>
      <div className="relative flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 text-xs">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-surface-secondary px-2.5 py-1 text-muted">
          <Lock aria-hidden className="size-3 shrink-0" />
          <span className="truncate">
            <span className="text-foreground">{host}</span>
            {canvasPath ?? b.page.path}
          </span>
        </div>
        {status.error ? (
          <span role="alert" className="flex items-center gap-1.5 text-error" title={status.error}>
            <AlertTriangle aria-hidden className="size-3.5" />
            <span className="max-w-60 truncate">{status.error}</span>
            <button type="button" onClick={retry} className="rounded-md px-1.5 py-0.5 font-medium text-accent hover:bg-accent-soft">
              Retry
            </button>
          </span>
        ) : busy ? (
          <span role="status" aria-live="polite" className={cn("flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium tabular-nums", progress.slow ? "bg-warning/12 text-warning" : "bg-success/12 text-success")}>
            <LoaderCircle aria-hidden className="size-3 animate-spin motion-reduce:animate-none" /> {loading ? "Loading" : progress.slow ? "Still working" : "Updating"} {progress.percent}%
          </span>
        ) : progress.done ? (
          <span role="status" className="flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 font-medium text-success">
            <CheckCircle2 aria-hidden className="size-3.5" /> Updated
          </span>
        ) : null}
        <button type="button" onClick={reload} aria-label="Reload canvas" title="Reload canvas" className="grid size-6 place-items-center rounded-md text-muted hover:bg-surface-secondary hover:text-foreground">
          <RotateCw aria-hidden className="size-3.5" />
        </button>
        <ProgressBar active={busy || progress.done} percent={progress.percent} slow={progress.slow} />
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
            className={cn(
              "absolute top-0 transition-opacity duration-300 motion-reduce:transition-none",
              scale < 1 ? "left-1/2 origin-top" : "inset-x-0 mx-auto w-fit",
              mobile && "mt-6 rounded-[2.25rem] border border-border-strong bg-foreground/90 shadow-xl",
              loading && ready && "opacity-60",
            )}
            // No transform at 100%: sharper text, and pointer/devtools hit-testing stays exact.
            style={{ padding: bezel, transform: scale < 1 ? `translateX(-50%) scale(${scale})` : undefined }}
          >
            <iframe
              key={loads}
              ref={frame}
              src={src}
              onLoad={() => setFrameLoaded((n) => n + 1)}
              title={`Store canvas (${b.device})`}
              className={cn("block border-0 bg-white", mobile && "rounded-[1.6rem]")}
              style={{ width, height: frameH }}
            />
          </div>
        ) : (
          <div className="grid h-full place-items-center">
            <div className="flex flex-col items-center gap-3 text-small text-muted">
              <span className="relative grid size-10 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-accent/20 motion-reduce:animate-none" />
                <LoaderCircle aria-hidden className="size-6 animate-spin text-accent motion-reduce:animate-none" />
              </span>
              Loading your store…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Bar shimmer (a static bar when the user prefers reduced motion). */
const PROGRESS_CSS = `
@keyframes sb-shine { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
.sb-progress-shine { animation: sb-shine 1.2s linear infinite; }
@media (prefers-reduced-motion: reduce) { .sb-progress-shine { animation: none; display: none; } }`;

/** How long an edit may take before the builder says it's taking longer than usual. */
export const SLOW_RENDER_MS = 6000;
/** A page load is only marked slow (amber badge, no toast) after this long. */
const LOAD_SLOW_MS = 12_000;

/**
 * Percentage for the canvas update bar (Bugs 2.0 follow-up: "show progress in %, in green, with
 * success / error / warning messages"). A render reports only start and finish, so the percentage
 * eases towards 92% while busy and jumps to 100% when the canvas answers. Errors and slow renders
 * also raise a toast; a finished update shows "Updated" briefly.
 */
export function nextPercent(p: number): number {
  return Math.min(92, Math.round((p + Math.max(1, (92 - p) * 0.08)) * 10) / 10);
}

function useRenderProgress(busy: boolean, error: string | null, editing: boolean): { percent: number; slow: boolean; done: boolean } {
  const toast = useToast();
  const [percent, setPercent] = useState(0);
  const [slow, setSlow] = useState(false);
  const [done, setDone] = useState(false);
  const [wasBusy, setWasBusy] = useState(busy);
  // Edge changes adjusted during render (start: reset; finish: 100% + "Updated").
  if (busy !== wasBusy) {
    setWasBusy(busy);
    if (busy) {
      setPercent(6);
      setSlow(false);
      setDone(false);
    } else {
      setPercent(100);
      setDone(!error);
    }
  }
  useEffect(() => {
    if (!busy) return;
    const tick = setInterval(() => setPercent(nextPercent), 140);
    // Page loads show their progress in the badge only; the toast is about an edit being slow.
    const warn = setTimeout(() => {
      setSlow(true);
      if (editing) toast.show({ tone: "warning", message: "This change is taking longer than usual. It will appear as soon as it's ready." });
    }, editing ? SLOW_RENDER_MS : LOAD_SLOW_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(warn);
    };
  }, [busy, toast, editing]);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1800);
    return () => clearTimeout(t);
  }, [done]);
  const [seenError, setSeenError] = useState(error);
  if (error !== seenError) {
    setSeenError(error);
    if (error) toast.show({ tone: "error", message: error });
  }
  return { percent: Math.round(percent), slow, done };
}

/** Thin progress bar along the bottom of the canvas address bar: green, amber when slow. */
function ProgressBar({ active, percent, slow }: { active: boolean; percent: number; slow: boolean }) {
  return (
    <div
      role="progressbar"
      aria-label="Preview update"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={active ? percent : undefined}
      className={cn("pointer-events-none absolute inset-x-0 -bottom-px z-10 h-[3px] overflow-hidden bg-success/10 transition-opacity duration-300", active ? "opacity-100" : "opacity-0")}
    >
      <div className={cn("relative h-full overflow-hidden rounded-r-full transition-[width] duration-200 ease-out", slow ? "bg-warning" : "bg-success")} style={{ width: `${active ? percent : 0}%`, boxShadow: slow ? undefined : "0 0 8px rgba(34,197,94,.55)" }}>
        <span className="sb-progress-shine absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      </div>
    </div>
  );
}
