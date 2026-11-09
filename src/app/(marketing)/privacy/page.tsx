import type { Metadata } from "next";
import { buildMarketingMetadata } from "@/features/marketing-site/seo";
import { siteOrigin } from "@/features/marketing-site/site";
import { PLATFORM_NAME } from "@/config/platform";

export function generateMetadata(): Metadata {
  return buildMarketingMetadata({ title: "Privacy policy", description: "Privacy policy for {PLATFORM_NAME}.".replace("{PLATFORM_NAME}", PLATFORM_NAME), path: "/privacy", origin: siteOrigin() });
}

export default function Page() {
  return (
    <article className="bg-mk-bg">
      <div className="mk-container max-w-3xl py-20">
        <p className="mk-label inline-flex items-center gap-2 text-mk-accent">
          <span className="size-1.5 rounded-full bg-mk-accent" aria-hidden />
          Legal
        </p>
        <h1 className="mk-display-lg mt-4 text-balance text-mk-text">Privacy policy</h1>
        <p className="mt-3 text-sm text-mk-dim">Summary version. The full legal text is provided with your subscription agreement.</p>
        <div className="mt-10 space-y-6 border-t border-mk-line pt-10 text-base leading-relaxed text-mk-muted">
          <p>
            We collect only what we need to run your store: account details, store content you upload, and order data your customers submit at checkout. Payment card details are handled by the payment
            gateway and never stored by us. Store data is isolated per store, encrypted in transit, and access by our staff is limited, time-boxed and audited. You can export or delete your store data
            at any time by contacting support.
          </p>
        </div>
      </div>
    </article>
  );
}
