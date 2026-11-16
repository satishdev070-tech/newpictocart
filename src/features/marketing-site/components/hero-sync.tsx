"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Keeps the hero's typing headline word and the theme screenshots beside it on the same slide.
 * The headline (RotatingWords) advances the index when it finishes a word; the dots under the
 * screenshots jump to a slide, and the headline then types that slide's word.
 */
type HeroSync = { index: number; setIndex: (i: number) => void };
const HeroSyncContext = createContext<HeroSync | null>(null);

export const useHeroSync = () => useContext(HeroSyncContext);

export function HeroSyncProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState(0);
  return <HeroSyncContext.Provider value={{ index, setIndex }}>{children}</HeroSyncContext.Provider>;
}

export type HeroShot = {
  key: string;
  /** "Hearth & Crust theme · Gourmet" */
  caption: string;
  desktop: string;
  desktopSrcSet?: string;
  phone: string;
  /** Theme background colour, painted while the image loads. */
  background: string;
};

/* eslint-disable @next/next/no-img-element -- pre-sized static WebP screenshots need no Image Optimization */

/**
 * Desktop screenshot in a browser frame plus a phone screenshot in a handset frame, cross-fading
 * with the headline. Only the current slide (and, after first paint, the next one) is mounted, so
 * first load fetches just the first pair; the first desktop shot is the eager, high-priority LCP.
 */
export function HeroThemeShots({
  shots,
  sizes,
  desktopSize,
  phoneSize,
}: {
  shots: HeroShot[];
  /** `sizes` for the desktop srcSet (also used by the server's preload). */
  sizes: string;
  desktopSize: { width: number; height: number };
  phoneSize: { width: number; height: number };
}) {
  const sync = useHeroSync();
  const index = (sync?.index ?? 0) % Math.max(shots.length, 1);
  const [warm, setWarm] = useState(false);
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set([0]));
  const [seenFor, setSeenFor] = useState(index);
  if (seenFor !== index) {
    setSeenFor(index);
    setSeen((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
  }

  useEffect(() => {
    const warmUp = () => setWarm(true);
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(warmUp, { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(warmUp, 1800);
    return () => clearTimeout(t);
  }, []);

  if (!shots.length) return null;
  const next = (index + 1) % shots.length;
  const mounted = (i: number) => i === index || seen.has(i) || (warm && i === next);
  // Incoming fades in on top; the outgoing one stays visible underneath until the fade ends.
  const layer = (i: number) =>
    cn("motion-reduce:transition-none", i === index ? "relative z-[1] opacity-100 transition-opacity duration-500 ease-out" : "absolute inset-0 z-0 opacity-0 transition-opacity delay-500 duration-0");

  return (
    <div>
      <div className="relative pr-[9%] pb-[7%] sm:pr-[10%]">
        {/* Desktop: browser frame */}
        <div className="overflow-hidden rounded-xl border border-mk-line bg-mk-elev-1 shadow-brand-float sm:rounded-2xl">
          <div className="flex items-center gap-1.5 border-b border-mk-line px-3 py-2 sm:px-4 sm:py-2.5" aria-hidden>
            <span className="size-2 rounded-full bg-white/25 sm:size-2.5" />
            <span className="size-2 rounded-full bg-white/25 sm:size-2.5" />
            <span className="size-2 rounded-full bg-mk-accent sm:size-2.5" />
            <span className="ml-3 h-3.5 flex-1 rounded-full bg-white/10 sm:h-4" />
          </div>
          <div className="relative overflow-hidden" style={{ aspectRatio: `${desktopSize.width} / ${desktopSize.height}`, background: shots[index]!.background }}>
            {shots.map((s, i) =>
              mounted(i) ? (
                <img
                  key={s.key}
                  src={s.desktop}
                  srcSet={s.desktopSrcSet}
                  sizes={s.desktopSrcSet ? sizes : undefined}
                  alt={i === index ? `${s.caption}, desktop view` : ""}
                  width={desktopSize.width}
                  height={desktopSize.height}
                  loading="eager"
                  fetchPriority={i === 0 ? "high" : "low"}
                  decoding={i === 0 ? "sync" : "async"}
                  className={cn("block size-full object-cover object-top", layer(i))}
                />
              ) : null,
            )}
          </div>
        </div>
        {/* Phone: handset frame overlapping the bottom-right corner */}
        <div className="absolute right-0 bottom-0 w-[21%] max-w-40 rounded-[18px] border-[5px] border-[#16110d] bg-[#16110d] shadow-brand-float sm:rounded-[24px] sm:border-[6px]">
          <div className="relative overflow-hidden rounded-[13px] sm:rounded-[18px]" style={{ aspectRatio: `${phoneSize.width} / ${phoneSize.height}`, background: shots[index]!.background }}>
            {shots.map((s, i) =>
              mounted(i) ? (
                <img
                  key={s.key}
                  src={s.phone}
                  alt={i === index ? `${s.caption}, phone view` : ""}
                  width={phoneSize.width}
                  height={phoneSize.height}
                  loading={i === 0 ? "lazy" : "eager"}
                  decoding="async"
                  className={cn("block size-full object-cover object-top", layer(i))}
                />
              ) : null,
            )}
          </div>
        </div>
      </div>
      {shots.length > 1 ? (
        <div className="mt-4 flex justify-center gap-1.5">
          {shots.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => sync?.setIndex(i)}
              aria-label={`Show ${s.caption}`}
              aria-current={i === index ? "true" : undefined}
              className="grid h-6 place-items-center rounded-full px-0.5 focus-visible:outline-2 focus-visible:outline-mk-accent"
            >
              <span className={cn("block h-1.5 rounded-full transition-[width,background-color] duration-300", i === index ? "w-7 bg-mk-accent" : "w-1.5 bg-white/25 hover:bg-white/50")} />
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-1 min-h-5 text-center text-sm text-mk-dim" aria-hidden>
        {shots[index]!.caption}
      </p>
    </div>
  );
}
