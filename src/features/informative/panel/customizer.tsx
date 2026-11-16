"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Monitor, RotateCcw, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClassName } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions/result";
import { cn } from "@/lib/cn";
import { saveCustomizerAction } from "../actions";
import { SECTION_TYPES, type SectionType } from "../sections";
import { moveItem, newSectionId, resetLayout, type LayoutEntry } from "../site/customize";
import { contrastAdvice } from "../themes/color";
import { FONT_PAIRS } from "../themes/fonts";
import { PublishForm } from "./publish-form";
import { SECTION_LABELS } from "./section-editor";
import { ImageField } from "./ui";

export type CustomizerTheme = { id: string; name: string; bestFor: string; primary: string; secondary: string; background: string; defaultSections: SectionType[] };

export type CustomizerInitial = {
  themeId: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  fontPair: string | null;
  logoPath: string | null;
  faviconPath: string | null;
  heroImagePath: string | null;
  ctaLabel: string;
  heroHeading: string;
  heroSubheading: string;
  layout: LayoutEntry[];
};

const DEVICE_WIDTH = { desktop: 1280, mobile: 390 } as const;
type Device = keyof typeof DEVICE_WIDTH;
/** Sections a seller can add from the Customizer (text blocks are added in Pages, where their text is edited). */
const ADDABLE: readonly SectionType[] = SECTION_TYPES.filter((t) => t !== "rich_text");

/** Renders the site at a real device width and scales it into the column (same as the store editor). */
function ScaledFrame({ src, device, onLoad }: { src: string; device: Device; onLoad: () => void }) {
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
    <div ref={box} className="relative h-[70vh] w-full overflow-hidden rounded-lg border border-border bg-surface-secondary lg:h-[calc(100dvh-12rem)]">
      {size.w ? (
        <iframe
          src={src}
          onLoad={onLoad}
          title={`Website preview (${device})`}
          className="absolute top-0 left-1/2 origin-top border-0 bg-white shadow-sm"
          style={{ width, height: size.h / scale, transform: `translateX(-50%) scale(${scale})` }}
        />
      ) : null}
    </div>
  );
}

function Group({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-lg border border-border bg-surface">
      <summary className="cursor-pointer list-none px-4 py-3 text-small font-semibold select-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between">
          {title}
          <ArrowDown aria-hidden className="size-4 text-muted transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="space-y-4 border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}

const fmt = (n: number) => `${n.toFixed(1)}:1`;

/** Contrast check for a brand colour (button fill with white / dark text, and as text on the page). */
function ContrastNote({ color, background }: { color: string; background: string }) {
  const a = contrastAdvice(color, background);
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <span className="rounded-md px-2.5 py-1 text-small font-semibold text-white" style={{ background: color }}>
          Aa <span className="font-normal">{fmt(a.withLight)}</span>
        </span>
        <span className="rounded-md px-2.5 py-1 text-small font-semibold text-[#111111]" style={{ background: color }}>
          Aa <span className="font-normal">{fmt(a.withDark)}</span>
        </span>
      </div>
      {!a.ok ? (
        <p className="text-caption text-warning" role="status">
          Neither white nor dark text is easy to read on this colour. Your site will use a slightly darker shade for buttons.
        </p>
      ) : !a.okAsText ? (
        <p className="text-caption text-muted">Buttons read well. Links in this colour will be darkened a little so they stay readable.</p>
      ) : (
        <p className="text-caption text-muted">Readable with {a.bestText === "light" ? "white" : "dark"} text.</p>
      )}
    </div>
  );
}

function ColorInput({ label, value, onChange, background }: { label: string; value: string; onChange: (v: string) => void; background: string }) {
  const id = `cz-${label.toLowerCase()}`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-small font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-14 cursor-pointer rounded-md border border-border bg-surface" />
        <input
          aria-label={`${label} colour code`}
          value={value}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v.toLowerCase());
          }}
          className={cn(inputClassName, "w-28 font-mono text-small")}
        />
      </div>
      <ContrastNote color={value} background={background} />
    </div>
  );
}

/**
 * Informative Website Customizer: controls on the left, live preview on the right. Every change
 * re-renders the preview iframe with the unsaved state; "Save changes" writes it (theme.edit, plus
 * content.write for the home layout and hero text). Publishing stays a separate step.
 */
