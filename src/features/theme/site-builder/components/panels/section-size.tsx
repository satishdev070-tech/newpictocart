"use client";

import { useId, useState } from "react";
import { Link2, Link2Off, Monitor, RotateCcw, Smartphone } from "lucide-react";
import { SECTION_BOX_LIMITS, type SectionBox, type SectionBoxSide, type SectionBoxWidth, type SectionInstance } from "@/features/theme/sections/types";
import { mobileSpace, normalizeSectionBox } from "@/features/theme/schema/section-box";
import type { ThemeTokens } from "@/features/theme/schema/tokens";
import { cn } from "@/lib/cn";
import { useBuilder, type SectionRef } from "../../context";
import { updateSection } from "../../ops";

/**
 * Section → Settings → "Size & spacing": content size (%), content width and margin / padding
 * (px, desktop + phone). Writes the section envelope `box` (schema/section-box.ts); every value can
 * be reset to the theme default, and an empty box is removed so the section renders as before.
 */

const { scale: SCALE, space: SPACE } = SECTION_BOX_LIMITS;

/** Theme section padding (px) per spacing token: [phone, desktop] (tokens-style.tsx SECTION_Y). */
const THEME_PADDING: Record<ThemeTokens["spacing"], [number, number]> = { compact: [40, 56], comfortable: [56, 80], airy: [64, 112] };
/** Per-section spacing preset multipliers (storefront.css data-spacing). */
const PRESET: Record<string, number> = { compact: 0.55, airy: 1.4, flush: 0 };

const WIDTHS: readonly (readonly [SectionBoxWidth | "", string])[] = [
  ["", "Theme"],
  ["narrow", "Narrow"],
  ["wide", "Wide"],
  ["full", "Full"],
];

type Device = "desktop" | "mobile";

