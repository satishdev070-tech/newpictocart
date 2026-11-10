"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { hasYearlyBilling, isFreeForeverPlan, maxYearlySavingsPercent, planHighlights, planPriceView, recommendedPlanCode, yearlySavingsPercent, type BillingPeriod, type MarketingPlan } from "../plan-view";
import { signupHref } from "../content";
import { analyticsAttributes } from "../analytics";
import { buttonClass } from "./ui";

/**
 * Plan cards. Prices, limits and trials come from public.plans (server/plans.ts). Choosing a plan
 * only carries the plan code into sign-up; it never grants access (entitlements are server-side).
 */
export function PricingTable({ plans, headingLevel = "h3" }: { plans: MarketingPlan[]; headingLevel?: "h2" | "h3" }) {
  const yearly = hasYearlyBilling(plans);
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const save = maxYearlySavingsPercent(plans);
  const rec = recommendedPlanCode(plans);
  const H = headingLevel;
  return (
    <div>
      {yearly ? (
        <div className="mb-10 flex justify-center">
          <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-full border border-mk-line bg-mk-elev-1 p-1 text-sm font-semibold">
            {(["monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={period === p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded-full px-5 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-mk-accent",
                  period === p ? "bg-mk-accent text-mk-accent-ink" : "text-mk-muted hover:bg-mk-elev-2 hover:text-mk-text",
                )}
                {...analyticsAttributes("billing_toggle", p, "pricing")}
              >
                {p === "monthly" ? "Monthly" : "Yearly"}
                {p === "yearly" && save > 0 ? (
                  <span className={cn("ml-2 rounded-full px-2 py-0.5 text-xs", period === p ? "bg-mk-accent-ink/15" : "bg-mk-accent-tint text-mk-accent")}>
                    save up to {save}%
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <ul className={cn("grid gap-6", plans.length >= 3 ? "lg:grid-cols-3" : "md:grid-cols-2")}>
        {plans.map((plan) => {
          const v = planPriceView(plan, yearly ? period : "monthly");
          const featured = plan.code === rec;
          const saving = yearlySavingsPercent(plan.monthlyMinor, plan.yearlyMinor);
          return (
            <li
              key={plan.code}
              className={cn(
                "relative flex flex-col rounded-[var(--r-lg)] border bg-mk-elev-1 p-7",
                featured
                  ? "z-[1] border-mk-accent shadow-brand-float ring-1 ring-mk-accent/40 lg:-translate-y-3 mk-card-glow"
                  : "border-mk-line",
              )}
            >
              {featured ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-mk-accent px-3 py-1 text-xs font-bold whitespace-nowrap text-mk-accent-ink">
                  Most Popular
                </span>
              ) : null}
              <H className="font-brand text-xl font-bold text-mk-text">{plan.name}</H>
              {plan.description ? <p className="mt-1 text-sm text-mk-muted">{plan.description}</p> : null}
              <p className="mt-6 flex items-baseline gap-1 text-mk-text">
                <span className="font-brand text-4xl font-extrabold tabular-nums">{v.amount}</span>
                <span className="text-mk-muted">{v.unit}</span>
              </p>
              <p className="mt-1 text-xs text-mk-dim">
                {v.note}
                {period === "yearly" && saving > 0 ? ` · saves ${saving}%` : ""}
              </p>
              {isFreeForeverPlan(plan) ? (
                <p className="mt-3 inline-flex w-fit rounded-full bg-mk-accent-tint px-3 py-1 text-xs font-semibold text-mk-accent">Free forever</p>
              ) : plan.trialDays ? (
                <p className="mt-3 inline-flex w-fit rounded-full bg-mk-accent-tint px-3 py-1 text-xs font-semibold text-mk-accent">{plan.trialDays}-day free trial</p>
              ) : null}
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-mk-text">
                {planHighlights(plan).map((h) => (
                  <li key={h} className="flex gap-2.5">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-mk-accent" strokeWidth={2.5} />
                    {h}
                  </li>
                ))}
              </ul>
              <Link
                href={signupHref({ plan: plan.code })}
                className={cn(
                  "mt-8",
                  featured
                    ? buttonClass("cta", "md", "w-full rounded-full bg-mk-accent font-bold text-mk-accent-ink shadow-[0_12px_40px_-12px_var(--accent-glow)] hover:bg-mk-accent-hover")
                    : buttonClass("secondary", "md", "w-full rounded-full border-mk-line-strong bg-transparent text-mk-text hover:border-mk-accent hover:text-mk-accent"),
                )}
                {...analyticsAttributes("cta_click", `plan_${plan.code}`, "pricing")}
              >
                Choose {plan.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
