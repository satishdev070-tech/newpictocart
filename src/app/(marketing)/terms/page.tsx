import type { Metadata } from "next";
import { buildMarketingMetadata } from "@/features/marketing-site/seo";
import { siteOrigin } from "@/features/marketing-site/site";
import { PLATFORM_NAME } from "@/config/platform";

export function generateMetadata(): Metadata {
  return buildMarketingMetadata({ title: "Terms of service", description: "Terms of service for {PLATFORM_NAME}.".replace("{PLATFORM_NAME}", PLATFORM_NAME), path: "/terms", origin: siteOrigin() });
}

export default function Page() {
  return (
    <article className="bg-mk-bg">
      <div className="mk-container max-w-3xl py-20">
        <p className="mk-label inline-flex items-center gap-2 text-mk-accent">
          <span className="size-1.5 rounded-full bg-mk-accent" aria-hidden />
          Legal
        </p>
        <h1 className="mk-display-lg mt-4 text-balance text-mk-text">Terms of service</h1>
        <p className="mt-3 text-sm text-mk-dim">Summary version. The full legal text is provided with your subscription agreement.</p>
        <div className="mt-10 space-y-6 border-t border-mk-line pt-10 text-base leading-relaxed text-mk-muted">
          <p>
            By creating a store you agree to sell only lawful goods, keep your catalogue and prices accurate, honour your published shipping and return policies, and comply with applicable Indian laws
            including GST and consumer-protection rules. Subscription fees are billed in advance and exclude GST. We may suspend stores that breach these terms, after notice where practical.
          </p>
        </div>
      </div>
    </article>
  );
}
