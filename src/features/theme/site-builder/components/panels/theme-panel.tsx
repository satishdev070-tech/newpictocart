"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronRight, LayoutTemplate, Palette as PaletteIcon, PanelTop, RectangleHorizontal, ShoppingBag, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { assetUrl } from "@/lib/storage/assets";
import { MediaPicker } from "@/features/media/components/media-picker";
import type { ThemeConfig } from "@/features/theme/schema/config";
import { BUTTON_SHAPES, BUTTON_VARIANTS, CARD_RADII, CONTAINER_WIDTHS, FONT_KEYS, FONT_STACKS, LOGO_LIMITS, MENU_FONT_WEIGHTS, MENU_LETTER_SPACINGS, MENU_TEXT_CASES, SPACING_SCALES, type FontKey, type HeaderSettings, type LogoPosition, type MobileLogoPosition, type ProductCardSettings, type ThemeTokens } from "@/features/theme/schema/tokens";
import { AUTO_LOGO_HEIGHT } from "@/features/theme/render/logo-layout";
import { DEFAULT_TYPE_SIZES, TYPE_FONTS, TYPE_LEVELS, TYPE_LEVEL_LABELS, TYPE_WEIGHTS, type TypeLevel, type TypeStyle } from "@/features/theme/schema/site";
import type { MarketplaceTheme } from "@/features/theme/marketplace/types";
import { UNSPLASH_CATEGORIES } from "@/lib/unsplash-categories";
import { useBuilder } from "../../context";
import { applyPalette, applyPresetTokens, COLOR_KEYS, COLOR_LABELS, isPaletteActive, PALETTES } from "../../palettes";
import { ColorInput, Dialog, FieldRow, input, PanelFrame, Toggle } from "../ui";

/**
 * Theme settings (site builder left panel): theme preset, site colours, font styles, buttons &
 * layout, header and product cards. Every change goes through apply() (undoable); rapid edits of
 * one field coalesce into one history step.
 */

type Tab = "preset" | "colors" | "fonts" | "layout" | "header" | "cards";
const TABS: { key: Tab; label: string; hint: string; icon: ReactNode }[] = [
  { key: "preset", label: "Theme preset", hint: "Restyle with a marketplace theme", icon: <LayoutTemplate /> },
  { key: "colors", label: "Site colours", hint: "Palettes and custom colours", icon: <PaletteIcon /> },
  { key: "fonts", label: "Font styles", hint: "Fonts and heading sizes", icon: <Type /> },
  { key: "layout", label: "Buttons & layout", hint: "Buttons, corners, width, spacing", icon: <RectangleHorizontal /> },
  { key: "header", label: "Header", hint: "Logo, icons, sticky bar", icon: <PanelTop /> },
  { key: "cards", label: "Product cards", hint: "Image shape, badges, prices", icon: <ShoppingBag /> },
];

export function ThemePanel() {
  const { setPanel } = useBuilder();
  const [tab, setTab] = useState<Tab | null>(null);
  const current = TABS.find((t) => t.key === tab);

  if (!current) {
    return (
      <PanelFrame title="Theme settings" subtitle="Applies to every page" onClose={() => setPanel(null)}>
        <nav className="space-y-1.5" aria-label="Theme settings">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-left hover:border-border-strong hover:bg-surface-secondary"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent [&_svg]:size-4">{t.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-small font-medium">{t.label}</span>
                <span className="block truncate text-xs text-muted">{t.hint}</span>
              </span>
              <ChevronRight className="size-4 text-muted" />
            </button>
          ))}
        </nav>
      </PanelFrame>
    );
  }

  return (
    <PanelFrame title={current.label} subtitle="Theme settings" onBack={() => setTab(null)} onClose={() => setPanel(null)}>
      {tab === "preset" ? <PresetTab /> : null}
      {tab === "colors" ? <ColorsTab /> : null}
      {tab === "fonts" ? <FontsTab /> : null}
      {tab === "layout" ? <LayoutTab /> : null}
      {tab === "header" ? <HeaderTab /> : null}
      {tab === "cards" ? <CardsTab /> : null}
    </PanelFrame>
  );
}

