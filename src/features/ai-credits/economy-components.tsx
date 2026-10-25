"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/layout";
import { CheckboxField, TextAreaField, TextField } from "@/components/ui/field";
import { ActionDialog, ActionForm, InlineAction } from "@/features/settings/ui/action-controls";
import { creditGrossMarginBps, creditsForAmount, sellPriceCentiPaise, type CreditPricing } from "@/features/platform-finance/calc";
import { centiPaiseToRupees, customCredits, multiplierToX100, rupeesToCentiPaise, trimDecimal, x100ToMultiplier, type ActionCostRow, type PackRow, type PromoRow } from "./economy-schemas";
import { createPromoAction, deletePackAction, grantCreditsEconomyAction, saveActionCostAction, savePackAction, savePricingAction, setPromoActiveAction } from "./economy-actions";

const rupees = (minor: number) => trimDecimal((minor / 100).toFixed(2));

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Pricing form with a live preview computed by the same calc functions the server uses. */
export function PricingForm({ pricing }: { pricing: CreditPricing }) {
  const [base, setBase] = useState(trimDecimal(centiPaiseToRupees(pricing.baseCostCentiPaise)));
  const [margin, setMargin] = useState(trimDecimal(x100ToMultiplier(pricing.marginX100)));
  const [perRupee, setPerRupee] = useState(String(pricing.creditsPerRupee));
  const p = { baseCostCentiPaise: safe(() => rupeesToCentiPaise(base), 0), marginX100: safe(() => multiplierToX100(margin), 0) };
  const sell = sellPriceCentiPaise(p);
  const marginPct = creditGrossMarginBps(p) / 100;
  const per100 = creditsForAmount(10_000, p);
  const custom100 = customCredits(10_000, Number(perRupee) || 0);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <ActionForm action={savePricingAction} submitLabel="Save pricing" success="Pricing saved." className="space-y-4">
        {(e) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Base cost per credit (₹)" name="baseCost" inputMode="decimal" required value={base} onChange={(ev) => setBase(ev.target.value)} hint="What one credit costs us in AI spend, up to 4 decimals." errors={e.baseCost} />
              <TextField label="Margin multiplier (×)" name="margin" inputMode="decimal" required value={margin} onChange={(ev) => setMargin(ev.target.value)} hint="Sell price = base cost × margin." errors={e.margin} />
              <TextField label="Custom credits per ₹1" name="creditsPerRupee" type="number" min={1} required value={perRupee} onChange={(ev) => setPerRupee(ev.target.value)} hint="For custom amounts at checkout." errors={e.creditsPerRupee} />
              <TextField label="Welcome credits" name="welcomeCredits" type="number" min={0} required defaultValue={pricing.welcomeCredits} hint="Given once to every new store." errors={e.welcomeCredits} />
              <TextField label="Custom amount minimum (₹)" name="customMin" inputMode="decimal" required defaultValue={rupees(pricing.customMinMinor)} errors={e.customMin} />
              <TextField label="Custom amount maximum (₹)" name="customMax" inputMode="decimal" required defaultValue={rupees(pricing.customMaxMinor)} errors={e.customMax} />
              <TextField label="Low balance warning (credits)" name="lowBalance" type="number" min={0} required defaultValue={pricing.lowBalance} errors={e.lowBalance} />
              <TextField label="Critical balance warning (credits)" name="criticalBalance" type="number" min={0} required defaultValue={pricing.criticalBalance} errors={e.criticalBalance} />
              <TextField label="Freelancer cost per hour (₹)" name="freelancerHourly" inputMode="decimal" required defaultValue={rupees(pricing.freelancerHourlyMinor)} hint="Used to value time saved in Insights." errors={e.freelancerHourly} />
            </div>
          </>
        )}
      </ActionForm>
      <aside aria-live="polite" className="h-fit space-y-3 rounded-lg border border-border bg-surface-secondary/40 p-4 text-small">
        <p className="font-semibold">Live preview</p>
        <p>
          Sell price per credit: <span className="font-medium tabular-nums">₹{trimDecimal(centiPaiseToRupees(Math.max(0, sell)))}</span>
        </p>
        <p>
          Gross margin: <span className="font-medium tabular-nums">~{marginPct.toFixed(1)}%</span>
        </p>
        <p>
          ₹100 buys <span className="font-medium tabular-nums">{per100.toLocaleString("en-IN")}</span> credits at the sell price
        </p>
        <p>
          ₹100 custom amount gives <span className="font-medium tabular-nums">{custom100.toLocaleString("en-IN")}</span> credits
        </p>
        {p.marginX100 > 0 && p.marginX100 < 100 ? <p className="text-error">Margin below 1× sells credits at a loss.</p> : null}
      </aside>
    </div>
  );
}

