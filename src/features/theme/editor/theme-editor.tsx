"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { publishThemeAction, refreshPreviewUrlAction, rollbackThemeAction, saveThemeDraftAction, uploadThemeVideoAction } from "@/features/theme/actions";
import { MediaPicker } from "@/features/media/components/media-picker";
import type { ThemeConfig } from "@/features/theme/schema/config";
import type { EditorField, SectionInstance, SectionType } from "@/features/theme/sections/types";
import type { ThemeVersionSummary, EditorPickers } from "@/features/theme/server/queries";
import { SECTION_DEFINITIONS, defaultSettings } from "@/features/theme/sections/definitions";
import { FONT_STACKS, BUTTON_SHAPES, BUTTON_VARIANTS, CARD_RADII, CONTAINER_WIDTHS, SPACING_SCALES } from "@/features/theme/schema/tokens";
import { assetUrl } from "@/lib/storage/assets";
import { IconGlyph } from "@/lib/icons/icon-glyph";
import { parseIconValue } from "@/lib/icons/names";
import { UNSPLASH_CATEGORIES } from "@/lib/unsplash-categories";
import { Button } from "@/components/ui/button";
import { inputClassName as input } from "@/components/ui/field";

type GroupKey = "layout.header" | "templates.home" | "templates.collection" | "templates.product" | "layout.footer";
const GROUPS: { key: GroupKey; label: string; group: string }[] = [
  { key: "layout.header", label: "Header", group: "header" },
  { key: "templates.home", label: "Home page", group: "home" },
  { key: "templates.collection", label: "Collection pages", group: "collection" },
  { key: "templates.product", label: "Product pages", group: "product" },
  { key: "layout.footer", label: "Footer", group: "footer" },
];

function getList(c: ThemeConfig, k: GroupKey): SectionInstance[] {
  const [a, b] = k.split(".") as ["layout" | "templates", string];
  return (c[a] as Record<string, SectionInstance[]>)[b] ?? [];
}
function setList(c: ThemeConfig, k: GroupKey, list: SectionInstance[]): ThemeConfig {
  const [a, b] = k.split(".") as ["layout" | "templates", string];
  return { ...c, [a]: { ...(c[a] as Record<string, SectionInstance[]>), [b]: list } } as ThemeConfig;
}
const newId = () => `s${Math.random().toString(36).slice(2, 10)}`;

