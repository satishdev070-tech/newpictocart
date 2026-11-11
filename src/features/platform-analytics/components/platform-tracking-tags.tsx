import { getPublicPlatformConfig } from "@/features/platform/server/public-config";
import { PlatformTracking } from "./platform-tracking";

/** Server wrapper: reads the cached public config and renders the enabled platform tags. */
export async function PlatformTrackingTags() {
  const { ga4Id, metaPixelId, firstPartyAnalytics } = await getPublicPlatformConfig();
  if (!ga4Id && !metaPixelId && !firstPartyAnalytics) return null;
  return <PlatformTracking ga4Id={ga4Id} metaPixelId={metaPixelId} firstParty={firstPartyAnalytics} />;
}
