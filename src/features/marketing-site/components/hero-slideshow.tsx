"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Cross-fading slideshow for the hero browser frame. Slides are server-rendered nodes; this island
 * only switches which one is shown. The progress bar in the active dot is a Web Animation whose
 * `finish` advances the slide, so pausing (hover, keyboard focus, off-screen, hidden tab, or the
 * pause button) freezes the bar and the timer together. People who ask for reduced motion get no
 * autoplay (the dots and play button still work).
 */
export function HeroSlideshow({ slides, captions, interval, autoplay, label, className }: { slides: ReactNode[]; captions: string[]; interval: number; autoplay: boolean; label: string; className?: string }) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [userPlaying, setUserPlaying] = useState<boolean | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [tabHidden, setTabHidden] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const anim = useRef<Animation | null>(null);

  const playing = count > 1 && (userPlaying ?? (autoplay && !reduced));
  const held = hovered || focused || !onScreen || tabHidden;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    const vis = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", vis);
    const el = root.current;
    const io = el && "IntersectionObserver" in window ? new IntersectionObserver(([e]) => setOnScreen(Boolean(e?.isIntersecting))) : null;
    if (el) io?.observe(el);
    return () => {
      mq.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", vis);
      io?.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = bar.current;
    if (!playing || !el || typeof el.animate !== "function") return;
    const a = el.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: interval * 1000, easing: "linear" });
    a.onfinish = () => setIndex((i) => (i + 1) % count);
    anim.current = a;
    return () => {
      a.onfinish = null;
      a.cancel();
      anim.current = null;
    };
  }, [index, playing, interval, count]);

  useEffect(() => {
    const a = anim.current;
    if (!a) return;
    if (held) a.pause();
    else if (a.playState === "paused") a.play();
  }, [held, index, playing]);

  if (!count) return null;

  return (
    <div
      ref={root}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="relative" aria-live={playing ? "off" : "polite"}>
        {slides.map((slide, i) => {
          // Mount only the active slide and the next one so off-screen hero images stay out of the
          // network waterfall (LCP). Dot buttons still jump to any index; that slide mounts on select.
          // Active slide is `relative` so the frame keeps height when slide 0 is unmounted.
          const next = (index + 1) % count;
          const mounted = i === index || i === next;
          const active = i === index;
          return (
            <div
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}${captions[i] ? `: ${captions[i]}` : ""}`}
              aria-hidden={!active}
              inert={!active}
              className={cn(
                "transition-[opacity,transform] duration-700 ease-out",
                active ? "relative z-[1] scale-100 opacity-100" : "pointer-events-none absolute inset-0 scale-[1.015] opacity-0",
              )}
            >
              {mounted ? slide : null}
            </div>
          );
        })}
      </div>
      {count > 1 ? (
        <div className="mt-5 flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show slide ${i + 1}${captions[i] ? `: ${captions[i]}` : ""}`}
                aria-current={i === index ? "true" : undefined}
                className="grid h-6 place-items-center rounded-full px-0.5 focus-visible:outline-2 focus-visible:outline-white"
              >
                <span className={cn("relative block h-1.5 overflow-hidden rounded-full bg-white/25 transition-[width,background-color] duration-300", i === index ? "w-7" : "w-1.5 hover:bg-white/50")}>
                  {i === index ? <span ref={bar} className="absolute inset-0 origin-left rounded-full bg-[#34d399]" style={{ transform: playing ? "scaleX(0)" : "none" }} /> : null}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setUserPlaying(!playing)}
            aria-label={playing ? "Pause slideshow" : "Play slideshow"}
            className="grid size-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
          >
            {playing ? <Pause aria-hidden className="size-3.5" /> : <Play aria-hidden className="size-3.5" />}
          </button>
        </div>
      ) : null}
      {captions.some(Boolean) ? (
        <p className="mt-2 min-h-5 text-center text-sm text-white/60" aria-hidden>
          {captions[index]}
        </p>
      ) : null}
    </div>
  );
}
