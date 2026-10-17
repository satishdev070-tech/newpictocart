"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Monitor, Plus, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { inputClassName } from "@/components/ui/field";
import { INDUSTRIES } from "@/features/stores/industries";
import { ThemeMockup } from "../../marketplace/mockup";
import { THEME_STYLES, THEME_STYLE_LABELS, type HomeItem, type MarketplaceTheme, type ThemePreset } from "../../marketplace/types";
import { BUTTON_SHAPES, BUTTON_VARIANTS, CARD_RADII, CONTAINER_WIDTHS, FONT_KEYS, FONT_STACKS, SPACING_SCALES } from "../../schema/tokens";
import { FOOTER_LAYOUTS, HEADER_STYLES } from "../../sections/variants";
import { SECTION_DEFINITIONS } from "../../sections/definitions";
import { ThemeSampleStore } from "@/features/marketing-site/components/theme-sample-store";
import { HOME_SECTION_TYPES, LAYOUT_KEYS, styleFieldsFor } from "../vocabulary";
import { saveThemeAction } from "../actions";
import type { BuiltTheme } from "../schema";

/**
 * Editor for a custom marketplace theme: listing details, design tokens, header/footer chrome and
 * the home-page composition (section order + layout variants), with a live preview. The store
 * theme editor (/dashboard/theme) edits one store's content; this edits the reusable preset.
 */

type Tab = "details" | "design" | "layout" | "photos";
const COLOR_KEYS = ["primary", "secondary", "accent", "background", "text", "border", "sale"] as const;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[8.5rem_1fr] items-center gap-2 text-small">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

function Select<T extends string>({ value, options, onChange, labels }: { value: T | undefined; options: readonly T[]; onChange: (v: T) => void; labels?: Partial<Record<string, string>> }) {
  return (
    <select className={`${inputClassName} h-8 py-0`} value={value ?? ""} onChange={(e) => onChange(e.target.value as T)}>
      {value === undefined ? <option value="">Default</option> : null}
      {options.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? o}
        </option>
      ))}
    </select>
  );
}

const sectionLabel = (type: string) => (SECTION_DEFINITIONS as Record<string, { label: string }>)[type]?.label ?? type;

