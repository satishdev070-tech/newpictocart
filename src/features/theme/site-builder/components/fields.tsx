"use client";

import { useId, useState } from "react";
import { DIAGRAMS_A } from "../variant-diagrams-a";
import { DIAGRAMS_B } from "../variant-diagrams-b";
import { DIAGRAMS_PAGES } from "../variant-diagrams-pages";
import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from "lucide-react";
import { uploadThemeVideoAction } from "@/features/theme/actions";
import { MediaPicker } from "@/features/media/components/media-picker";
import type { EditorField } from "@/features/theme/sections/types";
import type { EditorPickers } from "@/features/theme/server/queries";
import { assetUrl } from "@/lib/storage/assets";
import { IconGlyph } from "@/lib/icons/icon-glyph";
import { iconLabel, parseIconValue } from "@/lib/icons/names";
import { cn } from "@/lib/cn";
import { blankItem, itemLabel, visibleFields } from "../field-groups";
import { ColorInput, IconButton, Toggle, input } from "./ui";

/**
 * Field renderer for the site builder panels: one control per EditorField kind (text, number,
 * select / layout-variant cards, toggle, colour, image via the media library, video link + MP4
 * upload, catalog pickers, tags, nested lists). Ported from the classic theme editor.
 */

export type FieldProps = { field: EditorField; value: unknown; onChange: (v: unknown) => void; pickers: EditorPickers; error?: string };

/** Uploads an MP4 through the theme action and returns its storage path. */
export function VideoUpload({ onUploaded }: { onUploaded: (path: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-1.5">
      <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-accent hover:underline">
        <Upload className="size-3.5" aria-hidden />
        {busy ? "Uploading…" : "Upload MP4"}
        <input
          type="file"
          accept="video/mp4"
          className="sr-only"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            setError(null);
            const fd = new FormData();
            fd.set("file", file);
            const r = await uploadThemeVideoAction(null, fd);
            setBusy(false);
            if (r.ok) onUploaded(r.data.path);
            else setError(r.error.fieldErrors?.file?.[0] ?? r.error.fieldErrors?._form?.[0] ?? r.error.message);
          }}
        />
      </label>
      {error ? <p className="mt-1 text-xs text-error">{error}</p> : null}
    </div>
  );
}

