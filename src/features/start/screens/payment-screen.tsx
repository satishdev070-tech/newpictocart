"use client";

import { cn } from "@/lib/cn";
import { startCopy } from "../copy";
import type { StartDraft } from "../draft/schema";
import { progressFor } from "../flow";

export function PaymentScreen({
  draft,
  onChange,
  onNext,
}: {
  draft: StartDraft;
  onChange: (patch: Partial<StartDraft["payment"]>) => void;
  onNext: () => void;
}) {
  const c = startCopy(draft.locale);
  const manual = progressFor("payment", draft.path, draft.locale).manual;
  const pay = draft.payment;

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      {manual ? <p className="text-xs text-[#6B6275]">{manual}</p> : null}
      <h2 className="font-brand text-3xl text-center">
        {c.payment.title}
        <span className="text-[#C2410C]">{c.payment.titleAccent}</span>?
      </h2>
      <div className="space-y-5 rounded-[28px] border border-white/90 bg-white/75 p-6 shadow-sm">
        <label className="block text-sm font-medium">
          {c.payment.upiLabel}
          <input
            value={pay.upi}
            onChange={(e) => onChange({ upi: e.target.value })}
            placeholder="meera@okaxis"
            className="mt-2 w-full rounded-xl border px-3 py-2.5"
          />
        </label>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">{c.payment.cod}</p>
            <p className="text-xs text-[#6B6275]">{c.payment.codSub}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pay.cod}
            onClick={() => onChange({ cod: !pay.cod })}
            className={cn("relative h-7 w-12 rounded-full transition", pay.cod ? "bg-[#F97316]" : "bg-[#CBD5E1]")}
          >
            <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition", pay.cod ? "left-5" : "left-0.5")} />
          </button>
        </div>
        <div>
          <p className="mb-2 font-medium">{c.payment.shipping}</p>
          <div className="space-y-2">
            {(
              [
                ["free-over", c.payment.shipFree],
                ["flat", c.payment.shipFlat],
                ["courier", c.payment.shipCourier],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ shipping: id })}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm",
                  pay.shipping === id ? "border-[#F97316] bg-[#FFF7ED]" : "border-[#2A2233]/8 bg-white",
                )}
              >
                {label}
                <span className={cn("size-4 rounded-full border-2", pay.shipping === id ? "border-[#F97316] bg-[#F97316]" : "border-[#CBD5E1]")} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onNext} className="rounded-full bg-[#F97316] px-7 py-3.5 font-semibold text-white">
          {c.payment.next}
        </button>
      </div>
    </section>
  );
}
