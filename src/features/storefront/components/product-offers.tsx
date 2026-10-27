"use client";

import { useState } from "react";
import type { ProductOffer } from "@/features/checkout/discounts";

/** "Offers available" on the product page: public coupon codes that can apply to this product. */
export function ProductOffers({ offers }: { offers: ProductOffer[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  if (offers.length === 0) return null;
  return (
    <section aria-labelledby="pdp-offers-h" className="sf-border rounded-[var(--sf-radius-card)] border border-dashed p-3">
      <h2 id="pdp-offers-h" className="mb-2 text-sm font-medium">
        Offers available
      </h2>
      <ul className="space-y-2">
        {offers.map((o) => (
          <li key={o.code} className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="font-mono font-medium">{o.code}</span>
              <span className="sf-muted"> · {o.title ? `${o.title} · ` : ""}{o.summary}</span>
            </span>
            <button
              type="button"
              className="sf-link shrink-0 text-xs"
              onClick={() => {
                void navigator.clipboard?.writeText(o.code).then(() => setCopied(o.code), () => undefined);
              }}
            >
              {copied === o.code ? "Copied ✓" : "Copy code"}
            </button>
          </li>
        ))}
      </ul>
      <p className="sf-muted mt-2 text-xs">Apply the code in your bag or at checkout.</p>
    </section>
  );
}
