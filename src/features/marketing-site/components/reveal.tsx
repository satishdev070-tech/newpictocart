"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Staggered reveal on scroll. Renders a `group/reveal` element; only when it starts below the fold
 * does it set `data-reveal="hidden"` until it scrolls into view, so content is never hidden without
 * JS, above the fold, or for people who ask for reduced motion. Children animate with
 * `group-data-[reveal=hidden]/reveal:` classes and their own transition delay.
 */
export function Reveal({ as = "div", className, children }: { as?: "div" | "ul"; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement & HTMLUListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    el.dataset.reveal = "hidden";
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        delete el.dataset.reveal;
        io.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const cls = cn("group/reveal", className);
  return as === "ul" ? (
    <ul ref={ref} className={cls}>
      {children}
    </ul>
  ) : (
    <div ref={ref} className={cls}>
      {children}
    </div>
  );
}

