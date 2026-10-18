"use client";

import { useMemo, useState, useTransition } from "react";
import { resetPlatformProductTypeAction, savePlatformProductTypeAction, setPlatformProductTypeStatusAction } from "@/features/catalog/platform-actions";
import { typeKeyFromLabel, type AttributeTemplate, type ProductTypeDef } from "@/features/catalog/product-types";
import { INDUSTRIES, industryShort, type IndustrySlug } from "@/features/stores/industries";
import { Badge, Card, Table, td, th } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { CheckboxField, TextField, inputClassName as input } from "@/components/ui/field";

type Item = ProductTypeDef & { overridden: boolean; inCode: boolean };
type ErrorLike = { message: string; fieldErrors?: Record<string, string[]> };
const firstError = (e: ErrorLike) => Object.values(e.fieldErrors ?? {})[0]?.[0] ?? e.message;

type Draft = { key: string; label: string; plural: string; industries: string[]; template: AttributeTemplate; position: number; status: "active" | "disabled" };
const toDraft = (t: ProductTypeDef): Draft => ({ key: t.key, label: t.label, plural: t.plural, industries: t.industries, template: t.template, position: t.position, status: t.status });
const BLANK: Draft = { key: "", label: "", plural: "", industries: [], template: { fashion: false, sizes: false, specs: ["Material", "Dimensions", "Weight"], care: "Care & usage" }, position: 5000, status: "active" };

