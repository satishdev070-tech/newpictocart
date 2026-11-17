"use client";

import { useCallback, useId, useRef, useState, type FormEvent, type KeyboardEvent, createContext, useContext } from "react";
import { ImageIcon, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { assetUrl } from "@/lib/storage/assets";
import type { MediaItem } from "@/features/media/server/media";
import { importUnsplashImageAction, listInformativeMediaAction, searchUnsplashAction } from "./actions";
import type { PickerPhoto } from "./types";

type Props = {
  /** Stored image: a tenant media path (tenant/<id>/…) or, for theme defaults, an https URL. */
  value: string | null;
  onChange: (path: string | null) => void;
  label?: string;
  /** Starting Unsplash search, e.g. "dental clinic interior". */
  query?: string;
};

type Tab = "mine" | "unsplash";
type Failed = { ok: false; error: { message: string; fieldErrors?: Record<string, string[]> } };

const errorText = (r: Failed) => r.error.fieldErrors?._form?.[0] ?? r.error.message;
const PAGE_SIZE = 24;
const INPUT = "h-9 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-small focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15";

/** What to show for the current value: a tenant asset, or an https image (theme default). */
function previewUrl(value: string | null): string | null {
  if (!value) return null;
  return assetUrl(value) ?? (/^https:\/\//.test(value) ? value : null);
}

/** Tab / Shift+Tab stay inside the dialog. */
function trapFocus(e: KeyboardEvent<HTMLDialogElement>) {
  if (e.key !== "Tab") return;
  const nodes = [...e.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])")].filter((n) => n.offsetParent !== null);
  if (!nodes.length) return;
  const first = nodes[0]!;
  const last = nodes[nodes.length - 1]!;
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/**
 * Image field for the Website editor: the current image, "Choose image" (dialog with the store's
 * own images and, when the platform has an Unsplash key, an Unsplash search) and "Remove".
 * Choosing an Unsplash photo imports a copy into the store's media library (credit kept in its
 * alt text) and hands back the media path, so the site never depends on a hotlink.
 */
/**
 * The site's trade ("Dental clinic", "Gym"), provided by the Website editor so Unsplash searches start
 * from photos of this business instead of generic stock. Field hints are appended ("Dental clinic team at work").
 */
export const PhotoTradeContext = createContext("");

export function ImagePicker({ value, onChange, label = "Image", query: fieldQuery = "" }: Props) {
  const trade = useContext(PhotoTradeContext);
  const query = !trade || /texture|background/i.test(fieldQuery) ? fieldQuery : fieldQuery === "business" ? trade : `${trade} ${fieldQuery}`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const searchId = useId();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("mine");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // My images
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMine, setLoadingMine] = useState(false);
  // Unsplash
  const [unsplashOn, setUnsplashOn] = useState<boolean | null>(null);
  const [q, setQ] = useState(query);
  const [photos, setPhotos] = useState<PickerPhoto[]>([]);
  const [uPage, setUPage] = useState(1);
  const [uPages, setUPages] = useState(0);
  const [searched, setSearched] = useState(false);
  const [loadingU, setLoadingU] = useState(false);

  const preview = previewUrl(value);

  const loadMine = useCallback(async (p: number) => {
    setLoadingMine(true);
    setError(null);
    const r = await listInformativeMediaAction({ page: p, pageSize: PAGE_SIZE });
    setLoadingMine(false);
    if (!r.ok) return setError(errorText(r));
    setTotal(r.data.total);
    setItems((prev) => (p === 1 ? r.data.items : [...prev, ...r.data.items.filter((x) => !prev.some((y) => y.id === x.id))]));
  }, []);

  const searchU = useCallback(async (term: string, p: number) => {
    setLoadingU(true);
    setError(null);
    const r = await searchUnsplashAction({ query: term, page: p });
    setLoadingU(false);
    if (!r.ok) return setError(errorText(r));
    setUnsplashOn(r.data.configured);
    if (!r.data.configured) return;
    setSearched(Boolean(term.trim()));
    setUPages(r.data.pages);
    setPhotos((prev) => (p === 1 ? r.data.results : [...prev, ...r.data.results.filter((x) => !prev.some((y) => y.id === x.id))]));
  }, []);

  // On open: the first page of the store's images, and whether Unsplash is set up (searching the
  // starting query at the same time; an empty query makes no API call).
  const openDialog = () => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setError(null);
    setTab("mine");
    setQ(query);
    setPage(1);
    setUPage(1);
    dialogRef.current?.showModal();
    setOpen(true);
    void loadMine(1);
    void searchU(query, 1);
  };

  const closeDialog = () => {
    dialogRef.current?.close();
  };

  const onClosed = () => {
    setOpen(false);
    setBusyId(null);
    returnFocus.current?.focus();
  };

  const choose = (path: string) => {
    onChange(path);
    closeDialog();
  };

  const importPhoto = async (photo: PickerPhoto) => {
    if (busyId) return;
    setBusyId(photo.id);
    setError(null);
    const r = await importUnsplashImageAction({ id: photo.id });
    setBusyId(null);
    if (!r.ok) return setError(errorText(r));
    choose(r.data.path);
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    setUPage(1);
    void searchU(q, 1);
  };

  const showUnsplash = unsplashOn === true;
  const tabs: { id: Tab; label: string }[] = [{ id: "mine", label: "My images" }, ...(showUnsplash ? [{ id: "unsplash" as const, label: "Unsplash" }] : [])];
  const activeTab: Tab = tab === "unsplash" && !showUnsplash ? "mine" : tab;

  return (
    <div className="space-y-2">
      <p className="text-small font-medium text-foreground">{label}</p>
      <div className="flex items-center gap-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-secondary">
          {preview ? (
            // Already-sized asset or Unsplash URL; no Image Optimization needed in the editor.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon aria-hidden className="size-6 text-muted" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={openDialog}>
            Choose image
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <Trash2 aria-hidden />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={onClosed}
        onKeyDown={trapFocus}
        className="m-auto w-[min(56rem,calc(100vw-2rem))] rounded-xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50"
      >
        {open ? (
          <div className="flex max-h-[85vh] flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 id={titleId} className="text-body font-semibold">Choose {label.toLowerCase()}</h2>
              <Button type="button" variant="ghost" size="sm" onClick={closeDialog} aria-label="Close">
                <X aria-hidden />
              </Button>
            </div>

            <div role="tablist" aria-label="Image source" className="flex gap-1 border-b border-border px-4">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn("-mb-px border-b-2 px-3 py-2 text-small font-medium", activeTab === t.id ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground")}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-4">
              {error ? (
                <p role="alert" className="mb-3 rounded-md border border-error/30 bg-error/5 px-3 py-2 text-small text-error">
                  {error}
                </p>
              ) : null}

              {activeTab === "mine" ? (
                <>
                  {!items.length && !loadingMine ? (
                    <p className="py-8 text-center text-small text-muted">
                      No images in your library yet.{showUnsplash ? " Try the Unsplash tab for free stock photos." : " Upload some in Media."}
                    </p>
                  ) : null}
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {items.map((it) => (
                      <li key={it.id}>
                        <button
                          type="button"
                          onClick={() => choose(it.path)}
                          aria-pressed={it.path === value}
                          aria-label={it.alt || it.filename}
                          className={cn("block aspect-square w-full overflow-hidden rounded-md border bg-surface-secondary focus:outline-none focus:ring-3 focus:ring-accent/30", it.path === value ? "border-accent ring-2 ring-accent" : "border-border hover:border-border-strong")}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={it.url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {items.length < total ? (
                    <div className="mt-4 flex justify-center">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        pending={loadingMine}
                        onClick={() => {
                          const next = page + 1;
                          setPage(next);
                          void loadMine(next);
                        }}
                      >
                        Load more
                      </Button>
                    </div>
                  ) : loadingMine && !items.length ? (
                    <p className="py-8 text-center text-small text-muted">Loading your images…</p>
                  ) : null}
                </>
              ) : (
                <>
                  <form onSubmit={submitSearch} className="mb-3 flex gap-2" role="search">
                    <label htmlFor={searchId} className="sr-only">Search Unsplash</label>
                    <div className="relative flex-1">
                      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
                      <input id={searchId} type="search" value={q} maxLength={80} onChange={(e) => setQ(e.target.value)} placeholder="Search free photos, e.g. yoga studio" className={INPUT} />
                    </div>
                    <Button type="submit" variant="secondary" size="md" pending={loadingU && uPage === 1}>
                      Search
                    </Button>
                  </form>
                  {!photos.length && !loadingU ? (
                    <p className="py-8 text-center text-small text-muted">{searched ? "No photos found. Try other words." : "Search Unsplash for free photos."}</p>
                  ) : null}
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {photos.map((p) => (
                      <li key={p.id} className="min-w-0">
                        <button
                          type="button"
                          onClick={() => void importPhoto(p)}
                          disabled={busyId !== null}
                          aria-label={`Use photo: ${p.alt}`}
                          aria-busy={busyId === p.id}
                          className="relative block aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-surface-secondary hover:border-border-strong focus:outline-none focus:ring-3 focus:ring-accent/30 disabled:cursor-wait"
                        >
                          {/* Hotlinked from images.unsplash.com, pre-sized by Unsplash (API guidelines). */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.thumbUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                          {busyId === p.id ? <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-small font-medium text-white">Adding…</span> : null}
                        </button>
                        <p className="mt-1 truncate text-caption text-muted">
                          Photo by{" "}
                          <a href={p.authorUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                            {p.author}
                          </a>{" "}
                          on{" "}
                          <a href={p.photoUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                            Unsplash
                          </a>
                        </p>
                      </li>
                    ))}
                  </ul>
                  {photos.length && uPage < uPages ? (
                    <div className="mt-4 flex justify-center">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        pending={loadingU}
                        onClick={() => {
                          const next = uPage + 1;
                          setUPage(next);
                          void searchU(q, next);
                        }}
                      >
                        More photos
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
