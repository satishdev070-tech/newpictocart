"use client";

import { useCallback, useEffect, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * Cross-fading hero slideshow (theme Hero designs "hero-fade", "hero-slider", "hero-kenburns").
 * Slides are stacked in one grid cell (height = tallest slide) and fade; the inactive ones are
 * inert. Slide content is server-rendered and passed in as nodes, so this island only owns the
 * active index.
 *
 * Autoplay follows the same rules as <Carousel>: it starts after the page has loaded (LCP), pauses
 * on hover / focus / hidden tab, never runs under prefers-reduced-motion, and has a visible
 * pause button (WCAG 2.2.2). The timer IS the CSS progress animation (animationend → next slide),
 * so pausing freezes the progress bar and the countdown together.
 */
export function HeroStage({
  label,
  slides,
  names,
  thumbs,
  nav,
  autoplayMs,
  className = "",
  placement = "below",
}: {
  label: string;
  slides: ReactNode[];
  /** Accessible name per slide (its heading), used by the navigation buttons. */
  names: string[];
  /** Thumbnail per slide (nav "thumbs"). */
  thumbs?: ReactNode[];
  nav: "thumbs" | "numbers" | "dots";
  autoplayMs: number;
  className?: string;
  /** Where the navigation bar sits: under the slides, over their bottom edge, or in the text panel (split). */
  placement?: "below" | "overlay" | "panel";
}) {
  const count = slides.length;
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onMq = () => setReduced(Boolean(mq?.matches));
    const onVis = () => setHidden(document.visibilityState !== "visible");
    const onLoad = () => setReady(true);
    const t = window.setTimeout(() => {
      onMq();
      onVis();
      if (document.readyState === "complete") onLoad();
    }, 0);
    mq?.addEventListener?.("change", onMq);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("load", onLoad, { once: true });
    return () => {
      window.clearTimeout(t);
      mq?.removeEventListener?.("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("load", onLoad);
    };
  }, []);

  const go = useCallback((i: number) => setActive(((i % count) + count) % count), [count]);
  const auto = autoplayMs > 0 && count > 1 && ready && !reduced;
  const running = auto && !hover && !userPaused && !hidden;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(active + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(active - 1);
    }
  };

  const timer = (cls: string) =>
    auto ? (
      <span
        key={`t-${active}`}
        aria-hidden
        className={`sf-stage-timer ${cls}`}
        style={{ animationDuration: `${autoplayMs}ms`, animationPlayState: running ? "running" : "paused" }}
        onAnimationEnd={() => go(active + 1)}
      />
    ) : null;

  if (count === 0) return null;
  return (
    <div
      className={`sf-stage sf-stage-${placement} ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setHover(true)}
      onBlurCapture={() => setHover(false)}
      onKeyDown={onKey}
    >
      <div className="sf-stage-slides" aria-live={running ? "off" : "polite"}>
        {slides.map((slide, i) => (
          <div key={i} className={`sf-stage-slide ${i === active ? "is-active" : ""}`} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`} aria-hidden={i !== active || undefined} inert={i !== active || undefined}>
            {slide}
          </div>
        ))}
      </div>
      {count > 1 ? (
        <div className={`sf-stage-nav sf-stage-nav-${nav}`}>
          <button type="button" className="sf-stage-arrow" onClick={() => go(active - 1)} aria-label="Previous slide">
            <Chevron dir="left" />
          </button>
          <ul className="sf-stage-items">
            {slides.map((_, i) => (
              <li key={i}>
                <button type="button" onClick={() => go(i)} aria-label={`Show slide ${i + 1}${names[i] ? `: ${names[i]}` : ""}`} aria-current={i === active || undefined} className={`sf-stage-item ${i === active ? "is-active" : ""}`}>
                  {nav === "thumbs" ? (
                    <span className="sf-stage-thumb">{thumbs?.[i]}</span>
                  ) : nav === "numbers" ? (
                    <>
                      <span className="sf-stage-num">{String(i + 1).padStart(2, "0")}</span>
                      <span className="sf-stage-bar">{i === active ? timer("sf-stage-timer-bar") : null}</span>
                    </>
                  ) : (
                    <span className="sf-stage-dot" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="sf-stage-arrow" onClick={() => go(active + 1)} aria-label="Next slide">
            <Chevron dir="right" />
          </button>
          {autoplayMs > 0 && !reduced ? (
            <button type="button" className="sf-stage-arrow" onClick={() => setUserPaused((p) => !p)} aria-label={userPaused ? "Play slideshow" : "Pause slideshow"} aria-pressed={userPaused}>
              {userPaused ? <PlayIcon /> : <PauseIcon />}
            </button>
          ) : null}
        </div>
      ) : null}
      {nav !== "numbers" && count > 1 ? <span className="sf-stage-line">{timer("sf-stage-timer-line")}</span> : null}
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {dir === "left" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 5v14l12-7z" />
    </svg>
  );
}
