"use client";

import { useState } from "react";
import { ArrowLeft, Check, GripVertical, ListPlus, Pencil, Plus } from "lucide-react";
import { SECTION_DEFINITIONS, defaultSettings } from "@/features/theme/sections/definitions";
import type { EditorField, SectionDefinition, SectionInstance } from "@/features/theme/sections/types";
import type { EditorPickers } from "@/features/theme/server/queries";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useBuilder, type SectionRef, type SectionTab } from "../../context";
import { copyItem, findSection, moveItem, removeItem, setSectionSettings, setSectionStyle, updateItems, updateSection } from "../../ops";
import { blankItem, clearGroup, groupHasContent, itemGroups, itemHideField, itemLabel, primaryListField, sectionTabs, visibleFields, type ItemGroup, type ListField } from "../../field-groups";
import { Field, VariantPicker } from "../fields";
import { ColorInput, EmptyState, IconButton, MoreMenu, PanelFrame, Row, Toggle, useReorder } from "../ui";

/**
 * Section panel (left column): Edit (section data + Manage list), Change design (layout variants),
 * Settings (options + visibility) and Colours (section colour overrides + tone fields).
 *
 * Every edit is validated against the section's zod schema before it reaches the document: a
 * value that would make the section invalid stays local to its input (with the error shown) and
 * is applied once it is valid. List items are edited on a local copy and applied with "Update".
 */

const TABS: { id: SectionTab; label: string }[] = [
  { id: "edit", label: "Edit" },
  { id: "design", label: "Change design" },
  { id: "settings", label: "Settings" },
  { id: "colors", label: "Colours" },
];

type Settings = Record<string, unknown>;

type Issue = z.ZodError["issues"][number];
const issuePath = (i: Issue) => i.path.map(String);
function issueMessage(i: Issue, def: SectionDefinition): string {
  const [key, ...rest] = issuePath(i);
  const f = def.fields.find((x) => x.key === key);
  if (!rest.length || f?.kind !== "list") return i.message;
  const idx = Number(rest[0]);
  const sub = f.fields.find((x) => x.key === rest[1]);
  return `${f.itemLabel} ${Number.isFinite(idx) ? idx + 1 : ""}${sub ? ` · ${sub.label}` : ""}: ${i.message}`;
}

export function SectionPanel() {
  const b = useBuilder();
  const panel = b.panel;
  if (panel?.kind !== "section") return null;
  const section = findSection(b.config, panel.ref.list, panel.ref.sectionId);
  if (!section) {
    return (
      <PanelFrame title="Section" onClose={() => b.setPanel(null)}>
        <EmptyState title="Section not found">This section is no longer on the page. It may have been removed or undone.</EmptyState>
      </PanelFrame>
    );
  }
  return <SectionPanelBody key={section.id} section={section} sectionRef={panel.ref} tab={panel.tab} />;
}

