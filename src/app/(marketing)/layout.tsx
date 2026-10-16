import type { Metadata } from "next";
import { MarketingFooter, MarketingHeader } from "@/features/marketing-site/components/chrome";
import { PlatformAnalytics } from "@/features/marketing-site/components/platform-analytics";
import { getLandingContent } from "@/features/marketing-site/server/landing";
import { getPublicPlatformConfig, platformIconMetadata } from "@/features/platform/server/public-config";

export function generateMetadata(): Promise<Metadata> {
  return platformIconMetadata();
}

/** Public marketing site (platform host only; storefront hosts are rewritten before reaching it). */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [{ ga4Id }, landing] = await Promise.all([getPublicPlatformConfig(), getLandingContent()]);
  return (
    <div data-theme="light" className="theme-brand flex min-h-full flex-1 flex-col">
      <MarketingHeader header={landing.header} />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <MarketingFooter footer={landing.footer} />
      {ga4Id ? <PlatformAnalytics id={ga4Id} /> : null}
    </div>
  );
}
