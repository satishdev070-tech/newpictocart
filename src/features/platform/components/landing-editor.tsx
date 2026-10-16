"use client";

/* eslint-disable @next/next/no-img-element -- slide thumbnails are admin-provided URLs */

import { useActionState, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { inputClassName } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  ACCENT_COLORS,
  HIGHLIGHT_COLORS,
  LANDING_ICONS,
  SECTION_LABELS,
  STEP_VISUALS,
  type AccentColor,
  type LandingContent,
  type LandingIcon,
  type SectionKey,
} from "@/features/marketing-site/landing";
import { MENU_ICONS, MENU_TONES, SHARE_LABELS, SHARE_NETWORKS, SOCIAL_KEYS, SOCIAL_LABELS, type MenuIcon, type MenuTone } from "@/features/marketing-site/chrome-content";
import { ACCENT, LandingIconView, tagColor } from "@/features/marketing-site/components/landing-icons";
import { resetLandingAction, saveLandingAction } from "../actions";

/**
 * Super-admin editor for the public landing page (/admin/landing). Edits one JSON document in
 * memory; "Save & publish" sends it to saveLandingAction, which validates it again on the server.
 */

type Tab = "layout" | "header" | SectionKey | "footer" | "seo";
const TABS: { key: Tab; label: string }[] = [
  { key: "layout", label: "Page layout" },
  { key: "header", label: "Header & menu" },
  ...(Object.keys(SECTION_LABELS) as SectionKey[]).map((k) => ({ key: k as Tab, label: SECTION_LABELS[k] })),
  { key: "footer", label: "Footer & WhatsApp" },
  { key: "seo", label: "SEO" },
];

type Link = { label: string; href: string };

