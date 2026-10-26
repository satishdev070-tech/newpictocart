"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Crop, RotateCcw, RotateCw, ScanLine, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { MEDIA_MAX_BYTES, MEDIA_TYPES, formatBytes, type MediaMime } from "../rules";
import { aspectChoices, aspectRatio, recommendedText, sameAspect, type Aspect, type ImageStandard } from "../image-standards";
import {
  clampRect,
  croppedFilename,
  fallbackFormat,
  initialCrop,
  maxZoom,
  mayHaveAlpha,
  moveRect,
  nextRotation,
  outputSize,
  resizeRect,
  rotatedSize,
  rotationMatrix,
  roundRect,
  setAspect,
  setZoom,
  zoomOf,
  contentBounds,
  fitBox,
  type Corner,
  type OutputFormat,
  type Rect,
  type Rotation,
  type Size,
} from "../crop";

/** Formats the cropper can decode and re-encode (an animated GIF would lose its animation). */
export function canCrop(file: { type: string }): boolean {
  return file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp" || file.type === "image/avif";
}

function toBlob(canvas: HTMLCanvasElement, type: OutputFormat, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Draws the rotated crop at `out` size. */
function drawCrop(ctx: CanvasRenderingContext2D, img: CanvasImageSource, src: Size, rotation: Rotation, crop: Rect, out: Size) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.scale(out.w / crop.w, out.h / crop.h);
  ctx.translate(-crop.x, -crop.y);
  ctx.transform(...rotationMatrix(src, rotation));
  ctx.drawImage(img, 0, 0, src.w, src.h);
  ctx.restore();
}

/** Encodes the crop: WebP when the browser can, else PNG (transparent) / JPEG on white. */
async function encodeCrop(img: HTMLImageElement, src: Size, rotation: Rotation, crop: Rect, out: Size, keepAlpha: boolean, name: string): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = out.w;
  canvas.height = out.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't prepare the image.");
  const render = (flatten: boolean) => {
    ctx.clearRect(0, 0, out.w, out.h);
    if (flatten) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.w, out.h);
    }
    drawCrop(ctx, img, src, rotation, crop, out);
  };
  render(false);
  let type: OutputFormat = "image/webp";
  let blob: Blob | null = null;
  for (const q of [0.86, 0.72, 0.6]) {
    blob = await toBlob(canvas, "image/webp", q);
    if (!blob || blob.type !== "image/webp") break; // No WebP encoder (older Safari): use the fallback.
    if (blob.size <= MEDIA_MAX_BYTES) break;
  }
  if (!blob || blob.type !== "image/webp") {
    type = fallbackFormat(keepAlpha);
    if (type === "image/jpeg") render(true);
    blob = await toBlob(canvas, type, 0.86);
  }
  if (!blob) throw new Error("Your browser couldn't prepare the image.");
  return new File([blob], croppedFilename(name, out, type), { type, lastModified: Date.now() });
}

type Drag = { kind: "move" | Corner; x: number; y: number; start: Rect; id: number };
const CORNERS: Corner[] = ["nw", "ne", "sw", "se"];
const CORNER_CLASS: Record<Corner, string> = {
  nw: "-left-2 -top-2 cursor-nwse-resize",
  ne: "-right-2 -top-2 cursor-nesw-resize",
  sw: "-bottom-2 -left-2 cursor-nesw-resize",
  se: "-bottom-2 -right-2 cursor-nwse-resize",
};

type Props = {
  file: File;
  standard: ImageStandard;
  /** "Use cropped" / "Use original" both end here with the file to upload. */
  onDone: (file: File) => void;
  onCancel: () => void;
  /** Re-cropping a library image: "Use original" is hidden (the original is already in the library). */
  recrop?: boolean;
};

/**
 * Crop & resize step before an upload: preset shape from the image standard (plus Free / 1:1 /
 * 4:5 / 16:9), drag to move, corner handles, zoom (slider, wheel, + / −), rotate 90°, keyboard
 * control and a live preview. The result is scaled down to the standard's size in the browser and
 * then goes through the normal upload path, so every upload check still applies.
 */
