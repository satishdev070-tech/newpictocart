"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Sticky marketing header chrome: transparent at the top, glass after 20px scroll,
 * and hide-on-scroll-down / show-on-scroll-up. Markup stays in chrome.tsx.
 */
export function MarketingHeaderShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 20);
      const goingDown = y > lastY.current;
      // Only tuck away once the user has left the top band; always reveal on scroll up.
      if (y < 24) setHidden(false);
      else if (goingDown && y - lastY.current > 2) setHidden(true);
      else if (!goingDown && lastY.current - y > 2) setHidden(false);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 transition-[transform,background-color,border-color,backdrop-filter] duration-300 ease-[var(--ease-mk,cubic-bezier(0.22,1,0.36,1))] motion-reduce:transition-none",
        scrolled ? "border-b border-mk-line bg-black/70 backdrop-blur-md" : "border-b border-transparent bg-transparent",
        hidden && "-translate-y-full",
      )}
    >
      {children}
    </header>
  );
}