export function LandingEditor({ initial, defaults }: { initial: LandingContent; defaults: LandingContent }) {
  const [content, setContent] = useState<LandingContent>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [tab, setTab] = useState<Tab>("layout");
  // Bumped on reset so list editors that keep a local draft re-mount with the new values.
  const [version, setVersion] = useState(0);
  const [state, formAction, pending] = useActionState(async (prev: Awaited<ReturnType<typeof saveLandingAction>> | null, fd: FormData) => {
    const result = await saveLandingAction(prev, fd);
    if (result.ok) setSaved(String(fd.get("content")));
    return result;
  }, null);
  const [resetState, resetAction, resetting] = useActionState(async (prev: Awaited<ReturnType<typeof resetLandingAction>> | null, fd: FormData) => {
    const result = await resetLandingAction(prev, fd);
    if (result.ok) {
      setContent(defaults);
      setSaved(JSON.stringify(defaults));
      setVersion((v) => v + 1);
    }
    return result;
  }, null);
  const json = useMemo(() => JSON.stringify(content), [content]);
  const dirty = json !== saved;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof LandingContent>(key: K, value: LandingContent[K]) => setContent((c) => ({ ...c, [key]: value }));

  return (
    <div className="grid w-full gap-4 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Landing page sections" className="lg:sticky lg:top-4 lg:self-start">
        <ul className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1.5 lg:flex-col lg:overflow-visible">
          {TABS.map((t) => {
            const section = (SECTION_LABELS as Record<string, string>)[t.key] ? content[t.key as SectionKey] : null;
            return (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => setTab(t.key)}
                  aria-current={tab === t.key ? "page" : undefined}
                  className={cn("flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-small whitespace-nowrap", tab === t.key ? "bg-accent-soft font-semibold text-foreground" : "text-muted hover:bg-surface-secondary hover:text-foreground")}
                >
                  {t.label}
                  {section && !section.enabled ? <EyeOff aria-label="Hidden" className="size-3.5 text-subtle" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 space-y-4">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface/95 px-4 py-3 backdrop-blur">
          <p className="text-small text-muted" role="status">
            {dirty ? <span className="font-semibold text-warning">Unsaved changes</span> : "All changes saved. The live page updates within a minute."}
          </p>
          <div className="flex items-center gap-2">
            <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-small hover:bg-surface-secondary">
              View live page <ExternalLink aria-hidden className="size-3.5" />
            </a>
            <form action={formAction}>
              <input type="hidden" name="content" value={json} />
              <Button type="submit" pending={pending} disabled={!dirty}>
                Save & publish
              </Button>
            </form>
          </div>
        </div>
        <FormMessage state={state} success="Saved. The landing page has been updated." />

        <div key={`${tab}-${version}`} className="rounded-lg border border-border bg-surface p-5">
          {tab === "layout" ? <LayoutEditor content={content} setContent={setContent} /> : null}
          {tab === "header" ? <HeaderEditor value={content.header} onChange={(v) => set("header", v)} /> : null}
          {tab === "hero" ? <HeroEditor value={content.hero} onChange={(v) => set("hero", v)} /> : null}
          {tab === "trust" ? (
            <SectionShell enabled={content.trust.enabled} onToggle={(enabled) => set("trust", { ...content.trust, enabled })}>
              <Text label="Title" value={content.trust.title} onChange={(title) => set("trust", { ...content.trust, title })} />
              <Repeater
                label="Scrolling chips"
                items={content.trust.chips}
                max={30}
                onChange={(chips) => set("trust", { ...content.trust, chips })}
                newItem={() => ({ label: "New category", icon: "tag" as LandingIcon, color: "indigo" as AccentColor })}
                itemTitle={(c) => c.label || "Chip"}
                itemIcon={(c) => <IconBadge icon={c.icon} color={c.color} />}
                render={(c, update) => (
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <Text label="Label" value={c.label} onChange={(label) => update({ ...c, label })} max={40} />
                    <IconPicker value={c.icon} onChange={(icon) => update({ ...c, icon })} />
                    <ColorPicker value={c.color} onChange={(color) => update({ ...c, color })} className="sm:col-span-2" />
                  </div>
                )}
              />
            </SectionShell>
          ) : null}
          {tab === "solutions" ? <SolutionsEditor value={content.solutions} onChange={(v) => set("solutions", v)} /> : null}
          {tab === "steps" ? <StepsEditor value={content.steps} onChange={(v) => set("steps", v)} /> : null}
          {tab === "faq" ? <FaqEditor value={content.faq} onChange={(v) => set("faq", v)} /> : null}
          {tab === "features" ? <FeaturesEditor value={content.features} onChange={(v) => set("features", v)} /> : null}
          {tab === "themes" ? (
            <SectionShell enabled={content.themes.enabled} onToggle={(enabled) => set("themes", { ...content.themes, enabled })} note="Theme cards come from the live theme catalogue.">
              <Headings value={content.themes} onChange={(v) => set("themes", { ...content.themes, ...v })} />
              <Field label="Number of themes shown" hint="2 to 8; one theme per business category.">
                <input type="number" min={2} max={8} value={content.themes.count} onChange={(e) => set("themes", { ...content.themes, count: Math.min(8, Math.max(2, Number(e.target.value) || 4)) })} className={cn(inputClassName, "w-28")} />
              </Field>
              <LinkEditor label="Button" value={content.themes.button} onChange={(button) => set("themes", { ...content.themes, button })} />
            </SectionShell>
          ) : null}
          {tab === "categories" ? (
            <SectionShell enabled={content.categories.enabled} onToggle={(enabled) => set("categories", { ...content.categories, enabled })}>
              <Text label="Title" value={content.categories.title} onChange={(title) => set("categories", { ...content.categories, title })} highlight />
              <Area label="Text" value={content.categories.body} onChange={(body) => set("categories", { ...content.categories, body })} />
              <Repeater
                label="Categories"
                items={content.categories.items}
                max={30}
                onChange={(items) => set("categories", { ...content.categories, items })}
                newItem={() => ({ label: "New category", icon: "tag" as LandingIcon, color: "indigo" as AccentColor, href: "", imageUrl: "" })}
                itemTitle={(c) => c.label || "Category"}
                itemIcon={(c) => <IconBadge icon={c.icon} color={c.color} />}
                render={(c, update) => (
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <Text label="Label" value={c.label} onChange={(label) => update({ ...c, label })} max={40} />
                    <IconPicker value={c.icon} onChange={(icon) => update({ ...c, icon })} />
                    <ColorPicker value={c.color} onChange={(color) => update({ ...c, color })} className="sm:col-span-2" />
                    <Text label="Link (optional)" value={c.href} onChange={(href) => update({ ...c, href })} hint="e.g. /themes?category=fashion. Empty = not clickable." />
                    <span className="hidden sm:block" />
                    <Text label="Image (optional)" value={c.imageUrl} onChange={(imageUrl) => update({ ...c, imageUrl })} hint="https:// link, shown above the label. Empty = coloured icon tile." className="sm:col-span-2" />
                  </div>
                )}
              />
            </SectionShell>
          ) : null}
          {tab === "pricing" ? (
            <SectionShell enabled={content.pricing.enabled} onToggle={(enabled) => set("pricing", { ...content.pricing, enabled })} note="Plan cards, prices and limits come from Billing & features → Plans.">
              <Headings value={content.pricing} onChange={(v) => set("pricing", { ...content.pricing, ...v })} />
              <Text label="Line under the plans" value={content.pricing.note} onChange={(note) => set("pricing", { ...content.pricing, note })} />
              <LinkEditor label="Link after that line" value={content.pricing.noteLink} onChange={(noteLink) => set("pricing", { ...content.pricing, noteLink })} />
            </SectionShell>
          ) : null}
          {tab === "testimonials" ? <TestimonialsEditor value={content.testimonials} onChange={(v) => set("testimonials", v)} /> : null}
          {tab === "cta" ? (
            <SectionShell enabled={content.cta.enabled} onToggle={(enabled) => set("cta", { ...content.cta, enabled })}>
              <Text label="Title" value={content.cta.title} onChange={(title) => set("cta", { ...content.cta, title })} highlight />
              <Area label="Text" value={content.cta.body} onChange={(body) => set("cta", { ...content.cta, body })} />
              <LinkEditor label="Button" value={content.cta.button} onChange={(button) => set("cta", { ...content.cta, button })} />
              <Text label="Small note" value={content.cta.note} onChange={(note) => set("cta", { ...content.cta, note })} />
            </SectionShell>
          ) : null}
          {tab === "footer" ? <FooterEditor value={content.footer} onChange={(v) => set("footer", v)} /> : null}
          {tab === "seo" ? (
            <div className="space-y-4">
              <Text label="Page title (browser tab & Google)" value={content.seo.title} onChange={(title) => set("seo", { ...content.seo, title })} max={70} />
              <Area label="Meta description" value={content.seo.description} onChange={(description) => set("seo", { ...content.seo, description })} max={170} />
            </div>
          ) : null}
        </div>

        <form action={resetAction} onSubmit={(e) => (!confirm("Replace all landing page content with the built-in defaults? This can't be undone.") ? e.preventDefault() : undefined)} className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="ghost" size="sm" pending={resetting}>
            <RotateCcw aria-hidden /> Reset everything to defaults
          </Button>
          <FormMessage state={resetState} success="Defaults restored." />
        </form>
      </div>
    </div>
  );
}

// ---- Page layout -----------------------------------------------------------------------

function LayoutEditor({ content, setContent }: { content: LandingContent; setContent: (fn: (c: LandingContent) => LandingContent) => void }) {
  const move = (i: number, d: -1 | 1) =>
    setContent((c) => {
      const order = [...c.order];
      const j = i + d;
      if (j < 0 || j >= order.length) return c;
      [order[i], order[j]] = [order[j]!, order[i]!];
      return { ...c, order };
    });
  const toggle = (key: SectionKey) => setContent((c) => ({ ...c, [key]: { ...c[key], enabled: !c[key].enabled } }));
  return (
    <div>
      <h2 className="text-body font-semibold">Section order and visibility</h2>
      <p className="mt-1 text-small text-muted">Move sections up or down and hide the ones you don&apos;t want. Hidden sections keep their content.</p>
      <ol className="mt-4 divide-y divide-border rounded-md border border-border">
        {content.order.map((key, i) => {
          const on = content[key].enabled;
          return (
            <li key={key} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-6 text-caption text-subtle tabular-nums">{i + 1}</span>
              <span className={cn("flex-1 text-small font-medium", !on && "text-subtle line-through")}>{SECTION_LABELS[key]}</span>
              <IconButton label={`Move ${SECTION_LABELS[key]} up`} onClick={() => move(i, -1)} disabled={i === 0}>
                <ArrowUp />
              </IconButton>
              <IconButton label={`Move ${SECTION_LABELS[key]} down`} onClick={() => move(i, 1)} disabled={i === content.order.length - 1}>
                <ArrowDown />
              </IconButton>
              <button type="button" onClick={() => toggle(key)} aria-pressed={on} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-caption font-medium", on ? "border-success/30 bg-success/10 text-success" : "border-border text-muted")}>
                {on ? <Eye aria-hidden className="size-3.5" /> : <EyeOff aria-hidden className="size-3.5" />}
                {on ? "Shown" : "Hidden"}
              </button>
            </li>
          );
        })}
      </ol>
      <HighlightHelp />
    </div>
  );
}

function HighlightHelp() {
  return (
    <div className="mt-6 rounded-md bg-surface-secondary p-4 text-small text-muted">
      <p className="font-semibold text-foreground">Coloured words in titles</p>
      <p className="mt-1">
        Wrap words like <code className="rounded bg-surface px-1">{"{green:where to sell}"}</code> to colour them. Colours: {HIGHLIGHT_COLORS.join(", ")}. In hero stats, <code className="rounded bg-surface px-1">{"{themes}"}</code> shows the live number of themes.
      </p>
    </div>
  );
}

// ---- Section editors -------------------------------------------------------------------

function HeaderEditor({ value, onChange }: { value: LandingContent["header"]; onChange: (v: LandingContent["header"]) => void }) {
  return (
    <div className="space-y-5">
      <Repeater
        label="Menu links"
        items={value.nav}
        max={8}
        onChange={(nav) => onChange({ ...value, nav })}
        newItem={() => ({ label: "New link", href: "/" })}
        itemTitle={(l) => l.label || "Link"}
        render={(l, update) => <LinkFields value={l} onChange={update} />}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Login label" value={value.loginLabel} onChange={(loginLabel) => onChange({ ...value, loginLabel })} />
        <Text label="Login link" value={value.loginHref} onChange={(loginHref) => onChange({ ...value, loginHref })} />
        <Text label="Button label" value={value.ctaLabel} onChange={(ctaLabel) => onChange({ ...value, ctaLabel })} />
        <Text label="Button link" value={value.ctaHref} onChange={(ctaHref) => onChange({ ...value, ctaHref })} />
      </div>
      <MegaMenuEditor value={value.megaMenu} navLabels={value.nav.map((l) => l.label)} onChange={(megaMenu) => onChange({ ...value, megaMenu })} />
    </div>
  );
}

type MegaMenuValue = LandingContent["header"]["megaMenu"];

function MegaMenuEditor({ value, navLabels, onChange }: { value: MegaMenuValue; navLabels: string[]; onChange: (v: MegaMenuValue) => void }) {
  const triggerId = useId();
  const linked = navLabels.some((l) => l.trim().toLowerCase() === value.trigger.trim().toLowerCase());
  return (
    <fieldset className="space-y-4 rounded-md border border-border p-4">
      <legend className="px-1 text-small font-semibold">Mega menu</legend>
      <label className="flex items-center justify-between gap-4 rounded-md bg-surface-secondary px-4 py-3">
        <span>
          <span className="block text-small font-semibold">Show the mega menu</span>
          <span className="block text-caption text-muted">On desktop the menu link opens a wide panel; on phones it becomes an accordion.</span>
        </span>
        <input type="checkbox" checked={value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} className="size-5 accent-[var(--accent)]" />
      </label>
      <div className={cn("space-y-4", !value.enabled && "opacity-60")}>
        <Field id={triggerId} label="Opens from menu link" hint={linked ? undefined : "No menu link has this label, so the mega menu is not shown."}>
          <select id={triggerId} value={linked ? value.trigger : ""} onChange={(e) => onChange({ ...value, trigger: e.target.value })} className={inputClassName}>
            {linked ? null : <option value="">Choose a menu link</option>}
            {navLabels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Repeater
          label="Columns"
          items={value.columns}
          max={6}
          onChange={(columns) => onChange({ ...value, columns })}
          newItem={() => ({ title: "New column", subtitle: "", tone: "indigo" as MenuTone, items: [] })}
          itemTitle={(c) => c.title || "Column"}
          render={(c, update) => (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_160px]">
                <Text label="Title" value={c.title} onChange={(title) => update({ ...c, title })} hint="Shown in capitals." />
                <Text label="Subtitle" value={c.subtitle} onChange={(subtitle) => update({ ...c, subtitle })} />
                <ToneSelect value={c.tone} onChange={(tone) => update({ ...c, tone })} />
              </div>
              <Repeater
                label="Items"
                items={c.items}
                max={8}
                onChange={(items) => update({ ...c, items })}
                newItem={() => ({ icon: "sparkles" as MenuIcon, title: "New item", body: "", href: "/features" })}
                itemTitle={(it) => it.title || "Item"}
                render={(it, u) => (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MenuIconSelect value={it.icon} onChange={(icon) => u({ ...it, icon })} />
                    <Text label="Title" value={it.title} onChange={(title) => u({ ...it, title })} />
                    <Text label="One-line description" value={it.body} onChange={(body) => u({ ...it, body })} max={120} />
                    <Text label="Link" value={it.href} onChange={(href) => u({ ...it, href })} hint="/features, /themes or https://…" />
                  </div>
                )}
              />
            </div>
          )}
        />
        <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
          <Text label="Bottom bar: bold start" value={value.footerLead} onChange={(footerLead) => onChange({ ...value, footerLead })} />
          <Text label="Bottom bar: text" value={value.footerText} onChange={(footerText) => onChange({ ...value, footerText })} />
        </div>
        <LinkEditor label="Bottom bar link" value={value.footerLink} onChange={(footerLink) => onChange({ ...value, footerLink })} />
      </div>
    </fieldset>
  );
}

function MenuIconSelect({ value, onChange }: { value: MenuIcon; onChange: (v: MenuIcon) => void }) {
  const id = useId();
  return (
    <Field id={id} label="Icon">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as MenuIcon)} className={inputClassName}>
        {MENU_ICONS.map((i) => (
          <option key={i} value={i}>
            {i.replace(/-/g, " ")}
          </option>
        ))}
      </select>
    </Field>
  );
}

function ToneSelect({ value, onChange }: { value: MenuTone; onChange: (v: MenuTone) => void }) {
  const id = useId();
  return (
    <Field id={id} label="Colour">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as MenuTone)} className={inputClassName}>
        {MENU_TONES.map((t) => (
          <option key={t} value={t}>
            {t[0]!.toUpperCase() + t.slice(1)}
          </option>
        ))}
      </select>
    </Field>
  );
}

