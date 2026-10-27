"use client";

import { useState, useTransition } from "react";
import { applyDiscountAction, removeDiscountAction } from "@/features/cart/actions";
import type { OfferView } from "@/features/checkout/offers";
import { formatMoney } from "@/lib/money";

/**
 * Coupon code entry + "View offers" for the cart and checkout. Uses buttons, not a <form>, so it
 * can sit inside the checkout form (Enter applies the code instead of placing the order).
 * The server validates the code and re-prices the bag; `onChange` lets the checkout re-quote.
 */
export function CouponPanel({ applied, message, offers, onChange }: { applied: string | null; message: string | null; offers: OfferView[]; onChange?: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showOffers, setShowOffers] = useState(false);
  const [pending, start] = useTransition();

  function apply(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Enter a code");
      return;
    }
    start(async () => {
      const fd = new FormData();
      fd.set("code", trimmed);
      const r = await applyDiscountAction(null, fd);
      setError(r.ok ? null : (r.error.fieldErrors?.code?.[0] ?? r.error.message));
      if (r.ok) setCode("");
      onChange?.();
    });
  }

  function remove() {
    start(async () => {
      await removeDiscountAction(null, new FormData());
      setError(null);
      onChange?.();
    });
  }

  const available = offers.filter((o) => o.status === "applicable" && !o.applied).length;

  return (
    <div className="space-y-2" aria-busy={pending}>
      {applied ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span>
            Code <strong className="font-mono">{applied}</strong> applied
          </span>
          <button type="button" onClick={remove} disabled={pending} className="sf-link text-xs">
            Remove
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <label htmlFor="coupon" className="sr-only">
            Coupon code
          </label>
          <input
            id="coupon"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply(code);
              }
            }}
            placeholder="Coupon code"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={40}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "coupon-err" : undefined}
            className="sf-input min-w-0 flex-1 py-2 uppercase"
          />
          <button type="button" onClick={() => apply(code)} disabled={pending} className="sf-btn sf-btn-outline min-h-10 py-2">
            {pending ? "…" : "Apply"}
          </button>
        </div>
      )}
      {error ? (
        <p id="coupon-err" role="alert" className="text-xs text-[var(--sf-sale)]">
          {error}
        </p>
      ) : message ? (
        <p className="text-xs">{message}</p>
      ) : null}

      {offers.length ? (
        <div>
          <button type="button" onClick={() => setShowOffers((v) => !v)} aria-expanded={showOffers} aria-controls="offers-list" className="sf-link text-sm">
            {showOffers ? "Hide offers" : `View offers (${offers.length})`}
            {!showOffers && available ? <span className="sf-muted"> · {available} can be applied</span> : null}
          </button>
          {showOffers ? (
            <ul id="offers-list" className="mt-2 space-y-2">
              {offers.map((o) => (
                <li key={o.code} className="sf-border flex items-start justify-between gap-3 rounded border border-dashed p-3 text-sm">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-mono font-medium">{o.code}</p>
                    {o.title ? <p>{o.title}</p> : null}
                    <p className="sf-muted text-xs">{o.summary}</p>
                    {o.status === "applicable" ? (
                      o.savings > 0 ? <p className="text-xs text-[var(--sf-sale)]">You save {formatMoney(o.savings)}</p> : o.freeShipping ? <p className="text-xs">Free shipping on this order</p> : null
                    ) : (
                      <p className="text-xs">Add {formatMoney(o.shortfall)} more to use this code</p>
                    )}
                  </div>
                  {o.applied ? (
                    <span className="shrink-0 text-xs font-medium">Applied ✓</span>
                  ) : (
                    <button type="button" onClick={() => apply(o.code)} disabled={pending || o.status !== "applicable"} className="sf-btn sf-btn-outline min-h-9 shrink-0 px-3 py-1 text-xs disabled:opacity-50">
                      Apply
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
