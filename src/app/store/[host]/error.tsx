"use client";

import { useEffect } from "react";
import Link from "next/link";

type StoreErrorProps = {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
};

/** Storefront segment error UI — themed tokens so it matches the live shop chrome. */
export default function StoreError({ error, retry, reset }: StoreErrorProps) {
  useEffect(() => {
    const message = error instanceof Error ? error.message : String(error);
    const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
    console.error(JSON.stringify({ level: "error", msg: "storefront.route_error", digest: digest || null, message, time: new Date().toISOString() }));
  }, [error]);

  const recover = () => {
    if (typeof retry === "function") retry();
    else if (typeof reset === "function") reset();
    else window.location.reload();
  };

  const digest = error && typeof error === "object" && "digest" in error ? (error as { digest?: string }).digest : undefined;

  return (
    <div className="sf-container sf-section text-center" role="alert">
      <p className="sf-eyebrow">Error</p>
      <h1 className="sf-heading mt-2 text-4xl">Something went wrong</h1>
      <p className="sf-muted mt-3">Please try again in a moment. Your bag and account are unchanged.</p>
      {digest ? <p className="sf-muted mt-2 text-sm">Reference: {digest}</p> : null}
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" className="sf-btn" onClick={recover}>
          Try again
        </button>
        <Link href="/" className="sf-btn sf-btn-outline">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