function SectionPanelBody({ section, sectionRef, tab }: { section: SectionInstance; sectionRef: SectionRef; tab: SectionTab }) {
  const b = useBuilder();
  const def = SECTION_DEFINITIONS[section.type] as SectionDefinition;
  const settings = section.settings as Settings;
  const tabs = sectionTabs(def);
  const list = primaryListField(def);
  /** Values that failed validation, kept in their inputs until fixed. */
  const [pending, setPending] = useState<Record<string, { value: unknown; error: string }>>({});

  const setField = (key: string, value: unknown) => {
    const r = def.schema.safeParse({ ...settings, [key]: value });
    const issue = r.success ? null : r.error.issues.find((i) => issuePath(i)[0] === key);
    if (issue) {
      setPending((p) => ({ ...p, [key]: { value, error: issueMessage(issue, def) } }));
      return;
    }
    setPending((p) => {
      if (!(key in p)) return p;
      const { [key]: _drop, ...rest } = p;
      return rest;
    });
    b.apply((c) => setSectionSettings(c, sectionRef.list, sectionRef.sectionId, { [key]: value }), `sec.${sectionRef.sectionId}.${key}`);
  };
  const values: Settings = { ...settings, ...Object.fromEntries(Object.entries(pending).map(([k, p]) => [k, p.value])) };
  const errors = Object.fromEntries(Object.entries(pending).map(([k, p]) => [k, p.error]));

  const renderFields = (fields: readonly EditorField[]) => (
    <div className="space-y-3">
      {visibleFields(fields, values).map((f) => (
        <Field key={f.key} field={f} value={values[f.key]} pickers={b.pickers} error={errors[f.key]} onChange={(v) => setField(f.key, v)} />
      ))}
    </div>
  );

  const close = () => b.setPanel(null);
  const setTab = (t: SectionTab) => b.setPanel({ kind: "section", ref: sectionRef, tab: t });

  if (section.type === "PageContent") {
    return (
      <PanelFrame title={def.label} onClose={close}>
        <EmptyState title="Page content">This is where the page&apos;s own content appears. Move it up or down to place sections around it.</EmptyState>
      </PanelFrame>
    );
  }

  const contentFields = tabs.edit.filter((f) => f !== list);

  return (
    <PanelFrame title={def.label} subtitle={def.description} onClose={close}>
      <div className="sticky -top-3 z-10 -mx-3 -mt-3 mb-4 border-b border-border bg-surface/95 px-3 py-2 backdrop-blur">
        <div role="tablist" aria-label="Section panel" className="flex gap-0.5 overflow-x-auto rounded-xl bg-surface-secondary p-1 [scrollbar-width:none]">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 shrink-0 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                tab === t.id ? "bg-surface text-accent shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-muted hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "edit" ? (
        <div role="tabpanel" className="space-y-5">
          {list ? <ManageList field={list} section={section} sectionRef={sectionRef} def={def} pickers={b.pickers} /> : null}
          {contentFields.length ? (
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Section data</h3>
              {renderFields(contentFields)}
            </section>
          ) : null}
          {!list && !contentFields.length ? <EmptyState title="Nothing to edit here">This section has no content to edit. Try Change design, Settings or Colours.</EmptyState> : null}
        </div>
      ) : null}

      {tab === "design" ? (
        <div role="tabpanel" className="space-y-4">
          {tabs.design.length ? (
            tabs.design.map((f) =>
              f.kind === "select" ? <VariantPicker key={f.key} field={f} value={String(values[f.key] ?? "")} onChange={(v) => setField(f.key, v)} hideLegend={tabs.design.length === 1} /> : null,
            )
          ) : (
            <EmptyState title="One design">This section has a single layout. Use Settings and Colours to restyle it.</EmptyState>
          )}
        </div>
      ) : null}

      {tab === "settings" ? (
        <div role="tabpanel" className="space-y-5">
          {tabs.settings.length ? renderFields(tabs.settings) : null}
          <section className="space-y-2.5 border-t border-border pt-3 first:border-t-0 first:pt-0">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Visibility</h3>
            {(["desktop", "mobile"] as const).map((d) => (
              <Toggle
                key={d}
                label={d === "desktop" ? "Show on desktop" : "Show on mobile"}
                checked={section.visibility[d]}
                onChange={(v) => b.apply((c) => updateSection(c, sectionRef.list, sectionRef.sectionId, (s) => ({ ...s, visibility: { ...s.visibility, [d]: v } })))}
              />
            ))}
          </section>
        </div>
      ) : null}

      {tab === "colors" ? (
        <div role="tabpanel" className="space-y-5">
          <section className="space-y-2.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Section colours</h3>
            <p className="text-xs text-muted">Leave empty to use the theme colours.</p>
            {(
              [
                ["background", "Background"],
                ["text", "Text"],
                ["accent", "Accent"],
              ] as const
            ).map(([k, label]) => (
              <ColorInput
                key={k}
                label={label}
                allowEmpty
                value={section.style?.[k] ?? ""}
                onChange={(v) => b.apply((c) => setSectionStyle(c, sectionRef.list, sectionRef.sectionId, { [k]: v }), `sec.${sectionRef.sectionId}.style.${k}`)}
              />
            ))}
          </section>
          {tabs.colors.length ? (
            <section className="space-y-3 border-t border-border pt-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Section tones</h3>
              {renderFields(tabs.colors)}
            </section>
          ) : null}
        </div>
      ) : null}
    </PanelFrame>
  );
}

// -----------------------------------------------------------------------------
// Manage list
// -----------------------------------------------------------------------------

type Item = Record<string, unknown>;

