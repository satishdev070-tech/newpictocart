"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Image from "next/image";
import { Check, Crop, Images, LayoutGrid, List, Search, Shapes, Sparkles, UploadCloud, X } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { IconGlyph } from "@/lib/icons/icon-glyph";
import { ICON_CATEGORIES, iconLabel, iconValue, type IconCategoryId, type IconName } from "@/lib/icons/names";
import { formatBytes } from "../rules";
import { IMAGE_STANDARDS, recommendedText, type ImageStandard } from "../image-standards";
import { listMediaAction, updateMediaAction } from "../actions";
import { importUnsplashAction, listUnsplashAction } from "../unsplash-actions";
import type { UnsplashPhoto } from "../unsplash/photos";
import type { MediaItem } from "../server/media";
import { Dropzone, UploadQueue } from "./media-ui";
import { useMediaUploads } from "./use-media-uploads";
import { UnsplashBrowser, UnsplashCredit, actionError } from "./unsplash-browser";
import { ICON_COUNT, IconGrid, filterIcons, type IconEntry } from "./icon-library";
import { ImageCropper, canCrop } from "./image-cropper";

type Props = {
  /** Called with the chosen image(s). */
  onSelect: (items: MediaItem[]) => void;
  multiple?: boolean;
  /**
   * Offers the Icons library when given: called with the chosen `icon:<name>` value (an allowlisted
   * library icon, accepted by the theme imagePath primitive). Only pass it for fields that store
   * that value and render it with StoreImage / IconGlyph.
   */
  onSelectIcon?: (value: string) => void;
  /** Folder for images uploaded from inside the picker. */
  folder?: string;
  triggerLabel?: ReactNode;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  title?: string;
  /**
   * Where the image goes (see image-standards): a single uploaded image opens the crop & resize
   * step with this shape and size. Defaults to the general standard (free shape, 2400px max).
   */
  standard?: ImageStandard;
};

type View = "images" | "unsplash" | "icons" | "upload";
type Sort = "newest" | "oldest" | "name" | "largest";
type Active = { kind: "image"; item: MediaItem } | { kind: "unsplash"; photo: UnsplashPhoto } | { kind: "icon"; entry: IconEntry } | null;

const FIELD = "h-9 rounded-md border border-border bg-surface text-small focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15";
const DATE = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Arrow keys move focus between the asset buttons of the focused grid or list (Enter/Space selects). */
function moveFocus(e: KeyboardEvent<HTMLElement>) {
  if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
  const target = e.target as HTMLElement;
  if (!target.matches("button[aria-pressed]")) return;
  const list = target.closest("ul");
  if (!list) return;
  const all = [...list.querySelectorAll<HTMLElement>("button[aria-pressed]")];
  const i = all.indexOf(target);
  if (i < 0) return;
  const top = all[0]!.getBoundingClientRect().top;
  const cols = Math.max(1, all.filter((el) => Math.abs(el.getBoundingClientRect().top - top) < 2).length);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: all.length - 1 }[e.key]!;
  const el = all[Math.min(Math.max(next, 0), all.length - 1)];
  if (el && el !== target) {
    e.preventDefault();
    el.focus();
  }
}

/** Tab / Shift+Tab stay inside the dialog. */
function trapFocus(e: KeyboardEvent<HTMLDialogElement>) {
  if (e.key !== "Tab") return;
  const nodes = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null);
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
 * Media library dialog: upload, the store's images, Unsplash stock photos and (when the caller
 * accepts them) the curated Icons library, with search/filter/sort, grid or list view and an
 * inspector for the selected asset. Reads through listMediaAction (RLS). Chosen Unsplash photos are
 * imported into the library first (credit in their alt text), so `onSelect` always receives ordinary
 * media items; an icon goes to `onSelectIcon` as `icon:<name>`.
 */
