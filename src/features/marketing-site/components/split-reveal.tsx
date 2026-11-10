"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const STAGGER_S = 0.06;

/**
 * Splits heading text into overflow-hidden word spans (`.mk-split-word`).
 * Sets `data-split="hidden"` until IntersectionObserver; words stagger ~0.06s.
 * Pass a string `text` for splitting, or `children` for non-split content.
 */
export function SplitReveal({
  text,
  children,
  as: As = "span",
  className,
  stagger = STAGGER_S,
}: {
  text?: string;
  children?: ReactNode;
  as?: ElementType;
  className?: string;
  /** Delay between words, in seconds. */
  stagger?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    el.dataset.split = "hidden";
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        delete el.dataset.split;
        io.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (text == null) {
    return (
      <As ref={ref} className={cn(className)}>
        {children}
      </As>
    );
  }

  const words = text.trim().split(/\s+/).filter(Boolean);

  return (
    <As ref={ref} className={cn(className)}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="mk-split-word">
          <span style={{ transitionDelay: `${(i * stagger).toFixed(2)}s` }}>
            {word}
            {i < words.length - 1 ? "\u00A0" : null}
          </span>
        </span>
      ))}
    </As>
  );
}
