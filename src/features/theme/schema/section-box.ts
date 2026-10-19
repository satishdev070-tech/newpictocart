import { z } from "zod";
import { SECTION_BOX_LIMITS, SECTION_BOX_SIDES, SECTION_BOX_WIDTHS, type SectionBox, type SectionBoxSide } from "../sections/types";

/**
 * Section envelope `box`: per-section content size, content width and vertical spacing
 * (builder → section → Settings → "Size & spacing"). Every key is optional and absent means
 * "theme default", so sections saved before this render exactly as before (no CSS emitted).
 *
 * Only integers in range and enum keys reach CSS (sectionBoxVars re-checks them), as inline
 * custom properties on the section wrapper; storefront.css consumes them:
 *  - --sf-scale        rescales Tailwind's type scale (--text-*) and spacing unit (--spacing),
 *                      the inherited font size and the container width inside the section;
 *  - --sf-container    content width override;
 *  - --sf-mt/mb/pt/pb  desktop spacing, --sf-mt-m … phone spacing (container query < 48rem).
 */

const { scale: SCALE, space: SPACE, mobileFactor } = SECTION_BOX_LIMITS;

const space = z.coerce.number().int().min(SPACE.min, `Use ${SPACE.min}–${SPACE.max}px`).max(SPACE.max, `Use ${SPACE.min}–${SPACE.max}px`);
const scale = z.coerce
  .number()
  .int()
  .min(SCALE.min, `Use ${SCALE.min}–${SCALE.max}%`)
  .max(SCALE.max, `Use ${SCALE.min}–${SCALE.max}%`)
  .refine((n) => n % SCALE.step === 0, `Use steps of ${SCALE.step}%`);

const sides = Object.fromEntries(SECTION_BOX_SIDES.map((k) => [k, space.optional()])) as Record<SectionBoxSide, z.ZodOptional<typeof space>>;

export const sectionBoxSchema = z.object({
  scale: scale.optional(),
  width: z.enum(SECTION_BOX_WIDTHS).optional(),
  ...sides,
  mobile: z.object(sides).optional(),
});

/** Drops absent / default values; returns undefined when nothing is overridden. */
export function normalizeSectionBox(box: z.infer<typeof sectionBoxSchema> | SectionBox | undefined): SectionBox | undefined {
  if (!box) return undefined;
  const out: SectionBox = {};
  if (box.scale !== undefined && box.scale !== 100) out.scale = box.scale;
  if (box.width) out.width = box.width;
  for (const k of SECTION_BOX_SIDES) if (box[k] !== undefined) out[k] = box[k];
  const mobile: Partial<Record<SectionBoxSide, number>> = {};
  for (const k of SECTION_BOX_SIDES) if (box.mobile?.[k] !== undefined) mobile[k] = box.mobile[k];
  if (Object.keys(mobile).length) out.mobile = mobile;
  return Object.keys(out).length ? out : undefined;
}

/** Parses an envelope `box` value. Invalid input → issues + undefined (the section itself still renders). */
export function parseSectionBox(raw: unknown): { box?: SectionBox; error?: z.ZodError } {
  if (raw === undefined || raw === null) return {};
  const r = sectionBoxSchema.safeParse(raw);
  if (!r.success) return { error: r.error };
  return { box: normalizeSectionBox(r.data) };
}

const CONTENT_WIDTH: Record<(typeof SECTION_BOX_WIDTHS)[number], string> = { narrow: "1080px", wide: "1440px", full: "100%" };

const VAR: Record<SectionBoxSide, string> = { marginTop: "mt", marginBottom: "mb", paddingTop: "pt", paddingBottom: "pb" };

function okSpace(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= SPACE.min && n <= SPACE.max;
}

/** The phone value used for a side: explicit, else 60% of desktop, else none. */
export function mobileSpace(box: SectionBox, side: SectionBoxSide): number | undefined {
  const m = box.mobile?.[side];
  if (okSpace(m)) return m;
  const d = box[side];
  return okSpace(d) ? Math.round(d * mobileFactor) : undefined;
}

/**
 * Inline CSS variables + data attributes for a section's box. Empty/undefined box → nothing.
 * Data attributes switch on the matching storefront.css rules only when a value is set.
 */
export function sectionBoxVars(box: SectionBox | undefined): { vars: Record<string, string>; attrs: Record<string, string> } | undefined {
  if (!box) return undefined;
  const vars: Record<string, string> = {};
  const attrs: Record<string, string> = {};
  const s = box.scale;
  if (typeof s === "number" && Number.isInteger(s) && s >= SCALE.min && s <= SCALE.max && s % SCALE.step === 0 && s !== 100) {
    vars["--sf-scale"] = (s / 100).toFixed(2);
    attrs["data-sf-scale"] = "";
  }
  if (box.width && Object.hasOwn(CONTENT_WIDTH, box.width)) {
    vars["--sf-container"] = CONTENT_WIDTH[box.width];
    attrs["data-sf-width"] = box.width;
  }
  for (const side of SECTION_BOX_SIDES) {
    const d = box[side];
    if (!okSpace(d) && !okSpace(box.mobile?.[side])) continue;
    const v = VAR[side];
    // A phone-only value keeps the theme default on desktop.
    if (okSpace(d)) vars[`--sf-${v}`] = `${d}px`;
    const m = mobileSpace(box, side);
    if (m !== undefined) vars[`--sf-${v}-m`] = `${m}px`;
    attrs[`data-sf-${v}`] = okSpace(d) ? "" : "m";
  }
  return Object.keys(vars).length ? { vars, attrs } : undefined;
}
