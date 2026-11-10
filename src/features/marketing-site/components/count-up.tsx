"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Animates a number when it enters the viewport. Reduced-motion (or no IO) shows the final value.
 * Above-the-fold counts stay at the final value (no flash).
 */
export function CountUp({
  value,
  duration = 1200,
  className,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number;
  /** Animation length in ms. */
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => true);
  const [display, setDisplay] = useState(value);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (reduce || !("IntersectionObserver" in window)) return;
    const el = ref.current;
    if (!el) return;
    // Already in view — keep final value (matches Reveal's above-fold policy).
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    let parked = false;
    const park = () => {
      if (parked) return;
      parked = true;
      setDisplay(0);
    };
    const raf = requestAnimationFrame(park);

    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        setAnimating(true);
        io.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.2 },
    );
    io.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [reduce, value]);

  useEffect(() => {
    if (!animating || reduce) return;

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animating, reduce, value, duration]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString("en-IN");

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
