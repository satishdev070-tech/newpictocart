"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ThemeConfig } from "@/features/theme/schema/config";
import { BUILTIN_PAGES, LINK_TYPES, LINK_TYPE_LABELS, themeLinkSchema, type LinkType, type ThemeLink } from "@/features/theme/schema/links";
import { isSafeHref } from "@/features/theme/schema/primitives";
import { SECTION_DEFINITIONS } from "@/features/theme/sections/definitions";
import type { SectionInstance } from "@/features/theme/sections/types";
import type { EditorPickers } from "@/features/theme/server/queries";
import { useBuilder } from "../context";
import { Dialog, FieldRow, input } from "./ui";

/**
 * "Update menu" dialog: pick what a link opens (type list on the left, the matching picker on the
 * right), where it opens (tab, section of the target page) and its name. Reusable for any
 * ThemeLink (menu items, section buttons): pass `showTitle={false}` when there is no name.
 */

type Option = { value: string; label: string };
type Picked = { title: string; link: ThemeLink; highlight?: boolean };

export const EMPTY_LINK: ThemeLink = { type: "none", ref: "", url: "", anchor: "", newTab: false };

export function LinkDialog({
  open,
  onClose,
  initial,
  onSave,
  title = "Update menu",
  showTitle = true,
  titleLabel = "Menu name",
  showHighlight = false,
}: {
  open: boolean;
  onClose: () => void;
  initial: Picked;
  onSave: (title: string, link: ThemeLink, extra: { highlight: boolean }) => void;
  title?: string;
  showTitle?: boolean;
  titleLabel?: string;
  /** Show the "Highlight this item" checkbox (menu items). */
  showHighlight?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} wide>
      {/* Dialog renders children only while open, so the form state starts fresh on every open. */}
      <LinkForm initial={initial} onClose={onClose} onSave={onSave} showTitle={showTitle} titleLabel={titleLabel} showHighlight={showHighlight} />
    </Dialog>
  );
}

/** Sections of the page a link points at, as anchor options (`s-<sectionId>`). */
function sectionAnchors(config: ThemeConfig, link: ThemeLink): Option[] | null {
  let list: SectionInstance[] | null = null;
  if (link.type === "home") list = config.templates.home;
  else if (link.type === "page" && link.ref.startsWith("theme:")) list = config.pages.find((p) => p.handle === link.ref.slice(6))?.sections ?? null;
  if (!list) return null;
  return list.map((s, i) => {
    const heading = (s.settings as { heading?: unknown }).heading;
    const label = SECTION_DEFINITIONS[s.type].label;
    return { value: `s-${s.id}`, label: `${i + 1}. ${label}${typeof heading === "string" && heading ? ` — ${heading}` : ""}` };
  });
}

function pageOptions(config: ThemeConfig, pickers: EditorPickers): { label: string; options: Option[] }[] {
  return [
    { label: "Site builder pages", options: config.pages.map((p) => ({ value: `theme:${p.handle}`, label: p.title })) },
    { label: "Content pages", options: pickers.page },
    { label: "Store pages", options: Object.entries(BUILTIN_PAGES).map(([k, v]) => ({ value: `builtin:${k}`, label: v.label })) },
  ].filter((g) => g.options.length > 0);
}