// -----------------------------------------------------------------------------
// Shared bits
// -----------------------------------------------------------------------------

function Select<T extends string>({ label, value, options, onChange, hint }: { label: string; value: T; options: readonly (T | readonly [T, string])[]; onChange: (v: T) => void; hint?: string }) {
  const id = useId();
  return (
    <FieldRow label={label} htmlFor={id} hint={hint}>
      <select id={id} className={input} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => {
          const [v, l] = typeof o === "string" ? [o, humanize(o)] : o;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </FieldRow>
  );
}

function TextInput({ label, value, onChange, maxLength, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; maxLength: number; placeholder?: string; hint?: string }) {
  const id = useId();
  return (
    <FieldRow label={label} htmlFor={id} hint={hint}>
      <input id={id} className={input} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </FieldRow>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-border pb-4 last:border-b-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

const humanize = (s: string) => {
  const t = s.replace(/([A-Z])/g, " $1").replace(/-/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Token / header / product-card updaters with a coalesce key per field. */
function useThemeSetters() {
  const { config, apply } = useBuilder();
  return {
    config,
    setToken: <K extends keyof ThemeTokens>(k: K, v: ThemeTokens[K]) => apply((c) => ({ ...c, tokens: { ...c.tokens, [k]: v } }), `tokens.${String(k)}`),
    setHeader: <K extends keyof HeaderSettings>(k: K, v: HeaderSettings[K]) => apply((c) => ({ ...c, header: { ...c.header, [k]: v } }), `header.${String(k)}`),
    setCard: <K extends keyof ProductCardSettings>(k: K, v: ProductCardSettings[K]) => apply((c) => ({ ...c, productCard: { ...c.productCard, [k]: v } }), `productCard.${String(k)}`),
  };
}

// -----------------------------------------------------------------------------
// Theme preset
// -----------------------------------------------------------------------------

function PresetTab() {
  const { apply } = useBuilder();
  const [themes, setThemes] = useState<readonly MarketplaceTheme[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<MarketplaceTheme | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    // Loaded on demand: the catalogue is large and only this tab needs it.
    import("@/features/theme/marketplace/catalog")
      .then((m) => live && setThemes(m.MARKETPLACE_THEMES))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!themes) return [];
    return term ? themes.filter((t) => `${t.name} ${t.tagline} ${t.industry} ${t.style}`.toLowerCase().includes(term)) : themes;
  }, [themes, q]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Restyles colours, fonts, buttons, corners and spacing. Your sections, text, images and menus stay as they are. You can undo it.</p>
      <input type="search" className={input} placeholder="Search themes (name, industry, style)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search themes" />
      {failed ? <p className="text-small text-error">Couldn&apos;t load the themes. Reload the page and try again.</p> : null}
      {!themes && !failed ? <p className="text-small text-muted">Loading themes…</p> : null}
      {themes && !shown.length ? <p className="text-small text-muted">No theme matches “{q}”.</p> : null}
      <div className="grid grid-cols-2 gap-2">
        {shown.map((t) => {
          const c = t.preset.tokens.colors;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setPending(t)}
              className={cn("overflow-hidden rounded-lg border bg-surface text-left hover:border-border-strong", applied === t.key ? "border-accent ring-2 ring-accent/30" : "border-border")}
            >
              <div className="flex h-12 items-end gap-1 p-2" style={{ background: c.background }}>
                {[c.primary, c.secondary, c.accent, c.text].map((col, i) => (
                  <span key={i} className="size-4 rounded-full ring-1 ring-black/10" style={{ background: col }} />
                ))}
              </div>
              <div className="px-2 py-1.5">
                <span className="block truncate text-xs font-medium">{t.name}</span>
                <span className="block truncate text-[11px] text-muted">{t.tagline}</span>
              </div>
            </button>
          );
        })}
      </div>
      <Dialog
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending ? `Apply ${pending.name} styles?` : "Apply theme"}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => {
                if (!pending) return;
                apply((cfg: ThemeConfig) => applyPresetTokens(cfg, pending.preset.tokens));
                setApplied(pending.key);
                setPending(null);
              }}
            >
              Apply styles
            </Button>
          </>
        }
      >
        <p className="text-small">
          This changes the colours, fonts, buttons, corners, page width and spacing to match <strong>{pending?.name}</strong>. Your sections and content are not changed, and you can undo it.
        </p>
      </Dialog>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Site colours
