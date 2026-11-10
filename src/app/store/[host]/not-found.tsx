import type { Metadata } from "next";
import Link from "next/link";

/** Missing storefront paths must not be indexed even when a soft-404 streams as 200. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function StoreNotFound() {
  return (
    <div className="sf-container sf-section text-center">
      <p className="sf-eyebrow">404</p>
      <h1 className="sf-heading mt-2 text-4xl">We couldn&apos;t find that page</h1>
      <p className="sf-muted mt-3">It may have moved or is no longer available.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/" className="sf-btn">
          Continue shopping
        </Link>
        <Link href="/search" className="sf-btn sf-btn-outline">
          Search
        </Link>
      </div>
    </div>
  );
}