function HeroEditor({ value, onChange }: { value: LandingContent["hero"]; onChange: (v: LandingContent["hero"]) => void }) {
  return (
    <SectionShell enabled={value.enabled} onToggle={(enabled) => onChange({ ...value, enabled })}>
      <Text label="Small badge above the title" value={value.badge} onChange={(badge) => onChange({ ...value, badge })} />
      <Text label="Title" value={value.titleLead} onChange={(titleLead) => onChange({ ...value, titleLead })} highlight hint="The rotating words are typed after this, in green." />
      <Lines label="Rotating words" value={value.rotatingWords} onChange={(rotatingWords) => onChange({ ...value, rotatingWords })} hint="One per line. Up to 14 characters keeps the title on one line on desktop. Leave empty for a fixed title." />
      <Area label="Text under the title" value={value.body} onChange={(body) => onChange({ ...value, body })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <LinkEditor label="Main button" value={value.primaryCta} onChange={(primaryCta) => onChange({ ...value, primaryCta })} />
        <LinkEditor label="Second link" value={value.secondaryCta} onChange={(secondaryCta) => onChange({ ...value, secondaryCta })} />
      </div>
      <Text label="Live badge text" value={value.liveLabel} onChange={(liveLabel) => onChange({ ...value, liveLabel })} hint="Shown before the stats. Leave empty to hide." />
      <Repeater
        label="Stats"
        items={value.stats}
        max={6}
        onChange={(stats) => onChange({ ...value, stats })}
        newItem={() => ({ icon: "store" as LandingIcon, value: "", label: "" })}
        itemTitle={(s) => `${s.value} ${s.label}`.trim() || "Stat"}
        render={(s, update) => (
          <div className="grid gap-3 sm:grid-cols-[auto_140px_1fr]">
            <IconPicker value={s.icon} onChange={(icon) => update({ ...s, icon })} />
            <Text label="Value" value={s.value} onChange={(v) => update({ ...s, value: v })} hint="e.g. 59 or {themes}" />
            <Text label="Label" value={s.label} onChange={(label) => update({ ...s, label })} />
          </div>
        )}
      />
      <fieldset className="space-y-4 rounded-md border border-border p-4">
        <legend className="px-1 text-small font-semibold">Browser-frame slideshow</legend>
        <p className="text-caption text-muted">Images cross-fade inside the browser frame. With no slides, the single image below is shown; with neither, the showcase themes rotate.</p>
        <Repeater
          label="Slides"
          items={value.slides}
          max={8}
          onChange={(slides) => onChange({ ...value, slides })}
          newItem={() => ({ imageUrl: "", alt: "", caption: "" })}
          itemTitle={(sl) => sl.caption || sl.alt || sl.imageUrl.split("/").pop() || "Slide"}
          itemIcon={(sl) => (sl.imageUrl ? <img src={sl.imageUrl} alt="" className="h-7 w-11 rounded object-cover ring-1 ring-border" /> : null)}
          render={(sl, update) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Text label="Image" value={sl.imageUrl} onChange={(imageUrl) => update({ ...sl, imageUrl })} hint="https:// link or /path. 16:10 screenshots fit best." className="sm:col-span-2" />
              <Text label="Image description (alt text)" value={sl.alt} onChange={(alt) => update({ ...sl, alt })} max={120} />
              <Text label="Caption (optional)" value={sl.caption} onChange={(caption) => update({ ...sl, caption })} max={80} hint="Shown under the frame." />
            </div>
          )}
        />
        <div className="flex flex-wrap items-end gap-6">
          <Field label="Seconds per slide" hint="2 to 20.">
            <input type="number" min={2} max={20} value={value.slideInterval} onChange={(e) => onChange({ ...value, slideInterval: Math.min(20, Math.max(2, Math.round(Number(e.target.value)) || 5)) })} className={cn(inputClassName, "w-28")} />
          </Field>
          <label className="mb-7 inline-flex items-center gap-2 text-small">
            <input type="checkbox" checked={value.autoplay} onChange={(e) => onChange({ ...value, autoplay: e.target.checked })} className="size-4 accent-[var(--accent)]" />
            Play automatically (pauses on hover; off for visitors who prefer reduced motion)
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Single hero image (optional)" value={value.imageUrl} onChange={(imageUrl) => onChange({ ...value, imageUrl })} hint="Used only when there are no slides." />
          <Text label="Image description (alt text)" value={value.imageAlt} onChange={(imageAlt) => onChange({ ...value, imageAlt })} />
        </div>
      </fieldset>
    </SectionShell>
  );
}