export function ImageCropper({ file, standard, onDone, onCancel, recrop = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const titleId = useId();
  const helpId = useId();
  const zoomId = useId();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [aspect, setAspectState] = useState<Aspect>(standard.aspect);
  const [rect, setRect] = useState<Rect | null>(null);
  const [stage, setStage] = useState<Size>({ w: 0, h: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  const src: Size | null = img ? { w: img.naturalWidth, h: img.naturalHeight } : null;
  const space = src ? rotatedSize(src, rotation) : null;
  const ratio = aspectRatio(aspect);
  const k = space && stage.w && stage.h ? Math.min(stage.w / space.w, stage.h / space.h) : 0;

  // Open as a modal on mount; load the image from the file.
  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const url = URL.createObjectURL(file);
    const el = new Image();
    // A cleaned-up run (Strict Mode, or a new file) revokes its URL, so its load fails: ignore it.
    let live = true;
    el.onload = () => {
      if (!live) return;
      setImg(el);
      setRect(initialCrop({ w: el.naturalWidth, h: el.naturalHeight }, aspectRatio(standard.aspect)));
    };
    el.onerror = () => {
      if (live) setLoadError("This image couldn't be opened for cropping. You can still upload it as it is.");
    };
    el.src = url;
    return () => {
      live = false;
      URL.revokeObjectURL(url);
      // Back to whatever had focus in the picker (the drop zone or the inspector button).
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [file, standard.aspect]);

  // Stage size follows the dialog.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setStage({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The rotated image, drawn at display size.
  useEffect(() => {
    const c = viewRef.current;
    if (!c || !img || !src || !space || !k) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(space.w * k * dpr);
    c.height = Math.round(space.h * k * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    drawCrop(ctx, img, src, rotation, { x: 0, y: 0, w: space.w, h: space.h }, { w: c.width, h: c.height });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- src/space derive from img + rotation
  }, [img, rotation, k]);

  // Live preview of the result.
  useEffect(() => {
    const c = previewRef.current;
    if (!c || !img || !src || !rect) return;
    const frame = requestAnimationFrame(() => {
      const out = outputSize(rect, { w: 240, h: 240 });
      c.width = out.w;
      c.height = out.h;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, out.w, out.h);
      drawCrop(ctx, img, src, rotation, rect, out);
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- src derives from img
  }, [img, rotation, rect]);

  const update = (next: Rect) => setRect(space ? clampRect(next, space) : next);

  const rotate = (dir: 1 | -1) => {
    if (!src) return;
    const r = nextRotation(rotation, dir);
    setRotation(r);
    setRect(initialCrop(rotatedSize(src, r), ratio));
    setAnnounce(`Rotated to ${r}°`);
  };
  const chooseAspect = (a: Aspect) => {
    setAspectState(a);
    if (rect && space) setRect(a ? setAspect(rect, aspectRatio(a), space) : rect);
  };
  /** Trims empty or plain-background edges so the logo fills the crop (found on a ≤400px copy). */
  const fitToContent = () => {
    if (!img || !src || !space) return;
    const scale = Math.max(1, Math.max(space.w, space.h) / 400);
    const small = { w: Math.max(1, Math.round(space.w / scale)), h: Math.max(1, Math.round(space.h / scale)) };
    const c = document.createElement("canvas");
    c.width = small.w;
    c.height = small.h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    drawCrop(ctx, img, src, rotation, { x: 0, y: 0, w: space.w, h: space.h }, small);
    const found = contentBounds(ctx.getImageData(0, 0, small.w, small.h).data, small.w, small.h);
    if (!found) return setAnnounce("No empty edges to trim.");
    setAspectState(null);
    setRect(fitBox(found, space.w / small.w, space));
    setAnnounce("Cropped to the logo.");
  };
  const zoomBy = (factor: number) => {
    if (!rect || !space) return;
    setRect(setZoom(rect, zoomOf(rect, space) * factor, space));
  };

  // ---------------------------------------------------------- pointer
  /** Starts a move (crop box) or a resize (corner handle, `data-corner`). */
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!rect || e.button !== 0) return;
    const kind = (e.currentTarget.dataset.corner as Corner | undefined) ?? "move";
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind, x: e.clientX, y: e.clientY, start: rect, id: e.pointerId };
    boxRef.current?.focus({ preventScroll: true });
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !space || !k) return;
    const dx = (e.clientX - d.x) / k;
    const dy = (e.clientY - d.y) / k;
    setRect(d.kind === "move" ? moveRect(d.start, dx, dy, space) : resizeRect(d.start, d.kind, dx, dy, space, ratio));
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  // Wheel zoom (non-passive so the dialog doesn't scroll).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.08 : 1 / 1.08);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  // ---------------------------------------------------------- keyboard
  const onBoxKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!rect || !space) return;
    const step = (e.shiftKey ? 0.1 : 0.01) * Math.max(space.w, space.h);
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      // Alt + arrows resize from the bottom-right corner.
      const [dx, dy] = moves[e.key]!;
      update(e.altKey ? resizeRect(rect, "se", dx, dy, space, ratio) : moveRect(rect, dx, dy, space));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomBy(1.1);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomBy(1 / 1.1);
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      rotate(e.shiftKey ? -1 : 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      void apply();
    }
  };

  /** Tab / Shift+Tab stay inside the dialog; keys never reach a dialog behind it. */
  const onDialogKey = (e: KeyboardEvent<HTMLDialogElement>) => {
    e.stopPropagation();
    if (e.key !== "Tab") return;
    const nodes = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null);
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
  };

  const crop = rect && space ? roundRect(rect, space) : null;
  const out = crop ? outputSize(crop, { w: standard.maxWidth, h: standard.maxHeight }) : null;
  const small = out && crop && standard.aspect ? out.w < standard.maxWidth * 0.6 && out.h < standard.maxHeight * 0.6 : false;
  const zoom = rect && space ? zoomOf(rect, space) : 1;
  const zMax = rect && space ? maxZoom(rect, space) : 1;

  const apply = async () => {
    if (!img || !src || !crop || !out) return;
    setBusy(true);
    setError(null);
    try {
      const keepAlpha = standard.transparent && mayHaveAlpha(file.type);
      onDone(await encodeCrop(img, src, rotation, crop, out, keepAlpha, file.name));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't crop the image.");
      setBusy(false);
    }
  };

  const ext = (MEDIA_TYPES[file.type as MediaMime] as readonly string[] | undefined)?.[0];
  const choices = aspectChoices(standard);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={helpId}
      onKeyDown={onDialogKey}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto h-[min(92dvh,760px)] w-[min(96vw,1040px)] max-w-none overflow-hidden rounded-xl border border-border bg-surface p-0 text-foreground shadow-lg backdrop:bg-black/60"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <Crop aria-hidden className="size-5 text-accent" />
          <div className="min-w-0">
            <h2 id={titleId} className="text-h2">
              Crop &amp; resize
            </h2>
            <p className="truncate text-caption text-muted">
              {standard.label} · {recommendedText(standard)}
            </p>
          </div>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={onCancel} aria-label="Cancel cropping">
            <X aria-hidden />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* ------------------------------------------------ stage */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[repeating-conic-gradient(var(--surface-secondary)_0%_25%,var(--surface)_0%_50%)] bg-[length:16px_16px] p-4">
            <div ref={stageRef} className="relative min-h-48 flex-1 touch-none select-none">
              {loadError ? (
                <p role="alert" className="absolute inset-0 grid place-items-center px-6 text-center text-small text-error">
                  {loadError}
                </p>
              ) : !img || !space || !rect || !k ? (
                <p className="absolute inset-0 grid place-items-center text-small text-muted">Loading image…</p>
              ) : (
                <div className="absolute left-1/2 top-1/2 overflow-hidden" style={{ width: space.w * k, height: space.h * k, transform: "translate(-50%, -50%)" }} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
                  <canvas ref={viewRef} aria-hidden className="block size-full" />
                  <div
                    ref={boxRef}
                    role="group"
                    tabIndex={0}
                    aria-roledescription="crop area"
                    aria-label={`Crop area, ${Math.round(rect.w)} by ${Math.round(rect.h)} pixels`}
                    aria-describedby={helpId}
                    onKeyDown={onBoxKey}
                    onPointerDown={onPointerDown}
                    className="absolute cursor-move outline-none ring-2 ring-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] focus-visible:ring-4 focus-visible:ring-accent"
                    style={{ left: rect.x * k, top: rect.y * k, width: rect.w * k, height: rect.h * k }}
                  >
                    {/* Rule-of-thirds guides */}
                    <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_33.2%,rgba(255,255,255,.45)_33.3%,transparent_33.4%,transparent_66.6%,rgba(255,255,255,.45)_66.7%,transparent_66.8%),linear-gradient(to_bottom,transparent_33.2%,rgba(255,255,255,.45)_33.3%,transparent_33.4%,transparent_66.6%,rgba(255,255,255,.45)_66.7%,transparent_66.8%)]" />
                    {CORNERS.map((c) => (
                      <span key={c} aria-hidden data-corner={c} onPointerDown={onPointerDown} className={cn("absolute size-4 rounded-sm border-2 border-accent bg-white shadow", CORNER_CLASS[c])} />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p id={helpId} className="mt-3 text-center text-caption text-muted">
              Drag to move, drag a corner to resize. Keyboard: arrows move (Shift = bigger steps, Alt = resize), + / − zoom, R rotates, Enter applies.
            </p>
          </div>

          {/* ------------------------------------------------ controls */}
          <div className="w-full shrink-0 space-y-5 overflow-y-auto border-t border-border p-4 md:w-72 md:border-l md:border-t-0">
            <fieldset>
              <legend className="mb-2 text-label">Shape</legend>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Crop shape">
                {choices.map((c) => {
                  const on = sameAspect(c.aspect, aspect);
                  return (
                    <button
                      key={c.label}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={!img}
                      onClick={() => chooseAspect(c.aspect)}
                      className={cn("rounded-md border px-2.5 py-1 text-caption font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", on ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-surface-secondary")}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor={zoomId} className="mb-2 block text-label">
                Zoom
              </label>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" aria-label="Zoom out" disabled={!img || zoom <= 1.001} onClick={() => zoomBy(1 / 1.1)}>
                  <ZoomOut aria-hidden />
                </Button>
                <input
                  id={zoomId}
                  type="range"
                  min={1}
                  max={Math.max(1.01, zMax)}
                  step={0.01}
                  value={zoom}
                  disabled={!img}
                  aria-valuetext={`${zoom.toFixed(1)}×`}
                  onChange={(e) => rect && space && setRect(setZoom(rect, Number(e.target.value), space))}
                  className="min-w-0 flex-1 accent-accent"
                />
                <Button size="sm" variant="ghost" aria-label="Zoom in" disabled={!img || zoom >= zMax - 0.001} onClick={() => zoomBy(1.1)}>
                  <ZoomIn aria-hidden />
                </Button>
              </div>
            </div>

            {standard.transparent ? (
              <div>
                <Button size="sm" variant="secondary" disabled={!img} onClick={fitToContent}>
                  <ScanLine aria-hidden /> Fit to logo
                </Button>
                <p className="mt-1 text-caption text-muted">Trims empty or plain edges so the whole logo shows as large as possible.</p>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-label">Rotate</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={!img} onClick={() => rotate(-1)}>
                  <RotateCcw aria-hidden /> Left
                </Button>
                <Button size="sm" variant="secondary" disabled={!img} onClick={() => rotate(1)}>
                  <RotateCw aria-hidden /> Right
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-label">Preview</p>
              <div className="grid min-h-28 place-items-center rounded-lg bg-[repeating-conic-gradient(var(--surface-secondary)_0%_25%,var(--surface)_0%_50%)] bg-[length:12px_12px] p-2 ring-1 ring-border">
                <canvas ref={previewRef} aria-label="Preview of the cropped image" role="img" className="max-h-40 max-w-full" />
              </div>
              {out && crop ? (
                <p className="mt-2 text-caption text-muted" aria-live="polite">
                  Saves at {out.w}×{out.h}px{standard.transparent && mayHaveAlpha(file.type) ? " (transparency kept)" : ""}
                  {crop.w > out.w ? `, scaled down from ${crop.w}×${crop.h}` : ""}.
                </p>
              ) : null}
              {small ? <p className="mt-1 text-caption text-warning">This crop is smaller than the recommended {standard.maxWidth}×{standard.maxHeight}px and may look soft on large screens.</p> : null}
            </div>
            <p className="sr-only" aria-live="polite">
              {announce}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="text-caption text-muted">
            {error ? (
              <span role="alert" className="text-error">
                {error}
              </span>
            ) : recrop ? (
              "Saves a new copy in your library. The original stays as it is."
            ) : (
              <>
                Original: {file.name.length > 40 ? `${file.name.slice(0, 37)}…` : file.name} · {formatBytes(file.size)}
                {ext ? ` · ${ext.toUpperCase()}` : ""}
                {src ? ` · ${src.w}×${src.h}` : ""}
              </>
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            {!recrop ? (
              <Button variant="secondary" disabled={busy} onClick={() => onDone(file)}>
                Use original
              </Button>
            ) : null}
            <Button variant="accent" pending={busy} disabled={!img || Boolean(loadError)} onClick={() => void apply()}>
              {recrop ? "Save cropped copy" : "Crop & upload"}
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