/** Layout variants as a grid of cards (radio group), each with a small wireframe of the layout. */
export function VariantPicker({ field, value, onChange, hideLegend }: { field: Extract<EditorField, { kind: "select" }>; value: string; onChange: (v: string) => void; hideLegend?: boolean }) {
  const name = `v-${field.key}-${useId()}`;
  return (
    <fieldset>
      <legend className={cn("mb-1.5 block text-xs font-medium", hideLegend && "sr-only")}>{field.label}</legend>
      <div className="grid grid-cols-2 gap-2">
        {field.options.map((o) => {
          const on = o.value === value;
          return (
            <label key={o.value} className={cn("cursor-pointer rounded-lg border p-2 text-xs transition focus-within:ring-2 focus-within:ring-accent/40", on ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-border bg-surface hover:border-border-strong")}>
              <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              <VariantDiagram value={o.value} />
              <span className="mt-1.5 block font-medium">{o.label}</span>
              {o.hint ? <span className="block text-[11px] leading-snug text-muted">{o.hint}</span> : null}
            </label>
          );
        })}
      </div>
      {field.help ? <p className="mt-1 text-xs text-muted">{field.help}</p> : null}
    </fieldset>
  );
}

type Box = [number, number, number, number, ("img" | "t")?];

/** Tiny wireframe per variant value (decorative). Boxes: [x, y, w, h] on a 40x24 grid; "t" = text line. */
export const DIAGRAMS: Record<string, Box[]> = {
  overlay: [[0, 0, 40, 24], [4, 14, 16, 2, "t"], [4, 18, 10, 2, "t"]],
  split: [[0, 0, 20, 24], [24, 8, 12, 2, "t"], [24, 12, 9, 2, "t"]],
  collage: [[2, 8, 14, 2, "t"], [2, 12, 10, 2, "t"], [20, 2, 10, 20], [31, 2, 7, 9], [28, 12, 10, 10]],
  minimal: [[8, 3, 24, 3, "t"], [12, 8, 16, 2, "t"], [3, 13, 34, 10]],
  band: [[0, 0, 40, 11], [2, 15, 18, 3, "t"], [24, 15, 14, 2, "t"]],
  cards: [[0, 3, 4, 18], [6, 3, 28, 18], [36, 3, 4, 18]],
  framed: [[3, 2, 34, 20], [6, 13, 14, 7, "t"]],
  grid: [[1, 3, 8, 10], [11, 3, 8, 10], [21, 3, 8, 10], [31, 3, 8, 10], [1, 15, 8, 2, "t"], [11, 15, 8, 2, "t"], [21, 15, 8, 2, "t"], [31, 15, 8, 2, "t"]],
  masonry: [[1, 1, 12, 14], [14, 1, 12, 9], [27, 1, 12, 12], [1, 17, 12, 6], [14, 12, 12, 11], [27, 15, 12, 8]],
  lookbook: [[1, 1, 18, 22], [21, 1, 8, 10], [31, 1, 8, 10], [21, 13, 8, 10], [31, 13, 8, 10]],
  rail: [[1, 4, 10, 14], [13, 4, 10, 14], [25, 4, 10, 14], [37, 4, 3, 14]],
  bigtile: [[1, 2, 18, 20], [21, 2, 18, 20]],
  list: [[1, 2, 6, 5], [9, 3, 20, 2, "t"], [1, 9, 6, 5], [9, 10, 20, 2, "t"], [1, 16, 6, 5], [9, 17, 20, 2, "t"]],
  carousel: [[1, 4, 10, 14], [13, 4, 10, 14], [25, 4, 10, 14], [37, 4, 3, 14]],
  index: [[1, 3, 4, 2, "t"], [7, 2, 24, 4, "t"], [33, 2, 6, 4], [1, 10, 4, 2, "t"], [7, 9, 20, 4, "t"], [33, 9, 6, 4], [1, 17, 4, 2, "t"], [7, 16, 22, 4, "t"], [33, 16, 6, 4]],
  pills: [[1, 4, 12, 5], [15, 4, 10, 5], [27, 4, 12, 5], [5, 13, 12, 5], [19, 13, 14, 5]],
  mosaic: [[1, 1, 18, 22], [21, 1, 8, 10], [31, 1, 8, 10], [21, 13, 8, 10], [31, 13, 8, 10]],
  centered: [[16, 2, 8, 6], [8, 10, 24, 3, "t"], [11, 15, 18, 2, "t"], [8, 20, 24, 2, "t"]],
  spotlight: [[6, 6, 28, 4, "t"], [9, 12, 22, 3, "t"], [15, 18, 10, 2, "t"]],
  wall: [[1, 1, 12, 10], [14, 1, 12, 14], [27, 1, 12, 8], [1, 13, 12, 10], [14, 17, 12, 6], [27, 11, 12, 12]],
  marquee: [[-4, 7, 14, 10], [12, 7, 14, 10], [28, 7, 14, 10]],
  banner: [[0, 0, 40, 24], [10, 8, 20, 2, "t"], [12, 13, 16, 3, "t"]],
  card: [[0, 0, 22, 24], [24, 6, 14, 2, "t"], [24, 11, 14, 3, "t"]],
  inline: [[2, 10, 14, 3, "t"], [20, 9, 18, 5]],
  line: [[2, 11, 8, 2, "t"], [12, 11, 8, 2, "t"], [22, 11, 8, 2, "t"], [32, 11, 6, 2, "t"]],
  badges: [[3, 5, 8, 8], [16, 5, 8, 8], [29, 5, 8, 8], [3, 16, 8, 2, "t"], [16, 16, 8, 2, "t"], [29, 16, 8, 2, "t"]],
  classic: [[0, 0, 40, 6], [2, 2, 8, 2, "t"]],
  bordered: [[0, 0, 40, 8], [2, 3, 8, 2, "t"], [0, 9, 40, 1]],
  inverted: [[0, 0, 40, 6], [2, 2, 8, 2, "t"]],
  floating: [[2, 2, 36, 6], [5, 4, 8, 2, "t"]],
  editorial: [[0, 0, 40, 10], [12, 3, 16, 4, "t"]],
  columns: [[1, 4, 10, 2, "t"], [14, 4, 7, 2, "t"], [23, 4, 7, 2, "t"], [32, 4, 7, 2, "t"], [0, 18, 40, 6]],
  statement: [[1, 2, 8, 2, "t"], [14, 2, 7, 2, "t"], [23, 2, 7, 2, "t"], [2, 10, 36, 9, "t"]],
  default: [[1, 4, 18, 16], [21, 4, 18, 16]],
  fullbleed: [[0, 0, 40, 18], [4, 20, 6, 4], [12, 20, 6, 4], [20, 20, 6, 4]],
  journal: [[6, 2, 28, 4, "t"], [8, 8, 24, 14]],
  overlap: [[1, 1, 26, 20], [20, 8, 18, 12, "t"]],
};

/** Wireframe from a variant value, or from explicit boxes. */
export function VariantDiagram({ value, boxes: given, className }: { value?: string; boxes?: Box[]; className?: string }) {
  const boxes = given ?? (value ? (DIAGRAMS[value] ?? DIAGRAMS_A[value] ?? DIAGRAMS_B[value] ?? DIAGRAMS_PAGES[value]) : undefined);
  if (!boxes) return null;
  return (
    <svg viewBox="0 0 40 24" aria-hidden className={cn("h-9 w-full rounded-sm bg-surface-secondary", className)}>
      {boxes.map(([x, y, w, h, kind], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx={kind === "t" ? 1 : 1.5} className={kind === "t" ? "fill-foreground/60" : "fill-foreground/20"} />
      ))}
    </svg>
  );
}

/** Image chooser: thumbnail + media library picker + remove. */
export function ImageField({ label, value, onChange, id }: { label: string; value: string; onChange: (v: string) => void; id?: string }) {
  const icon = parseIconValue(value);
  const url = assetUrl(value);
  const filled = Boolean(url || icon);
  return (
    <div>
      <span id={id} className="mb-1 block text-xs font-medium">
        {label}
      </span>
      <div className="flex items-center gap-2" aria-labelledby={id}>
        {icon ? (
          <div className="grid size-12 place-items-center rounded-md bg-accent-soft text-accent ring-1 ring-border" title={iconLabel(icon)}>
            <IconGlyph name={icon} className="size-6" />
          </div>
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element -- editor thumbnail
          <img src={url} alt="" className="size-12 rounded-md object-cover ring-1 ring-border" />
        ) : (
          <div className="grid size-12 place-items-center rounded-md bg-surface-secondary text-[10px] text-muted ring-1 ring-border">Stock</div>
        )}
        <MediaPicker folder="theme" triggerLabel={filled ? "Change" : "Choose image"} onSelect={([m]) => m && onChange(m.path)} onSelectIcon={onChange} />
        {filled ? (
          <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => onChange("")}>
            Remove
          </button>
        ) : null}
      </div>
      {!filled ? <p className="mt-1 text-xs text-muted">Empty slots show a stock photo on the store.</p> : null}
    </div>
  );
}

export function Field({ field, value, onChange, pickers, error }: FieldProps) {
  const id = `f-${field.key}-${useId()}`;
  const label = (
    <label htmlFor={id} className="mb-1 block text-xs font-medium">
      {field.label}
    </label>
  );
  const foot = (
    <>
      {field.help ? <p className="mt-1 text-xs text-muted">{field.help}</p> : null}
      {error ? <p className="mt-1 text-xs text-error">{error}</p> : null}
    </>
  );
  const invalid = error ? true : undefined;
  switch (field.kind) {
    case "text":
      return (
        <div>
          {label}
          {field.multiline ? (
            <textarea id={id} aria-invalid={invalid} className={input} rows={3} maxLength={field.maxLength} value={String(value ?? "")} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
          ) : (
            <input id={id} aria-invalid={invalid} className={input} maxLength={field.maxLength} value={String(value ?? "")} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
          )}
          {foot}
        </div>
      );
    case "video":
      return (
        <div>
          {label}
          <input id={id} aria-invalid={invalid} className={input} value={String(value ?? "")} placeholder="YouTube / Vimeo link or uploaded MP4" onChange={(e) => onChange(e.target.value)} />
          <VideoUpload onUploaded={onChange} />
          {foot}
        </div>
      );
    case "link":
      return (
        <div>
          {label}
          <input id={id} aria-invalid={invalid} className={input} value={String(value ?? "")} placeholder={field.placeholder ?? "/collections/new-arrivals"} onChange={(e) => onChange(e.target.value)} />
          {foot}
        </div>
      );
    case "number":
      return (
        <div>
          {label}
          <input id={id} aria-invalid={invalid} type="number" className={input} min={field.min} max={field.max} step={field.step ?? 1} value={Number(value ?? field.min)} onChange={(e) => onChange(Number(e.target.value))} />
          {foot}
        </div>
      );
    case "select":
      if (field.display === "variants")
        return (
          <div>
            <VariantPicker field={field} value={String(value ?? "")} onChange={onChange} />
            {error ? <p className="mt-1 text-xs text-error">{error}</p> : null}
          </div>
        );
      return (
        <div>
          {label}
          <select id={id} aria-invalid={invalid} className={input} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {foot}
        </div>
      );
    case "toggle":
      return (
        <div>
          <Toggle id={id} checked={Boolean(value)} onChange={onChange} label={field.label} />
          {foot}
        </div>
      );
    case "color":
      return (
        <div>
          <ColorInput value={String(value ?? "")} onChange={onChange} label={field.label} allowEmpty />
          {foot}
        </div>
      );
    case "image":
      return (
        <div>
          <ImageField id={id} label={field.label} value={String(value ?? "")} onChange={onChange} />
          {foot}
        </div>
      );
    case "picker":
      return (
        <div>
          {label}
          <select id={id} aria-invalid={invalid} className={input} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            <option value="">None</option>
            {pickers[field.picker].map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {foot}
        </div>
      );
    case "multiPicker": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const options = pickers[field.picker];
      return (
        <fieldset>
          <legend className="mb-1 text-xs font-medium">
            {field.label} <span className="font-normal text-muted">({arr.length}/{field.max})</span>
          </legend>
          {options.length ? (
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface p-2">
              {options.map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" className="accent-accent" checked={arr.includes(o.value)} disabled={!arr.includes(o.value) && arr.length >= field.max} onChange={(e) => onChange(e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value))} />
                  {o.label}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">Nothing to choose from yet.</p>
          )}
          {foot}
        </fieldset>
      );
    }
    case "tags":
      return <TagsField id={id} field={field} value={value} onChange={onChange} label={label} foot={foot} />;
    case "list":
      return <ListField field={field} value={value} onChange={onChange} pickers={pickers} error={error} />;
  }
}

/** Comma-separated tags; commits on blur / Enter, re-syncs when the value changes elsewhere (undo). */
function TagsField({ id, field, value, onChange, label, foot }: { id: string; field: Extract<EditorField, { kind: "tags" }>; value: unknown; onChange: (v: unknown) => void; label: React.ReactNode; foot: React.ReactNode }) {
  const arr = Array.isArray(value) ? (value as string[]) : [];
  const joined = arr.join(", ");
  const commit = (s: string) => {
    const next = s.split(",").map((t) => t.trim()).filter(Boolean).slice(0, field.max);
    if (next.join(", ") !== joined) onChange(next);
  };
  return (
    <div>
      {label}
      <input
        key={joined}
        id={id}
        className={input}
        defaultValue={joined}
        placeholder={field.placeholder}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(e.currentTarget.value);
          }
        }}
      />
      {foot}
    </div>
  );
}