export function MediaPicker({ onSelect, onSelectIcon, multiple = false, folder = "general", triggerLabel = "Choose image", triggerVariant = "secondary", triggerSize = "sm", title, standard = IMAGE_STANDARDS.general }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("images");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  // Images
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [folders, setFolders] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Icons
  const [iconQ, setIconQ] = useState("");
  const [iconCategory, setIconCategory] = useState<IconCategoryId | "">("");
  const [iconSort, setIconSort] = useState<"category" | "name">("category");
  // Selection
  const [selected, setSelected] = useState<Map<string, MediaItem>>(new Map());
  const [unsplash, setUnsplash] = useState<Map<string, UnsplashPhoto>>(new Map());
  const [icon, setIcon] = useState<IconName | null>(null);
  const [active, setActive] = useState<Active>(null);
  const [importing, setImporting] = useState(false);
  /** A file waiting in the crop & resize step (`recrop` = a copy of a library image). */
  const [cropping, setCropping] = useState<{ file: File; recrop: boolean } | null>(null);
  const [recropError, setRecropError] = useState<string | null>(null);
  const iconsEnabled = Boolean(onSelectIcon);

  const load = useCallback(async (term: string, p: number, f: string, s: Sort) => {
    setLoading(true);
    setError(null);
    const r = await listMediaAction({ q: term || undefined, page: p, pageSize: 36, folder: f, sort: s });
    setLoading(false);
    if (!r.ok) return setError(r.error.message);
    setTotal(r.data.total);
    setFolders(r.data.folders);
    setItems((prev) => (p === 1 ? r.data.items : [...prev, ...r.data.items.filter((x) => !prev.some((y) => y.id === x.id))]));
  }, []);

  const uploads = useMediaUploads({
    folder,
    onUploaded: (item) => {
      setItems((prev) => [item, ...prev.filter((x) => x.id !== item.id)]);
      setTotal((t) => t + 1);
      setIcon(null);
      if (!multiple) setUnsplash(new Map());
      setSelected((s) => (multiple ? new Map(s).set(item.id, item) : new Map([[item.id, item]])));
      setActive({ kind: "image", item });
      setView("images");
    },
  });

  /** One croppable image goes through the crop step first; several files (or a GIF) upload as they are. */
  const addFiles = (files: FileList | File[]) => {
    const list = [...files];
    if (list.length === 1 && canCrop(list[0]!)) setCropping({ file: list[0]!, recrop: false });
    else uploads.addFiles(list);
  };

  /** Re-crop a library image: fetch its bytes and open the crop step; the result is a new asset. */
  const recrop = async (item: MediaItem) => {
    setRecropError(null);
    try {
      const res = await fetch(item.url, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const file = new File([blob], item.filename, { type: blob.type || item.mime });
      if (!canCrop(file)) return setRecropError("This image type can't be cropped (GIFs keep their animation as they are).");
      setCropping({ file, recrop: true });
    } catch {
      setRecropError("Couldn't load the image for cropping. Check your connection and retry.");
    }
  };

  // (Re)load the first page whenever the dialog opens or the query changes (search is debounced).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setPage(1);
      void load(q, 1, folderFilter, sort);
    }, 250);
    return () => clearTimeout(t);
  }, [open, q, folderFilter, sort, load]);

  useEffect(() => {
    if (open && (view === "images" || view === "icons")) searchRef.current?.focus();
  }, [open, view]);

  const openPicker = () => {
    setSelected(new Map());
    setUnsplash(new Map());
    setIcon(null);
    setActive(null);
    setError(null);
    setRecropError(null);
    setCropping(null);
    setView("images");
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.showModal();
    setOpen(true);
  };
  const close = () => ref.current?.close();

  const toggle = (m: MediaItem) => {
    setIcon(null);
    if (!multiple) setUnsplash(new Map());
    const wasOn = selected.has(m.id);
    setSelected((s) => {
      if (!multiple) return wasOn ? new Map() : new Map([[m.id, m]]);
      const next = new Map(s);
      if (wasOn) next.delete(m.id);
      else next.set(m.id, m);
      return next;
    });
    setActive({ kind: "image", item: m });
  };
  const toggleUnsplash = (p: UnsplashPhoto) => {
    setIcon(null);
    if (!multiple) setSelected(new Map());
    const wasOn = unsplash.has(p.id);
    setUnsplash((s) => {
      if (!multiple) return wasOn ? new Map() : new Map([[p.id, p]]);
      const next = new Map(s);
      if (wasOn) next.delete(p.id);
      else next.set(p.id, p);
      return next;
    });
    setActive({ kind: "unsplash", photo: p });
  };
  const chooseIcon = (entry: IconEntry) => {
    const off = icon === entry.name;
    setSelected(new Map());
    setUnsplash(new Map());
    setIcon(off ? null : entry.name);
    setActive({ kind: "icon", entry });
  };

  const count = icon ? 1 : selected.size + unsplash.size;
  const insert = async () => {
    if (icon && onSelectIcon) {
      onSelectIcon(iconValue(icon));
      return close();
    }
    const chosen = [...selected.values()];
    if (unsplash.size) {
      setImporting(true);
      setError(null);
      for (const p of unsplash.values()) {
        const r = await importUnsplashAction({ id: p.id, folder });
        if (!r.ok) {
          setImporting(false);
          return setError(actionError(r));
        }
        chosen.push(r.data.item);
        // Keep each imported photo as a library selection, so a retry after a failure doesn't import it twice.
        const item = r.data.item;
        setSelected((s) => new Map(s).set(item.id, item));
        setUnsplash((s) => {
          const next = new Map(s);
          next.delete(p.id);
          return next;
        });
      }
      setImporting(false);
    }
    onSelect(multiple ? chosen : chosen.slice(-1));
    close();
  };

  const updateItem = (item: MediaItem) => {
    setItems((prev) => prev.map((x) => (x.id === item.id ? item : x)));
    setSelected((s) => (s.has(item.id) ? new Map(s).set(item.id, item) : s));
    setActive((a) => (a?.kind === "image" && a.item.id === item.id ? { kind: "image", item } : a));
  };

  const icons = view === "icons" ? filterIcons(iconQ, iconCategory, iconSort) : [];
  const nav: { id: View; label: string; icon: ReactNode; count?: number }[] = [
    { id: "images", label: "Images", icon: <Images aria-hidden />, count: total || undefined },
    { id: "unsplash", label: "Stock photos", icon: <Sparkles aria-hidden /> },
    ...(iconsEnabled ? [{ id: "icons" as const, label: "Icons", icon: <Shapes aria-hidden />, count: ICON_COUNT }] : []),
  ];
  const selectHint = iconsEnabled ? "Select an image or icon" : multiple ? "Select one or more images" : "Select an image";

  return (
    <>
      <Button variant={triggerVariant} size={triggerSize} onClick={openPicker}>
        <Images aria-hidden /> {triggerLabel}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onKeyDown={trapFocus}
        onClose={() => {
          setOpen(false);
          returnFocus.current?.focus();
        }}
        className="m-auto h-[min(90dvh,800px)] w-[min(96vw,1200px)] max-w-none overflow-hidden rounded-xl border border-border bg-surface p-0 text-foreground shadow-lg backdrop:bg-black/50"
      >
        {open ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
              <div className="min-w-0">
                <h2 id={titleId} className="text-h2">
                  {title ?? "Media library"}
                </h2>
                <p className="text-caption text-muted">{multiple ? "Choose one or more images" : iconsEnabled ? "Choose an image or an icon" : "Choose an image"}</p>
              </div>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={close} aria-label="Close">
                <X aria-hidden />
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              {/* ------------------------------------------------ left nav */}
              <nav aria-label="Media sources" className="flex shrink-0 gap-2 overflow-x-auto border-b border-border bg-surface-secondary/50 p-3 md:w-52 md:flex-col md:overflow-visible md:border-b-0 md:border-r">
                <Button variant="accent" size="sm" className="shrink-0 md:w-full" aria-pressed={view === "upload"} onClick={() => setView("upload")}>
                  <UploadCloud aria-hidden /> Upload asset
                </Button>
                <p className="hidden px-2 pt-3 text-caption font-medium uppercase tracking-wide text-subtle md:block">Library</p>
                <ul className="flex gap-1 md:flex-col">
                  {nav.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        aria-current={view === n.id ? "page" : undefined}
                        onClick={() => setView(n.id)}
                        className={cn(
                          "flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-small font-medium transition-colors [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                          view === n.id ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface hover:text-foreground",
                        )}
                      >
                        {n.icon}
                        <span className="flex-1 text-left">{n.label}</span>
                        {n.count ? <span className="text-caption tabular-nums text-subtle">{n.count}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* ------------------------------------------------ main */}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {view === "images" || view === "icons" ? (
                  <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
                    <div className="relative min-w-44 flex-1">
                      <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                      <label htmlFor={`${titleId}-q`} className="sr-only">
                        {view === "icons" ? "Search icons" : "Search images"}
                      </label>
                      <input
                        ref={searchRef}
                        id={`${titleId}-q`}
                        type="search"
                        maxLength={80}
                        value={view === "icons" ? iconQ : q}
                        onChange={(e) => (view === "icons" ? setIconQ(e.target.value) : setQ(e.target.value))}
                        placeholder={view === "icons" ? `Search ${ICON_COUNT} icons` : "Search by name or alt text"}
                        className={cn(FIELD, "w-full pl-8 pr-3")}
                      />
                    </div>
                    <label htmlFor={`${titleId}-filter`} className="sr-only">
                      {view === "icons" ? "Category" : "Folder"}
                    </label>
                    {view === "icons" ? (
                      <select id={`${titleId}-filter`} value={iconCategory} onChange={(e) => setIconCategory(e.target.value as IconCategoryId | "")} className={cn(FIELD, "px-2")}>
                        <option value="">All categories</option>
                        {ICON_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select id={`${titleId}-filter`} value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)} className={cn(FIELD, "px-2")}>
                        <option value="">All folders</option>
                        {folders.map((f) => (
                          <option key={f} value={f}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                          </option>
                        ))}
                      </select>
                    )}
                    <label htmlFor={`${titleId}-sort`} className="sr-only">
                      Sort
                    </label>
                    {view === "icons" ? (
                      <select id={`${titleId}-sort`} value={iconSort} onChange={(e) => setIconSort(e.target.value as "category" | "name")} className={cn(FIELD, "px-2")}>
                        <option value="category">By category</option>
                        <option value="name">Name A–Z</option>
                      </select>
                    ) : (
                      <select id={`${titleId}-sort`} value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={cn(FIELD, "px-2")}>
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="name">Name A–Z</option>
                        <option value="largest">Largest first</option>
                      </select>
                    )}
                    <div role="group" aria-label="View" className="inline-flex rounded-md border border-border p-0.5">
                      {(["grid", "list"] as const).map((l) => (
                        <button
                          key={l}
                          type="button"
                          aria-pressed={layout === l}
                          aria-label={l === "grid" ? "Grid view" : "List view"}
                          onClick={() => setLayout(l)}
                          className={cn("grid size-7 place-items-center rounded-[5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", layout === l ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground")}
                        >
                          {l === "grid" ? <LayoutGrid aria-hidden className="size-4" /> : <List aria-hidden className="size-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="min-h-0 flex-1 overflow-y-auto p-4" onKeyDown={moveFocus}>
                  {view === "upload" ? (
                    <div className="space-y-4">
                      <Dropzone onFiles={addFiles} multiple={multiple} />
                      <p className="text-caption text-muted">
                        <Crop aria-hidden className="mr-1 inline size-3.5 align-[-2px]" />
                        A single image opens a crop &amp; resize step · {standard.label}: {recommendedText(standard)}
                      </p>
                      <UploadQueue tasks={uploads.tasks} onCancel={uploads.cancel} onRetry={uploads.retry} onDismiss={uploads.dismiss} />
                    </div>
                  ) : view === "unsplash" ? (
                    <div className="space-y-3">
                      <UnsplashBrowser load={listUnsplashAction} selected={new Set(unsplash.keys())} onToggle={toggleUnsplash} />
                      {error ? <p className="text-small text-error">{error}</p> : null}
                    </div>
                  ) : view === "icons" ? (
                    <div className="space-y-3">
                      <p className="text-caption text-muted" aria-live="polite">
                        {icons.length} {icons.length === 1 ? "icon" : "icons"} · drawn in your theme colours on the store
                      </p>
                      <IconGrid icons={icons} view={layout} selected={icon} onSelect={chooseIcon} />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {error ? <p className="text-small text-error">{error}</p> : null}
                      {items.length ? (
                        <ImageAssets items={items} layout={layout} selected={selected} onToggle={toggle} />
                      ) : loading ? (
                        <ul className="grid grid-cols-3 gap-3 md:grid-cols-5" aria-hidden>
                          {Array.from({ length: 10 }, (_, i) => (
                            <li key={i} className="aspect-square animate-pulse rounded-lg bg-surface-secondary" />
                          ))}
                        </ul>
                      ) : (
                        <div className="py-16 text-center">
                          <p className="text-h3">{q || folderFilter ? "No images match" : "No images yet"}</p>
                          <p className="mt-1 text-small text-muted">{q || folderFilter ? "Try another search or folder." : "Upload your first image to get started."}</p>
                          {!q && !folderFilter ? (
                            <Button className="mt-4" variant="secondary" onClick={() => setView("upload")}>
                              <UploadCloud aria-hidden /> Upload images
                            </Button>
                          ) : null}
                        </div>
                      )}
                      {items.length < total ? (
                        <div className="flex justify-center">
                          <Button
                            variant="secondary"
                            pending={loading}
                            onClick={() => {
                              const p = page + 1;
                              setPage(p);
                              void load(q, p, folderFilter, sort);
                            }}
                          >
                            Load more
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {/* ------------------------------------------------ inspector */}
              <aside aria-label="Inspector" className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-border lg:flex">
                <p className="border-b border-border px-4 py-3 text-h4">Inspector</p>
                {active?.kind === "image" ? (
                  <ImageInspector key={active.item.id} item={active.item} onSaved={updateItem} onCrop={() => void recrop(active.item)} cropError={recropError} />
                ) : active?.kind === "unsplash" ? (
                  <UnsplashInspector photo={active.photo} />
                ) : active?.kind === "icon" ? (
                  <IconInspector entry={active.entry} />
                ) : (
                  <div className="grid flex-1 place-items-center px-6 text-center">
                    <div>
                      <span className="mx-auto grid size-12 place-items-center rounded-full bg-surface-secondary text-subtle">
                        <Images aria-hidden className="size-5" />
                      </span>
                      <p className="mt-3 text-small font-medium">No asset selected</p>
                      <p className="mt-1 text-caption text-muted">Select an asset to see its details.</p>
                    </div>
                  </div>
                )}
              </aside>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
              <p className="text-small text-muted" aria-live="polite">
                {count ? (
                  <>
                    <span className="font-medium text-foreground">{count}</span> selected
                  </>
                ) : (
                  selectHint
                )}
                {unsplash.size ? " · Stock photos are added to your library" : ""}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={close}>
                  Cancel
                </Button>
                <Button variant="accent" onClick={() => void insert()} disabled={!count} pending={importing}>
                  Insert media
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </dialog>
      {open && cropping ? (
        <ImageCropper
          key={cropping.file.name + cropping.file.size}
          file={cropping.file}
          standard={standard}
          recrop={cropping.recrop}
          onCancel={() => setCropping(null)}
          onDone={(file) => {
            setCropping(null);
            uploads.addFiles([file]);
            setView("upload");
          }}
        />
      ) : null}
    </>
  );
}

// ------------------------------------------------------------------ images

function ImageAssets({ items, layout, selected, onToggle }: { items: MediaItem[]; layout: "grid" | "list"; selected: ReadonlyMap<string, MediaItem>; onToggle: (m: MediaItem) => void }) {
  if (layout === "list") {
    return (
      <ul className="divide-y divide-border rounded-lg ring-1 ring-border">
        {items.map((m) => {
          const on = selected.has(m.id);
          return (
            <li key={m.id}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={`Select ${m.filename}`}
                onClick={() => onToggle(m)}
                className={cn("flex w-full items-center gap-3 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent", on ? "bg-accent-soft" : "hover:bg-surface-secondary")}
              >
                <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-surface-secondary ring-1 ring-border">
                  <Image src={m.url} alt="" fill sizes="40px" className="object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-medium">{m.filename}</span>
                  <span className="block truncate text-caption text-muted">
                    {m.width && m.height ? `${m.width}×${m.height} · ` : ""}
                    {formatBytes(m.bytes)} · {m.folder}
                  </span>
                </span>
                {!m.alt ? <span className="hidden rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning sm:inline">No alt text</span> : null}
                <span className="hidden w-24 text-right text-caption text-muted md:block">{DATE(m.createdAt)}</span>
                {on ? <Check aria-hidden className="size-4 text-accent" strokeWidth={3} /> : <span className="size-4" />}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
      {items.map((m) => {
        const on = selected.has(m.id);
        return (
          <li key={m.id} className="min-w-0">
            <button
              type="button"
              aria-pressed={on}
              aria-label={`Select ${m.filename}`}
              onClick={() => onToggle(m)}
              className={cn(
                "relative block aspect-square w-full overflow-hidden rounded-lg bg-surface-secondary ring-1 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                on ? "ring-2 ring-accent" : "ring-border hover:ring-border-strong",
              )}
            >
              <Image src={m.url} alt={m.alt || m.filename} fill sizes="(min-width: 1024px) 14vw, (min-width: 768px) 22vw, 45vw" className="object-cover" />
              {on ? (
                <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-accent text-accent-foreground shadow-sm">
                  <Check aria-hidden className="size-3.5" strokeWidth={3} />
                </span>
              ) : null}
              {!m.alt ? <span className="absolute bottom-2 left-2 rounded bg-warning/90 px-1.5 py-0.5 text-[10px] font-medium text-white">No alt text</span> : null}
            </button>
            <p className="mt-1.5 truncate text-caption text-muted" title={m.filename}>
              {m.filename}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

// ------------------------------------------------------------------ inspector panels

function Meta({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-caption">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="truncate">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ImageInspector({ item, onSaved, onCrop, cropError }: { item: MediaItem; onSaved: (item: MediaItem) => void; onCrop?: () => void; cropError?: string | null }) {
  const altId = useId();
  const [alt, setAlt] = useState(item.alt);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    setSaving(true);
    setStatus(null);
    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("alt", alt);
    fd.set("folder", item.folder);
    fd.set("filename", item.filename);
    const r = await updateMediaAction(null, fd);
    setSaving(false);
    if (!r.ok) return setStatus({ ok: false, text: r.error.message });
    setStatus({ ok: true, text: "Alt text saved" });
    onSaved({ ...item, alt: alt.trim() });
  };
  return (
    <div className="space-y-4 p-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[repeating-conic-gradient(var(--surface-secondary)_0%_25%,var(--surface)_0%_50%)] bg-[length:16px_16px] ring-1 ring-border">
        <Image src={item.url} alt={item.alt || item.filename} fill sizes="288px" className="object-contain" />
      </div>
      <div>
        <p className="truncate text-small font-medium" title={item.filename}>
          {item.filename}
        </p>
        <p className="text-caption text-muted">Image</p>
      </div>
      {onCrop && item.mime !== "image/gif" ? (
        <div className="space-y-1">
          <Button size="sm" variant="secondary" onClick={onCrop}>
            <Crop aria-hidden /> Crop &amp; resize a copy
          </Button>
          {cropError ? (
            <p role="alert" className="text-caption text-error">
              {cropError}
            </p>
          ) : null}
        </div>
      ) : null}
      <Meta
        rows={[
          ["Dimensions", item.width && item.height ? `${item.width} × ${item.height}px` : "—"],
          ["Size", formatBytes(item.bytes)],
          ["Type", item.mime.replace("image/", "").toUpperCase()],
          ["Folder", item.folder],
          ["Added", DATE(item.createdAt)],
        ]}
      />
      <div className="space-y-1.5 border-t border-border pt-4">
        <label htmlFor={altId} className="block text-label">
          Alt text
        </label>
        <textarea
          id={altId}
          rows={3}
          maxLength={300}
          value={alt}
          onChange={(e) => {
            setAlt(e.target.value);
            setStatus(null);
          }}
          placeholder="Describe the image for screen readers and search engines"
          className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-small focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
        />
        {!item.alt && !alt ? <p className="text-caption text-warning">This image has no alt text yet.</p> : null}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" pending={saving} disabled={alt.trim() === item.alt} onClick={() => void save()}>
            Save alt text
          </Button>
          {status ? (
            <p role="status" className={cn("text-caption", status.ok ? "text-success" : "text-error")}>
              {status.text}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function UnsplashInspector({ photo }: { photo: UnsplashPhoto }) {
  return (
    <div className="space-y-4 p-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg ring-1 ring-border" style={{ background: photo.color ?? undefined }}>
        {/* Hotlinked, pre-sized by Unsplash (w=400). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.thumb} alt={photo.alt} className="size-full object-cover" />
      </div>
      <div>
        <p className="line-clamp-2 text-small font-medium">{photo.alt || "Unsplash photo"}</p>
        <UnsplashCredit photo={photo} />
      </div>
      <Meta rows={[["Dimensions", photo.width && photo.height ? `${photo.width} × ${photo.height}px` : "—"], ["Source", "Unsplash"]]} />
      <p className="text-caption text-muted">Inserting adds this photo to your library, with the photographer credit as its alt text. You can edit the alt text afterwards.</p>
    </div>
  );
}

function IconInspector({ entry }: { entry: IconEntry }) {
  return (
    <div className="space-y-4 p-4">
      <div className="grid aspect-[4/3] place-items-center rounded-lg bg-accent-soft text-accent ring-1 ring-border">
        <IconGlyph name={entry.name} className="size-20" strokeWidth={1.25} />
      </div>
      <div>
        <p className="text-small font-medium">{iconLabel(entry.name)}</p>
        <p className="text-caption text-muted">Icon · {entry.categoryLabel}</p>
      </div>
      <Meta
        rows={[
          ["Name", <code key="n" className="text-caption">{entry.name}</code>],
          ["Format", "Vector (SVG)"],
          ["Colour", "Follows your theme"],
        ]}
      />
      <p className="text-caption text-muted">Icons scale to any size without blurring and use your store’s primary colour. The section’s alt text, when set, is read out by screen readers.</p>
    </div>
  );
}
