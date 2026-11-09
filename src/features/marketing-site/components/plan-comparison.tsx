import { Check, Minus } from "lucide-react";
import { planComparison, type MarketingPlan } from "../plans";

/** Server-rendered feature comparison, derived from plan limits/features only. */
export function PlanComparison({ plans }: { plans: MarketingPlan[] }) {
  const rows = planComparison(plans);
  return (
    <div className="relative overflow-x-auto rounded-mk-lg border border-mk-line bg-mk-elev-1">
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="sr-only">Plan comparison</caption>
        <thead className="bg-mk-elev-2">
          <tr className="border-b border-mk-line-strong">
            <th scope="col" className="px-5 py-4 font-semibold text-mk-muted">
              Feature
            </th>
            {plans.map((p) => (
              <th key={p.code} scope="col" className="px-5 py-4 font-brand text-base font-bold text-mk-text">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, rowIndex) => (
            <tr key={r.label} className={rowIndex % 2 === 0 ? "bg-mk-bg/40" : "bg-mk-elev-1"}>
              <th scope="row" className="border-t border-mk-line px-5 py-3.5 font-medium text-mk-text">
                {r.label}
              </th>
              {r.cells.map((c, i) => (
                <td key={plans[i]!.code} className="border-t border-mk-line px-5 py-3.5 text-mk-text tabular-nums">
                  {c === true ? (
                    <>
                      <Check aria-hidden className="size-4 text-mk-accent" strokeWidth={2.5} />
                      <span className="sr-only">Included</span>
                    </>
                  ) : c === false ? (
                    <>
                      <Minus aria-hidden className="size-4 text-mk-dim" />
                      <span className="sr-only">Not included</span>
                    </>
                  ) : (
                    c
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
