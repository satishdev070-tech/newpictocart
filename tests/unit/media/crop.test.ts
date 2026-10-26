import { describe, expect, it } from "vitest";
import {
  clampRect,
  croppedFilename,
  fallbackFormat,
  initialCrop,
  maxZoom,
  mayHaveAlpha,
  minSide,
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
} from "@/features/media/crop";

const img = { w: 4000, h: 3000 };
const apply = (m: number[], x: number, y: number) => [m[0]! * x + m[2]! * y + m[4]!, m[1]! * x + m[3]! * y + m[5]!];

describe("crop geometry", () => {
  it("starts with the largest centred crop of the shape", () => {
    expect(initialCrop(img, 16 / 9)).toEqual({ x: 0, y: 375, w: 4000, h: 2250 });
    expect(initialCrop(img, 1)).toEqual({ x: 500, y: 0, w: 3000, h: 3000 });
    expect(initialCrop(img, null)).toEqual({ x: 0, y: 0, ...img });
  });

  it("rotates in 90° steps", () => {
    expect(nextRotation(0)).toBe(90);
    expect(nextRotation(270)).toBe(0);
    expect(nextRotation(0, -1)).toBe(270);
    expect(rotatedSize(img, 90)).toEqual({ w: 3000, h: 4000 });
    expect(rotatedSize(img, 180)).toEqual(img);
  });

  it("maps source corners into the rotated image", () => {
    // Top-left of the source lands at top-right after 90° clockwise, etc.
    expect(apply(rotationMatrix(img, 90), 0, 0)).toEqual([3000, 0]);
    expect(apply(rotationMatrix(img, 90), 4000, 3000)).toEqual([0, 4000]);
    expect(apply(rotationMatrix(img, 180), 0, 0)).toEqual([4000, 3000]);
    expect(apply(rotationMatrix(img, 270), 0, 0)).toEqual([0, 4000]);
    expect(apply(rotationMatrix(img, 270), 4000, 3000)).toEqual([3000, 0]);
    expect(apply(rotationMatrix(img, 0), 12, 34)).toEqual([12, 34]);
  });

  it("keeps rects inside the image", () => {
    expect(clampRect({ x: -50, y: 2900, w: 1000, h: 500 }, img)).toEqual({ x: 0, y: 2500, w: 1000, h: 500 });
    expect(clampRect({ x: 0, y: 0, w: 9000, h: 9000 }, img)).toEqual({ x: 0, y: 0, w: 4000, h: 3000 });
    expect(moveRect({ x: 100, y: 100, w: 1000, h: 1000 }, 5000, -500, img)).toEqual({ x: 3000, y: 0, w: 1000, h: 1000 });
  });

  it("zooms around the centre within limits", () => {
    const full = initialCrop(img, 1);
    expect(zoomOf(full, img)).toBeCloseTo(1);
    const z2 = setZoom(full, 2, img);
    expect(z2).toEqual({ x: 1250, y: 750, w: 1500, h: 1500 });
    expect(zoomOf(z2, img)).toBeCloseTo(2);
    expect(setZoom(full, 0.5, img)).toEqual(full); // never below 1
    expect(maxZoom(full, img)).toBeCloseTo(3000 / minSide(img));
    expect(setZoom(full, 999, img).w).toBeCloseTo(minSide(img)); // never below the upload minimum
  });

  it("changes shape keeping the centre", () => {
    const sq = { x: 1000, y: 500, w: 2000, h: 2000 };
    const wide = setAspect(sq, 16 / 9, img);
    expect(wide.w / wide.h).toBeCloseTo(16 / 9);
    expect(wide.x + wide.w / 2).toBeCloseTo(2000);
    expect(wide.y + wide.h / 2).toBeCloseTo(1500);
    expect(setAspect(sq, null, img)).toEqual(sq);
    // A shape that can't keep the area shrinks to fit.
    const banner = setAspect(initialCrop(img, null), 3, img);
    expect(banner.w).toBeLessThanOrEqual(4000);
    expect(banner.w / banner.h).toBeCloseTo(3);
  });

  it("resizes from a corner, freely or keeping the shape", () => {
    const r = { x: 1000, y: 1000, w: 1000, h: 1000 };
    expect(resizeRect(r, "se", 200, 100, img, null)).toEqual({ x: 1000, y: 1000, w: 1200, h: 1100 });
    expect(resizeRect(r, "nw", 200, 100, img, null)).toEqual({ x: 1200, y: 1100, w: 800, h: 900 });
    const kept = resizeRect(r, "se", 400, 0, img, 1);
    expect(kept).toEqual({ x: 1000, y: 1000, w: 1400, h: 1400 });
    // Stops at the image edge, keeping the shape.
    const edge = resizeRect(r, "se", 9000, 9000, img, 1);
    expect(edge).toEqual({ x: 1000, y: 1000, w: 2000, h: 2000 });
    // Never below the minimum side.
    const tiny = resizeRect(r, "se", -5000, -5000, img, 16 / 9);
    expect(Math.min(tiny.w, tiny.h)).toBeCloseTo(minSide(img));
    expect(tiny.w / tiny.h).toBeCloseTo(16 / 9);
    expect(resizeRect(r, "ne", -5000, 0, img, null).w).toBe(minSide(img));
  });

  it("scales the output down to the standard, never up", () => {
    expect(outputSize({ w: 4000, h: 2250 }, { w: 2400, h: 1350 })).toEqual({ w: 2400, h: 1350 });
    expect(outputSize({ w: 1200, h: 675 }, { w: 2400, h: 1350 })).toEqual({ w: 1200, h: 675 });
    expect(outputSize({ w: 3000, h: 1000 }, { w: 960, h: 400 })).toEqual({ w: 960, h: 320 });
    expect(outputSize({ w: 1000, h: 3000 }, { w: 960, h: 400 })).toEqual({ w: 133, h: 400 });
    expect(roundRect({ x: 0.4, y: 10.6, w: 3999.7, h: 100.2 }, img)).toEqual({ x: 0, y: 11, w: 4000, h: 100 });
  });

  it("names and formats the result", () => {
    expect(croppedFilename("kurta.jpeg", { w: 1600, h: 2000 }, "image/webp")).toBe("kurta-1600x2000.webp");
    expect(croppedFilename("kurta-800x800.png", { w: 400, h: 400 }, "image/png")).toBe("kurta-400x400.png");
    expect(croppedFilename(".jpg", { w: 200, h: 200 }, "image/jpeg")).toBe("image-200x200.jpg");
    expect(fallbackFormat(true)).toBe("image/png");
    expect(fallbackFormat(false)).toBe("image/jpeg");
    expect(mayHaveAlpha("image/png")).toBe(true);
    expect(mayHaveAlpha("image/jpeg")).toBe(false);
  });
});
