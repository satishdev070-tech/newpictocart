"use client";

import { useState } from "react";
import { toMinor } from "@/lib/money";
import { PRICE_TYPES, priceTypeNeedsAmount, type PriceType } from "../../pricing";
import { MAX_DRAFT_SERVICES, type InformativeDraft } from "../draft";
import { OnbEyebrow, OnbHeading, OnbSub } from "@/components/onboarding-ui";
import { ui } from "./shell";
import { infoCopy } from "@/features/start/i18n/info-copy";

type Row = { name: string; shortDescription: string; priceType: PriceType; price: string; durationMinutes: number | null };
const EMPTY: Row = { name: "", shortDescription: "", priceType: "FIXED", price: "", durationMinutes: null };

/**
 * Informative Step 3: up to 6 starter services, pre-filled from the chosen service type. Skippable;
 * then sample services are added, marked "Sample".
 */
export function ServicesStep({ draft, onSave, onSkip, onBack }: { draft: InformativeDraft; onSave: (s: InformativeDraft["services"]) => void; onSkip: () => void; onBack: () => void }) {
  const [rows, setRows] = useState<Row[]>(
    draft.services.length
      ? draft.services.map((s) => ({ name: s.name, shortDescription: s.shortDescription, priceType: s.priceType, price: s.pricePaise == null ? "" : String(s.pricePaise / 100), durationMinutes: s.durationMinutes ?? null }))
      : [{ ...EMPTY }],
  );
  const c = infoCopy(draft.locale);
  const tx = c.services;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  function save(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const out: InformativeDraft["services"] = [];
    rows.forEach((r, i) => {
      if (!r.name.trim() && !r.shortDescription.trim() && !r.price.trim()) return; // blank row: ignore
      if (!r.name.trim()) errs[`${i}.name`] = tx.nameRequired;
      let pricePaise: number | null = null;
      const clean = r.price.replace(/[,₹\s]/g, "");
      if (clean) {
        if (!/^\d{1,9}(\.\d{1,2})?$/.test(clean)) errs[`${i}.price`] = tx.amountInvalid;
        else pricePaise = toMinor(clean);
      } else if (priceTypeNeedsAmount(r.priceType)) errs[`${i}.price`] = tx.priceRequired;
      out.push({ name: r.name.trim().slice(0, 120), shortDescription: r.shortDescription.trim().slice(0, 300), priceType: r.priceType, pricePaise, durationMinutes: r.durationMinutes });
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!out.length) return onSkip();
    onSave(out);
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-6" aria-labelledby="services-title">
      <div className="flex flex-col gap-3">
        <OnbEyebrow>{tx.eyebrow}</OnbEyebrow>
        <div id="services-title">
          <OnbHeading>{tx.title}</OnbHeading>
        </div>
        <OnbSub>
          {draft.seededFrom ? tx.subSeeded : tx.subAddUpTo(MAX_DRAFT_SERVICES)} {tx.subMore}
        </OnbSub>
      </div>
      {rows.map((r, i) => (
        <fieldset key={i} className={`${ui.card} grid gap-4 sm:grid-cols-2`}>
          <legend className="sr-only">{tx.legend(i + 1)}</legend>
          <label className={`${ui.label} sm:col-span-2`}>
            {tx.name}
            <input className={ui.input} value={r.name} onChange={(e) => update(i, { name: e.target.value })} maxLength={120} aria-invalid={errors[`${i}.name`] ? true : undefined} aria-describedby={errors[`${i}.name`] ? `e-${i}-name` : undefined} />
            {errors[`${i}.name`] ? <span id={`e-${i}-name`} aria-hidden className={`${ui.error} block`}>{errors[`${i}.name`]}</span> : null}
          </label>
          <label className={`${ui.label} sm:col-span-2`}>
            {tx.description}
            <input className={ui.input} value={r.shortDescription} onChange={(e) => update(i, { shortDescription: e.target.value })} maxLength={300} />
          </label>
          <label className={ui.label}>
            {tx.priceType}
            <select className={ui.input} value={r.priceType} onChange={(e) => update(i, { priceType: e.target.value as PriceType })}>
              {PRICE_TYPES.map((p) => (
                <option key={p} value={p}>{c.priceTypes[p]}</option>
              ))}
            </select>
          </label>
          <label className={ui.label}>
            {tx.price}
            <input className={ui.input} value={r.price} onChange={(e) => update(i, { price: e.target.value })} inputMode="decimal" disabled={!priceTypeNeedsAmount(r.priceType)} aria-invalid={errors[`${i}.price`] ? true : undefined} aria-describedby={errors[`${i}.price`] ? `e-${i}-price` : undefined} />
            {errors[`${i}.price`] ? <span id={`e-${i}-price`} aria-hidden className={`${ui.error} block`}>{errors[`${i}.price`]}</span> : null}
          </label>
          {rows.length > 1 ? (
            <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className={`${ui.ghostBtn} justify-self-start sm:col-span-2`}>
              {tx.remove}
            </button>
          ) : null}
        </fieldset>
      ))}
      {rows.length < MAX_DRAFT_SERVICES ? (
        <button type="button" onClick={() => setRows((rs) => [...rs, { ...EMPTY }])} className={`${ui.secondaryBtn} self-start`}>
          + {tx.add}
        </button>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className={ui.ghostBtn}>← {c.back}</button>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
          <button type="button" onClick={onSkip} className={ui.ghostBtn}>{tx.skip}</button>
          <button type="submit" className={ui.primaryBtn}>{c.continue}</button>
        </div>
      </div>
    </form>
  );
}