/** Uploads an MP4 through the theme action and writes its storage path into the field. */
function VideoUpload({ onUploaded }: { onUploaded: (path: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-1.5">
      <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-accent hover:underline">
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

/** Layout variants as a grid of cards (radio group), each with a small diagram of the layout. */
function VariantPicker({ field, value, onChange }: { field: Extract<EditorField, { kind: "select" }>; value: string; onChange: (v: unknown) => void }) {
  const name = `v-${field.key}-${useId()}`;
  return (
    <fieldset>
      <legend className="mb-1 block text-xs font-medium">{field.label}</legend>
      <div className="grid grid-cols-2 gap-1.5">
        {field.options.map((o) => {
          const on = o.value === value;
          return (
            <label key={o.value} className={`cursor-pointer rounded-md border p-2 text-xs transition ${on ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-foreground/40"}`}>
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

/** Tiny wireframe per variant value (decorative). Boxes: [x, y, w, h] on a 40x24 grid; "t" = text line. */
const DIAGRAMS: Record<string, [number, number, number, number, ("img" | "t")?][]> = {
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

function VariantDiagram({ value }: { value: string }) {
  const boxes = DIAGRAMS[value];
  if (!boxes) return null;
  return (
    <svg viewBox="0 0 40 24" aria-hidden className="h-9 w-full rounded-sm bg-surface-secondary">
      {boxes.map(([x, y, w, h, kind], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx={kind === "t" ? 1 : 1.5} className={kind === "t" ? "fill-foreground/60" : "fill-foreground/20"} />
      ))}
    </svg>
  );
}

function Field({ field, value, onChange, pickers }: { field: EditorField; value: unknown; onChange: (v: unknown) => void; pickers: EditorPickers }) {
  const id = `f-${field.key}-${useId()}`;
  const label = (
    <label htmlFor={id} className="mb-1 block text-xs font-medium">
      {field.label}
    </label>
  );
  const help = field.help ? <p className="mt-1 text-xs text-muted">{field.help}</p> : null;
  switch (field.kind) {
    case "text":
      return (
        <div>
          {label}
          {field.multiline ? (
            <textarea id={id} className={input} rows={3} maxLength={field.maxLength} value={String(value ?? "")} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
          ) : (
            <input id={id} className={input} maxLength={field.maxLength} value={String(value ?? "")} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
          )}
          {help}
        </div>
      );
    case "video":
      return (
        <div>
          {label}
          <input id={id} className={input} value={String(value ?? "")} placeholder="YouTube / Vimeo link or uploaded MP4" onChange={(e) => onChange(e.target.value)} />
          <VideoUpload onUploaded={onChange} />
          {help}
        </div>
      );
    case "link":
      return (
        <div>
          {label}
          <input id={id} className={input} value={String(value ?? "")} placeholder={field.kind === "link" ? (field.placeholder ?? "/collections/new-arrivals") : "YouTube / Vimeo URL"} onChange={(e) => onChange(e.target.value)} />
          {help}
        </div>
      );
    case "number":
      return (
        <div>
          {label}
          <input id={id} type="number" className={input} min={field.min} max={field.max} step={field.step ?? 1} value={Number(value ?? field.min)} onChange={(e) => onChange(Number(e.target.value))} />
          {help}
        </div>
      );
    case "select":
      if (field.display === "variants") return <VariantPicker field={field} value={String(value ?? "")} onChange={onChange} />;
      return (
        <div>
          {label}
          <select id={id} className={input} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {help}
        </div>
      );
    case "toggle":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /> {field.label}
        </label>
      );
    case "color":
      return (
        <div className="flex items-center gap-2">
          <input id={id} type="color" value={String(value || "#000000")} onChange={(e) => onChange(e.target.value)} className="size-8 cursor-pointer rounded border border-border" />
          <label htmlFor={id} className="text-sm">
            {field.label}
          </label>
        </div>
      );
    case "image": {
      const url = assetUrl(String(value ?? ""));
      const icon = parseIconValue(String(value ?? ""));
      return (
        <div>
          {label}
          <div className="flex items-center gap-2">
            {icon ? (
              <div className="grid size-12 place-items-center rounded-md bg-accent-soft text-accent ring-1 ring-border">
                <IconGlyph name={icon} className="size-6" />
              </div>
            ) : url ? (
              // eslint-disable-next-line @next/next/no-img-element -- editor thumbnail
              <img src={url} alt="" className="size-12 rounded-md object-cover ring-1 ring-border" />
            ) : (
              <div className="size-12 rounded-md bg-surface-secondary ring-1 ring-border" />
            )}
            <MediaPicker folder="theme" triggerLabel={url || icon ? "Change" : "Choose image"} onSelect={([m]) => m && onChange(m.path)} onSelectIcon={onChange} />
            {url || icon ? (
              <button type="button" className="text-xs text-muted" onClick={() => onChange("")}>
                Remove
              </button>
            ) : null}
          </div>
        </div>
      );
    }
    case "picker":
      return (
        <div>
          {label}
          <select id={id} className={input} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            <option value="">None</option>
            {pickers[field.picker].map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    case "multiPicker": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset>
          <legend className="mb-1 text-xs font-medium">{field.label}</legend>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-border p-2">
            {pickers[field.picker].map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={arr.includes(o.value)} disabled={!arr.includes(o.value) && arr.length >= field.max} onChange={(e) => onChange(e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value))} />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    case "tags": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div>
          {label}
          <input id={id} className={input} defaultValue={arr.join(", ")} placeholder={field.placeholder} onBlur={(e) => onChange(e.target.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, field.max))} />
        </div>
      );
    }
    case "list": {
      const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      const blank = () => Object.fromEntries(field.fields.map((f) => [f.key, f.kind === "toggle" ? false : f.kind === "number" ? f.min : f.kind === "multiPicker" || f.kind === "tags" ? [] : ""]));
      return (
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium">{field.label}</legend>
          {items.map((it, i) => (
            <div key={i} className="space-y-2 rounded border border-border p-2">
              <div className="flex justify-between text-xs text-muted">
                <span>
                  {field.itemLabel} {i + 1}
                </span>
                <span className="flex gap-2">
                  <button type="button" disabled={i === 0} onClick={() => { const n = [...items]; [n[i - 1], n[i]] = [n[i]!, n[i - 1]!]; onChange(n); }}>↑</button>
                  <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button>
                </span>
              </div>
              {field.fields.map((sub) =>
                sub.showIf && !sub.showIf.equals.includes(it[sub.showIf.key] as string | boolean) ? null : (
                  <Field key={sub.key} field={sub} value={it[sub.key]} pickers={pickers} onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, [sub.key]: v } : x)))} />
                ),
              )}
            </div>
          ))}
          {items.length < field.max ? (
            <Button size="sm" variant="secondary" onClick={() => onChange([...items, blank()])}>
              + {field.itemLabel}
            </Button>
          ) : null}
        </fieldset>
      );
    }
  }
}

const DEVICE_WIDTH = { desktop: 1280, mobile: 390 } as const;

/**
 * Renders the storefront at a real device width and scales it down to fit the column, so the
 * "Desktop" preview shows the desktop layout even when the editor column is narrow.
 */
function ScaledFrame({ src, device }: { src: string; device: "desktop" | "mobile" }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const width = DEVICE_WIDTH[device];
  const scale = size.w ? Math.min(1, size.w / width) : 1;
  return (
    <div ref={box} className="relative h-[72vh] w-full overflow-hidden">
      {size.w ? (
        <iframe
          src={src}
          title={`Storefront preview (${device})`}
          className="absolute left-1/2 top-0 origin-top border-0 bg-white shadow-sm"
          style={{ width, height: size.h / scale, transform: `translateX(-50%) scale(${scale})` }}
        />
      ) : null}
    </div>
  );
}

export function ThemeEditor({
  initial,
  draftUpdatedAt,
  pickers,
  history,
  publishedVersion,
  canPublish,
  issues,
}: {
  initial: ThemeConfig;
  draftUpdatedAt: string | null;
  pickers: EditorPickers;
  history: ThemeVersionSummary[];
  publishedVersion: number | null;
  canPublish: boolean;
  issues: string[];
}) {
  const [config, setConfig] = useState<ThemeConfig>(initial);
  const [group, setGroup] = useState<GroupKey | "global">("templates.home");
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [base, setBase] = useState(draftUpdatedAt ?? "");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [saveState, saveAction, saving] = useActionState(async (prev: Awaited<ReturnType<typeof saveThemeDraftAction>> | null, fd: FormData) => {
    const r = await saveThemeDraftAction(prev, fd);
    if (r.ok) {
      setBase(r.data.updatedAt);
      setDirty(false);
      setPreviewKey((k) => k + 1);
    }
    return r;
  }, null);
  const [pubState, pubAction, publishing] = useActionState(publishThemeAction, null);
  const [, rollbackAction, rollingBack] = useActionState(rollbackThemeAction, null);

  useEffect(() => {
    void refreshPreviewUrlAction().then((r) => r.ok && setPreview(r.data.url));
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const update = (c: ThemeConfig) => {
    setConfig(c);
    setDirty(true);
  };
  const list = group === "global" ? [] : getList(config, group);
  const current = list.find((s) => s.id === selected) ?? null;
  const groupMeta = GROUPS.find((g) => g.key === group);
  const addable = groupMeta
    ? (Object.values(SECTION_DEFINITIONS) as { type: SectionType; label: string; groups: readonly string[]; singleton?: boolean }[]).filter(
        (d) => d.groups.includes(groupMeta.group) && !(d.singleton && list.some((s) => s.type === d.type)),
      )
    : [];
  const setSection = (id: string, patch: Partial<SectionInstance>) => update(setList(config, group as GroupKey, list.map((s) => (s.id === id ? { ...s, ...patch } : s))));
  const move = (i: number, d: -1 | 1) => {
    const n = [...list];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j]!, n[i]!];
    update(setList(config, group as GroupKey, n));
  };
  const t = config.tokens;
  const setTokens = (patch: Partial<typeof t>) => update({ ...config, tokens: { ...t, ...patch } });
  const saveError = saveState && !saveState.ok ? saveState.error : null;

  return (
    <div className="grid min-h-[70vh] gap-4 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
      <aside className="space-y-4 rounded-lg border border-border bg-surface p-3">
        <nav aria-label="Theme areas" className="flex flex-wrap gap-1 text-xs xl:flex-col">
          <button type="button" onClick={() => setGroup("global")} className={`rounded px-2 py-1.5 text-left ${group === "global" ? "bg-primary text-primary-foreground" : "hover:bg-background"}`}>
            Theme settings
          </button>
          {GROUPS.map((g) => (
            <button key={g.key} type="button" onClick={() => { setGroup(g.key); setSelected(null); }} className={`rounded px-2 py-1.5 text-left ${group === g.key ? "bg-primary text-primary-foreground" : "hover:bg-background"}`}>
              {g.label}
            </button>
          ))}
        </nav>
        {group !== "global" ? (
          <div className="space-y-2">
            <ol className="space-y-1">
              {list.map((s, i) => (
                <li key={s.id} className={`flex items-center gap-1 rounded border px-2 py-1 text-sm ${selected === s.id ? "border-accent" : "border-border"}`}>
                  <button type="button" className={`flex-1 truncate text-left ${!s.visibility.desktop && !s.visibility.mobile ? "text-muted line-through" : ""}`} onClick={() => setSelected(s.id)}>
                    {SECTION_DEFINITIONS[s.type]?.label ?? s.type}
                  </button>
                  <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="px-1 text-xs">↑</button>
                  <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="px-1 text-xs">↓</button>
                  <button type="button" aria-label="Remove section" onClick={() => { update(setList(config, group, list.filter((x) => x.id !== s.id))); if (selected === s.id) setSelected(null); }} className="px-1 text-xs">✕</button>
                </li>
              ))}
            </ol>
            {addable.length ? (
              <select
                aria-label="Add section"
                className={input}
                value=""
                onChange={(e) => {
                  const type = e.target.value as SectionType;
                  if (!type) return;
                  const s: SectionInstance = { id: newId(), type, settings: defaultSettings(type), visibility: { desktop: true, mobile: true } } as SectionInstance;
                  update(setList(config, group, [...list, s]));
                  setSelected(s.id);
                }}
              >
                <option value="">+ Add section…</option>
                {addable.map((d) => (
                  <option key={d.type} value={d.type}>
                    {d.label}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        ) : null}
      </aside>

      <section aria-label="Preview" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex gap-1" role="group" aria-label="Preview device">
            {(["desktop", "mobile"] as const).map((d) => (
              <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)} className={`rounded px-2 py-1 ${device === d ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                {d === "desktop" ? "Desktop" : "Mobile"}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted">{dirty ? "Unsaved changes — save to refresh the preview" : "Preview shows your saved draft"}</span>
        </div>
        <div className="flex flex-1 justify-center overflow-hidden rounded bg-background">
          {preview ? (
            <ScaledFrame key={previewKey} src={preview} device={device} />
          ) : (
            <p className="self-center text-sm text-muted">Loading preview…</p>
          )}
        </div>
      </section>

      <aside className="space-y-4 rounded-lg border border-border bg-surface p-3">
        <form action={saveAction} className="space-y-2">
          <input type="hidden" name="config" value={JSON.stringify(config)} />
          <input type="hidden" name="baseUpdatedAt" value={base} />
          {saveError?.code === "CONFLICT" ? <input type="hidden" name="force" value="1" /> : null}
          <Button type="submit" className="w-full" pending={saving} disabled={!dirty && !saveError}>
            {saveError?.code === "CONFLICT" ? "Save anyway (overwrite)" : "Save draft"}
          </Button>
          {saveError ? <p role="alert" className="text-xs text-error">{saveError.fieldErrors?._form?.[0] ?? saveError.message}</p> : saveState?.ok ? <p role="status" className="text-xs text-success">Draft saved.</p> : null}
          {issues.length ? <p className="text-xs text-warning">{issues.length} stored section(s) were invalid and will be dropped on save.</p> : null}
        </form>
        {canPublish ? (
          <form action={pubAction} className="space-y-2 border-t border-border pt-3" onSubmit={(e) => { if (dirty || !confirm("Publish the saved draft to your live store?")) e.preventDefault(); }}>
            <label htmlFor="pub-label" className="text-xs font-medium">Version note</label>
            <input id="pub-label" name="label" className={input} placeholder="e.g. Diwali homepage" maxLength={80} />
            <Button type="submit" variant="secondary" className="w-full" pending={publishing} disabled={dirty}>
              Publish
            </Button>
            {dirty ? <p className="text-xs text-muted">Save your draft before publishing.</p> : null}
            {pubState?.ok ? <p role="status" className="text-xs text-success">Published. Your store is updated.</p> : pubState && !pubState.ok ? <p role="alert" className="text-xs text-error">{pubState.error.message}</p> : null}
          </form>
        ) : null}

        {group === "global" ? (
          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-sm font-medium">Colours</p>
            {(Object.keys(t.colors) as (keyof typeof t.colors)[]).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm capitalize">
                <input type="color" value={t.colors[k]} onChange={(e) => setTokens({ colors: { ...t.colors, [k]: e.target.value } })} className="size-7 rounded border border-border" /> {k}
              </label>
            ))}
            {(
              [
                ["headingFont", "Heading font", Object.keys(FONT_STACKS)],
                ["bodyFont", "Body font", Object.keys(FONT_STACKS)],
                ["headingCase", "Heading case", ["normal", "uppercase"]],
                ["buttonShape", "Button shape", BUTTON_SHAPES],
                ["buttonVariant", "Button style", BUTTON_VARIANTS],
                ["cardRadius", "Card corners", CARD_RADII],
                ["containerWidth", "Page width", CONTAINER_WIDTHS],
                ["spacing", "Spacing", SPACING_SCALES],
                ["sectionHeadingAlign", "Section titles", ["left", "center"]],
                ["finish", "Finish (refined = extra polish for editorial sections)", ["standard", "refined"]],
                ["imagery", "Stock photos for empty image slots (Unsplash)", ["auto", "off", ...UNSPLASH_CATEGORIES]],
              ] as const
            ).map(([k, lbl, values]) => (
              <div key={k}>
                <label htmlFor={`tok-${k}`} className="mb-1 block text-xs font-medium">{lbl}</label>
                <select id={`tok-${k}`} className={input} value={String(t[k])} onChange={(e) => setTokens({ [k]: e.target.value } as Partial<typeof t>)}>
                  {values.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            ))}
            <p className="pt-2 text-sm font-medium">Header</p>
            {(["showSearch", "showAccount", "showWishlist", "showCart", "sticky", "showStoreName", "bottomNav"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={config.header[k]} onChange={(e) => update({ ...config, header: { ...config.header, [k]: e.target.checked } })} /> {k.replace(/([A-Z])/g, " $1").toLowerCase()}
              </label>
            ))}
            {(
              [
                ["wordmark", "Text wordmark instead of logo (large-logo header layout)", 40],
                ["logoTagline", "Tagline under the logo (large-logo header layout)", 60],
              ] as const
            ).map(([k, lbl, max]) => (
              <div key={k}>
                <label htmlFor={`hdr-${k}`} className="mb-1 block text-xs font-medium">{lbl}</label>
                <input id={`hdr-${k}`} className={input} maxLength={max} value={config.header[k]} onChange={(e) => update({ ...config, header: { ...config.header, [k]: e.target.value } })} />
              </div>
            ))}
            <Field field={{ kind: "image", key: "logoPath", label: "Logo" }} value={config.header.logoPath} pickers={pickers} onChange={(v) => update({ ...config, header: { ...config.header, logoPath: String(v) } })} />
            <Field field={{ kind: "picker", key: "menuHandle", label: "Main menu", picker: "menu" }} value={config.header.menuHandle} pickers={pickers} onChange={(v) => update({ ...config, header: { ...config.header, menuHandle: String(v) || "main" } })} />
            <p className="pt-2 text-sm font-medium">Product cards</p>
            <div>
              <label htmlFor="pc-ratio" className="mb-1 block text-xs font-medium">Image shape</label>
              <select id="pc-ratio" className={input} value={config.productCard.imageRatio} onChange={(e) => update({ ...config, productCard: { ...config.productCard, imageRatio: e.target.value as typeof config.productCard.imageRatio } })}>
                {["portrait", "tall", "square", "landscape"].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pc-badge" className="mb-1 block text-xs font-medium">Badge style</label>
              <select id="pc-badge" className={input} value={config.productCard.badgeStyle} onChange={(e) => update({ ...config, productCard: { ...config.productCard, badgeStyle: e.target.value as typeof config.productCard.badgeStyle } })}>
                {[["minimal", "Minimal"], ["filled", "Filled"], ["pill", "Pill (% off in green)"]].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pc-offer" className="mb-1 block text-xs font-medium">Offer badge on every card (optional)</label>
              <input id="pc-offer" className={input} maxLength={24} placeholder="e.g. Buy 2 Get 1" value={config.productCard.offerBadge} onChange={(e) => update({ ...config, productCard: { ...config.productCard, offerBadge: e.target.value } })} />
            </div>
            {(["showBrand", "secondImageOnHover", "showBadges", "showComparePrice", "showDiscountPercent", "showQuickAdd", "showRating", "showSizes", "showWishlist"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={config.productCard[k]} onChange={(e) => update({ ...config, productCard: { ...config.productCard, [k]: e.target.checked } })} /> {k.replace(/([A-Z])/g, " $1").toLowerCase()}
              </label>
            ))}
          </div>
        ) : current ? (
          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-sm font-medium">{SECTION_DEFINITIONS[current.type].label}</p>
            <div className="flex gap-4 text-xs">
              {(["desktop", "mobile"] as const).map((d) => (
                <label key={d} className="flex items-center gap-1">
                  <input type="checkbox" checked={current.visibility[d]} onChange={(e) => setSection(current.id, { visibility: { ...current.visibility, [d]: e.target.checked } })} /> Show on {d}
                </label>
              ))}
            </div>
            {(SECTION_DEFINITIONS[current.type].fields as EditorField[]).map((f) =>
              f.showIf && !f.showIf.equals.includes((current.settings as Record<string, unknown>)[f.showIf.key] as string | boolean) ? null : (
                <Field key={f.key} field={f} value={(current.settings as Record<string, unknown>)[f.key]} pickers={pickers} onChange={(v) => setSection(current.id, { settings: { ...(current.settings as Record<string, unknown>), [f.key]: v } })} />
              ),
            )}
          </div>
        ) : (
          <p className="border-t border-border pt-3 text-sm text-muted">Select a section to edit it, or add one.</p>
        )}

        <details className="border-t border-border pt-3 text-sm">
          <summary className="cursor-pointer font-medium">Version history {publishedVersion ? `(live: v${publishedVersion})` : ""}</summary>
          <ul className="mt-2 space-y-2">
            {history.filter((h) => h.status !== "draft").map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 text-xs">
                <span>
                  v{h.version} · {h.label ?? ""} {h.status === "published" ? "(live)" : ""}
                </span>
                {canPublish && h.status !== "published" ? (
                  <form action={rollbackAction} onSubmit={(e) => { if (!confirm(`Roll back your live store to v${h.version}?`)) e.preventDefault(); }}>
                    <input type="hidden" name="versionId" value={h.id} />
                    <button type="submit" disabled={rollingBack} className="text-accent underline">Restore</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      </aside>
    </div>
  );
}