// -----------------------------------------------------------------------------

function ColorsTab() {
  const { config, apply } = useBuilder();
  const [custom, setCustom] = useState(false);
  const tokens = config.tokens;
  return (
    <div className="space-y-4">
      <Group title="Palettes">
        <div className="space-y-1.5">
          {PALETTES.map((p) => {
            const active = isPaletteActive(tokens, p);
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={active}
                onClick={() => apply((c) => applyPalette(c, p.colors))}
                className={cn("flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left", active ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-border-strong")}
              >
                <span className="flex overflow-hidden rounded-md ring-1 ring-black/10">
                  {COLOR_KEYS.map((k) => (
                    <span key={k} className="h-6 w-4" style={{ background: p.colors[k] }} title={COLOR_LABELS[k]} />
                  ))}
                </span>
                <span className="flex-1 truncate text-small">{p.name}</span>
                {active ? <Check className="size-4 text-accent" /> : null}
              </button>
            );
          })}
        </div>
      </Group>
      <Group title="Your colours">
        <div className="flex overflow-hidden rounded-md ring-1 ring-black/10">
          {COLOR_KEYS.map((k) => (
            <span key={k} className="h-6 flex-1" style={{ background: tokens.colors[k] }} title={COLOR_LABELS[k]} />
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setCustom((v) => !v)} aria-expanded={custom}>
          {custom ? "Hide custom colours" : "Customize"}
        </Button>
        {custom ? (
          <div className="space-y-2">
            {COLOR_KEYS.map((k) => (
              <ColorInput key={k} label={COLOR_LABELS[k]} value={tokens.colors[k]} onChange={(v) => apply((c) => applyPalette(c, { [k]: v }), `tokens.colors.${k}`)} />
            ))}
          </div>
        ) : null}
      </Group>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Font styles
// -----------------------------------------------------------------------------

const fontName = (k: FontKey) => FONT_STACKS[k].label.split(" (")[0];
const fontHint = (k: FontKey) => FONT_STACKS[k].label.match(/\(([^)]+)\)/)?.[1] ?? "";

/**
 * Font select with a live sample of every option, rendered in that font (a native <select> can't
 * style its options). The list opens inline so the panel's scroll area never clips it. The font
 * files are the storefront's self-hosted ones (app/storefront-fonts.ts), declared on every page,
 * so each one downloads only when its sample is shown.
 */
function FontPicker({ label, value, sample, onChange }: { label: string; value: FontKey; sample: string; onChange: (v: FontKey) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <span id={`${id}-label`} className="block text-xs font-medium">
        {label}
      </span>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => setOpen((o) => !o)}
        className={cn("flex w-full items-center gap-2 rounded-lg border bg-surface px-3 py-2 text-left", open ? "border-accent" : "border-border hover:border-border-strong")}
      >
        <span id={`${id}-value`} className="min-w-0 flex-1">
          <span className="block truncate text-base leading-tight" style={{ fontFamily: FONT_STACKS[value].stack }}>
            {fontName(value)}
          </span>
          <span className="block truncate text-xs text-muted" style={{ fontFamily: FONT_STACKS[value].stack }}>
            {sample}
          </span>
        </span>
        <ChevronRight className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-90")} />
      </button>
      {open ? (
        <ul id={`${id}-list`} aria-labelledby={`${id}-label`} className="max-h-72 space-y-0.5 overflow-y-auto rounded-lg border border-border bg-surface p-1">
          {FONT_KEYS.map((k) => (
            <li key={k}>
              <button
                type="button"
                aria-pressed={k === value}
                onClick={() => {
                  onChange(k);
                  setOpen(false);
                }}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left", k === value ? "bg-accent-soft text-accent" : "hover:bg-surface-secondary")}
              >
                <span className="min-w-0 flex-1" style={{ fontFamily: FONT_STACKS[k].stack }}>
                  <span className="block truncate text-[15px] leading-tight">{fontName(k)}</span>
                  <span className="block truncate text-xs opacity-70">{sample}</span>
                </span>
                <span className="shrink-0 text-[10px] text-muted">{fontHint(k)}</span>
                {k === value ? <Check className="size-3.5 shrink-0" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
const DEFAULT_STYLE: TypeStyle = { size: 0, weight: "default", font: "default", lineHeight: 0 };
const isHeading = (l: TypeLevel) => l.startsWith("h");

function FontsTab() {
  const { config, setToken } = useThemeSetters();
  const { apply } = useBuilder();
  const t = config.tokens;
  const [editing, setEditing] = useState<TypeLevel | null>(null);

  const setLevel = (level: TypeLevel, patch: Partial<TypeStyle>, field: string) =>
    apply((c) => {
      const cur = c.tokens.typography[level] ?? DEFAULT_STYLE;
      return { ...c, tokens: { ...c.tokens, typography: { ...c.tokens.typography, [level]: { ...cur, ...patch } } } };
    }, `tokens.typography.${level}.${field}`);

  return (
    <div className="space-y-4">
      <Group title="Fonts">
        <FontPicker label="Heading font" value={t.headingFont} sample="Handcrafted with love" onChange={(v) => setToken("headingFont", v)} />
        <FontPicker label="Body font" value={t.bodyFont} sample="Free shipping on orders over ₹999" onChange={(v) => setToken("bodyFont", v)} />
        <Select label="Heading case" value={t.headingCase} options={[["normal", "As typed"], ["uppercase", "UPPERCASE"]] as const} onChange={(v) => setToken("headingCase", v)} />
      </Group>
      <Group title="Text styles">
        <ul className="space-y-1.5">
          {TYPE_LEVELS.map((level) => {
            const s = t.typography[level] ?? DEFAULT_STYLE;
            const size = s.size > 0 ? s.size : DEFAULT_TYPE_SIZES[level];
            const fontKey = s.font === "heading" ? t.headingFont : s.font === "body" ? t.bodyFont : isHeading(level) ? t.headingFont : t.bodyFont;
            const changed = s.size > 0 || s.weight !== "default" || s.font !== "default" || s.lineHeight > 0;
            const open = editing === level;
            return (
              <li key={level} className={cn("rounded-lg border bg-surface", open ? "border-accent" : "border-border")}>
                <div className="flex items-center gap-2 px-2.5 py-2">
                  <span
                    className="min-w-0 flex-1 truncate"
                    style={{
                      fontFamily: FONT_STACKS[fontKey].stack,
                      fontSize: Math.min(size, 34),
                      fontWeight: s.weight === "default" ? (isHeading(level) ? 600 : 400) : Number(s.weight),
                      lineHeight: 1.2,
                      textTransform: isHeading(level) && t.headingCase === "uppercase" ? "uppercase" : undefined,
                    }}
                  >
                    {TYPE_LEVEL_LABELS[level]}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {size}px{changed ? " ·" : ""}
                  </span>
                  <button type="button" className="shrink-0 text-xs font-medium text-accent hover:underline" aria-expanded={open} onClick={() => setEditing(open ? null : level)}>
                    {open ? "Done" : "Edit"}
                  </button>
                </div>
                {open ? <TypeEditor level={level} style={s} onChange={(patch, field) => setLevel(level, patch, field)} onReset={() => setLevel(level, DEFAULT_STYLE, "reset")} /> : null}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted">Phones use 80% of the size you set (never below 12px).</p>
      </Group>
    </div>
  );
}

function TypeEditor({ level, style, onChange, onReset }: { level: TypeLevel; style: TypeStyle; onChange: (patch: Partial<TypeStyle>, field: string) => void; onReset: () => void }) {
  const id = useId();
  const shownSize = style.size > 0 ? style.size : DEFAULT_TYPE_SIZES[level];
  const clampSize = (n: number) => (Number.isFinite(n) ? Math.max(10, Math.min(96, Math.round(n))) : 0);
  return (
    <div className="space-y-3 border-t border-border px-2.5 py-3">
      <FieldRow label="Size (px)" htmlFor={`${id}-size`} hint={style.size > 0 ? undefined : "Theme default"}>
        <div className="flex items-center gap-2">
          <input type="range" min={10} max={96} value={shownSize} onChange={(e) => onChange({ size: clampSize(Number(e.target.value)) }, "size")} className="flex-1 accent-accent" aria-label="Size" />
          <input id={`${id}-size`} type="number" min={10} max={96} className={cn(input, "w-20")} value={shownSize} onChange={(e) => onChange({ size: clampSize(Number(e.target.value)) }, "size")} />
        </div>
      </FieldRow>
      <div className="grid grid-cols-2 gap-2">
        <Select label="Weight" value={style.weight} options={TYPE_WEIGHTS.map((w) => [w, w === "default" ? "Theme default" : w] as const)} onChange={(v) => onChange({ weight: v }, "weight")} />
        <Select label="Font" value={style.font} options={TYPE_FONTS.map((f) => [f, f === "default" ? "Theme default" : `${humanize(f)} font`] as const)} onChange={(v) => onChange({ font: v }, "font")} />
      </div>
      <FieldRow label="Line height" htmlFor={`${id}-lh`} hint={style.lineHeight > 0 ? `${(style.lineHeight / 100).toFixed(2)}×` : "Theme default"}>
        <input
          id={`${id}-lh`}
          type="range"
          min={90}
          max={200}
          step={5}
          value={style.lineHeight > 0 ? style.lineHeight : 120}
          onChange={(e) => onChange({ lineHeight: Math.max(90, Math.min(200, Number(e.target.value) || 0)) }, "lineHeight")}
          className="w-full accent-accent"
        />
      </FieldRow>
      <button type="button" onClick={onReset} className="text-xs font-medium text-accent hover:underline">
        Reset to theme default
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Buttons & layout
// -----------------------------------------------------------------------------

function LayoutTab() {
  const { config, setToken } = useThemeSetters();
  const t = config.tokens;
  return (
    <div className="space-y-4">
      <Group title="Buttons">
        <Select label="Button shape" value={t.buttonShape} options={BUTTON_SHAPES} onChange={(v) => setToken("buttonShape", v)} />
        <Select label="Button style" value={t.buttonVariant} options={BUTTON_VARIANTS} onChange={(v) => setToken("buttonVariant", v)} />
      </Group>
      <Group title="Layout">
        <Select label="Card corners" value={t.cardRadius} options={[["none", "Square"], ["sm", "Slightly rounded"], ["md", "Rounded"], ["lg", "Very rounded"]] as const satisfies readonly (readonly [(typeof CARD_RADII)[number], string])[]} onChange={(v) => setToken("cardRadius", v)} />
        <Select label="Page width" value={t.containerWidth} options={CONTAINER_WIDTHS} onChange={(v) => setToken("containerWidth", v)} />
        <Select label="Spacing between sections" value={t.spacing} options={SPACING_SCALES} onChange={(v) => setToken("spacing", v)} />
        <Select label="Section titles" value={t.sectionHeadingAlign} options={[["left", "Left aligned"], ["center", "Centred"]] as const} onChange={(v) => setToken("sectionHeadingAlign", v)} />
        <Select label="Finish" value={t.finish} options={[["standard", "Standard"], ["refined", "Refined (extra polish)"]] as const} onChange={(v) => setToken("finish", v)} hint="Refined adds a finer type scale, spacing and hover states to editorial sections." />
      </Group>
      <Group title="Images">
        <Select
          label="Stock photos for empty image slots"
          value={t.imagery}
          options={[["auto", "Auto (store category)"], ["off", "Off (plain placeholders)"], ...UNSPLASH_CATEGORIES.map((c) => [c, humanize(c)] as const)] as const}
          onChange={(v) => setToken("imagery", v)}
          hint="Photos from Unsplash fill image slots you haven't set yet."
        />
      </Group>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Header
// -----------------------------------------------------------------------------

const HEADER_TOGGLES: [keyof HeaderSettings & ("showSearch" | "showAccount" | "showWishlist" | "showCart" | "sticky" | "showStoreName" | "bottomNav"), string][] = [
  ["showSearch", "Search icon"],
  ["showAccount", "Account icon"],
  ["showWishlist", "Wishlist icon"],
  ["showCart", "Cart icon"],
  ["sticky", "Sticky header"],
  ["showStoreName", "Store name when there's no logo"],
  ["bottomNav", "App-style bottom bar on phones"],
];

/** px slider with readout; 0 = auto (slider shows autoValue, the size the storefront uses today). */
function SizeSlider({ label, value, autoValue, autoLabel = "Auto", limits, onChange }: { label: string; value: number; autoValue: number; autoLabel?: string; limits: { min: number; max: number }; onChange: (v: number) => void }) {
  const id = useId();
  const shown = Math.max(limits.min, Math.min(limits.max, value || autoValue));
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium">
          {label}
        </label>
        <span className="flex items-center gap-2 text-xs tabular-nums">
          {value ? (
            <>
              <span className="font-medium">{value}px</span>
              <button type="button" className="text-accent hover:underline" onClick={() => onChange(0)}>
                Auto
              </button>
            </>
          ) : (
            <span className="text-muted">{autoLabel}</span>
          )}
        </span>
      </div>
      <input id={id} type="range" min={limits.min} max={limits.max} step={2} value={shown} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-accent" />
    </div>
  );
}

/** Small header diagrams for the position buttons: logo = filled block, menu = thin lines. */
function PosIcon({ kind }: { kind: "auto" | "left" | "center" | "center-stacked" | "right" }) {
  const logo = (x: number, y = 5) => <rect x={x} y={y} width="8" height="4" rx="1" fill="currentColor" />;
  const line = (x: number, w: number, y = 7) => <rect x={x} y={y - 0.5} width={w} height="1" rx="0.5" fill="currentColor" opacity="0.55" />;
  return (
    <svg viewBox="0 0 28 14" width="28" height="14" aria-hidden className="shrink-0">
      <rect x="0.5" y="0.5" width="27" height="13" rx="2" fill="none" stroke="currentColor" opacity="0.35" />
      {kind === "auto" ? <text x="14" y="10" textAnchor="middle" fontSize="7" fill="currentColor">A</text> : null}
      {kind === "left" ? <>{logo(3)}{line(14, 11)}</> : null}
      {kind === "right" ? <>{line(3, 11)}{logo(17)}</> : null}
      {kind === "center" ? <>{line(2, 7)}{logo(10)}{line(19, 7)}</> : null}
      {kind === "center-stacked" ? <>{logo(10, 2.5)}{line(6, 16, 10.5)}</> : null}
    </svg>
  );
}

const DESKTOP_POSITIONS = [
  ["auto", "Auto"],
  ["left", "Left"],
  ["center", "Centre"],
  ["center-stacked", "Centre above"],
  ["right", "Right"],
] as const satisfies readonly (readonly [LogoPosition, string])[];
const MOBILE_POSITIONS = [
  ["auto", "Auto"],
  ["left", "Left"],
  ["center", "Centre"],
] as const satisfies readonly (readonly [MobileLogoPosition, string])[];

function Segmented<T extends LogoPosition>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="space-y-1" role="radiogroup" aria-label={`Logo position: ${label}`}>
      <span className="block text-xs font-medium">{label}</span>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-[11px] leading-tight",
              value === v ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground",
            )}
          >
            <PosIcon kind={v} />
            <span className="w-full truncate text-center">{l}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function HeaderTab() {
  const { config, setHeader } = useThemeSetters();
  const { pickers } = useBuilder();
  const h = config.header;
  const logo = assetUrl(h.logoPath);
  const menus = pickers.menu.some((m) => m.value === h.menuHandle) ? pickers.menu : [{ value: h.menuHandle, label: h.menuHandle }, ...pickers.menu];
  return (
    <div className="space-y-4">
      <Group title="Logo">
        <div className="flex items-center gap-2">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- editor thumbnail
            <img src={logo} alt="" className="h-12 max-w-28 rounded-md bg-surface-secondary object-contain ring-1 ring-border" />
          ) : (
            <div className="grid size-12 place-items-center rounded-md bg-surface-secondary text-xs text-muted ring-1 ring-border">Logo</div>
          )}
          <MediaPicker folder="theme" triggerLabel={logo ? "Change" : "Choose logo"} onSelect={([m]) => m && setHeader("logoPath", m.path)} />
          {logo ? (
            <button type="button" className="text-xs text-muted hover:underline" onClick={() => setHeader("logoPath", "")}>
              Remove
            </button>
          ) : null}
        </div>
        {logo ? <TextInput label="Logo alt text" value={h.logoAlt} maxLength={120} onChange={(v) => setHeader("logoAlt", v)} placeholder="Your store name" /> : null}
        <TextInput label="Text wordmark instead of the logo" hint="Large-logo header layout only." value={h.wordmark} maxLength={40} onChange={(v) => setHeader("wordmark", v)} />
        <TextInput label="Tagline under the logo" hint="Large-logo header layout only." value={h.logoTagline} maxLength={60} onChange={(v) => setHeader("logoTagline", v)} />
      </Group>
      <Group title="Logo size">
        <SizeSlider
          label="Width on desktop"
          value={h.logoWidth}
          autoValue={h.logoMaxWidth}
          limits={LOGO_LIMITS.width}
          onChange={(v) => setHeader("logoWidth", v)}
        />
        <SizeSlider
          label="Width on phones"
          value={h.logoWidthMobile}
          autoValue={Math.min(h.logoWidth || h.logoMaxWidth, LOGO_LIMITS.widthMobile.max)}
          autoLabel="Same as desktop (fits the screen)"
          limits={LOGO_LIMITS.widthMobile}
          onChange={(v) => setHeader("logoWidthMobile", v)}
        />
        <SizeSlider
          label="Max height on desktop"
          value={h.logoHeight}
          autoValue={h.logoWidth || h.logoWidthMobile || h.logoHeightMobile ? AUTO_LOGO_HEIGHT.desktop : 56}
          limits={LOGO_LIMITS.height}
          onChange={(v) => setHeader("logoHeight", v)}
        />
        <SizeSlider
          label="Max height on phones"
          value={h.logoHeightMobile}
          autoValue={h.logoWidth || h.logoWidthMobile || h.logoHeight ? AUTO_LOGO_HEIGHT.mobile : 56}
          limits={LOGO_LIMITS.heightMobile}
          onChange={(v) => setHeader("logoHeightMobile", v)}
        />
        <p className="text-xs text-muted">The logo keeps its proportions: if the height limit is reached it stops growing instead of stretching.</p>
      </Group>
      <Group title="Logo position">
        <Segmented
          label="Desktop"
          value={h.logoPosition}
          options={DESKTOP_POSITIONS}
          onChange={(v) => setHeader("logoPosition", v)}
        />
        <Segmented label="Phones and tablets" value={h.mobileLogoPosition} options={MOBILE_POSITIONS} onChange={(v) => setHeader("mobileLogoPosition", v)} />
        <p className="text-xs text-muted">
          Auto follows the Header section&apos;s layout. Centre and Centre above split or stack the header menu: turn on &ldquo;Show menu inside the header&rdquo; in the Header section to see it.
        </p>
      </Group>
      <Group title="Menu">
        <Select label="Main menu" value={h.menuHandle} options={menus.map((m) => [m.value, m.label] as const)} onChange={(v) => setHeader("menuHandle", v || "main")} />
        <Select label="Menu on phones" value={h.mobileMenu} options={[["drawer", "Side drawer"], ["fullscreen", "Full screen"]] as const} onChange={(v) => setHeader("mobileMenu", v)} />
      </Group>
      <Group title="Menu text">
        <SizeSlider label="Text size" value={h.menuFontSize} autoValue={14} limits={{ min: 12, max: 24 }} onChange={(v) => setHeader("menuFontSize", v)} />
        <Select label="Weight" value={h.menuFontWeight} options={[["default", "Theme default"], ["400", "Regular"], ["500", "Medium"], ["600", "Semibold"], ["700", "Bold"], ["800", "Extra bold"]] as const satisfies readonly (readonly [(typeof MENU_FONT_WEIGHTS)[number], string])[]} onChange={(v) => setHeader("menuFontWeight", v)} />
        <Select label="Letter spacing" value={h.menuLetterSpacing} options={[["default", "Theme default"], ["tight", "Tight"], ["normal", "Normal"], ["wide", "Wide"], ["wider", "Wider"]] as const satisfies readonly (readonly [(typeof MENU_LETTER_SPACINGS)[number], string])[]} onChange={(v) => setHeader("menuLetterSpacing", v)} />
        <Select label="Capital letters" value={h.menuTextCase} options={[["default", "Theme default"], ["normal", "Normal"], ["uppercase", "UPPERCASE"]] as const satisfies readonly (readonly [(typeof MENU_TEXT_CASES)[number], string])[]} onChange={(v) => setHeader("menuTextCase", v)} />
        <ColorInput label="Menu colour" allowEmpty value={h.menuTextColor} onChange={(v) => setHeader("menuTextColor", v)} />
      </Group>
      <Group title="Icons and behaviour">
        {HEADER_TOGGLES.map(([k, label]) => (
          <Toggle key={k} label={label} checked={h[k]} onChange={(v) => setHeader(k, v)} />
        ))}
      </Group>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Product cards
// -----------------------------------------------------------------------------

const CARD_TOGGLES: [keyof ProductCardSettings & ("showBrand" | "secondImageOnHover" | "showBadges" | "showComparePrice" | "showDiscountPercent" | "showQuickAdd" | "showRating" | "showSizes" | "showWishlist"), string][] = [
  ["showBrand", "Brand above the title"],
  ["secondImageOnHover", "Second image on hover"],
  ["showBadges", "Badges (new, sale, sold out)"],
  ["showComparePrice", "Compare-at price"],
  ["showDiscountPercent", "Discount percentage"],
  ["showQuickAdd", "Quick add button"],
  ["showRating", "Star rating"],
  ["showSizes", "Size chips"],
  ["showWishlist", "Wishlist heart"],
];

function CardsTab() {
  const { config, setCard } = useThemeSetters();
  const p = config.productCard;
  return (
    <div className="space-y-4">
      <Group title="Look">
        <Select label="Image shape" value={p.imageRatio} options={[["portrait", "Portrait (3:4)"], ["tall", "Tall (2:3)"], ["square", "Square"], ["landscape", "Landscape (4:3)"]] as const} onChange={(v) => setCard("imageRatio", v)} />
        <Select label="Text alignment" value={p.textAlign} options={[["left", "Left"], ["center", "Centred"]] as const} onChange={(v) => setCard("textAlign", v)} />
        <Select label="Badge style" value={p.badgeStyle} options={[["minimal", "Minimal"], ["filled", "Filled"], ["pill", "Pill (% off in green)"]] as const} onChange={(v) => setCard("badgeStyle", v)} />
        <TextInput label="Offer badge on every card (optional)" value={p.offerBadge} maxLength={24} placeholder="e.g. Buy 2 Get 1" onChange={(v) => setCard("offerBadge", v)} />
      </Group>
      <Group title="Show on cards">
        {CARD_TOGGLES.map(([k, label]) => (
          <Toggle key={k} label={label} checked={p[k]} onChange={(v) => setCard(k, v)} />
        ))}
      </Group>
    </div>
  );
}
