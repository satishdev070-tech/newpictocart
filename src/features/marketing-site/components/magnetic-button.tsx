"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const MAX_OFFSET = 8;

/**
 * Subtle magnetic hover (≤8px). Disabled under prefers-reduced-motion.
 * Wrap any button/link — children keep their own styles.
 */
export function MagneticButton({
  children,
  className,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "span";
}) {
  const ref = useRef<HTMLDivElement | HTMLSpanElement>(null);

  function reset() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mx", "0px");
    el.style.setProperty("--my", "0px");
  }

  return (
    <As
      ref={ref as never}
      className={cn(
        "inline-flex will-change-transform",
        "transition-transform duration-[var(--dur-fast,200ms)] ease-[var(--ease-out,cubic-bezier(0.22,1,0.36,1))]",
        "motion-reduce:transition-none",
        className,
      )}
      style={{ "--mx": "0px", "--my": "0px", transform: "translate(var(--mx), var(--my))" } as CSSProperties}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const dist = Math.hypot(dx, dy) || 1;
        const strength = Math.min(1, (r.width / 2) / dist);
        const ox = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dx * 0.25 * strength));
        const oy = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dy * 0.25 * strength));
        el.style.setProperty("--mx", `${ox.toFixed(1)}px`);
        el.style.setProperty("--my", `${oy.toFixed(1)}px`);
      }}
      onPointerLeave={reset}
      onPointerCancel={reset}
    >
      {children}
    </As>
  );
}