function TypeForm({ initial, isNew, onDone }: { initial: Draft; isNew: boolean; onDone: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [keyTouched, setKeyTouched] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));
  const setTpl = (patch: Partial<AttributeTemplate>) => setD((p) => ({ ...p, template: { ...p.template, ...patch } }));
  const save = () =>
    start(async () => {
      setError(null);
      const r = await savePlatformProductTypeAction({ ...d, plural: d.plural || null });
      if (!r.ok) setError(firstError(r.error));
      else onDone();
    });
  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface-secondary/40 p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Name" name="label" value={d.label} maxLength={60} onChange={(e) => set({ label: e.target.value, ...(keyTouched ? {} : { key: typeKeyFromLabel(e.target.value) }) })} />
        <TextField label="Plural (listing filters)" name="plural" value={d.plural} maxLength={60} optional onChange={(e) => set({ plural: e.target.value })} />
        <TextField
          label="Key"
          name="key"
          value={d.key}
          maxLength={40}
          disabled={!isNew}
          hint={isNew ? "Stored on products; can't be changed later." : "Keys can't change (products store them)."}
          onChange={(e) => {
            setKeyTouched(true);
            set({ key: e.target.value.toLowerCase() });
          }}
        />
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Suggested for industries</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {INDUSTRIES.map((i) => (
            <label key={i.slug} className="flex items-center gap-1.5 text-small">
              <input type="checkbox" checked={d.industries.includes(i.slug)} onChange={(e) => set({ industries: e.target.checked ? [...d.industries, i.slug] : d.industries.filter((x) => x !== i.slug) })} />
              {i.short}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <CheckboxField label="Clothing fields (fabric, style, occasion…)" name="fashion" checked={d.template.fashion} onChange={(e) => setTpl({ fashion: e.target.checked })} />
        <CheckboxField label="Sized (size chart, size presets)" name="sizes" checked={d.template.sizes} onChange={(e) => setTpl({ sizes: e.target.checked })} />
        <TextField label="Care / usage box label" name="care" value={d.template.care} maxLength={40} onChange={(e) => setTpl({ care: e.target.value })} />
      </div>
      <TextField
        label="Detail fields"
        name="specs"
        defaultValue={d.template.specs.join(", ")}
        hint="Comma separated, up to 12 (e.g. Material, Dimensions, Warranty). Shown as labelled fields in the product form."
        onBlur={(e) => setTpl({ specs: [...new Set(e.target.value.split(",").map((x) => x.trim().slice(0, 40)).filter(Boolean))].slice(0, 12) })}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Sort position" name="position" type="number" min={0} value={d.position} onChange={(e) => set({ position: Number(e.target.value) || 0 })} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Status</span>
          <select className={input} value={d.status} onChange={(e) => set({ status: e.target.value as Draft["status"] })}>
            <option value="active">Active</option>
            <option value="disabled">Disabled (hidden from pickers)</option>
          </select>
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-small text-error">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" pending={pending} onClick={save} disabled={!d.label.trim() || !d.key}>
          {isNew ? "Add product type" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function ProductTypesAdmin({ types, migrated }: { types: Item[]; migrated: boolean }) {
  const [industry, setIndustry] = useState<"" | IndustrySlug>("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return types.filter((t) => (!industry || t.industries.includes(industry)) && (!s || t.label.toLowerCase().includes(s) || t.key.includes(s)));
  }, [types, industry, q]);
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: ErrorLike }>) =>
    start(async () => {
      setRowError(null);
      const r = await fn();
      if (!r.ok) setRowError(firstError(r.error));
    });

  return (
    <div className="space-y-4">
      {!migrated ? (
        <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-small">
          Showing the built-in catalogue. Apply migration <code>20261018003200_product_types</code> to save changes, let sellers create their own types and use new type keys directly.
        </p>
      ) : null}
      <Card
        title="Catalogue"
        description="Sellers see the types for their store's industry first, then all other active types. Disabling hides a type from pickers; products that already use it keep it."
        actions={
          <Button size="sm" onClick={() => setAdding(true)} disabled={adding || !migrated}>
            Add type
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-3">
          <input aria-label="Search types" placeholder="Search…" className={`${input} w-56`} value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Filter by industry" className={`${input} w-56`} value={industry} onChange={(e) => setIndustry(e.target.value as IndustrySlug | "")}>
            <option value="">All industries</option>
            {INDUSTRIES.map((i) => (
              <option key={i.slug} value={i.slug}>
                {i.name}
              </option>
            ))}
          </select>
          <span className="self-center text-small text-muted">{shown.length} types</span>
        </div>
        {adding ? (
          <div className="mb-4">
            <TypeForm initial={{ ...BLANK, industries: industry ? [industry] : [] }} isNew onDone={() => setAdding(false)} />
          </div>
        ) : null}
        {rowError ? (
          <p role="alert" className="mb-3 text-small text-error">
            {rowError}
          </p>
        ) : null}
        <Table caption="Product types">
          <thead>
            <tr>
              <th className={th}>Type</th>
              <th className={th}>Industries</th>
              <th className={th}>Fields</th>
              <th className={th}>Status</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody aria-busy={pending}>
            {shown.map((t) =>
              editing === t.key ? (
                <tr key={t.key}>
                  <td className={td} colSpan={5}>
                    <TypeForm initial={toDraft(t)} isNew={false} onDone={() => setEditing(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={t.key}>
                  <td className={td}>
                    <p className="font-medium">{t.label}</p>
                    <p className="text-caption text-muted">
                      {t.key}
                      {t.inCode ? (t.overridden ? " · customised" : " · built-in") : " · added"}
                    </p>
                  </td>
                  <td className={`${td} max-w-xs text-small text-muted`}>{t.industries.length ? t.industries.map((i) => (INDUSTRIES.some((x) => x.slug === i) ? industryShort(i as IndustrySlug) : i)).join(", ") : "—"}</td>
                  <td className={`${td} max-w-xs text-small text-muted`}>
                    {[t.template.fashion ? "Clothing" : null, t.template.sizes ? "Sizes" : null, ...t.template.specs].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className={td}>{t.status === "active" ? <Badge tone="success">Active</Badge> : <Badge>Disabled</Badge>}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <span className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" disabled={!migrated} onClick={() => setEditing(t.key)}>
                        Edit
                      </Button>
                      {t.key !== "other" ? (
                        <Button size="sm" variant="ghost" disabled={!migrated || pending} onClick={() => run(() => setPlatformProductTypeStatusAction({ key: t.key, status: t.status === "active" ? "disabled" : "active" }))}>
                          {t.status === "active" ? "Disable" : "Enable"}
                        </Button>
                      ) : null}
                      {t.overridden ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => {
                            if (window.confirm(t.inCode ? `Reset “${t.label}” to the built-in defaults?` : `Remove “${t.label}”? Products using it keep the key and show it as plain text.`)) run(() => resetPlatformProductTypeAction({ key: t.key }));
                          }}
                        >
                          {t.inCode ? "Reset" : "Remove"}
                        </Button>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