export function SectionSizeSpacing({ section, sectionRef }: { section: SectionInstance; sectionRef: SectionRef }) {
  const b = useBuilder();
  const box: SectionBox = section.box ?? {};
  const [device, setDevice] = useState<Device>(b.device);

  const write = (fn: (x: SectionBox) => SectionBox, key: string) =>
    b.apply(
      (c) =>
        updateSection(c, sectionRef.list, sectionRef.sectionId, (s) => {
          const next = normalizeSectionBox(fn(structuredClone(s.box ?? {})));
          const { box: _drop, ...rest } = s;
          return next ? { ...rest, box: next } : rest;
        }),
      `sec.${sectionRef.sectionId}.box.${key}`,
    );

  const setSide = (side: SectionBoxSide, v: number | undefined, d: Device) =>
    write((x) => {
      if (d === "desktop") x[side] = v;
      else x.mobile = { ...x.mobile, [side]: v };
      return x;
    }, `${d}.${side}`);

  const switchDevice = (d: Device) => {
    setDevice(d);
    if (b.device !== d) b.setDevice(d); // preview the canvas on the same device
  };

  // Theme default padding shown on the sliders while unset (follows the section's spacing preset).
  const preset = (section.settings as { spacing?: unknown }).spacing;
  const factor = typeof preset === "string" && preset in PRESET ? PRESET[preset]! : 1;
  const [padM, padD] = THEME_PADDING[b.config.tokens.spacing] ?? THEME_PADDING.airy;
  const themePad = Math.round((device === "desktop" ? padD : padM) * factor);

  const shown = (side: SectionBoxSide): { value: number; set: boolean; auto: boolean } => {
    if (device === "desktop") {
      const v = box[side];
      return v === undefined ? { value: side.startsWith("padding") ? themePad : 0, set: false, auto: false } : { value: v, set: true, auto: false };
    }
    const explicit = box.mobile?.[side];
    if (explicit !== undefined) return { value: explicit, set: true, auto: false };
    const derived = mobileSpace(box, side);
    if (derived !== undefined) return { value: derived, set: false, auto: true };
    return { value: side.startsWith("padding") ? themePad : 0, set: false, auto: false };
  };

  const scale = box.scale ?? 100;

  return (
    <section className="space-y-3 border-t border-border pt-3 first:border-t-0 first:pt-0" aria-label="Size and spacing">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Size &amp; spacing</h3>

      <RangeRow
        label="Content size"
        min={SCALE.min}
        max={SCALE.max}
        step={SCALE.step}
        value={scale}
        readout={`${scale}%`}
        hint={box.scale === undefined ? "Theme" : undefined}
        onChange={(v) => write((x) => ({ ...x, scale: v === 100 ? undefined : v }), "scale")}
        onReset={box.scale !== undefined ? () => write((x) => ({ ...x, scale: undefined }), "scale") : undefined}
      />
      <p className="-mt-1 text-[11px] text-muted">Scales headings, text, buttons, gaps and cards in this section.</p>

      <div className="space-y-1" role="radiogroup" aria-label="Content width">
        <span className="block text-xs font-medium">Content width</span>
        <div className="grid grid-cols-4 gap-1">
          {WIDTHS.map(([v, l]) => {
            const active = (box.width ?? "") === v;
            return (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => write((x) => ({ ...x, width: v || undefined }), "width")}
                className={cn(
                  "rounded-md border px-1 py-1.5 text-[11px] font-medium",
                  active ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground",
                )}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs font-medium">Spacing for</span>
        <div className="inline-flex rounded-lg bg-surface-secondary p-0.5" role="radiogroup" aria-label="Spacing device">
          {(
            [
              ["desktop", "Desktop", Monitor],
              ["mobile", "Phone", Smartphone],
            ] as const
          ).map(([d, l, Icon]) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={device === d}
              onClick={() => switchDevice(d)}
              className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium", device === d ? "bg-surface text-accent shadow-xs" : "text-muted hover:text-foreground")}
            >
              <Icon className="size-3.5" aria-hidden /> {l}
            </button>
          ))}
        </div>
      </div>
      {device === "mobile" ? <p className="-mt-1 text-[11px] text-muted">Unset phone values use 60% of the desktop value.</p> : null}

      <SidePair title="Margin" sides={["marginTop", "marginBottom"]} shown={shown} onSet={(side, v) => setSide(side, v, device)} />
      <SidePair title="Padding" sides={["paddingTop", "paddingBottom"]} shown={shown} onSet={(side, v) => setSide(side, v, device)} />
      {preset && preset !== "default" ? <p className="text-[11px] text-muted">Exact padding values override the Spacing preset for that side.</p> : null}
    </section>
  );
}

function SidePair({
  title,
  sides,
  shown,
  onSet,
}: {
  title: string;
  sides: readonly [SectionBoxSide, SectionBoxSide];
  shown: (s: SectionBoxSide) => { value: number; set: boolean; auto: boolean };
  onSet: (side: SectionBoxSide, v: number | undefined) => void;
}) {
  const [a, z] = sides.map(shown) as [ReturnType<typeof shown>, ReturnType<typeof shown>];
  const [linked, setLinked] = useState(a.set && z.set && a.value === z.value);
  const set = (side: SectionBoxSide, v: number | undefined) => {
    if (linked) sides.forEach((s) => onSet(s, v));
    else onSet(side, v);
  };
  return (
    <div className="space-y-2 rounded-lg border border-border p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">{title}</span>
        <button
          type="button"
          aria-pressed={linked}
          onClick={() => setLinked((l) => !l)}
          title={linked ? "Top and bottom are linked" : "Link top and bottom"}
          className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]", linked ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground")}
        >
          {linked ? <Link2 className="size-3.5" aria-hidden /> : <Link2Off className="size-3.5" aria-hidden />}
          {linked ? "Linked" : "Link"}
        </button>
      </div>
      {sides.map((side, i) => {
        const s = i === 0 ? a : z;
        return (
          <RangeRow
            key={side}
            label={i === 0 ? "Top" : "Bottom"}
            min={SPACE.min}
            max={SPACE.max}
            step={4}
            value={s.value}
            readout={`${s.value}px`}
            hint={s.set ? undefined : s.auto ? "Auto" : "Theme"}
            onChange={(v) => set(side, v)}
            onReset={s.set ? () => set(side, undefined) : undefined}
          />
        );
      })}
    </div>
  );
}

function RangeRow({
  label,
  min,
  max,
  step,
  value,
  readout,
  hint,
  onChange,
  onReset,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  readout: string;
  hint?: string;
  onChange: (v: number) => void;
  onReset?: () => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="flex-1 text-xs font-medium">
          {label}
        </label>
        {hint ? <span className="rounded bg-surface-secondary px-1 text-[10px] uppercase tracking-wide text-muted">{hint}</span> : null}
        <span className="w-11 text-right font-mono text-xs tabular-nums">{readout}</span>
        <button
          type="button"
          onClick={onReset}
          disabled={!onReset}
          aria-label={`Reset ${label.toLowerCase()}`}
          title="Reset to theme default"
          className="grid size-5 place-items-center rounded text-muted hover:text-accent disabled:pointer-events-none disabled:opacity-30"
        >
          <RotateCcw className="size-3" aria-hidden />
        </button>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Math.round(Number(e.target.value)))))}
        className="w-full accent-accent"
      />
    </div>
  );
}