function SolutionsEditor({ value, onChange }: { value: LandingContent["solutions"]; onChange: (v: LandingContent["solutions"]) => void }) {
  return (
    <SectionShell enabled={value.enabled} onToggle={(enabled) => onChange({ ...value, enabled })}>
      <Headings value={value} onChange={(v) => onChange({ ...value, ...v })} />
      <Repeater
        label="Cards"
        items={value.items}
        max={16}
        onChange={(items) => onChange({ ...value, items })}
        newItem={() => ({ icon: "sparkles" as LandingIcon, title: "New feature", tag: "", body: "", linkLabel: "Explore this feature", href: "/features", badge: "", color: "auto" as const })}
        itemTitle={(c) => c.title || "Card"}
        itemIcon={(c, i) => <IconBadge icon={c.icon} color={c.color === "auto" ? tagColor(c.tag, i) : c.color} />}
        render={(c, update) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Title" value={c.title} onChange={(title) => update({ ...c, title })} className="sm:col-span-2" />
            <IconPicker value={c.icon} onChange={(icon) => update({ ...c, icon })} />
            <ColorPicker value={c.color} onChange={(color) => update({ ...c, color })} auto />
            <Text label="Small tag" value={c.tag} onChange={(tag) => update({ ...c, tag })} hint="Source, Sell, Design, Channels, Operate or Grow pick a colour automatically." />
            <Text label="Corner badge" value={c.badge} onChange={(badge) => update({ ...c, badge })} hint="e.g. New. Empty = none." />
            <Area label="Text" value={c.body} onChange={(body) => update({ ...c, body })} className="sm:col-span-2" />
            <Text label="Link label" value={c.linkLabel} onChange={(linkLabel) => update({ ...c, linkLabel })} />
            <Text label="Link" value={c.href} onChange={(href) => update({ ...c, href })} />
          </div>
        )}
      />
    </SectionShell>
  );
}

