"use client";

import { useRef, useState } from "react";

export type LightboxPhoto = { src: string; alt: string };

/**
 * Thumbnails that open a full-size viewer (native <dialog>: focus trap + Esc). Works on the
 * dashboard and the storefront, so it uses neutral colours instead of either theme's tokens.
 * `src` is a short-lived signed URL, so plain <img> (no optimizer).
 */
export function PhotoLightbox({ photos, size = "md", label = "Photos" }: { photos: LightboxPhoto[]; size?: "sm" | "md"; label?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  if (!photos.length) return null;
  const current = photos[Math.min(index, photos.length - 1)]!;
  const open = (n: number) => {
    setIndex(n);
    ref.current?.showModal();
  };
  const step = (d: number) => setIndex((i) => (i + d + photos.length) % photos.length);
  const thumb = size === "sm" ? "size-10" : "size-20";
  return (
    <>
      <ul className="flex flex-wrap gap-2" aria-label={label}>
        {photos.map((p, n) => (
          <li key={p.src}>
            <button type="button" onClick={() => open(n)} className={`${thumb} block overflow-hidden rounded border border-black/10 focus-visible:outline-2 focus-visible:outline-offset-2`} aria-label={`View ${p.alt}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
              <img src={p.src} alt="" className="size-full object-cover" loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
      <dialog
        ref={ref}
        aria-label={label}
        className="m-auto max-h-[92vh] w-[min(94vw,960px)] bg-transparent p-0 backdrop:bg-black/80"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) ref.current?.close();
        }}
      >
        <figure className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
          <img src={current.src} alt={current.alt} className="max-h-[80vh] w-auto max-w-full rounded object-contain" />
          <figcaption className="flex items-center gap-4 text-sm text-white">
            {photos.length > 1 ? (
              <button type="button" onClick={() => step(-1)} className="rounded bg-white/15 px-3 py-1.5 hover:bg-white/25" aria-label="Previous photo">
                ←
              </button>
            ) : null}
            <span>
              {Math.min(index, photos.length - 1) + 1} / {photos.length}
            </span>
            {photos.length > 1 ? (
              <button type="button" onClick={() => step(1)} className="rounded bg-white/15 px-3 py-1.5 hover:bg-white/25" aria-label="Next photo">
                →
              </button>
            ) : null}
            <a href={current.src} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              Open original
            </a>
            <button type="button" onClick={() => ref.current?.close()} className="rounded bg-white/15 px-3 py-1.5 hover:bg-white/25" autoFocus>
              Close
            </button>
          </figcaption>
        </figure>
      </dialog>
    </>
  );
}
