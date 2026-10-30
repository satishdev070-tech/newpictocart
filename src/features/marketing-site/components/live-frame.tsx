"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
export { DESKTOP_VIEWPORT, PHONE_VIEWPORT } from "./device-viewports";

/**
 * A live, scaled demo store. The store is rendered at a true device width (so the phone frame
 * shows the store's real mobile layout, not a shrunk desktop page), scaled to the frame's width.
 * The iframe only mounts once the frame nears the viewport, and `fallback` (the token mockup)
 * stays visible until the page has loaded, or for good if it never does.
 */
export function LiveFrame({
  src,
  viewport,
  fallback,
  eager = false,
  fill = false,
}: {
  src: string;
  viewport: { width: number; height: number };
  fallback: ReactNode;
  eager?: boolean;
  /** Fill a parent frame (e.g. a height-capped phone) instead of sizing from the viewport aspect ratio. */
  fill?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [visible, setVisible] = useState(eager);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const update = () => setScale(element.clientWidth / viewport.width);
    update();
    const resize = new ResizeObserver(update);
    resize.observe(element);
    let seen: IntersectionObserver | undefined;
    if (!eager) {
      seen = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setVisible(true);
            seen?.disconnect();
          }
        },
        { rootMargin: "300px" },
      );
      seen.observe(element);
    }
    return () => {
      resize.disconnect();
      seen?.disconnect();
    };
  }, [eager, viewport.width]);

  return (
    <div
      ref={frame}
      className={`relative overflow-hidden bg-white ${fill ? "size-full" : "w-full"}`}
      style={fill ? undefined : { aspectRatio: `${viewport.width} / ${viewport.height}` }}
    >
      <div className={`absolute inset-0 transition-opacity duration-300 ${loaded ? "opacity-0" : "opacity-100"}`}>{fallback}</div>
      {visible && scale ? (
        <iframe
          src={src}
          title=""
          tabIndex={-1}
          loading={eager ? "eager" : "lazy"}
          onLoad={() => setLoaded(true)}
          className={`pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{ width: viewport.width, height: viewport.height, transform: `scale(${scale})` }}
        />
      ) : null}
    </div>
  );
}