function StepsEditor({ value, onChange }: { value: LandingContent["steps"]; onChange: (v: LandingContent["steps"]) => void }) {
  return (
    <SectionShell enabled={value.enabled} onToggle={(enabled) => onChange({ ...value, enabled })}>
      <Headings value={value} onChange={(v) => onChange({ ...value, ...v })} />
      <Repeater
        label="Steps"
        items={value.items}
        max={8}
        onChange={(items) => onChange({ ...value, items })}
        newItem={() => ({ icon: "sparkles" as LandingIcon, title: "New step", body: "", visual: "none" as const, imageUrl: "", imageAlt: "" })}
        itemTitle={(s) => s.title || "Step"}
        render={(s, update) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <IconSelect value={s.icon} onChange={(icon) => update({ ...s, icon })} />
            <Text label="Title" value={s.title} onChange={(title) => update({ ...s, title })} />
            <Area label="Text" value={s.body} onChange={(body) => update({ ...s, body })} className="sm:col-span-2" />
            <Field label="Illustration">
              <select value={s.visual} onChange={(e) => update({ ...s, visual: e.target.value as typeof s.visual })} className={inputClassName}>
                {STEP_VISUALS.map((v) => (
                  <option key={v} value={v}>
                    {v === "none" ? "None" : `Built-in: ${v}`}
                  </option>
                ))}
              </select>
            </Field>
            <Text label="Or your own image (https:// link)" value={s.imageUrl} onChange={(imageUrl) => update({ ...s, imageUrl })} hint="Replaces the illustration. 4:3 works best." />
            {s.imageUrl ? <Text label="Image description (alt text)" value={s.imageAlt} onChange={(imageAlt) => update({ ...s, imageAlt })} /> : null}
          </div>
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <LinkEditor label="Button under the steps" value={value.cta} onChange={(cta) => onChange({ ...value, cta })} />
        <LinkEditor label="Small link" value={value.link} onChange={(link) => onChange({ ...value, link })} />
      </div>
      <Text label="Note under the button" value={value.note} onChange={(note) => onChange({ ...value, note })} />
    </SectionShell>
  );
}

function FaqEditor({ value, onChange }: { value: LandingContent["faq"]; onChange: (v: LandingContent["faq"]) => void }) {
  return (
    <SectionShell enabled={value.enabled} onToggle={(enabled) => onChange({ ...value, enabled })} note="Questions are also published to Google as FAQ structured data.">
      <Headings value={value} onChange={(v) => onChange({ ...value, ...v })} />
      <Repeater
        label="Questions"
        items={value.items}
        max={20}
        onChange={(items) => onChange({ ...value, items })}
        newItem={() => ({ question: "New question?", answer: "" })}
        itemTitle={(f) => f.question || "Question"}
        render={(f, update) => (
          <div className="space-y-3">
            <Text label="Question" value={f.question} onChange={(question) => update({ ...f, question })} />
            <Area label="Answer" value={f.answer} onChange={(answer) => update({ ...f, answer })} rows={4} />
          </div>
        )}
      />
      <LinkEditor label="Link under the questions" value={value.link} onChange={(link) => onChange({ ...value, link })} />
    </SectionShell>
  );
}

function FeaturesEditor({ value, onChange }: { value: LandingContent["features"]; onChange: (v: LandingContent["features"]) => void }) {
  const h = value.highlight;
  return (
    <SectionShell enabled={value.enabled} onToggle={(enabled) => onChange({ ...value, enabled })}>
      <Headings value={value} onChange={(v) => onChange({ ...value, ...v })} />
      <fieldset className="space-y-3 rounded-md border border-border p-4">
        <legend className="px-1 text-small font-semibold">Large purple card</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <IconSelect value={h.icon} onChange={(icon) => onChange({ ...value, highlight: { ...h, icon } })} />
          <Text label="Title" value={h.title} onChange={(title) => onChange({ ...value, highlight: { ...h, title } })} />
        </div>
        <Area label="Text" value={h.body} onChange={(body) => onChange({ ...value, highlight: { ...h, body } })} />
        <Lines label="Tags" value={h.tags} onChange={(tags) => onChange({ ...value, highlight: { ...h, tags } })} rows={3} />
      </fieldset>
      <Repeater
        label="Feature cards"
        items={value.items}
        max={6}
        onChange={(items) => onChange({ ...value, items })}
        newItem={() => ({ icon: "sparkles" as LandingIcon, title: "New feature", body: "" })}
        itemTitle={(f) => f.title || "Feature"}
        render={(f, update) => (
          <div className="grid gap-3 sm:grid-cols-[160px_1fr_1fr]">
            <IconSelect value={f.icon} onChange={(icon) => update({ ...f, icon })} />
            <Text label="Title" value={f.title} onChange={(title) => update({ ...f, title })} />
            <Text label="Text" value={f.body} onChange={(body) => update({ ...f, body })} />
          </div>
        )}
      />
      <Repeater
        label="Small tiles"
        items={value.mini}
        max={8}
        onChange={(mini) => onChange({ ...value, mini })}
        newItem={() => ({ icon: "sparkles" as LandingIcon, title: "New" })}
        itemTitle={(f) => f.title || "Tile"}
        render={(f, update) => (
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <IconSelect value={f.icon} onChange={(icon) => update({ ...f, icon })} />
            <Text label="Title" value={f.title} onChange={(title) => update({ ...f, title })} />
          </div>
        )}
      />
    </SectionShell>
  );
}

function TestimonialsEditor({ value, onChange }: { value: LandingContent["testimonials"]; onChange: (v: LandingContent["testimonials"]) => void }) {
  return (
    <SectionShell enabled={value.enabled} onToggle={(enabled) => onChange({ ...value, enabled })} note="Only publish real quotes from merchants who agreed to be featured. The section stays hidden while it has no quotes.">
      <Text label="Small badge" value={value.badge} onChange={(badge) => onChange({ ...value, badge })} />
      <Text label="Title" value={value.title} onChange={(title) => onChange({ ...value, title })} highlight />
      <Repeater
        label="Quotes"
        items={value.items}
        max={12}
        onChange={(items) => onChange({ ...value, items })}
        newItem={() => ({ quote: "", name: "", business: "", rating: 5, result: "" })}
        itemTitle={(t) => t.name || "Quote"}
        render={(t, update) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Area label="Quote" value={t.quote} onChange={(quote) => update({ ...t, quote })} className="sm:col-span-2" />
            <Text label="Name" value={t.name} onChange={(name) => update({ ...t, name })} />
            <Text label="Business" value={t.business} onChange={(business) => update({ ...t, business })} hint="e.g. Priya's Boutique • Fashion" />
            <Field label="Stars">
              <select value={t.rating} onChange={(e) => update({ ...t, rating: Number(e.target.value) })} className={inputClassName}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Text label="Result badge" value={t.result} onChange={(result) => update({ ...t, result })} hint="e.g. 3× sales in 2 months" />
          </div>
        )}
      />
    </SectionShell>
  );
}

