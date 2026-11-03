"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { formatMoney, toMinor } from "@/lib/money";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { ActionDialog } from "@/features/settings/ui/action-controls";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { activatePlanAction, decidePlanRequestAction, previewPlanCouponAction, requestPlanAction, type PlanCheckoutResult, type PlanCouponPreview } from "./actions";
import { requestKind, yearlySavingPercent, type BillingCycle } from "./schemas";
import { applyPlanDiscountPaise } from "./plan-discount";
import type { ActionResult } from "@/lib/actions/result";
import type { PlatformGatewayCheckout } from "@/features/ai-credits/gateway-schemas";

export type PlanCardData = {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  limits: Record<string, number | null>;
  features: string[];
};

const LIMIT_LABELS: Record<string, (n: number | null) => string> = {
  products: (n) => (n === null ? "Unlimited products" : `Up to ${n.toLocaleString("en-IN")} products`),
  staff: (n) => (n === null ? "Unlimited staff" : `${n} staff account${n === 1 ? "" : "s"}`),
  storage_mb: (n) => (n === null ? "Unlimited storage" : `${n >= 1024 ? `${Math.round(n / 1024)} GB` : `${n} MB`} media storage`),
  custom_domains: (n) => (n === null ? "Unlimited custom domains" : n === 0 ? "No custom domain" : `${n} custom domain${n === 1 ? "" : "s"}`),
};

const KIND_LABEL = { upgrade: "Upgrade", downgrade: "Downgrade", activate: "Activate", change: "Switch" } as const;

type RazorpayOptions = Record<string, unknown> & {
  handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
};
declare global {
  interface Window {
    Razorpay?: new (o: RazorpayOptions) => { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void };
    Cashfree?: (o: { mode: "sandbox" | "production" }) => { checkout: (o: { paymentSessionId: string; redirectTarget: "_self" }) => Promise<unknown> };
  }
}

function loadExternal(src: string, ready: () => boolean): Promise<boolean> {
  if (ready()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve(ready());
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

async function openPlatformCheckout(checkout: PlatformGatewayCheckout, meta: { storeName: string; description: string }) {
  if (checkout.kind === "payu") {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = checkout.action;
    for (const [k, v] of Object.entries(checkout.fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = k;
      input.value = v;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    return;
  }
  if (checkout.kind === "cashfree") {
    if (!(await loadExternal("https://sdk.cashfree.com/js/v3/cashfree.js", () => Boolean(window.Cashfree))) || !window.Cashfree) {
      throw new Error("Couldn't load Cashfree. Check your connection and try again.");
    }
    await window.Cashfree({ mode: checkout.mode }).checkout({ paymentSessionId: checkout.paymentSessionId, redirectTarget: "_self" });
    return;
  }
  if (!(await loadExternal("https://checkout.razorpay.com/v1/checkout.js", () => Boolean(window.Razorpay))) || !window.Razorpay) {
    throw new Error("Couldn't load the payment window. Check your connection and try again.");
  }
  await new Promise<void>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: checkout.keyId,
      order_id: checkout.providerOrderId,
      amount: checkout.amountMinor,
      currency: "INR",
      name: meta.storeName,
      description: meta.description,
      modal: { ondismiss: () => resolve() },
      handler: () => resolve(),
    });
    rzp.on("payment.failed", (r) => reject(new Error(r.error?.description ?? "Payment failed.")));
    rzp.open();
  });
}

