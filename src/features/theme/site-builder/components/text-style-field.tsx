"use client";

import { useId } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, RotateCcw, Underline } from "lucide-react";
import {
  DEFAULT_TEXT_LOOK,
  TEXT_ALIGNS,
  TEXT_FONTS,
  TEXT_LOOK_LIMITS,
  TEXT_WEIGHTS,
  clampTextWidthPct,
  patchTextLook,
  textLookChanged,
  type TextAlign,
  type TextFont,
  type TextLook,
  type TextWeight,
} from "@/features/theme/schema/text-style";
import { cn } from "@/lib/cn";
import { ColorInput, input } from "./ui";

/**
 * Layman-friendly per-text controls: font, weight, size, colour, alignment, bold/italic/underline,
 * and a width stepper (mirrors canvas text-box resize). Writes a structured TextLook object.
 */

const FONT_LABELS: Record<TextFont, string> = {
  default: "Theme default",
  heading: "Heading font",
  body: "Body font",
};
const WEIGHT_LABELS: Record<TextWeight, string> = {
  default: "Theme default",
  "300": "Light",
  "400": "Regular",
  "500": "Medium",
  "600": "Semi-bold",
  "700": "Bold",
  "800": "Extra bold",
};
const ALIGN_ICONS: Record<Exclude<TextAlign, "default">, typeof AlignLeft> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
};

export function TextStyleField({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: unknown;
  onChange: (v: TextLook) => void;
  help?: string;
}) {
  const id = useId();
  const look = patchTextLook(value, {});
  const changed = textLookChanged(look);
  const set = (patch: Partial<TextLook>) => onChange(patchTextLook(look, patch));
  const width = look.widthPct;
  const mobileW = clampTextWidthPct(width, "mobile");

  return (
    <fieldset className="space-y-2.5 rounded-lg border border-border bg-surface p-2.5">
      <legend className="px-1 text-xs font-medium">{label}</legend>
      {help ? <p className="text-[11px] text-muted">{help}</p> : null}

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="block text-[11px] font-medium text-muted">Font</span>
          <select
            className={input}
            value={look.font}
            onChange={(e) => set({ font: e.target.value as TextFont })}
            aria-label={`${label} font`}
          >
            {TEXT_FONTS.map((f) => (
              <option key={f} value={f}>
                {FONT_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] font-medium text-muted">Weight</span>
          <select
            className={input}
            value={look.weight}
            onChange={(e) => set({ weight: e.target.value as TextWeight })}
            aria-label={`${label} weight`}
            disabled={look.bold}
          >
            {TEXT_WEIGHTS.map((w) => (
              <option key={w} value={w}>
                {WEIGHT_LABELS[w]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={`${id}-size`} className="text-[11px] font-medium text-muted">
            Size
          </label>
          <span className="font-mono text-[11px] tabular-nums text-muted">{look.size > 0 ? `${look.size}px` : "Theme"}</span>
        </div>
        <input
          id={`${id}-size`}
          type="range"
          min={TEXT_LOOK_LIMITS.size.min}
          max={TEXT_LOOK_LIMITS.size.max}
          step={1}
          value={look.size}
          onChange={(e) => set({ size: Number(e.target.value) })}
          className="w-full accent-[var(--color-accent,#f97316)]"
        />
        <div className="flex items-center gap-1">
          <Stepper
            label={`${label} size down`}
            onClick={() => set({ size: Math.max(0, look.size - 1) })}
            disabled={look.size <= 0}
          >
            −
          </Stepper>
          <input
            type="number"
            className={cn(input, "h-7 text-center")}
            min={0}
            max={TEXT_LOOK_LIMITS.size.max}
            value={look.size}
            aria-label={`${label} size in pixels`}
            onChange={(e) => set({ size: Number(e.target.value) || 0 })}
          />
          <Stepper
            label={`${label} size up`}
            onClick={() => set({ size: Math.min(TEXT_LOOK_LIMITS.size.max, look.size + 1) })}
            disabled={look.size >= TEXT_LOOK_LIMITS.size.max}
          >
            +
          </Stepper>
        </div>
      </div>

      <ColorInput label="Colour" value={look.color} allowEmpty onChange={(v) => set({ color: v })} />

      <div className="space-y-1" role="group" aria-label={`${label} alignment`}>
        <span className="block text-[11px] font-medium text-muted">Alignment</span>
        <div className="flex gap-1">
          <AlignBtn active={look.align === "default"} onClick={() => set({ align: "default" })} label="Theme alignment">
            Auto
          </AlignBtn>
          {TEXT_ALIGNS.filter((a): a is Exclude<TextAlign, "default"> => a !== "default").map((a) => {
            const Icon = ALIGN_ICONS[a];
            return (
              <AlignBtn key={a} active={look.align === a} onClick={() => set({ align: a })} label={`Align ${a}`}>
                <Icon className="size-3.5" aria-hidden />
              </AlignBtn>
            );
          })}
        </div>
      </div>

      <div className="flex gap-1" role="group" aria-label={`${label} emphasis`}>
        <ToggleBtn active={look.bold} onClick={() => set({ bold: !look.bold })} label="Bold">
          <Bold className="size-3.5" aria-hidden />
        </ToggleBtn>
        <ToggleBtn active={look.italic} onClick={() => set({ italic: !look.italic })} label="Italic">
          <Italic className="size-3.5" aria-hidden />
        </ToggleBtn>
        <ToggleBtn active={look.underline} onClick={() => set({ underline: !look.underline })} label="Underline">
          <Underline className="size-3.5" aria-hidden />
        </ToggleBtn>
      </div>

      <div className="space-y-1 border-t border-border pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={`${id}-width`} className="text-[11px] font-medium text-muted">
            Text box width
          </label>
          <span className="font-mono text-[11px] tabular-nums text-muted">{width > 0 ? `${width}%` : "Auto"}</span>
        </div>
        <input
          id={`${id}-width`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={width}
          onChange={(e) => set({ widthPct: Number(e.target.value) })}
          className="w-full accent-[var(--color-accent,#f97316)]"
        />
        <div className="flex items-center gap-1">
          <Stepper
            label={`${label} width down`}
            onClick={() => set({ widthPct: Math.max(0, width - 5) })}
            disabled={width <= 0}
          >
            −
          </Stepper>
          <input
            type="number"
            className={cn(input, "h-7 text-center")}
            min={0}
            max={100}
            step={5}
            value={width}
            aria-label={`${label} width percent`}
            onChange={(e) => set({ widthPct: Number(e.target.value) || 0 })}
          />
          <Stepper
            label={`${label} width up`}
            onClick={() => set({ widthPct: Math.min(100, width + 5) })}
            disabled={width >= 100}
          >
            +
          </Stepper>
        </div>
        {width > 0 ? (
          <p className="text-[11px] text-muted">
            On phones this stays between {TEXT_LOOK_LIMITS.mobileMinWidthPct}% and 100% (now {mobileW}%).
          </p>
        ) : (
          <p className="text-[11px] text-muted">Drag the handles on the canvas, or use the steppers above.</p>
        )}
      </div>

      {changed ? (
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_TEXT_LOOK })}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
        >
          <RotateCcw className="size-3" aria-hidden /> Reset to theme
        </button>
      ) : null}
    </fieldset>
  );
}

function Stepper({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 shrink-0 place-items-center rounded-md border border-border text-sm font-semibold text-foreground hover:bg-surface-secondary disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function AlignBtn({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 min-w-7 flex-1 items-center justify-center rounded-md border px-1.5 text-[11px] font-medium",
        active ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ToggleBtn({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md border",
        active ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
