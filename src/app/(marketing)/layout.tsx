import type { Metadata } from "next";
import { jetbrainsMono, manrope } from "@/app/fonts";
import { cn } from "@/lib/cn";
import { MarketingFooter, MarketingHeader } from "@/features/marketing-site/components/chrome";
import { PlatformTracking } from "@/features/platform-analytics/components/platform-tracking";
import { getLandingContent } from "@/features/marketing-site/server/landing";
import { getPublicPlatformConfig, platformIconMetadata } from "@/features/platform/server/public-config";

export function generateMetadata(): Promise<Metadata> {
  return platformIconMetadata();
}

/** Public marketing site (platform host only; storefront hosts are rewritten before reaching it). */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [{ ga4Id, metaPixelId, firstPartyAnalytics }, landing] = await Promise.all([getPublicPlatformConfig(), getLandingContent()]);
  return (
    <div data-theme="dark" className={cn("theme-brand theme-marketing flex min-h-full flex-1 flex-col", manrope.variable, jetbrainsMono.variable)}>
      <MarketingHeader header={landing.header} />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <MarketingFooter footer={landing.footer} />
      <PlatformTracking ga4Id={ga4Id} metaPixelId={metaPixelId} firstParty={firstPartyAnalytics} />
    </div>
  );
}