/** Inline nested list (used for secondary list fields; the primary list gets the Manage list UI). */
function ListField({ field, value, onChange, pickers, error }: { field: Extract<EditorField, { kind: "list" }>; value: unknown; onChange: (v: unknown) => void; pickers: EditorPickers; error?: string }) {
  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const [open, setOpen] = useState<number | null>(null);
  const move = (i: number, j: number) => {
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j]!, n[i]!];
    onChange(n);
    if (open === i) setOpen(j);
  };
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium">
        {field.label} <span className="font-normal text-muted">({items.length}/{field.max})</span>
      </legend>
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface">
          <div className="flex items-center gap-1 px-2.5 py-1.5 text-small">
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="min-w-0 flex-1 truncate text-left hover:text-accent">
              {itemLabel(it, field.fields, `${field.itemLabel} ${i + 1}`)}
            </button>
            <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}>
              <ArrowUp />
            </IconButton>
            <IconButton label="Move down" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
              <ArrowDown />
            </IconButton>
            <IconButton label={`Remove ${field.itemLabel.toLowerCase()}`} disabled={items.length <= (field.min ?? 0)} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <Trash2 />
            </IconButton>
          </div>
          {open === i ? (
            <div className="space-y-3 border-t border-border p-2.5">
              {visibleFields(field.fields, it).map((sub) => (
                <Field key={sub.key} field={sub} value={it[sub.key]} pickers={pickers} onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, [sub.key]: v } : x)))} />
              ))}
            </div>
          ) : null}
        </div>
      ))}
      {items.length < field.max ? (
        <button type="button" onClick={() => onChange([...items, blankItem(field.fields)])} className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-accent-soft">
          <Plus className="size-3.5" aria-hidden /> Add {field.itemLabel.toLowerCase()}
        </button>
      ) : null}
      {error ? <p className="text-xs text-error">{error}</p> : null}
    </fieldset>
  );
}

/** Renders a list of fields for a values object (showIf respected); `errors` keyed by field key. */
export function FieldList({ fields, values, onChange, pickers, errors }: { fields: readonly EditorField[]; values: Record<string, unknown>; onChange: (key: string, v: unknown) => void; pickers: EditorPickers; errors?: Record<string, string> }) {
  return (
    <div className="space-y-3">
      {visibleFields(fields, values).map((f) => (
        <Field key={f.key} field={f} value={values[f.key]} pickers={pickers} onChange={(v) => onChange(f.key, v)} error={errors?.[f.key]} />
      ))}
    </div>
  );
}
