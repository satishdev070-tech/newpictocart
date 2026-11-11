"use client";

import { useState } from "react";
import { toMinor } from "@/lib/money";
import { PRICE_TYPES, PRICE_TYPE_LABELS, priceTypeNeedsAmount, type PriceType } from "../../pricing";
import type { InformativeDraft } from "../draft";
import { ui } from "./shell";

type Row = { name: string; shortDescription: string; priceType: PriceType; price: string };
const EMPTY: Row = { name: "", shortDescription: "", priceType: "FIXED", price: "" };

/** Informative Step 3 — up to 3 starter services, skippable (then 3 category samples are added, marked "Sample"). */
export function ServicesStep({ draft, onSave, onSkip, onBack }: { draft: InformativeDraft; onSave: (s: InformativeDraft["services"]) => void; onSkip: () => void; onBack: () => void }) {
  const [rows, setRows] = useState<Row[]>(
    draft.services.length
      ? draft.services.map((s) => ({ name: s.name, shortDescription: s.shortDescription, priceType: s.priceType, price: s.pricePaise == null ? "" : String(s.pricePaise / 100) }))
      : [{ ...EMPTY }],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  function save(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const out: InformativeDraft["services"] = [];
    rows.forEach((r, i) => {
      if (!r.name.trim() && !r.shortDescription.trim() && !r.price.trim()) return; // blank row: ignore
      if (!r.name.trim()) errs[`${i}.name`] = "Add a name";
      let pricePaise: number | null = null;
      const clean = r.price.replace(/[,₹\s]/g, "");
      if (clean) {
        if (!/^\d{1,9}(\.\d{1,2})?$/.test(clean)) errs[`${i}.price`] = "Enter an amount like 499";
        else pricePaise = toMinor(clean);
      } else if (priceTypeNeedsAmount(r.priceType)) errs[`${i}.price`] = "Enter a price";
      out.push({ name: r.name.trim().slice(0, 120), shortDescription: r.shortDescription.trim().slice(0, 300), priceType: r.priceType, pricePaise });
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!out.length) return onSkip();
    onSave(out);
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-6" aria-labelledby="services-title">
      <div>
        <h1 id="services-title" className="font-brand text-3xl sm:text-4xl">Add your services</h1>
        <p className="mt-2 text-[#5E5568]">Add up to 3 now. You can add more, with photos and details, from your dashboard.</p>
      </div>
      {rows.map((r, i) => (
        <fieldset key={i} className={`${ui.card} grid gap-4 sm:grid-cols-2`}>
          <legend className="sr-only">Service {i + 1}</legend>
          <label className={`${ui.label} sm:col-span-2`}>
            Service name
            <input className={ui.input} value={r.name} onChange={(e) => update(i, { name: e.target.value })} maxLength={120} aria-invalid={errors[`${i}.name`] ? true : undefined} aria-describedby={errors[`${i}.name`] ? `e-${i}-name` : undefined} />
            {errors[`${i}.name`] ? <span id={`e-${i}-name`} aria-hidden className={`${ui.error} block`}>{errors[`${i}.name`]}</span> : null}
          </label>
          <label className={`${ui.label} sm:col-span-2`}>
            Short description
            <input className={ui.input} value={r.shortDescription} onChange={(e) => update(i, { shortDescription: e.target.value })} maxLength={300} />
          </label>
          <label className={ui.label}>
            Price type
            <select className={ui.input} value={r.priceType} onChange={(e) => update(i, { priceType: e.target.value as PriceType })}>
              {PRICE_TYPES.map((p) => (
                <option key={p} value={p}>{PRICE_TYPE_LABELS[p]}</option>
              ))}
            </select>
          </label>
          <label className={ui.label}>
            Price (₹)
            <input className={ui.input} value={r.price} onChange={(e) => update(i, { price: e.target.value })} inputMode="decimal" disabled={!priceTypeNeedsAmount(r.priceType)} aria-invalid={errors[`${i}.price`] ? true : undefined} aria-describedby={errors[`${i}.price`] ? `e-${i}-price` : undefined} />
            {errors[`${i}.price`] ? <span id={`e-${i}-price`} aria-hidden className={`${ui.error} block`}>{errors[`${i}.price`]}</span> : null}
          </label>
          {rows.length > 1 ? (
            <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className={`${ui.ghostBtn} sm:col-span-2`}>
              Remove this service
            </button>
          ) : null}
        </fieldset>
      ))}
      {rows.length < 3 ? (
        <button type="button" onClick={() => setRows((rs) => [...rs, { ...EMPTY }])} className={`${ui.ghostBtn} self-start`}>
          + Add another service
        </button>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className={ui.ghostBtn}>← Back</button>
        <div className="flex items-center gap-4">
          <button type="button" onClick={onSkip} className={ui.ghostBtn}>Skip, I&apos;ll add later</button>
          <button type="submit" className={ui.primaryBtn}>Continue</button>
        </div>
      </div>
    </form>
  );
}
