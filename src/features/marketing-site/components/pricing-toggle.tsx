"use client";

import { cn } from "@/lib/cn";
import type { BillingPeriod } from "../plans";

/**
 * Segmented monthly/yearly pill with a sliding accent indicator.
 * Controlled: pass `period` + `onChange`. Optional save badge on yearly.
 */
export function PricingToggle({
  period,
  onChange,
  saveLabel,
  className,
  labels = { monthly: "Monthly", yearly: "Yearly" },
}: {
  period: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
  /** e.g. "save up to 17%" — shown next to Yearly when provided. */
  saveLabel?: string;
  className?: string;
  labels?: { monthly: string; yearly: string };
}) {
  const yearly = period === "yearly";

  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      className={cn(
        "relative inline-grid grid-cols-2 rounded-full border border-mk-line bg-mk-elev-1 p-1 text-sm font-semibold",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-mk-accent",
          "transition-transform duration-[var(--dur,450ms)] ease-[var(--ease-out,cubic-bezier(0.22,1,0.36,1))]",
          "motion-reduce:transition-none",
          yearly && "translate-x-full",
        )}
      />
      {(["monthly", "yearly"] as const).map((p) => {
        const selected = period === p;
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(p)}
            className={cn(
              "relative z-[1] inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 whitespace-nowrap",
              "transition-colors duration-[var(--dur-fast,200ms)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent",
              selected ? "text-mk-accent-ink" : "text-mk-muted hover:text-mk-text",
            )}
          >
            {labels[p]}
            {p === "yearly" && saveLabel ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  selected ? "bg-mk-accent-ink/15 text-mk-accent-ink" : "bg-mk-accent-tint text-mk-accent",
                )}
              >
                {saveLabel}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