/** Plan cards + monthly/yearly toggle + coupon + Pay now / Request plan. */
export function PlanPicker({
  plans,
  currentId,
  status,
  featureLabels,
  canRequest,
  pendingPlanId,
  onlineCheckoutAvailable,
  storeName,
}: {
  plans: PlanCardData[];
  currentId: string | null;
  status: string;
  featureLabels: Record<string, string>;
  canRequest: boolean;
  pendingPlanId: string | null;
  onlineCheckoutAvailable: boolean;
  storeName: string;
}) {
  const [state, action] = useActionState(requestPlanAction, null as ActionResult<PlanCheckoutResult> | null);
  const [couponState, couponAction] = useActionState(previewPlanCouponAction, null as ActionResult<PlanCouponPreview> | null);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [coupon, setCoupon] = useState("");
  const [paying, setPaying] = useState(false);
  const { show } = useToast();
  const handledOk = useRef<unknown>(null);
  const current = plans.find((p) => p.id === currentId) ?? null;
  const notActive = status === "trial" || status === "suspended";
  const [choice, setChoice] = useState<string>(pendingPlanId ?? (notActive ? (currentId ?? plans[0]?.id ?? "") : (plans.find((p) => current && p.priceMonthly > current.priceMonthly)?.id ?? currentId ?? "")));
  const chosen = plans.find((p) => p.id === choice) ?? null;
  const kind = chosen ? requestKind(current, chosen, notActive) : null;
  const sameAsCurrent = chosen?.id === currentId && !notActive;

  const listPaise = chosen ? toMinor(cycle === "yearly" ? chosen.priceYearly : chosen.priceMonthly) : 0;
  const preview = couponState?.ok ? couponState.data : null;
  const previewMatches = preview && chosen && preview.code === coupon.trim().toUpperCase();
  const discountPercent = previewMatches ? preview.discountPercent : 0;
  const amountPaise = previewMatches ? preview.amountPaise : applyPlanDiscountPaise(listPaise, 0);
  const canPayOnline = onlineCheckoutAvailable && amountPaise > 0 && !sameAsCurrent && Boolean(chosen);

  useEffect(() => {
    if (!state?.ok || state === handledOk.current) return;
    handledOk.current = state;
    const checkout = state.data.checkout;
    if (!checkout) {
      show({ tone: "success", message: "Request sent. We'll confirm by email once your plan is active." });
      return;
    }
    let cancelled = false;
    void (async () => {
      setPaying(true);
      try {
        await openPlatformCheckout(checkout, {
          storeName,
          description: chosen ? `${chosen.name} · ${cycle}` : "Plan upgrade",
        });
        if (cancelled || checkout.kind === "payu") return;
        show({ tone: "success", message: "Payment submitted. Your plan activates once payment is confirmed." });
      } catch (err: unknown) {
        if (!cancelled) show({ tone: "error", message: err instanceof Error ? err.message : "Payment couldn't be started." });
      } finally {
        if (!cancelled) setPaying(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, show, storeName, chosen, cycle]);

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />
      <div className="inline-flex rounded-md border border-border p-0.5 text-small" role="radiogroup" aria-label="Billing cycle">
        {(["monthly", "yearly"] as const).map((c) => (
          <label key={c} className={`cursor-pointer rounded px-3 py-1.5 ${cycle === c ? "bg-primary text-primary-foreground" : "text-muted"}`}>
            <input type="radio" name="cycle" value={c} checked={cycle === c} onChange={() => setCycle(c)} className="sr-only" />
            {c === "monthly" ? "Monthly" : "Yearly"}
          </label>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.id === currentId;
          const price = cycle === "monthly" ? p.priceMonthly : p.priceYearly;
          const save = yearlySavingPercent(p.priceMonthly, p.priceYearly);
          const selected = choice === p.id;
          const displayPaise = selected && discountPercent > 0 ? amountPaise : toMinor(price);
          return (
            <label key={p.id} className={`flex cursor-pointer flex-col rounded-lg border p-5 transition ${selected ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-foreground/30"} ${canRequest ? "" : "cursor-default"}`}>
              <input type="radio" name="planId" value={p.id} checked={choice === p.id} onChange={() => setChoice(p.id)} disabled={!canRequest} className="sr-only" />
              <span className="flex items-center justify-between gap-2">
                <span className="text-h3">{p.name}</span>
                {isCurrent ? <span className="rounded bg-surface-secondary px-2 py-0.5 text-caption font-medium">{notActive ? `Current (${status})` : "Current plan"}</span> : null}
                {pendingPlanId === p.id ? <span className="rounded bg-warning/15 px-2 py-0.5 text-caption font-medium text-warning">Requested</span> : null}
              </span>
              {p.description ? <span className="mt-1 text-small text-muted">{p.description}</span> : null}
              <span className="mt-3 text-h1 tabular-nums">
                {price > 0 ? formatMoney(displayPaise) : "Free"}
                {price > 0 ? <span className="text-small font-normal text-muted"> / {cycle === "monthly" ? "month" : "year"}</span> : null}
              </span>
              {selected && discountPercent > 0 && price > 0 ? (
                <span className="text-caption text-success">
                  {discountPercent}% off · was {formatMoney(toMinor(price))}
                </span>
              ) : null}
              {cycle === "yearly" && save > 0 ? <span className="text-caption text-success">Save {save}% vs monthly</span> : null}
              <ul className="mt-4 space-y-1.5 text-small">
                {Object.entries(p.limits).map(([k, v]) => (LIMIT_LABELS[k] ? <li key={k} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{LIMIT_LABELS[k](v)}</li> : null))}
                {p.features.slice(0, 8).map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                    {featureLabels[f] ?? f.replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            </label>
          );
        })}
      </div>
      {canRequest ? (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <TextField
              label="Coupon code"
              name="couponCode"
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              optional
              autoComplete="off"
              spellCheck={false}
              placeholder="Optional"
              errors={fieldErrors(state).couponCode ?? fieldErrors(couponState).couponCode}
              hint={previewMatches ? `${preview.discountPercent}% off applied` : undefined}
            />
            <SubmitButton
              formAction={couponAction}
              variant="secondary"
              disabled={!chosen || !coupon.trim() || sameAsCurrent}
            >
              Apply coupon
            </SubmitButton>
          </div>
          {couponState?.ok ? (
            <p className="text-small text-success">
              Coupon {couponState.data.code}: {formatMoney(couponState.data.listPaise)} → {formatMoney(couponState.data.amountPaise)}
            </p>
          ) : null}
          <TextAreaField label="Message for our team" name="note" rows={2} maxLength={500} optional errors={fieldErrors(state).note} hint="e.g. GST details for the invoice, or the best time to call you." />
          <div className="flex flex-wrap gap-2">
            {canPayOnline ? (
              <SubmitButton name="intent" value="pay" disabled={!chosen || sameAsCurrent || paying}>
                {paying ? "Opening payment…" : chosen ? `Pay now · ${formatMoney(amountPaise)}` : "Choose a plan"}
              </SubmitButton>
            ) : null}
            <SubmitButton name="intent" value="request" variant={canPayOnline ? "secondary" : "primary"} disabled={!chosen || sameAsCurrent || paying}>
              {chosen ? (sameAsCurrent ? "This is your current plan" : `${KIND_LABEL[kind!]} to ${chosen.name}${cycle === "yearly" ? " (yearly)" : ""}`) : "Choose a plan"}
            </SubmitButton>
          </div>
          <p className="text-caption text-muted">
            {canPayOnline
              ? "Pay now activates the plan after the payment is confirmed. Or send a request and our team will confirm offline."
              : "Our team confirms the request and activates the plan; your store keeps working meanwhile. Payment details are shared with you by our team."}
          </p>
        </div>
      ) : (
        <p className="text-small text-muted">Only the store owner can change the plan.</p>
      )}
    </form>
  );
}

// ---- Platform ---------------------------------------------------------------------------

export function DecidePlanRequest({ requestId, planName, storeName }: { requestId: string; planName: string; storeName: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionDialog
        action={decidePlanRequestAction}
        fields={{ requestId, decision: "approve" }}
        title={`Approve ${planName} for ${storeName}?`}
        description="Switches the store to this plan and makes it active (ends the trial or lifts a suspension). Audited."
        triggerLabel="Approve"
        triggerVariant="primary"
        confirmLabel="Approve & activate"
        success="Approved."
      >
        {(e) => (
          <>
            <TextField label="Paid for (months)" name="months" type="number" min={1} max={60} optional errors={e.months} hint="Recorded in the audit log, e.g. 1 or 12." />
            <TextAreaField label="Note" name="note" rows={2} maxLength={500} optional errors={e.note} hint="e.g. payment reference." />
          </>
        )}
      </ActionDialog>
      <ActionDialog action={decidePlanRequestAction} fields={{ requestId, decision: "decline" }} title="Decline this request?" triggerLabel="Decline" triggerVariant="ghost" confirmLabel="Decline" variant="danger" success="Declined.">
        {(e) => <TextAreaField label="Reason" name="note" rows={2} maxLength={500} optional errors={e.note} />}
      </ActionDialog>
    </div>
  );
}

export function ActivatePlanForm({ tenantId, planId, plans }: { tenantId: string; planId: string | null; plans: { value: string; label: string }[] }) {
  return (
    <ActionDialog
      action={activatePlanAction}
      fields={{ tenantId }}
      title="Activate a paid plan"
      description="Sets the plan and makes the store active (ends a trial or lifts a suspension) in one step. Audited."
      triggerLabel="Activate plan"
      triggerVariant="primary"
      confirmLabel="Activate"
      success="Plan activated."
    >
      {(e) => (
        <>
          <SelectField label="Plan" name="planId" defaultValue={planId ?? ""} options={[{ value: "", label: "Choose…" }, ...plans]} errors={e.planId} />
          <TextAreaField label="Reason" name="reason" required minLength={10} maxLength={500} rows={2} errors={e.reason} hint="e.g. payment received, reference no." />
        </>
      )}
    </ActionDialog>
  );
}
