import type { Metadata } from "next";
import { requirePlatform } from "@/lib/platform/access";
import { PageHeader, Card } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { listPlanCoupons } from "@/features/billing/plan-coupon-server";
import { CreatePlanCouponForm, PlanCouponStatus, PlanCouponToggle } from "@/features/billing/plan-coupon-components";

export const metadata: Metadata = { title: "Plan coupons" };

export default async function PlanCouponsPage() {
  const ctx = await requirePlatform("platform.plans.manage");
  const coupons = await listPlanCoupons(ctx);
  const now = new Date();

  return (
    <div className="space-y-6">
      <PageHeader title="Plan coupons" description="Percent-off codes for platform plan checkout. Sellers enter a code when paying for Starter, Growth, or other allowed plans." />

      {!coupons.available ? (
        <p role="status" className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
          Plan coupons need migration <code className="font-mono">20261103006200_platform_plan_coupons.sql</code>. Apply it, then refresh.
        </p>
      ) : null}

      <Card title="New coupon" description="Codes are stored uppercase. Leave plan checkboxes on Starter + Growth for the usual paid tiers, or tick others as needed.">
        <CreatePlanCouponForm />
      </Card>

      <Card title="Coupons">
        {coupons.data.length ? (
          <ul className="divide-y divide-border text-small">
            {coupons.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-mono font-medium">
                    {c.code} <PlanCouponStatus coupon={c} now={now} />
                  </p>
                  <p className="text-caption text-muted">
                    {c.percentOff}% off · plans {c.appliesToPlanCodes.join(", ") || "—"} · {c.startsAt ? new Date(c.startsAt).toLocaleDateString("en-IN") : "any start"} →{" "}
                    {c.endsAt ? new Date(c.endsAt).toLocaleDateString("en-IN") : "no end"} · {c.uses}
                    {c.maxUses != null ? ` / ${c.maxUses}` : ""} uses
                  </p>
                </div>
                <PlanCouponToggle coupon={c} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No plan coupons yet" description="Create a code above — for example MISSHUMANN20 at 20% off Starter and Growth." />
        )}
      </Card>
    </div>
  );
}
