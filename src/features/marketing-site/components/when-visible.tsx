"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Defers mounting heavy children until the slot nears the viewport. Server still streams the
 * placeholder; keeps below-fold ThemeCards out of the initial image/network waterfall.
 */
export function WhenVisible({
  children,
  placeholder,
  rootMargin = "200px 0px",
}: {
  children: ReactNode;
  placeholder: ReactNode;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = window.setTimeout(() => setShow(true), 0);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return <div ref={ref}>{show ? children : placeholder}</div>;
}
