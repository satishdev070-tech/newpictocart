/**
 * Crop geometry (pure). Every rectangle is in the pixels of the image *after* rotation, so the
 * cropper only rotates once (in `rotationMatrix`) and the rest is plain axis-aligned maths.
 */
import { MEDIA_MIN_DIMENSION } from "./rules";

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };
export type Rotation = 0 | 90 | 180 | 270;
export type Corner = "nw" | "ne" | "sw" | "se";

export function nextRotation(r: Rotation, dir: 1 | -1 = 1): Rotation {
  return ((((r + dir * 90) % 360) + 360) % 360) as Rotation;
}

/** Image size after rotating by a multiple of 90°. */
export function rotatedSize(src: Size, r: Rotation): Size {
  return r === 90 || r === 270 ? { w: src.h, h: src.w } : { w: src.w, h: src.h };
}

/**
 * Canvas transform `[a, b, c, d, e, f]` that draws the source image (at 0,0) into rotated space:
 * x' = a·x + c·y + e, y' = b·x + d·y + f.
 */
export function rotationMatrix(src: Size, r: Rotation): [number, number, number, number, number, number] {
  switch (r) {
    case 90:
      return [0, 1, -1, 0, src.h, 0];
    case 180:
      return [-1, 0, 0, -1, src.w, src.h];
    case 270:
      return [0, -1, 1, 0, 0, src.w];
    default:
      return [1, 0, 0, 1, 0, 0];
  }
}

/** Smallest crop side allowed: the upload minimum, or the whole image when it is smaller. */
export function minSide(img: Size): number {
  return Math.min(MEDIA_MIN_DIMENSION, img.w, img.h);
}

/** Largest rect of `ratio` (w/h; null = whole image) centred in the image. */
export function initialCrop(img: Size, ratio: number | null): Rect {
  if (!ratio) return { x: 0, y: 0, w: img.w, h: img.h };
  let w = img.w;
  let h = w / ratio;
  if (h > img.h) {
    h = img.h;
    w = h * ratio;
  }
  return { x: (img.w - w) / 2, y: (img.h - h) / 2, w, h };
}

/** Keeps the rect inside the image (size first, then position). */
export function clampRect(r: Rect, img: Size): Rect {
  const w = Math.min(Math.max(r.w, 1), img.w);
  const h = Math.min(Math.max(r.h, 1), img.h);
  return { x: Math.min(Math.max(r.x, 0), img.w - w), y: Math.min(Math.max(r.y, 0), img.h - h), w, h };
}

export function moveRect(r: Rect, dx: number, dy: number, img: Size): Rect {
  return clampRect({ ...r, x: r.x + dx, y: r.y + dy }, img);
}

/**
 * Zoom = how much smaller the crop is than the biggest crop of its shape. Zoom 1 is the full fit;
 * larger values crop tighter. Scales around the rect's centre.
 */
export function zoomOf(r: Rect, img: Size): number {
  const full = initialCrop(img, r.w / r.h);
  return full.w / r.w;
}

export function maxZoom(r: Rect, img: Size): number {
  const full = initialCrop(img, r.w / r.h);
  return Math.max(1, Math.min(full.w, full.h) / minSide(img));
}

export function setZoom(r: Rect, zoom: number, img: Size): Rect {
  const full = initialCrop(img, r.w / r.h);
  const z = Math.min(Math.max(zoom, 1), maxZoom(r, img));
  const w = full.w / z;
  const h = full.h / z;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return clampRect({ x: cx - w / 2, y: cy - h / 2, w, h }, img);
}

/** Changes the shape, keeping the centre and as much of the area as fits. */
export function setAspect(r: Rect, ratio: number | null, img: Size): Rect {
  if (!ratio) return r;
  const area = r.w * r.h;
  let w = Math.sqrt(area * ratio);
  let h = w / ratio;
  const full = initialCrop(img, ratio);
  if (w > full.w) {
    w = full.w;
    h = full.h;
  }
  const min = minSide(img);
  if (Math.min(w, h) < min) {
    const s = min / Math.min(w, h);
    w = Math.min(w * s, full.w);
    h = w / ratio;
  }
  return clampRect({ x: r.x + r.w / 2 - w / 2, y: r.y + r.h / 2 - h / 2, w, h }, img);
}

/**
 * Drags one corner by (dx, dy); the opposite corner stays put. With a ratio the corner follows the
 * larger movement and keeps the shape. Never smaller than `minSide` or outside the image.
 */
export function resizeRect(r: Rect, corner: Corner, dx: number, dy: number, img: Size, ratio: number | null): Rect {
  const min = minSide(img);
  const left = corner === "nw" || corner === "sw";
  const top = corner === "nw" || corner === "ne";
  // Anchor = opposite corner.
  const ax = left ? r.x + r.w : r.x;
  const ay = top ? r.y + r.h : r.y;
  // Room available from the anchor towards the dragged corner.
  const roomW = left ? ax : img.w - ax;
  const roomH = top ? ay : img.h - ay;
  let w = r.w + (left ? -dx : dx);
  let h = r.h + (top ? -dy : dy);
  if (ratio) {
    // Follow whichever axis moved more (relative to the shape), then fit.
    if (Math.abs(w - r.w) * (1 / ratio) >= Math.abs(h - r.h)) h = w / ratio;
    else w = h * ratio;
    // Both sides at least `min`: w ≥ min and w / ratio ≥ min.
    const minW = Math.max(min, min * ratio);
    const maxW = Math.min(roomW, roomH * ratio);
    w = Math.min(Math.max(w, Math.min(minW, maxW)), maxW);
    h = w / ratio;
  } else {
    w = Math.min(Math.max(w, min), roomW);
    h = Math.min(Math.max(h, min), roomH);
  }
  return { x: left ? ax - w : ax, y: top ? ay - h : ay, w, h };
}

/** Output size: the crop scaled down (never up) to fit inside max, rounded to whole pixels. */
export function outputSize(crop: Size, max: Size): Size {
  const s = Math.min(1, max.w / crop.w, max.h / crop.h);
  return { w: Math.max(1, Math.round(crop.w * s)), h: Math.max(1, Math.round(crop.h * s)) };
}

/** Rounds a rect to whole source pixels (inside the image). */
export function roundRect(r: Rect, img: Size): Rect {
  const x = Math.max(0, Math.round(r.x));
  const y = Math.max(0, Math.round(r.y));
  return { x, y, w: Math.min(Math.round(r.w), img.w - x), h: Math.min(Math.round(r.h), img.h - y) };
}

export type OutputFormat = "image/webp" | "image/jpeg" | "image/png";

/**
 * Preferred format: WebP (keeps transparency, smallest). When the browser can't encode WebP, PNG
 * for images that may be transparent, JPEG otherwise.
 */
export function fallbackFormat(keepAlpha: boolean): OutputFormat {
  return keepAlpha ? "image/png" : "image/jpeg";
}

export function extensionFor(type: OutputFormat): string {
  return type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg";
}

/** "kurta.jpeg" → "kurta-1600x2000.webp". */
export function croppedFilename(name: string, size: Size, type: OutputFormat): string {
  const base = (name.replace(/\.[^.]*$/, "") || "image").replace(/-\d+x\d+$/, "").slice(0, 150);
  return `${base}-${size.w}x${size.h}.${extensionFor(type)}`;
}

/** Can the source carry transparency? */
export function mayHaveAlpha(mime: string): boolean {
  return mime === "image/png" || mime === "image/webp" || mime === "image/gif" || mime === "image/avif";
}
