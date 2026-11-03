"use client";

import { Badge } from "@/components/ui/layout";
import { CheckboxField, TextField } from "@/components/ui/field";
import { ActionForm, InlineAction } from "@/features/settings/ui/action-controls";
import { PLAN_COUPON_PLAN_OPTIONS, type PlanCoupon } from "./plan-coupons";
import { createPlanCouponAction, setPlanCouponActiveAction } from "./plan-coupon-actions";

const PLAN_LABELS: Record<(typeof PLAN_COUPON_PLAN_OPTIONS)[number], string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
};

export function CreatePlanCouponForm() {
  return (
    <ActionForm action={createPlanCouponAction} submitLabel="Create coupon" success="Coupon created." resetOnSuccess className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {(e) => (
        <>
          <TextField label="Code" name="code" required maxLength={30} placeholder="MISSHUMANN20" hint="3–30 letters, digits, _ or -" errors={e.code} />
          <TextField label="Percent off" name="percentOff" type="number" min={1} max={100} required placeholder="20" errors={e.percentOff} />
          <TextField label="Max uses" name="maxUses" type="number" min={1} optional hint="Leave blank for unlimited" errors={e.maxUses} />
          <TextField label="Starts" name="startsAt" type="date" optional errors={e.startsAt} />
          <TextField label="Ends" name="endsAt" type="date" optional errors={e.endsAt} />
          <fieldset className="sm:col-span-2 lg:col-span-3">
            <legend className="mb-2 text-label">Applies to plans</legend>
            <p className="mb-2 text-caption text-muted">Defaults to Starter + Growth when none are ticked.</p>
            <div className="flex flex-wrap gap-4">
              {PLAN_COUPON_PLAN_OPTIONS.map((code) => (
                <CheckboxField
                  key={code}
                  label={PLAN_LABELS[code]}
                  name="appliesToPlanCodes[]"
                  value={code}
                  defaultChecked={code === "starter" || code === "growth"}
                />
              ))}
            </div>
            {e.appliesToPlanCodes?.length ? <p className="mt-1 text-caption text-error">{e.appliesToPlanCodes[0]}</p> : null}
          </fieldset>
        </>
      )}
    </ActionForm>
  );
}

export function PlanCouponToggle({ coupon }: { coupon: PlanCoupon }) {
  return (
    <InlineAction
      action={setPlanCouponActiveAction}
      fields={{ id: coupon.id, active: coupon.active ? "false" : "true" }}
      label={coupon.active ? "Disable" : "Enable"}
      success={coupon.active ? "Coupon disabled." : "Coupon enabled."}
    />
  );
}

export function PlanCouponStatus({ coupon, now }: { coupon: PlanCoupon; now: Date }) {
  const t = now.getTime();
  if (!coupon.active) return <Badge tone="neutral">disabled</Badge>;
  if (coupon.endsAt && Date.parse(coupon.endsAt) < t) return <Badge tone="neutral">expired</Badge>;
  if (coupon.startsAt && Date.parse(coupon.startsAt) > t) return <Badge tone="info">scheduled</Badge>;
  if (coupon.maxUses != null && coupon.uses >= coupon.maxUses) return <Badge tone="warning">used up</Badge>;
  return <Badge tone="success">active</Badge>;
}
