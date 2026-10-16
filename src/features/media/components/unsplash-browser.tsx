"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actions/result";
import { cn } from "@/lib/cn";
import type { UnsplashListing } from "../unsplash-actions";
import type { UnsplashPhoto } from "../unsplash/photos";

/** Message to show for a failed action (fieldErrors._form carries the user-facing text). */
export function actionError(r: { ok: false; error: { message: string; fieldErrors?: Record<string, string[]> } }): string {
  return r.error.fieldErrors?._form?.[0] ?? r.error.message;
}

/** "Photo by Name on Unsplash", both parts linked (Unsplash API attribution guideline). */
export function UnsplashCredit({ photo, className }: { photo: UnsplashPhoto; className?: string }) {
  const link = "underline decoration-border-strong underline-offset-2 hover:text-foreground";
  return (
    <p className={cn("truncate text-caption text-muted", className)}>
      {photo.photographer ? (
        <>
          Photo by{" "}
          <a href={photo.photographer.url} target="_blank" rel="noopener noreferrer" className={link}>
            {photo.photographer.name}
          </a>{" "}
          on{" "}
        </>
      ) : (
        "Photo from "
      )}
      <a href={photo.link} target="_blank" rel="noopener noreferrer" className={link}>
        Unsplash
      </a>
    </p>
  );
}

type Props = {
  /** Server action that lists photos (featured when `q` is empty, else a search). */
  load: (input: { q?: string; page?: number }) => Promise<ActionResult<UnsplashListing>>;
  /** Selection mode (media picker): clicking a photo toggles it. */
  selected?: ReadonlySet<string>;
  onToggle?: (photo: UnsplashPhoto) => void;
  /** Per-photo action under the thumbnail (e.g. "Add to library", "Copy URL"). */
  action?: (photo: UnsplashPhoto) => ReactNode;
  /** Shown above the grid when the platform has no Unsplash API key (search is limited). */
  noKeyNote?: string;
};

/**
 * Unsplash tab of the media library and picker: the photos the platform's themes and category
 * cards use, plus Unsplash search. Thumbnails are hotlinked from images.unsplash.com (plain
 * <img>, already sized by Unsplash) and always shown with the photographer credit.
 */
export function UnsplashBrowser({ load, selected, onToggle, action, noKeyNote = "Unsplash search isn't switched on for this platform yet, so only the built-in photos are listed." }: Props) {
  const id = useId();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UnsplashListing | null>(null);
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (term: string, p: number) => {
      setLoading(true);
      setError(null);
      const r = await load({ q: term.trim() || undefined, page: p });
      setLoading(false);
      if (!r.ok) return setError(actionError(r));
      setData(r.data);
      setPhotos((prev) => (p === 1 ? r.data.photos : [...prev, ...r.data.photos.filter((x) => !prev.some((y) => y.id === x.id))]));
    },
    [load],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      void fetchPage(q, 1);
    }, 350);
    return () => clearTimeout(t);
  }, [q, fetchPage]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 max-w-sm flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <label htmlFor={`${id}-q`} className="sr-only">
            Search Unsplash
          </label>
          <input
            id={`${id}-q`}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search free photos on Unsplash"
            maxLength={80}
            className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-small focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          />
        </div>
        <p className="text-small text-muted" aria-live="polite">
          {data ? (data.featured ? "Photos used by Pictocart themes and category cards" : `${data.total.toLocaleString("en-IN")} photos for “${q.trim()}”`) : null}
        </p>
      </div>
      {data && !data.apiEnabled ? <p className="rounded-md bg-surface-secondary px-3 py-2 text-small text-muted">{noKeyNote}</p> : null}
      {error ? <p className="text-small text-error">{error}</p> : null}

      {photos.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {photos.map((p) => {
            const isSelected = selected?.has(p.id) ?? false;
            const img = (
              // Hotlinked, pre-sized by Unsplash (w=400): no Image Optimization needed.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.thumb} alt={p.alt} loading="lazy" decoding="async" className="size-full object-cover" />
            );
            return (
              <li key={p.id} className="min-w-0">
                {onToggle ? (
                  <button
                    type="button"
                    onClick={() => onToggle(p)}
                    aria-pressed={isSelected}
                    aria-label={`Select ${p.alt}`}
                    className={cn("relative block aspect-[4/3] w-full overflow-hidden rounded-lg ring-1 ring-border transition-shadow", isSelected ? "ring-2 ring-accent" : "hover:ring-border-strong")}
                    style={{ background: p.color ?? undefined }}
                  >
                    {img}
                    {isSelected ? (
                      <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-accent text-accent-foreground shadow-sm">
                        <Check aria-hidden className="size-3.5" strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                ) : (
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg ring-1 ring-border" style={{ background: p.color ?? undefined }}>
                    {img}
                  </div>
                )}
                <UnsplashCredit photo={p} className="mt-1.5" />
                {p.usedFor.length ? (
                  <p className="truncate text-caption text-subtle" title={p.usedFor.join(" · ")}>
                    Used for: {p.usedFor.join(" · ")}
                  </p>
                ) : null}
                {action ? <div className="mt-1.5">{action(p)}</div> : null}
              </li>
            );
          })}
        </ul>
      ) : loading ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5" aria-hidden>
          {Array.from({ length: 10 }, (_, i) => (
            <li key={i} className="aspect-[4/3] animate-pulse rounded-lg bg-surface-secondary" />
          ))}
        </ul>
      ) : data ? (
        <div className="py-12 text-center">
          <p className="text-h3">No photos found</p>
          <p className="mt-1 text-small text-muted">Try a different word, e.g. “saree”, “coffee” or “sneakers”.</p>
        </div>
      ) : null}

      {data && page < data.pages ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            pending={loading}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              void fetchPage(q, next);
            }}
          >
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
