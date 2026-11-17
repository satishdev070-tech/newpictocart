"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { LoaderCircle } from "lucide-react";

export const DEVICE_WIDTH = { desktop: 1280, mobile: 390 } as const;
export type Device = keyof typeof DEVICE_WIDTH;

/**
 * The preview iframe at a real device width, scaled to fit its column (same approach as the store
 * editor and the Customizer). The iframe loads once per page; edits arrive over postMessage.
 */
export function PreviewFrame({ src, device, frameRef, ready }: { src: string; device: Device; frameRef: RefObject<HTMLIFrameElement | null>; ready: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const width = DEVICE_WIDTH[device];
  const scale = size.w ? Math.min(1, size.w / width) : 1;
  return (
    <div ref={box} className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-surface-secondary">
      {size.w ? (
        <iframe
          ref={frameRef}
          src={src}
          title={`Website preview (${device})`}
          className="absolute top-0 left-1/2 origin-top border-0 bg-white shadow-sm"
          style={{ width, height: size.h / scale, transform: `translateX(-50%) scale(${scale})` }}
        />
      ) : null}
      {!ready ? (
        <div role="status" className="absolute inset-0 grid place-items-center bg-surface-secondary/70 text-small text-muted">
          <span className="inline-flex items-center gap-2">
            <LoaderCircle aria-hidden className="size-4 animate-spin" /> Loading preview…
          </span>
        </div>
      ) : null}
    </div>
  );
}