function ManageList({ field, section, sectionRef, def, pickers }: { field: ListField; section: SectionInstance; sectionRef: SectionRef; def: SectionDefinition; pickers: EditorPickers }) {
  const b = useBuilder();
  const settings = section.settings as Settings;
  const items: Item[] = Array.isArray(settings[field.key]) ? (settings[field.key] as Item[]) : [];
  /** Item editor: index into items (items.length = a new, not yet added item). */
  const [editing, setEditing] = useState<{ index: number; draft: Item; isNew: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hide = itemHideField(field.fields);
  const min = field.min ?? 0;

  const validate = (next: Item[]) => def.schema.safeParse({ ...settings, [field.key]: next });
  const commit = (fn: (items: Item[]) => Item[]) => {
    const next = fn(items);
    if (next === items) return;
    const r = validate(next);
    if (!r.success) {
      setError(issueMessage(r.error.issues[0]!, def));
      return;
    }
    setError(null);
    b.apply((c) => updateItems(c, sectionRef.list, sectionRef.sectionId, field.key, () => next));
  };
  const reorder = useReorder((from, to) => commit((xs) => moveItem(xs, from, to)));
  const resolve = (f: EditorField, v: string) => (f.kind === "picker" ? (pickers[f.picker].find((o) => o.value === v)?.label ?? null) : null);

  const add = () => {
    if (items.length >= field.max) return;
    const blank = blankItem(field.fields);
    const sample = (defaultSettings(section.type)[field.key] as Item[] | undefined)?.[0];
    const candidates = [blank, ...(sample ? [{ ...blank, ...structuredClone(sample) }] : [])];
    const ok = candidates.find((c) => validate([...items, c]).success);
    if (ok) {
      b.apply((c) => updateItems(c, sectionRef.list, sectionRef.sectionId, field.key, (xs) => [...xs, ok]));
      setEditing({ index: items.length, draft: ok, isNew: false });
    } else {
      // Needs content before it is valid: edit it first, "Update" adds it.
      setEditing({ index: items.length, draft: blank, isNew: true });
    }
    setError(null);
  };

  if (editing) {
    return (
      <ItemEditor
        key={`${editing.index}-${editing.isNew}`}
        field={field}
        initial={editing.draft}
        isNew={editing.isNew}
        title={editing.isNew ? `New ${field.itemLabel.toLowerCase()}` : itemLabel(items[editing.index] ?? editing.draft, field.fields, `${field.itemLabel} ${editing.index + 1}`, resolve)}
        pickers={pickers}
        onBack={() => setEditing(null)}
        onUpdate={(draft) => {
          const next = editing.isNew ? [...items, draft] : items.map((x, j) => (j === editing.index ? draft : x));
          const r = validate(next);
          if (!r.success) {
            const errs: Record<string, string> = {};
            let form: string | null = null;
            for (const i of r.error.issues) {
              const [k, idx, sub] = issuePath(i);
              if (k === field.key && Number(idx) === editing.index && sub) errs[sub] ??= i.message;
              else form ??= issueMessage(i, def);
            }
            return { errors: errs, form };
          }
          b.apply((c) => updateItems(c, sectionRef.list, sectionRef.sectionId, field.key, () => next));
          if (editing.isNew) setEditing({ index: items.length, draft, isNew: false });
          return null;
        }}
      />
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          {field.label} <span className="ml-0.5 rounded-full bg-surface-secondary px-1.5 py-0.5 font-medium normal-case tracking-normal">{items.length}/{field.max}</span>
        </h3>
        <button
          type="button"
          onClick={add}
          disabled={items.length >= field.max}
          className="inline-flex h-7 items-center gap-1 rounded-full bg-accent px-3 text-xs font-semibold text-accent-foreground shadow-xs transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus className="size-3.5" aria-hidden /> Add {field.itemLabel.toLowerCase()}
        </button>
      </div>
      {field.help ? <p className="text-xs text-muted">{field.help}</p> : null}
      {items.length ? (
        <ol className="space-y-1.5">
          {items.map((it, i) => {
            const hidden = hide ? it[hide.key] === hide.hiddenWhen : false;
            const label = itemLabel(it, field.fields, `${field.itemLabel} ${i + 1}`, resolve);
            const { className: handleClass, ...handle } = reorder.handleProps(i);
            return (
              <li key={i} {...reorder.itemProps(i)}>
                <Row className={cn(hidden && "opacity-60")}>
                  <span {...handle} className={handleClass}>
                    <GripVertical className="size-4" aria-hidden />
                  </span>
                  <button type="button" onClick={() => setEditing({ index: i, draft: structuredClone(it), isNew: false })} className={cn("min-w-0 flex-1 truncate py-1 text-left font-medium", hidden && "line-through")}>
                    {label}
                  </button>
                  <IconButton label={`Edit ${label}`} onClick={() => setEditing({ index: i, draft: structuredClone(it), isNew: false })}>
                    <Pencil />
                  </IconButton>
                  <MoreMenu
                    label={`More actions for ${label}`}
                    items={[
                      { label: "Edit", onSelect: () => setEditing({ index: i, draft: structuredClone(it), isNew: false }) },
                      { label: "Copy", disabled: items.length >= field.max, onSelect: () => commit((xs) => copyItem(xs, i, field.max)) },
                      ...(hide ? [{ label: hidden ? "Show" : "Hide", onSelect: () => commit((xs) => xs.map((x, j) => (j === i ? { ...x, [hide.key]: !x[hide.key] } : x))) }] : []),
                      { label: "Delete", danger: true, disabled: items.length <= min, onSelect: () => commit((xs) => removeItem(xs, i, min)) },
                    ]}
                  />
                </Row>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState
          icon={<ListPlus />}
          title={`No ${field.label.toLowerCase()} yet`}
          action={
            <button type="button" onClick={add} className="text-xs font-semibold text-accent hover:underline">
              Add the first {field.itemLabel.toLowerCase()}
            </button>
          }
        />
      )}
      {min > 0 ? <p className="text-xs text-muted">Keep at least {min}.</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Item editor
// -----------------------------------------------------------------------------

function ItemEditor({
  field,
  initial,
  isNew,
  title,
  pickers,
  onBack,
  onUpdate,
}: {
  field: ListField;
  initial: Item;
  isNew: boolean;
  title: string;
  pickers: EditorPickers;
  onBack: () => void;
  onUpdate: (draft: Item) => { errors: Record<string, string>; form: string | null } | null;
}) {
  const groups = itemGroups(field.fields);
  const [draft, setDraft] = useState<Item>(initial);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(groups.map((g) => [g.id, isNew || !g.toggle || groupHasContent(g, initial)])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  /** The item as last applied (for the Update button state). */
  const [base, setBase] = useState<Item>(initial);
  const changed = isNew || JSON.stringify(draft) !== JSON.stringify(base);

  const set = (key: string, v: unknown) => {
    setDraft((d) => ({ ...d, [key]: v }));
    setSaved(false);
    if (errors[key]) setErrors(({ [key]: _drop, ...rest }) => rest);
  };
  const toggleGroup = (g: ItemGroup, v: boolean) => {
    setOn((o) => ({ ...o, [g.id]: v }));
    if (!v) setDraft((d) => clearGroup(g, d));
    setSaved(false);
  };
  const update = () => {
    const r = onUpdate(draft);
    setErrors(r?.errors ?? {});
    setForm(r?.form ?? null);
    setSaved(!r);
    if (!r) setBase(draft);
    if (r) setOn((o) => ({ ...o, ...Object.fromEntries(groups.filter((g) => g.fields.some((f) => r.errors[f.key])).map((g) => [g.id, true])) }));
  };

  return (
    <section className="space-y-3" aria-label={`Edit ${field.itemLabel.toLowerCase()}`}>
      <div className="-mx-1 flex items-center gap-1.5">
        <IconButton label={`Back to ${field.label.toLowerCase()}`} onClick={onBack}>
          <ArrowLeft />
        </IconButton>
        <h3 className="min-w-0 flex-1 truncate text-small font-semibold">{title}</h3>
      </div>
      {groups.map((g) => (
        <div key={g.id} className={cn("rounded-xl border bg-surface p-3 transition-colors", on[g.id] ? "border-border" : "border-dashed border-border")}>
          {g.toggle ? <Toggle label={g.label} checked={!!on[g.id]} onChange={(v) => toggleGroup(g, v)} /> : <p className="text-small font-semibold">{g.label}</p>}
          {on[g.id] ? (
            <div className="mt-3 space-y-3 border-t border-border pt-3">
              {visibleFields(g.fields, draft).map((f) => (
                <Field key={f.key} field={f} value={draft[f.key]} pickers={pickers} error={errors[f.key]} onChange={(v) => set(f.key, v)} />
              ))}
            </div>
          ) : null}
        </div>
      ))}
      {form ? (
        <p role="alert" className="text-xs text-error">
          {form}
        </p>
      ) : null}
      <p className="text-xs text-muted">Changes show on the page after {isNew ? `“Add ${field.itemLabel.toLowerCase()}”` : "“Update”"}.</p>
      {/* Pinned to the bottom of the panel while the item scrolls. */}
      <div className="sticky -bottom-3 z-10 -mx-3 -mb-3 space-y-2 border-t border-border bg-surface/95 px-3 py-3 shadow-[0_-6px_16px_-10px_rgba(0,0,0,0.18)] backdrop-blur">
        <div className="flex items-center gap-2">
          <Button variant="accent" size="lg" className="flex-1" onClick={update} disabled={!changed && !Object.keys(errors).length}>
            {saved && !changed ? <Check aria-hidden /> : null}
            {isNew ? `Add ${field.itemLabel.toLowerCase()}` : saved && !changed ? "Updated" : "Update"}
          </Button>
          <Button size="lg" variant="secondary" onClick={onBack}>
            {saved || !changed ? "Done" : "Cancel"}
          </Button>
        </div>
        {saved ? (
          <p role="status" className="sr-only">
            Updated
          </p>
        ) : null}
      </div>
    </section>
  );
}
