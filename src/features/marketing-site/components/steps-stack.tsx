"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Sticky stacking cards for the marketing Steps section. Each card pins under the header
 * as you scroll. When the user prefers reduced motion, cards stack statically (no sticky).
 */
export function StepsStack({ children, className }: { children: ReactNode; className?: string }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <ol className={cn(reduceMotion ? "space-y-8" : "relative space-y-6 md:space-y-8", className)}>
      {children}
    </ol>
  );
}

export function StepsStackCard({
  index,
  total,
  children,
  className,
}: {
  index: number;
  total: number;
  children: ReactNode;
  className?: string;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <li
      className={cn(
        "rounded-[var(--r-lg)] border border-mk-line bg-mk-elev-1 p-6 shadow-brand-card sm:p-8",
        !reduceMotion && "sticky top-24",
        className,
      )}
      style={reduceMotion ? undefined : { zIndex: index + 1, top: `calc(5.5rem + ${Math.min(index, 4) * 0.65}rem)` }}
      data-step-index={index}
      data-step-total={total}
    >
      {children}
    </li>
  );
}
