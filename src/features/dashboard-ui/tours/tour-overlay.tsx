"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/cn";
import { TOURS, stepTargets, type TourStep } from "./steps";
import { TOUR_TEXT } from "./text";
import type { TourText } from "./text/en";
import { placePopover, type Placement, type Rect } from "./position";
import type { TourId } from "./routes";

export type TourLabels = { next: string; back: string; done: string; close: string; stepOf: string };

type Props = {
  tour: TourId;
  locale: Locale;
  labels: TourLabels;
  /** Started automatically (first visit): close quietly when the page has none of the targets. */
  auto: boolean;
  /** `seen` = the seller saw at least one step (remember the tour as done). */
  onClose: (seen: boolean) => void;
};

const PAD = 6;
/** How long to wait for streamed sections before skipping their steps (nothing shows meanwhile). */
const WAIT_MS = 15000;

/** First on-screen element for a step (hidden ones, e.g. the desktop sidebar on a phone, don't count). */
function findTarget(step: TourStep): HTMLElement | null {
  for (const id of stepTargets(step)) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
    }
  }
  return null;
}

function rectOf(el: HTMLElement | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

/**
 * Coach-mark overlay: dims the page, rings the step's element and shows a popover with
 * Back / Next / Got it. Loaded on demand (next/dynamic) by TourLauncher. Esc closes, ← → move,
 * Tab stays inside the popover, and focus goes back where it was when the tour ends.
 */
export default function TourOverlay({ tour, locale, labels, auto, onClose }: Props) {
  const [text, setText] = useState<TourText | null>(null);
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [place, setPlace] = useState<Placement | null>(null);
  const pop = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();

  // Text for the seller's language, and the steps whose targets are on this page.
  useEffect(() => {
    let alive = true;
    void TOUR_TEXT[locale]().then((t) => alive && setText(t));
    const all = TOURS[tour];
    const targeted = all.filter((s) => stepTargets(s).length);
    const started = Date.now();
    const timer = setInterval(() => {
      // Streamed sections may arrive after the shell: wait a moment for the first target.
      if (targeted.some(findTarget) || !targeted.length || Date.now() - started > WAIT_MS) {
        clearInterval(timer);
        if (!alive) return;
        const found = all.filter((s) => !stepTargets(s).length || findTarget(s));
        if (targeted.length && !found.some((s) => stepTargets(s).length)) {
          onClose(!auto);
          return;
        }
        setSteps(found);
      }
    }, 150);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [tour, locale, auto, onClose]);

  const step = steps?.[index];
  const copy = step && text ? text[tour][step.id] : undefined;

  const measure = useCallback(() => {
    const vp = { width: window.innerWidth, height: window.innerHeight };
    const r = rectOf(target.current);
    setRect(r);
    const box = pop.current?.getBoundingClientRect();
    setPlace(placePopover(r, { width: box?.width ?? 340, height: box?.height ?? 180 }, vp));
  }, []);

  // Move to the step's element, then keep the ring on it while the page scrolls or resizes.
  useLayoutEffect(() => {
    if (!step) return;
    const el = findTarget(step);
    target.current = el;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "center", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
    measure();
    let frame = 0;
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    const settle = setTimeout(measure, 400);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [step, measure, copy]);

  // Focus the popover while the tour runs; give focus back afterwards.
  useEffect(() => {
    if (!steps?.length) return;
    const before = document.activeElement as HTMLElement | null;
    return () => before?.focus?.();
  }, [steps]);
  useEffect(() => {
    if (copy) pop.current?.focus();
  }, [copy, index]);

  const count = steps?.length ?? 0;
  const last = index === count - 1;
  const next = useCallback(() => (index >= count - 1 ? onClose(true) : setIndex((i) => i + 1)), [index, count, onClose]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Keys work wherever focus is (the page under the overlay can't be used while the tour runs).
  useEffect(() => {
    if (!count) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose(true);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      } else if (e.key === "Tab" && pop.current) {
        const f = Array.from(pop.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
        if (!f.length) return;
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (i === -1 || (e.shiftKey && i === 0) || (!e.shiftKey && i === f.length - 1)) {
          e.preventDefault();
          f[e.shiftKey ? f.length - 1 : 0]!.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [count, next, back, onClose]);

  if (!steps || !step || !copy) return null;

  const sheet = place?.side === "sheet";
  return createPortal(
    // .theme-panel gives the panel's colour tokens (light and dark) to this body-level layer.
    <div className="theme-panel fixed inset-0 z-[200]" style={{ background: "transparent", minHeight: 0 }}>
      {/* Swallows clicks so the page can't change under the tour; dims the page when no element is ringed. */}
      <div aria-hidden className={cn("absolute inset-0", !rect && "bg-black/55")} />
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-xl ring-2 ring-accent transition-all duration-200 ease-out motion-reduce:transition-none"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)" }}
        />
      ) : null}
      <div
        ref={pop}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className={cn(
          "absolute rounded-xl border border-border bg-surface-elevated p-4 text-foreground shadow-lg outline-none animate-[pop-in_140ms_ease-out]",
          sheet ? "inset-x-3 w-auto" : "w-[min(340px,calc(100vw-24px))]",
        )}
        style={{ top: place?.top ?? -9999, left: sheet ? undefined : (place?.left ?? -9999), visibility: place ? "visible" : "hidden" }}
      >
        <button type="button" onClick={() => onClose(true)} aria-label={labels.close} className="absolute right-2 top-2 grid size-8 place-items-center rounded-md text-muted hover:bg-surface-secondary hover:text-foreground">
          <X aria-hidden className="size-4" />
        </button>
        <h2 id={titleId} className="pr-8 text-h3">
          {copy.title}
        </h2>
        <p id={bodyId} className="mt-1.5 text-body text-muted">
          {copy.body}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span aria-live="polite" className="text-caption text-muted tabular-nums">
            {labels.stepOf.replace("{current}", String(index + 1)).replace("{total}", String(steps.length))}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={back}
              disabled={index === 0}
              className="h-8 rounded-md border border-border px-3 text-small text-muted transition-colors hover:bg-surface-secondary hover:text-foreground disabled:opacity-40"
            >
              ← {labels.back}
            </button>
            <button type="button" onClick={next} className="h-8 rounded-md bg-primary px-3 text-small font-medium text-primary-foreground transition-opacity hover:opacity-90">
              {last ? labels.done : `${labels.next} →`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