type FooterLink = LandingContent["footer"]["groups"][number]["links"][number];

function FooterEditor({ value, onChange }: { value: LandingContent["footer"]; onChange: (v: LandingContent["footer"]) => void }) {
  const socials = value.socials;
  const share = value.share;
  return (
    <div className="space-y-5">
      <Area label="Tagline under the links" value={value.tagline} onChange={(tagline) => onChange({ ...value, tagline })} hint="Empty = hidden." />
      <Repeater
        label="Link columns"
        items={value.groups}
        max={5}
        onChange={(groups) => onChange({ ...value, groups })}
        newItem={() => ({ title: "New column", links: [] as FooterLink[] })}
        itemTitle={(g) => g.title || "Column"}
        render={(g, update) => (
          <div className="space-y-3">
            <Text label="Column title" value={g.title} onChange={(title) => update({ ...g, title })} />
            <Repeater
              label="Links"
              items={g.links}
              max={10}
              onChange={(links) => update({ ...g, links })}
              newItem={() => ({ label: "New link", href: "/", highlight: false })}
              itemTitle={(l) => (l.highlight ? `${l.label || "Link"} (highlighted)` : l.label || "Link")}
              render={(l, u) => (
                <div className="space-y-3">
                  <LinkFields value={l} onChange={(v) => u({ ...l, ...v })} />
                  <label className="flex items-center gap-2 text-small">
                    <input type="checkbox" checked={l.highlight} onChange={(e) => u({ ...l, highlight: e.target.checked })} className="size-4 accent-[var(--accent)]" />
                    Highlight this link (purple, bold), e.g. Investors
                  </label>
                </div>
              )}
            />
          </div>
        )}
      />
      <fieldset className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-2">
        <legend className="px-1 text-small font-semibold">Social links (empty = hidden)</legend>
        {SOCIAL_KEYS.map((k) => (
          <Text key={k} label={SOCIAL_LABELS[k]} value={socials[k]} onChange={(v) => onChange({ ...value, socials: { ...socials, [k]: v } })} placeholder="https://" />
        ))}
      </fieldset>
      <fieldset className="space-y-3 rounded-md border border-border p-4">
        <legend className="px-1 text-small font-semibold">Share button</legend>
        <label className="flex items-center justify-between gap-4 rounded-md bg-surface-secondary px-4 py-3">
          <span>
            <span className="block text-small font-semibold">Show the share button</span>
            <span className="block text-caption text-muted">Lets visitors share the page they&apos;re on. Phones also get their own share sheet.</span>
          </span>
          <input type="checkbox" checked={share.enabled} onChange={(e) => onChange({ ...value, share: { ...share, enabled: e.target.checked } })} className="size-5 accent-[var(--accent)]" />
        </label>
        <div className={cn("space-y-3", !share.enabled && "opacity-60")}>
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <Text label="Button label" value={share.label} onChange={(label) => onChange({ ...value, share: { ...share, label } })} />
            <Text label="Share message" value={share.text} onChange={(text) => onChange({ ...value, share: { ...share, text } })} hint="Sent with the link where the network allows it." max={200} />
          </div>
          <div>
            <p className="mb-1.5 text-label">Share options</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {SHARE_NETWORKS.map((n) => (
                <label key={n} className="flex items-center gap-2 text-small">
                  <input
                    type="checkbox"
                    checked={share.networks.includes(n)}
                    onChange={(e) => onChange({ ...value, share: { ...share, networks: SHARE_NETWORKS.filter((x) => (x === n ? e.target.checked : share.networks.includes(x))) } })}
                    className="size-4 accent-[var(--accent)]"
                  />
                  {SHARE_LABELS[n]}
                </label>
              ))}
            </div>
          </div>
        </div>
      </fieldset>
      <fieldset className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-2">
        <legend className="px-1 text-small font-semibold">Floating WhatsApp button</legend>
        <Text label="WhatsApp number" value={value.whatsapp} onChange={(whatsapp) => onChange({ ...value, whatsapp: whatsapp.replace(/[^\d]/g, "") })} hint="Digits with country code, e.g. 919876543210. Empty = no button." />
        <Text label="Pre-filled message" value={value.whatsappMessage} onChange={(whatsappMessage) => onChange({ ...value, whatsappMessage })} />
      </fieldset>
      <Text label="Copyright line" value={value.copyright} onChange={(copyright) => onChange({ ...value, copyright })} hint="The year is added automatically." />
    </div>
  );
}

