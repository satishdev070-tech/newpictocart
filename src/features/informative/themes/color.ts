/** WCAG 2.x colour maths (pure, unit tested). Hex colours only (#rrggbb). */

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new RangeError(`Not a #rrggbb colour: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Relative luminance (WCAG). */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Linear mix: t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

export const AA_TEXT = 4.5;

/** Black or white, whichever reads better on `bg` (button / badge text). */
export function readableOn(bg: string, dark = "#111111", light = "#ffffff"): string {
  return contrastRatio(dark, bg) >= contrastRatio(light, bg) ? dark : light;
}

/**
 * `fg` nudged toward black or white (away from the backgrounds) until it reaches `ratio` against
 * EVERY background in `bgs`. Returns `fg` unchanged when it already passes.
 */
export function ensureContrast(fg: string, bgs: readonly string[], ratio = AA_TEXT): string {
  const worst = (c: string) => Math.min(...bgs.map((bg) => contrastRatio(c, bg)));
  if (worst(fg) >= ratio) return fg;
  const avgLum = bgs.reduce((s, b) => s + luminance(b), 0) / bgs.length;
  const target = avgLum > 0.4 ? "#000000" : "#ffffff";
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c = mix(fg, target, t);
    if (worst(c) >= ratio) return c;
  }
  return target;
}

/**
 * A fill colour (button / band background) that some text colour can sit on at `ratio`. Mid-tones
 * (e.g. #777777) reach < 4.5:1 with both black and white: they are darkened just enough that white
 * text passes. Colours that already work are returned unchanged.
 */
export function ensureFill(fill: string, ratio = AA_TEXT, dark = "#111111", light = "#ffffff"): string {
  if (Math.max(contrastRatio(dark, fill), contrastRatio(light, fill)) >= ratio) return fill;
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c = mix(fill, "#000000", t);
    if (contrastRatio(light, c) >= ratio) return c;
  }
  return "#000000";
}