function LinkForm({
  initial,
  onClose,
  onSave,
  showTitle,
  titleLabel,
  showHighlight,
}: {
  initial: Picked;
  onClose: () => void;
  onSave: (title: string, link: ThemeLink, extra: { highlight: boolean }) => void;
  showTitle: boolean;
  titleLabel: string;
  showHighlight: boolean;
}) {
  const { config, pickers } = useBuilder();
  const [link, setLink] = useState<ThemeLink>({ ...EMPTY_LINK, ...initial.link });
  const [name, setName] = useState(initial.title);
  const [highlight, setHighlight] = useState(initial.highlight ?? false);
  const anchors = useMemo(() => sectionAnchors(config, link), [config, link]);
  const anchorIsSection = !!anchors?.some((a) => a.value === link.anchor);
  const [advanced, setAdvanced] = useState(!!link.anchor && !anchorIsSection);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ids = { name: useId(), ref: useId(), url: useId(), tag: useId(), target: useId(), where: useId(), anchor: useId(), hl: useId() };

  const patch = (p: Partial<ThemeLink>) => {
    setLink((l) => ({ ...l, ...p }));
    setErrors({});
  };
  const pickType = (type: LinkType) => {
    if (type === link.type) return;
    patch({ type, ref: "", url: type === "url" ? link.url : "", anchor: "" });
  };

  const save = () => {
    const next: Record<string, string> = {};
    const r = themeLinkSchema.safeParse(link);
    if (!r.success) for (const i of r.error.issues) next[String(i.path[0] ?? "link")] ??= i.message;
    const t = name.trim();
    if (showTitle && !t) next.title = "Give the menu item a name";
    if (showTitle && t.length > 60) next.title = "Use at most 60 characters";
    setErrors(next);
    if (Object.keys(next).length || !r.success) return;
    onSave(t, r.data, { highlight });
    onClose();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
        <div role="radiogroup" aria-label="Link type" className="flex flex-row flex-wrap gap-1 sm:flex-col">
          {LINK_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={link.type === t}
              onClick={() => pickType(t)}
              className={cn("rounded-md px-2.5 py-1.5 text-left text-small", link.type === t ? "bg-accent-soft font-medium text-accent" : "text-foreground hover:bg-surface-secondary")}
            >
              {LINK_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="min-w-0 space-y-4 rounded-lg border border-border p-3">
          <TargetPicker link={link} patch={patch} config={config} pickers={pickers} ids={ids} />
          {errors.ref ? <p className="text-xs text-error">{errors.ref}</p> : null}
          {errors.url ? <p className="text-xs text-error">{errors.url}</p> : null}

          {link.type !== "none" && link.type !== "popup" ? (
            <FieldRow label="Target in" htmlFor={ids.target}>
              <select id={ids.target} className={input} value={link.newTab ? "new" : "same"} onChange={(e) => patch({ newTab: e.target.value === "new" })}>
                <option value="same">Same tab</option>
                <option value="new">New tab</option>
              </select>
            </FieldRow>
          ) : null}

          {anchors && anchors.length > 0 ? (
            <FieldRow label="Where on page" htmlFor={ids.where}>
              <select id={ids.where} className={input} value={anchorIsSection ? link.anchor : ""} onChange={(e) => patch({ anchor: e.target.value })}>
                <option value="">Main page</option>
                {anchors.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </FieldRow>
          ) : null}

          {showTitle ? (
            <FieldRow label={titleLabel} htmlFor={ids.name}>
              <input id={ids.name} className={input} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. New arrivals" />
              {errors.title ? <p className="text-xs text-error">{errors.title}</p> : null}
            </FieldRow>
          ) : null}

          <div>
            <button type="button" onClick={() => setAdvanced((v) => !v)} aria-expanded={advanced} className="flex items-center gap-1 text-small font-medium text-accent">
              {advanced ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              Advanced settings
            </button>
            {advanced ? (
              <div className="mt-3 space-y-3">
                <FieldRow label="Anchor on the page" htmlFor={ids.anchor} hint="Scrolls to the element with this id (letters, numbers, - or _). Leave empty for the top of the page.">
                  <input id={ids.anchor} className={input} value={link.anchor} maxLength={64} onChange={(e) => patch({ anchor: e.target.value.replace(/^#/, "") })} placeholder="s-hero" />
                </FieldRow>
                {errors.anchor ? <p className="text-xs text-error">{errors.anchor}</p> : null}
                {showHighlight ? (
                  <label htmlFor={ids.hl} className="flex items-center gap-2 text-small">
                    <input id={ids.hl} type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} className="size-4 accent-[var(--accent)]" />
                    Highlight this item (accent colour)
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="accent" onClick={save}>
          Update
        </Button>
      </div>
    </div>
  );
}

function TargetPicker({
  link,
  patch,
  config,
  pickers,
  ids,
}: {
  link: ThemeLink;
  patch: (p: Partial<ThemeLink>) => void;
  config: ThemeConfig;
  pickers: EditorPickers;
  ids: { ref: string; url: string; tag: string };
}) {
  switch (link.type) {
    case "none":
      return <Note>Not a link. The item shows as plain text (useful as a heading for a dropdown).</Note>;
    case "home":
      return <Note>Homepage will open.</Note>;
    case "page": {
      const groups = pageOptions(config, pickers);
      return (
        <FieldRow label="Page" htmlFor={ids.ref}>
          <select id={ids.ref} className={input} value={link.ref} onChange={(e) => patch({ ref: e.target.value, anchor: "" })}>
            <option value="">Choose a page…</option>
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </FieldRow>
      );
    }
    case "product":
      return <SearchSelect label="Product" options={pickers.product} value={link.ref} onChange={(ref) => patch({ ref })} empty="No products yet. Add one in Products." />;
    case "collection":
      return <SearchSelect label="Collection" options={pickers.collection} value={link.ref} onChange={(ref) => patch({ ref })} empty="No collections yet. Add one in Collections." />;
    case "blogPost":
      return <SearchSelect label="Blog post" options={[{ value: "", label: "All posts (blog home)" }, ...pickers.blogPost]} value={link.ref} onChange={(ref) => patch({ ref })} />;
    case "blogCategory":
      return (
        <FieldRow label="Blog tag" htmlFor={ids.tag} hint="Opens the blog filtered to posts with this tag.">
          <input id={ids.tag} className={input} value={link.ref} maxLength={40} onChange={(e) => patch({ ref: e.target.value })} placeholder="e.g. styling" />
        </FieldRow>
      );
    case "url": {
      const bad = link.url.trim() !== "" && !isSafeHref(link.url.trim());
      return (
        <FieldRow label="Web address" htmlFor={ids.url} hint="A path on your store (/collections/sale) or a full address (https://…).">
          <input id={ids.url} className={cn(input, bad && "border-error")} value={link.url} maxLength={500} onChange={(e) => patch({ url: e.target.value })} placeholder="https://" inputMode="url" />
          {bad ? <p className="text-xs text-error">Use a link starting with / or https://</p> : null}
        </FieldRow>
      );
    }
    case "popup":
      return config.popups.length ? (
        <FieldRow label="Popup" htmlFor={ids.ref} hint="The popup opens when the link is clicked.">
          <select id={ids.ref} className={input} value={link.ref} onChange={(e) => patch({ ref: e.target.value })}>
            <option value="">Choose a popup…</option>
            {config.popups.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </FieldRow>
      ) : (
        <Note>No popups yet. Add one in Pages &amp; menu → Popups.</Note>
      );
  }
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md bg-surface-secondary px-3 py-2 text-small text-muted">{children}</p>;
}

/** Text filter + scrolling option list (shows the first 100 matches). */
function SearchSelect({ label, options, value, onChange, empty }: { label: string; options: Option[]; value: string; onChange: (v: string) => void; empty?: string }) {
  const [q, setQ] = useState("");
  const id = useId();
  const needle = q.trim().toLowerCase();
  const shown = (needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options).slice(0, 100);
  const current = options.find((o) => o.value === value);
  if (!options.length) return <Note>{empty ?? "Nothing to choose yet."}</Note>;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs font-medium">
        {label}
        {current ? <span className="ml-1 font-normal text-muted">· {current.label}</span> : null}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input id={id} className={cn(input, "pl-8")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}s`} />
      </div>
      <div role="listbox" aria-label={label} className="max-h-56 overflow-y-auto rounded-md border border-border p-1">
        {shown.length ? (
          shown.map((o) => (
            <button
              key={o.value || "__all"}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => onChange(o.value)}
              className={cn("block w-full truncate rounded px-2 py-1.5 text-left text-small", o.value === value ? "bg-accent-soft font-medium text-accent" : "hover:bg-surface-secondary")}
            >
              {o.label}
            </button>
          ))
        ) : (
          <p className="px-2 py-1.5 text-small text-muted">No matches</p>
        )}
      </div>
    </div>
  );
}