// ---- Building blocks -------------------------------------------------------------------

function SectionShell({ enabled, onToggle, note, children }: { enabled: boolean; onToggle: (v: boolean) => void; note?: string; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <label className="flex items-center justify-between gap-4 rounded-md bg-surface-secondary px-4 py-3">
        <span>
          <span className="block text-small font-semibold">Show this section</span>
          {note ? <span className="block text-caption text-muted">{note}</span> : null}
        </span>
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="size-5 accent-[var(--accent)]" />
      </label>
      <div className={cn("space-y-5", !enabled && "opacity-60")}>{children}</div>
    </div>
  );
}

function Headings({ value, onChange }: { value: { badge: string; title: string; body: string }; onChange: (v: { badge: string; title: string; body: string }) => void }) {
  return (
    <>
      <Text label="Small badge" value={value.badge} onChange={(badge) => onChange({ ...value, badge })} />
      <Text label="Title" value={value.title} onChange={(title) => onChange({ ...value, title })} highlight />
      <Area label="Text" value={value.body} onChange={(body) => onChange({ ...value, body })} />
    </>
  );
}

function Field({ label, hint, children, className, id }: { label: string; hint?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-label">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-caption text-muted">{hint}</p> : null}
    </div>
  );
}

function Text({ label, value, onChange, hint, max, placeholder, highlight, className }: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode; max?: number; placeholder?: string; highlight?: boolean; className?: string }) {
  const id = useId();
  return (
    <Field id={id} label={label} className={className} hint={hint ?? (highlight ? <>Colour words with {"{purple:…}"}, {"{green:…}"}, {"{orange:…}"} or {"{indigo:…}"}.</> : undefined)}>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} placeholder={placeholder} className={inputClassName} />
    </Field>
  );
}

function Area({ label, value, onChange, hint, max, rows = 2, className }: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode; max?: number; rows?: number; className?: string }) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} className={className}>
      <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} rows={rows} className={inputClassName} />
    </Field>
  );
}

/** One item per line. Keeps a trailing empty line while typing; empty lines are dropped on save. */
function Lines({ label, value, onChange, hint, rows = 5 }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: ReactNode; rows?: number }) {
  const id = useId();
  const [draft, setDraft] = useState(value.join("\n"));
  return (
    <Field id={id} label={label} hint={hint ?? "One per line."}>
      <textarea
        id={id}
        value={draft}
        rows={rows}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(
            e.target.value
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean),
          );
        }}
        className={inputClassName}
      />
    </Field>
  );
}