export function Customizer({
  initial,
  images,
  themes,
  canEditContent,
  homeHasSections,
  storedSectionIds,
  placeholders,
  status,
  canPublish,
  liveUrl,
}: {
  initial: CustomizerInitial;
  images: { logo: string | null; favicon: string | null; hero: string | null };
  themes: CustomizerTheme[];
  canEditContent: boolean;
  homeHasSections: boolean;
  storedSectionIds: string[];
  placeholders: { heading: string; subheading: string; ctaLabel: string };
  status: "DRAFT" | "PUBLISHED";
  canPublish: boolean;
  liveUrl: string;
}) {
  const router = useRouter();
  const [themeId, setThemeId] = useState(initial.themeId);
  const theme = themes.find((t) => t.id === themeId) ?? themes[0]!;
  const [custom, setCustom] = useState(Boolean(initial.primaryColor || initial.secondaryColor));
  const [primary, setPrimary] = useState(initial.primaryColor ?? theme.primary.toLowerCase());
  const [secondary, setSecondary] = useState(initial.secondaryColor ?? theme.secondary.toLowerCase());
  const [fontPair, setFontPair] = useState(initial.fontPair ?? "");
  const [logoPath, setLogoPath] = useState(initial.logoPath ?? "");
  const [faviconPath, setFaviconPath] = useState(initial.faviconPath ?? "");
  const [heroImagePath, setHeroImagePath] = useState(initial.heroImagePath ?? "");
  const [ctaLabel, setCtaLabel] = useState(initial.ctaLabel);
  const [heroHeading, setHeroHeading] = useState(initial.heroHeading);
  const [heroSubheading, setHeroSubheading] = useState(initial.heroSubheading);
  const [layout, setLayout] = useState<LayoutEntry[]>(initial.layout);
  const [layoutTouched, setLayoutTouched] = useState(false);
  const [adding, setAdding] = useState<SectionType>(ADDABLE.find((t) => !initial.layout.some((e) => e.type === t)) ?? "cta");
  const [device, setDevice] = useState<Device>("desktop");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const draft = useMemo(
    () => ({
      themeId,
      primaryColor: custom ? primary : "",
      secondaryColor: custom ? secondary : "",
      fontPair,
      logoPath,
      faviconPath,
      heroImagePath,
      ctaLabel,
      heroHeading: canEditContent ? heroHeading : undefined,
      heroSubheading: canEditContent ? heroSubheading : undefined,
      home: canEditContent ? layout : undefined,
    }),
    [themeId, custom, primary, secondary, fontPair, logoPath, faviconPath, heroImagePath, ctaLabel, heroHeading, heroSubheading, layout, canEditContent],
  );
  const draftJson = JSON.stringify(draft);
  const [saved, setSaved] = useState(draftJson);
  const dirty = draftJson !== saved;

  // Preview follows the unsaved state, debounced so typing doesn't reload the frame on every key.
  const [src, setSrc] = useState(`/informative/customize-preview?c=${encodeURIComponent(draftJson)}`);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const next = `/informative/customize-preview?c=${encodeURIComponent(draftJson)}`;
    if (next === src) return;
    const t = setTimeout(() => {
      setLoading(true);
      setSrc(next);
    }, 600);
    return () => clearTimeout(t);
  }, [draftJson, src]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const editLayout = (fn: (l: LayoutEntry[]) => LayoutEntry[]) => {
    setLayout(fn);
    setLayoutTouched(true);
  };

  function pickTheme(id: string) {
    setThemeId(id);
    const t = themes.find((x) => x.id === id);
    if (!t) return;
    if (!custom) {
      setPrimary(t.primary.toLowerCase());
      setSecondary(t.secondary.toLowerCase());
    }
    // A home page that still uses the design's default sections follows the new design.
    if (!homeHasSections && !layoutTouched) setLayout(t.defaultSections.map((type, i) => ({ id: `${type}-${i}`, type, visible: true })));
  }

  function resetToDefaults() {
    setCustom(false);
    setPrimary(theme.primary.toLowerCase());
    setSecondary(theme.secondary.toLowerCase());
    setFontPair("");
    if (canEditContent) editLayout((l) => resetLayout(theme.defaultSections, l));
    setNotice(`Colours, fonts${canEditContent ? " and home sections" : ""} are back to ${theme.name}'s defaults. Your text and images are kept. Save to keep this.`);
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    const r = await saveCustomizerAction(draft);
    setSaving(false);
    setResult(r);
    if (r.ok) {
      setSaved(draftJson);
      router.refresh();
    }
  }

  const stored = new Set(storedSectionIds);
  const missing = ADDABLE.filter((t) => !layout.some((e) => e.type === t));
  const hasHero = layout.some((e) => e.type === "hero");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(320px,400px)_1fr]">
      <div className="space-y-3 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto lg:pr-1">
        <Group title="Design">
          <ul className="grid grid-cols-2 gap-2">
            {themes.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => pickTheme(t.id)}
                  aria-pressed={themeId === t.id}
                  className={cn("block w-full overflow-hidden rounded-md border text-left focus-visible:outline-2 focus-visible:outline-accent", themeId === t.id ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-border-strong")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- static thumbnail */}
                  <img src={`/informative/themes/${t.id}.webp`} alt="" width={320} height={200} loading="lazy" className="aspect-[8/5] w-full object-cover" />
                  <span className="block px-2 py-1.5 text-caption font-semibold">{t.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-caption text-muted">{theme.bestFor}. Your services, pages and photos stay the same in every design.</p>
        </Group>

        <Group title="Colours">
          <label className="flex items-center gap-2 text-small">
            <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} className="size-4" />
            Use my own brand colours
          </label>
          {custom ? (
            <div className="space-y-5">
              <ColorInput label="Primary" value={primary} onChange={setPrimary} background={theme.background} />
              <ColorInput label="Secondary" value={secondary} onChange={setSecondary} background={theme.background} />
            </div>
          ) : (
            <p className="text-caption text-muted">Using {theme.name}&apos;s own colours.</p>
          )}
        </Group>

        <Group title="Fonts">
          <label htmlFor="cz-font" className="block text-small font-medium">
            Font pair (headings + text)
          </label>
          <select id="cz-font" value={fontPair} onChange={(e) => setFontPair(e.target.value)} className={inputClassName}>
            <option value="">The design&apos;s own fonts</option>
            {FONT_PAIRS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Group>

        <Group title="Logo and favicon" open={false}>
          <ImageField name="logoPath" label="Logo" initialPath={initial.logoPath} initialUrl={images.logo} onChange={(p) => setLogoPath(p)} />
          <ImageField name="faviconPath" label="Favicon" initialPath={initial.faviconPath} initialUrl={images.favicon} hint="Square image, at least 64×64. Shown in browser tabs." onChange={(p) => setFaviconPath(p)} />
        </Group>

        <Group title="Hero banner" open={false}>
          <ImageField name="heroImagePath" label="Hero image" initialPath={initial.heroImagePath} initialUrl={images.hero} hint="Wide photo, at least 1600 px across." onChange={(p) => setHeroImagePath(p)} />
          {canEditContent ? (
            <>
              <div>
                <label htmlFor="cz-heading" className="mb-1.5 block text-small font-medium">
                  Heading
                </label>
                <input id="cz-heading" value={heroHeading} maxLength={120} onChange={(e) => setHeroHeading(e.target.value)} placeholder={placeholders.heading} disabled={!hasHero} className={inputClassName} />
              </div>
              <div>
                <label htmlFor="cz-sub" className="mb-1.5 block text-small font-medium">
                  Subheading
                </label>
                <textarea id="cz-sub" value={heroSubheading} maxLength={240} rows={2} onChange={(e) => setHeroSubheading(e.target.value)} placeholder={placeholders.subheading} disabled={!hasHero} className={inputClassName} />
              </div>
              {!hasHero ? <p className="text-caption text-muted">Add the “{SECTION_LABELS.hero}” section below to edit its text.</p> : null}
            </>
          ) : (
            <p className="text-caption text-muted">Your role can&apos;t edit page text, so the hero heading is managed by the owner.</p>
          )}
          <div>
            <label htmlFor="cz-cta" className="mb-1.5 block text-small font-medium">
              Button label
            </label>
            <input id="cz-cta" value={ctaLabel} maxLength={40} onChange={(e) => setCtaLabel(e.target.value)} placeholder={placeholders.ctaLabel} className={inputClassName} />
            <p className="mt-1 text-caption text-muted">Used on the main buttons across your website. Leave empty for “{placeholders.ctaLabel}”.</p>
          </div>
        </Group>

        <Group title="Home page sections" open={false}>
          {canEditContent ? (
            <>
              <ol className="space-y-2">
                {layout.map((e, i) => (
                  <li key={e.id} className={cn("flex items-center gap-2 rounded-md border border-border px-3 py-2", !e.visible && "bg-surface-secondary")}>
                    <label className="flex min-w-0 flex-1 items-center gap-2 text-small">
                      <input
                        type="checkbox"
                        checked={e.visible}
                        onChange={(ev) => editLayout((l) => l.map((x) => (x.id === e.id ? { ...x, visible: ev.target.checked } : x)))}
                        className="size-4"
                        aria-label={`Show ${SECTION_LABELS[e.type]}`}
                      />
                      <span className={cn("truncate", !e.visible && "text-muted line-through")}>{SECTION_LABELS[e.type]}</span>
                    </label>
                    <Button type="button" variant="ghost" size="sm" disabled={i === 0} onClick={() => editLayout((l) => moveItem(l, i, -1))} aria-label={`Move ${SECTION_LABELS[e.type]} up`}>
                      <ArrowUp aria-hidden className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={i === layout.length - 1} onClick={() => editLayout((l) => moveItem(l, i, 1))} aria-label={`Move ${SECTION_LABELS[e.type]} down`}>
                      <ArrowDown aria-hidden className="size-4" />
                    </Button>
                    {!stored.has(e.id) ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => editLayout((l) => l.filter((x) => x.id !== e.id))} aria-label={`Remove ${SECTION_LABELS[e.type]}`}>
                        <X aria-hidden className="size-4" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ol>
              {missing.length ? (
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label htmlFor="cz-add" className="mb-1.5 block text-small font-medium">
                      Add a section
                    </label>
                    <select id="cz-add" value={missing.includes(adding) ? adding : missing[0]} onChange={(e) => setAdding(e.target.value as SectionType)} className={inputClassName}>
                      {missing.map((t) => (
                        <option key={t} value={t}>
                          {SECTION_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const type = missing.includes(adding) ? adding : missing[0]!;
                      editLayout((l) => [...l, { id: newSectionId(type, l.map((x) => x.id)), type, visible: true }]);
                    }}
                  >
                    Add
                  </Button>
                </div>
              ) : null}
              <p className="text-caption text-muted">Sections with nothing to show yet (for example an empty gallery) stay hidden on your website. Edit section text in Pages → Home.</p>
            </>
          ) : (
            <p className="text-caption text-muted">Your role can&apos;t change page content, so the home page layout is managed by the owner.</p>
          )}
        </Group>

        <div className="sticky bottom-0 space-y-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
          {notice ? (
            <p className="text-small text-muted" role="status">
              {notice}
            </p>
          ) : null}
          <FormMessage state={result} success={status === "PUBLISHED" ? "Saved. Your live website now shows these changes." : "Saved. Publish when you're ready."} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={save} pending={saving} disabled={!dirty || saving}>
              Save changes
            </Button>
            <Button type="button" variant="ghost" onClick={resetToDefaults}>
              <RotateCcw aria-hidden className="size-4" />
              Reset to design defaults
            </Button>
          </div>
          <p className="text-caption text-muted">
            {dirty ? "Unsaved changes: the preview shows them, your website doesn't yet." : "All changes saved."}
            {status === "PUBLISHED" ? " Your website is live, so saving updates it straight away." : " Your website is a private draft."}
          </p>
          {canPublish && status === "DRAFT" ? (
            dirty ? (
              <p className="text-caption text-muted">Save your changes before publishing.</p>
            ) : (
              <PublishForm status={status} />
            )
          ) : null}
        </div>
      </div>

      <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Preview size">
            {(["desktop", "mobile"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                aria-pressed={device === d}
                className={cn("inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-small", device === d ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:text-foreground")}
              >
                {d === "desktop" ? <Monitor aria-hidden className="size-4" /> : <Smartphone aria-hidden className="size-4" />}
                {d === "desktop" ? "Desktop" : "Mobile"}
              </button>
            ))}
          </div>
          <span className="text-caption text-muted" aria-live="polite">
            {loading ? "Updating preview…" : dirty ? "Preview (unsaved changes)" : "Preview"}
          </span>
          <span className="flex gap-3 text-caption">
            <a href="/informative/site-preview" target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
              Full preview
            </a>
            {status === "PUBLISHED" ? (
              <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
                View live site
              </a>
            ) : null}
          </span>
        </div>
        <ScaledFrame src={src} device={device} onLoad={() => setLoading(false)} />
      </div>
    </div>
  );
}