export function ThemeBuilderEditor({ initial, published }: { initial: BuiltTheme; published: boolean }) {
  const [theme, setTheme] = useState(initial);
  const [tab, setTab] = useState<Tab>("details");
  const [device, setDevice] = useState<"desktop" | "phone" | "page">("desktop");
  const [adding, setAdding] = useState<string>(HOME_SECTION_TYPES[0]!);
  const [state, action] = useActionState(saveThemeAction, null);
  const preset = theme.preset as ThemePreset;
  const dirty = JSON.stringify(theme) !== JSON.stringify(initial);

  const setPreset = (patch: Partial<ThemePreset>) => setTheme((t) => ({ ...t, preset: { ...t.preset, ...patch } as BuiltTheme["preset"] }));
  const setTokens = (patch: Record<string, unknown>) => setPreset({ tokens: { ...preset.tokens, ...patch } as ThemePreset["tokens"] });
  const setHome = (home: HomeItem[]) => setPreset({ home });
  const moveSection = (i: number, d: -1 | 1) => {
    const next = [...preset.home];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    setHome(next);
  };
  const setSetting = (i: number, key: string, value: string | number | boolean | undefined) => {
    const next = preset.home.map((item, n) => {
      if (n !== i) return item;
      const settings = { ...item[1] };
      if (value === undefined || value === "") delete settings[key];
      else settings[key] = value;
      return (item.length === 3 ? [item[0], settings, item[2]] : [item[0], settings]) as HomeItem;
    });
    setHome(next);
  };

  const photos = useMemo(() => {
    const hero = theme.images.filter((i) => i.slot === "hero");
    const rest = theme.images.filter((i) => i.slot !== "hero");
    const seen = new Set<string>();
    return [...hero, ...rest].filter((i) => !seen.has(i.id) && seen.add(i.id)).map((i) => ({ url: `${i.url}${i.url.includes("?") ? "&" : "?"}w=${i.slot === "hero" ? 1600 : 640}`, alt: i.alt }));
  }, [theme.images]);
  const asMarketplace: MarketplaceTheme = { key: theme.key, name: theme.name, tagline: theme.tagline, description: theme.description, industry: theme.industry, style: theme.style, bestFor: theme.bestFor, features: theme.features, demo: null, version: "1.0.0", added: "", preset };

  const tabBtn = (t: Tab, label: string) => (
    <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-small font-medium ${tab === t ? "bg-surface-secondary text-foreground" : "text-muted hover:text-foreground"}`}>
      {label}
    </button>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(320px,400px)_1fr]">
      <div className="space-y-4">
        <form action={action} className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <input type="hidden" name="key" value={theme.key} />
          <input type="hidden" name="theme" value={JSON.stringify(theme)} />
          <FormMessage state={state} success="Saved." />
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="publish" value="keep" variant="secondary" size="sm">
              Save{published ? "" : " draft"}
            </SubmitButton>
            {published ? (
              <SubmitButton name="publish" value="draft" variant="ghost" size="sm">
                Save &amp; unpublish
              </SubmitButton>
            ) : (
              <SubmitButton name="publish" value="publish" size="sm">
                Save &amp; publish
              </SubmitButton>
            )}
          </div>
          <p className="text-caption text-muted">{dirty ? "Unsaved changes." : published ? "Published: sellers can pick this theme." : "Draft: only platform staff can see it."}</p>
        </form>

        <div role="tablist" aria-label="Editor sections" className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {tabBtn("details", "Details")}
          {tabBtn("design", "Design")}
          {tabBtn("layout", "Home page")}
          {tabBtn("photos", "Photos")}
        </div>

        <div role="tabpanel" className="space-y-3 rounded-lg border border-border bg-surface p-4">
          {tab === "details" ? (
            <>
              <Row label="Name">
                <input className={inputClassName} value={theme.name} maxLength={60} onChange={(e) => setTheme({ ...theme, name: e.target.value })} />
              </Row>
              <Row label="Tagline">
                <input className={inputClassName} value={theme.tagline} maxLength={160} onChange={(e) => setTheme({ ...theme, tagline: e.target.value })} />
              </Row>
              <Row label="Category">
                <Select value={theme.industry} options={INDUSTRIES.map((i) => i.slug)} labels={Object.fromEntries(INDUSTRIES.map((i) => [i.slug, i.name]))} onChange={(v) => setTheme({ ...theme, industry: v })} />
              </Row>
              <Row label="Style">
                <Select value={theme.style} options={THEME_STYLES} labels={THEME_STYLE_LABELS} onChange={(v) => setTheme({ ...theme, style: v })} />
              </Row>
              <label className="block text-small">
                <span className="text-muted">Description</span>
                <textarea className={`${inputClassName} mt-1 h-24`} value={theme.description} maxLength={2000} onChange={(e) => setTheme({ ...theme, description: e.target.value })} />
              </label>
              <label className="block text-small">
                <span className="text-muted">Best for (one per line, max 6)</span>
                <textarea className={`${inputClassName} mt-1 h-20`} value={theme.bestFor.join("\n")} onChange={(e) => setTheme({ ...theme, bestFor: e.target.value.split("\n").map((s) => s.slice(0, 40)).filter((s) => s.trim()).slice(0, 6) })} />
              </label>
              <label className="block text-small">
                <span className="text-muted">Features (one per line, max 8)</span>
                <textarea className={`${inputClassName} mt-1 h-24`} value={theme.features.join("\n")} onChange={(e) => setTheme({ ...theme, features: e.target.value.split("\n").map((s) => s.slice(0, 60)).filter((s) => s.trim()).slice(0, 8) })} />
              </label>
              {theme.reference.host || theme.generation ? (
                <p className="text-caption text-muted">
                  {theme.reference.host ? `Style reference: ${theme.reference.host}. ` : ""}
                  {theme.reference.screenshots ? `${theme.reference.screenshots} screenshot(s). ` : ""}
                  {theme.generation ? `Made by ${theme.generation.provider} (${theme.generation.model}). ${theme.generation.notes}` : ""}
                </p>
              ) : null}
            </>
          ) : null}

          {tab === "design" ? (
            <>
              <fieldset className="grid grid-cols-2 gap-2">
                <legend className="mb-1 text-small font-medium">Colours</legend>
                {COLOR_KEYS.map((k) => (
                  <label key={k} className="flex items-center gap-2 text-small">
                    <input type="color" value={preset.tokens.colors[k] ?? "#000000"} onChange={(e) => setTokens({ colors: { ...preset.tokens.colors, [k]: e.target.value } })} className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent" />
                    <span className="capitalize">{k}</span>
                  </label>
                ))}
              </fieldset>
              <Row label="Heading font">
                <Select value={preset.tokens.headingFont as (typeof FONT_KEYS)[number]} options={FONT_KEYS} labels={Object.fromEntries(Object.entries(FONT_STACKS).map(([k, v]) => [k, v.label]))} onChange={(v) => setTokens({ headingFont: v })} />
              </Row>
              <Row label="Body font">
                <Select value={preset.tokens.bodyFont as (typeof FONT_KEYS)[number]} options={FONT_KEYS} labels={Object.fromEntries(Object.entries(FONT_STACKS).map(([k, v]) => [k, v.label]))} onChange={(v) => setTokens({ bodyFont: v })} />
              </Row>
              <Row label="Heading case">
                <Select value={preset.tokens.headingCase as "normal" | "uppercase"} options={["normal", "uppercase"] as const} onChange={(v) => setTokens({ headingCase: v })} />
              </Row>
              <Row label="Buttons">
                <div className="flex gap-2">
                  <Select value={preset.tokens.buttonShape as (typeof BUTTON_SHAPES)[number]} options={BUTTON_SHAPES} onChange={(v) => setTokens({ buttonShape: v })} />
                  <Select value={preset.tokens.buttonVariant as (typeof BUTTON_VARIANTS)[number]} options={BUTTON_VARIANTS} onChange={(v) => setTokens({ buttonVariant: v })} />
                </div>
              </Row>
              <Row label="Card corners">
                <Select value={preset.tokens.cardRadius as (typeof CARD_RADII)[number]} options={CARD_RADII} onChange={(v) => setTokens({ cardRadius: v })} />
              </Row>
              <Row label="Page width">
                <Select value={preset.tokens.containerWidth as (typeof CONTAINER_WIDTHS)[number]} options={CONTAINER_WIDTHS} onChange={(v) => setTokens({ containerWidth: v })} />
              </Row>
              <Row label="Spacing">
                <Select value={preset.tokens.spacing as (typeof SPACING_SCALES)[number]} options={SPACING_SCALES} onChange={(v) => setTokens({ spacing: v })} />
              </Row>
              <Row label="Section titles">
                <Select value={preset.tokens.sectionHeadingAlign as "left" | "center"} options={["left", "center"] as const} onChange={(v) => setTokens({ sectionHeadingAlign: v })} />
              </Row>
              <hr className="border-border" />
              <Row label="Logo">
                <Select value={preset.headerLayout} options={["logo-left", "logo-center"] as const} onChange={(v) => setPreset({ headerLayout: v, inlineMenu: v === "logo-left" ? preset.inlineMenu : false })} />
              </Row>
              <Row label="Header style">
                <Select value={preset.headerStyle} options={HEADER_STYLES.map((h) => h.value)} labels={Object.fromEntries(HEADER_STYLES.map((h) => [h.value, h.label]))} onChange={(v) => setPreset({ headerStyle: v })} />
              </Row>
              <Row label="Menu">
                <Select value={preset.menuStyle ?? "bar"} options={["bar", "drawer"] as const} onChange={(v) => setPreset({ menuStyle: v, inlineMenu: v === "bar" && preset.headerLayout === "logo-left" ? preset.inlineMenu : false })} />
              </Row>
              {preset.headerLayout === "logo-left" && preset.menuStyle !== "drawer" ? (
                <Row label="Menu beside logo">
                  <input type="checkbox" checked={preset.inlineMenu} onChange={(e) => setPreset({ inlineMenu: e.target.checked })} className="size-4" />
                </Row>
              ) : null}
              <Row label="Announcement">
                <Select value={preset.announcementTone as "light" | "dark" | "accent" | "muted"} options={["light", "dark", "accent", "muted"] as const} onChange={(v) => setPreset({ announcementTone: v })} />
              </Row>
              <Row label="Footer">
                <div className="flex gap-2">
                  <Select value={preset.footerTone} options={["dark", "light", "muted"] as const} onChange={(v) => setPreset({ footerTone: v })} />
                  <Select value={preset.footerLayout} options={FOOTER_LAYOUTS.map((f) => f.value)} labels={Object.fromEntries(FOOTER_LAYOUTS.map((f) => [f.value, f.label]))} onChange={(v) => setPreset({ footerLayout: v })} />
                </div>
              </Row>
              <Row label="Hero text">
                <div className="flex gap-2">
                  <Select value={preset.hero.align as "left" | "center" | "right"} options={["left", "center", "right"] as const} onChange={(v) => setPreset({ hero: { ...preset.hero, align: v } })} />
                  <Select value={preset.hero.textTone as "light" | "dark"} options={["light", "dark"] as const} onChange={(v) => setPreset({ hero: { ...preset.hero, textTone: v } })} />
                </div>
              </Row>
              <Row label="Product image">
                <Select value={preset.productCard.imageRatio as "portrait" | "tall" | "square" | "landscape" | undefined} options={["portrait", "tall", "square", "landscape"] as const} onChange={(v) => setPreset({ productCard: { ...preset.productCard, imageRatio: v } })} />
              </Row>
              <Row label="Product text">
                <Select value={preset.productCard.textAlign as "left" | "center" | undefined} options={["left", "center"] as const} onChange={(v) => setPreset({ productCard: { ...preset.productCard, textAlign: v } })} />
              </Row>
            </>
          ) : null}

          {tab === "layout" ? (
            <>
              <ol className="space-y-2">
                {preset.home.map((item, i) => {
                  const [type, settings] = item;
                  const fields = styleFieldsFor(type as (typeof HOME_SECTION_TYPES)[number]).filter((f) => (LAYOUT_KEYS as readonly string[]).includes(f.key));
                  return (
                    <li key={`${type}-${i}`} className="rounded-md border border-border p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-small font-medium">
                          {i + 1}. {sectionLabel(type)}
                        </span>
                        <span className="flex gap-1">
                          <Button type="button" variant="ghost" size="sm" aria-label={`Move ${sectionLabel(type)} up`} disabled={i === 0} onClick={() => moveSection(i, -1)}>
                            <ArrowUp aria-hidden />
                          </Button>
                          <Button type="button" variant="ghost" size="sm" aria-label={`Move ${sectionLabel(type)} down`} disabled={i === preset.home.length - 1} onClick={() => moveSection(i, 1)}>
                            <ArrowDown aria-hidden />
                          </Button>
                          <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${sectionLabel(type)}`} disabled={type === "Hero" && preset.home.filter(([t]) => t === "Hero").length === 1} onClick={() => setHome(preset.home.filter((_, n) => n !== i))}>
                            <Trash2 aria-hidden />
                          </Button>
                        </span>
                      </div>
                      {fields.length ? (
                        <div className="mt-2 grid gap-1.5">
                          {fields.map((f) => (
                            <Row key={f.key} label={f.key}>
                              {f.kind === "enum" ? (
                                <Select value={settings[f.key] as string | undefined} options={f.options} onChange={(v) => setSetting(i, f.key, v)} />
                              ) : f.kind === "number" ? (
                                <input type="number" className={`${inputClassName} h-8`} min={f.min} max={f.max} value={(settings[f.key] as number | undefined) ?? ""} onChange={(e) => setSetting(i, f.key, e.target.value === "" ? undefined : Math.min(f.max, Math.max(f.min, Number(e.target.value))))} />
                              ) : (
                                <input type="checkbox" className="size-4" checked={!!settings[f.key]} onChange={(e) => setSetting(i, f.key, e.target.checked)} />
                              )}
                            </Row>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              <div className="flex gap-2">
                <select aria-label="Section to add" className={`${inputClassName} h-8 py-0`} value={adding} onChange={(e) => setAdding(e.target.value)}>
                  {HOME_SECTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {sectionLabel(t)}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="secondary" size="sm" disabled={preset.home.length >= 24} onClick={() => setHome([...preset.home, [adding, {}]])}>
                  <Plus aria-hidden /> Add
                </Button>
              </div>
            </>
          ) : null}

          {tab === "photos" ? (
            theme.images.length ? (
              <>
                <p className="text-caption text-muted">Sample photos from Unsplash, shown in previews. Sellers&apos; own images replace them; empty slots on a store use its category&apos;s Unsplash photos.</p>
                <ul className="grid grid-cols-3 gap-2">
                  {theme.images.map((img, n) => (
                    <li key={`${img.id}-${n}`} className="space-y-1">
                      {/* eslint-disable-next-line @next/next/no-img-element -- small Unsplash thumbnail, pre-sized */}
                      <img src={`${img.url}${img.url.includes("?") ? "&" : "?"}w=240`} alt={img.alt} loading="lazy" className="aspect-square w-full rounded object-cover" />
                      <p className="truncate text-[11px] text-muted">
                        {img.photographer ? (
                          <a href={img.photographer.url} target="_blank" rel="noopener noreferrer" className="underline">
                            {img.photographer.name}
                          </a>
                        ) : (
                          "Unsplash"
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-small text-muted">No photos yet.</p>
            )
          ) : null}
        </div>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-small font-semibold">Live preview</h2>
          <div className="flex gap-1" role="group" aria-label="Preview size">
            {(
              [
                ["desktop", "Layout", Monitor],
                ["phone", "Phone", Smartphone],
                ["page", "Sample page", Monitor],
              ] as const
            ).map(([d, label, Icon]) => (
              <Button key={d} type="button" size="sm" variant={device === d ? "primary" : "secondary"} aria-pressed={device === d} onClick={() => setDevice(d)}>
                <Icon aria-hidden /> {label}
              </Button>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          {device === "page" ? (
            <div className="max-h-[80vh] overflow-auto">
              <ThemeSampleStore theme={asMarketplace} photos={photos} />
            </div>
          ) : device === "phone" ? (
            <div className="mx-auto w-[390px] max-w-full">
              <ThemeMockup preset={preset} name={theme.name.split(" ")[0] || "Store"} size="phone" />
            </div>
          ) : (
            <ThemeMockup preset={preset} name={theme.name.split(" ")[0] || "Store"} size="large" />
          )}
        </div>
        <p className="text-caption text-muted">The preview shows sample products and photos. The theme recreates a visual style only: no logo, text or images from the reference are used.</p>
      </div>
    </div>
  );
}