function IconSelect({ value, onChange }: { value: LandingIcon; onChange: (v: LandingIcon) => void }) {
  const id = useId();
  return (
    <Field id={id} label="Icon">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as LandingIcon)} className={inputClassName}>
        {LANDING_ICONS.map((i) => (
          <option key={i} value={i}>
            {i.replace(/-/g, " ")}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Small coloured icon chip, as the landing page draws it (list thumbnails). */
function IconBadge({ icon, color }: { icon: LandingIcon; color: AccentColor }) {
  return (
    <span className={cn("grid size-7 place-items-center rounded-full", ACCENT[color].chip)}>
      <LandingIconView name={icon} className="size-3.5" />
    </span>
  );
}

/** Visual icon picker: the current icon opens a grid of every LANDING_ICONS entry. */
function IconPicker({ value, onChange }: { value: LandingIcon; onChange: (v: LandingIcon) => void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="relative">
      <p id={id} className="mb-1.5 block text-label">
        Icon
      </p>
      <button type="button" aria-labelledby={id} aria-expanded={open} onClick={() => setOpen((o) => !o)} className={cn(inputClassName, "inline-flex w-auto min-w-40 items-center gap-2 text-left")}>
        <LandingIconView name={value} className="size-4 shrink-0" />
        <span className="flex-1 truncate">{value.replace(/-/g, " ")}</span>
      </button>
      {open ? (
        <div role="group" aria-label="Choose an icon" className="absolute z-20 mt-1 grid w-72 grid-cols-6 gap-1 rounded-md border border-border bg-surface p-2 shadow-lg" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          {LANDING_ICONS.map((name) => (
            <button
              key={name}
              type="button"
              title={name.replace(/-/g, " ")}
              aria-label={name.replace(/-/g, " ")}
              aria-pressed={name === value}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
              className={cn("grid size-10 place-items-center rounded-md hover:bg-surface-secondary", name === value && "bg-accent-soft text-accent ring-1 ring-accent")}
            >
              <LandingIconView name={name} className="size-4" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Swatch radio group over ACCENT_COLORS; `auto` adds a "match the tag" option. */
function ColorPicker<C extends string>({ value, onChange, auto, className }: { value: C; onChange: (v: C) => void; auto?: boolean; className?: string }) {
  const options = [...(auto ? ["auto"] : []), ...ACCENT_COLORS] as C[];
  return (
    <fieldset className={className}>
      <legend className="mb-1.5 block text-label">Colour</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((c) => (
          <label key={c} title={c === "auto" ? "Match the tag" : c} className="cursor-pointer">
            <input type="radio" className="peer sr-only" checked={value === c} onChange={() => onChange(c)} />
            <span className="sr-only">{c === "auto" ? "Match the tag" : c}</span>
            <span
              aria-hidden
              className={cn(
                "grid h-8 min-w-8 place-items-center rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[var(--focus)]",
                c === "auto" ? "border border-dashed border-border-strong px-2.5 text-caption text-muted" : ACCENT[c as AccentColor].swatch,
              )}
            >
              {c === "auto" ? "Auto" : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function LinkFields({ value, onChange }: { value: Link; onChange: (v: Link) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Text label="Label" value={value.label} onChange={(label) => onChange({ ...value, label })} />
      <Text label="Link" value={value.href} onChange={(href) => onChange({ ...value, href })} hint="/pricing, #faq or https://…" />
    </div>
  );
}

function LinkEditor({ label, value, onChange }: { label: string; value: Link; onChange: (v: Link) => void }) {
  return (
    <fieldset className="rounded-md border border-border p-4">
      <legend className="px-1 text-small font-semibold">{label}</legend>
      <LinkFields value={value} onChange={onChange} />
      <p className="mt-2 text-caption text-muted">Empty label = hidden.</p>
    </fieldset>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-secondary hover:text-foreground disabled:opacity-30 [&_svg]:size-4">
      {children}
    </button>
  );
}

function Repeater<T>({
  label,
  items,
  onChange,
  newItem,
  render,
  itemTitle,
  itemIcon,
  max,
}: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  newItem: () => T;
  render: (item: T, update: (v: T) => void) => ReactNode;
  itemTitle: (item: T) => string;
  /** Optional thumbnail before the title (icon chip, image). */
  itemIcon?: (item: T, index: number) => ReactNode;
  max: number;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const update = (i: number, v: T) => onChange(items.map((x, j) => (j === i ? v : x)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
    setOpen((o) => (o === i ? j : o === j ? i : o));
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-label">
          {label} <span className="font-normal text-muted">({items.length}/{max})</span>
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={items.length >= max}
          onClick={() => {
            onChange([...items, newItem()]);
            setOpen(items.length);
          }}
        >
          <Plus aria-hidden /> Add
        </Button>
      </div>
      {items.length ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {items.map((item, i) => (
            <li key={i}>
              <div className="flex items-center gap-1 px-3 py-2">
                {itemIcon ? <span className="mr-1.5 shrink-0">{itemIcon(item, i)}</span> : null}
                <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex-1 truncate rounded py-1 text-left text-small font-medium hover:text-accent">
                  {itemTitle(item)}
                </button>
                <IconButton label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp />
                </IconButton>
                <IconButton label="Move down" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                  <ArrowDown />
                </IconButton>
                <IconButton
                  label="Remove"
                  onClick={() => {
                    onChange(items.filter((_, j) => j !== i));
                    setOpen(null);
                  }}
                >
                  <Trash2 />
                </IconButton>
              </div>
              {open === i ? <div className="border-t border-border bg-surface-secondary/40 p-4">{render(item, (v) => update(i, v))}</div> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-small text-muted">Nothing yet. Select Add.</p>
      )}
    </div>
  );
}