export function ActionCostForm({ row }: { row: ActionCostRow }) {
  return (
    <ActionForm action={saveActionCostAction} fields={{ kind: row.kind }} submitLabel="Save" success={`${row.label} saved.`} submitVariant="secondary" className="grid items-end gap-3 sm:grid-cols-[1fr_7rem_8rem_auto]">
      {(e) => (
        <>
          <TextField label={`Label (${row.kind})`} name="label" required defaultValue={row.label} maxLength={80} errors={e.label} />
          <TextField label="Credits" name="credits" type="number" min={1} max={1000} required defaultValue={row.credits} errors={e.credits} />
          <TextField label="Minutes saved" name="minutesSaved" type="number" min={0} max={6000} required defaultValue={row.minutesSaved} errors={e.minutesSaved} />
        </>
      )}
    </ActionForm>
  );
}

function PackFields({ pack, errors }: { pack?: PackRow; errors: Record<string, string[]> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {pack ? null : <TextField label="Code" name="code" required maxLength={31} placeholder="festive" hint="Lowercase letters, digits and _" errors={errors.code} />}
      <TextField label="Label" name="label" required maxLength={60} defaultValue={pack?.label} errors={errors.label} />
      <TextField label="Credits" name="credits" type="number" min={1} required defaultValue={pack?.credits} errors={errors.credits} />
      <TextField label="Price (₹)" name="price" inputMode="decimal" required defaultValue={pack ? rupees(pack.priceMinor) : ""} errors={errors.price} />
      <TextField label="Sort order" name="sortOrder" type="number" defaultValue={pack?.sortOrder ?? 0} errors={errors.sortOrder} />
      <CheckboxField label="Active (shown to sellers)" name="active" defaultChecked={pack?.active ?? true} />
    </div>
  );
}

export function CreatePackDialog() {
  return (
    <ActionDialog action={savePackAction} fields={{ mode: "create" }} title="New credit pack" triggerLabel="New pack" confirmLabel="Create pack" success="Pack created." triggerVariant="primary">
      {(e) => <PackFields errors={e} />}
    </ActionDialog>
  );
}

export function EditPackDialog({ pack }: { pack: PackRow }) {
  return (
    <ActionDialog action={savePackAction} fields={{ mode: "update", code: pack.code }} title={`Edit ${pack.label}`} triggerLabel="Edit" confirmLabel="Save pack" success="Pack saved.">
      {(e) => <PackFields pack={pack} errors={e} />}
    </ActionDialog>
  );
}

export function DeletePackDialog({ pack }: { pack: PackRow }) {
  return <ActionDialog action={deletePackAction} fields={{ code: pack.code }} title={`Delete ${pack.label}?`} description="Sellers stop seeing this pack. Past purchases keep their pack code. To hide it for now, untick Active instead." triggerLabel="Delete" confirmLabel="Delete pack" variant="danger" success="Pack deleted." />;
}

export function CreatePromoForm() {
  return (
    <ActionForm action={createPromoAction} submitLabel="Create promo" success="Promo created." resetOnSuccess className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {(e) => (
        <>
          <TextField label="Code" name="code" required maxLength={30} placeholder="DIWALI25" errors={e.code} />
          <TextField label="Bonus %" name="bonusPct" type="number" min={1} max={500} required errors={e.bonusPct} />
          <TextField label="Starts" name="startsAt" type="date" optional errors={e.startsAt} />
          <TextField label="Ends" name="endsAt" type="date" optional errors={e.endsAt} />
          <TextField label="Max uses" name="maxUses" type="number" min={1} optional errors={e.maxUses} />
        </>
      )}
    </ActionForm>
  );
}

export function PromoToggle({ promo }: { promo: PromoRow }) {
  return <InlineAction action={setPromoActiveAction} fields={{ id: promo.id, active: promo.active ? "false" : "true" }} label={promo.active ? "Disable" : "Enable"} success={promo.active ? "Promo disabled." : "Promo enabled."} />;
}

export function GrantCreditsDialog({ tenantId, storeName }: { tenantId: string; storeName: string }) {
  return (
    <ActionDialog action={grantCreditsEconomyAction} fields={{ tenantId }} title={`Adjust credits for ${storeName}`} description="Use a positive number to grant credits and a negative number to remove them. Every adjustment is kept in the ledger and audit log." triggerLabel="Grant credits" confirmLabel="Save adjustment" success="Credit balance adjusted.">
      {(e) => (
        <>
          <TextField label="Credits (+/-)" name="credits" type="number" required errors={e.credits} />
          <TextAreaField label="Reason" name="note" rows={2} required maxLength={500} errors={e.note} />
        </>
      )}
    </ActionDialog>
  );
}

export function PromoStatus({ promo, today }: { promo: PromoRow; today: string }) {
  if (!promo.active) return <Badge tone="neutral">disabled</Badge>;
  if (promo.endsAt && promo.endsAt < today) return <Badge tone="neutral">expired</Badge>;
  if (promo.startsAt && promo.startsAt > today) return <Badge tone="info">scheduled</Badge>;
  if (promo.maxUses != null && promo.uses >= promo.maxUses) return <Badge tone="warning">used up</Badge>;
  return <Badge tone="success">active</Badge>;
}

