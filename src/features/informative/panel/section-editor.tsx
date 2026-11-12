"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions/result";
import { savePageSectionsAction } from "../actions";
import { SECTION_TYPES, type PageSection, type SectionType } from "../sections";

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: "Hero banner",
  about: "About",
  services_grid: "Services (cards)",
  services_list: "Services (list)",
  highlights: "Why choose us",
  stats: "Stats",
  team: "Team",
  gallery: "Gallery",
  testimonials: "Testimonials",
  pricing: "Pricing",
  faq: "FAQ",
  cta: "Call to action",
  contact: "Contact details",
  enquiry_form: "Enquiry form",
  rich_text: "Text block",
};

/** Editable text per section type (content such as services and FAQs comes from their own pages). */
const FIELDS: Partial<Record<SectionType, { key: string; label: string; long?: boolean }[]>> = {
  hero: [{ key: "heading", label: "Headline" }, { key: "subheading", label: "Sub-headline" }],
  about: [{ key: "heading", label: "Heading" }, { key: "text", label: "Text (leave empty to use your business 'About')", long: true }],
  services_grid: [{ key: "heading", label: "Heading" }],
  services_list: [{ key: "heading", label: "Heading" }],
  highlights: [{ key: "heading", label: "Heading" }],
  team: [{ key: "heading", label: "Heading" }],
  gallery: [{ key: "heading", label: "Heading" }],
  testimonials: [{ key: "heading", label: "Heading" }],
  pricing: [{ key: "heading", label: "Heading" }],
  faq: [{ key: "heading", label: "Heading" }],
  cta: [{ key: "heading", label: "Heading" }, { key: "text", label: "Text", long: true }],
  contact: [{ key: "heading", label: "Heading" }],
  enquiry_form: [{ key: "heading", label: "Heading" }],
  rich_text: [{ key: "heading", label: "Heading" }, { key: "text", label: "Text", long: true }],
};

const input = "mt-1 block min-h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-small";

/** Page section editor: show/hide, reorder, add/remove and edit each section's text. */
export function SectionEditor({ pageId, initial }: { pageId: string; initial: PageSection[] }) {
  const [sections, setSections] = useState<PageSection[]>(initial);
  const [adding, setAdding] = useState<SectionType>("rich_text");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<PageSection>) => setSections((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) =>
    setSections((list) => {
      const next = [...list];
      const j = i + d;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  async function save() {
    setSaving(true);
    const r = await savePageSectionsAction({ pageId, sections: sections.map((s, i) => ({ ...s, order: i })) });
    setSaving(false);
    setResult(r);
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {sections.map((s, i) => {
          const label = SECTION_LABELS[s.type];
          return (
            <li key={s.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {i + 1}. {label}
                </p>
                <div className="flex items-center gap-1">
                  <label className="mr-2 flex items-center gap-2 text-small">
                    <input type="checkbox" checked={s.visible} onChange={(e) => update(i, { visible: e.target.checked })} className="size-4" />
                    Visible
                  </label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${label} up`}>
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label={`Move ${label} down`}>
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSections((l) => l.filter((_, j) => j !== i))} aria-label={`Remove ${label}`}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
              {(FIELDS[s.type] ?? []).map((f) => {
                const value = typeof s.props[f.key] === "string" ? (s.props[f.key] as string) : "";
                const set = (v: string) => update(i, { props: { ...s.props, [f.key]: v } });
                const id = `${s.id}-${f.key}`;
                return (
                  <div key={f.key} className="mt-3">
                    <label htmlFor={id} className="text-small font-medium">{f.label}</label>
                    {f.long ? (
                      <textarea id={id} value={value} onChange={(e) => set(e.target.value)} rows={4} maxLength={2000} className={input} />
                    ) : (
                      <input id={id} value={value} onChange={(e) => set(e.target.value)} maxLength={200} className={input} />
                    )}
                  </div>
                );
              })}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-4">
        <label className="text-small font-medium">
          Add a section
          <select value={adding} onChange={(e) => setAdding(e.target.value as SectionType)} className={input}>
            {SECTION_TYPES.map((t) => (
              <option key={t} value={t}>{SECTION_LABELS[t]}</option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="secondary"
          disabled={sections.length >= 40}
          onClick={() => setSections((l) => [...l, { id: `${adding}-${Date.now().toString(36)}`, type: adding, props: {}, order: l.length, visible: true }])}
        >
          Add
        </Button>
      </div>
      <FormMessage state={result} success="Page saved." />
      <Button type="button" onClick={save} pending={saving}>Save page</Button>
    </div>
  );
}
