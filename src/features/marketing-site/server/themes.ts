import "server-only";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { liveDemoOrigins } from "@/features/theme/marketplace/server";
import { livePreviewUrl } from "@/features/theme/marketplace/live-preview";
import { SHOWCASE_STORES } from "@/features/theme/marketplace/showcase";
import { logger } from "@/lib/observability/logger";
import type { MarketplaceTheme } from "@/features/theme/marketplace/catalog";
import { pickPreviewDemo } from "../themes";

/**
 * Live Preview URLs for public theme cards: the theme rendered on a demo (showcase) store via
 * ?sf_theme=<key>. Applied in memory only for showcase tenants, so previews never write to any
 * store. Each theme uses its own demo store when it is live, otherwise the best other live
 * showcase store (pickPreviewDemo). Themes with no live demo at all get no entry: the on-site
 * preview page (/themes/[key]/preview) then shows the sample store instead.
 */
export async function livePreviewUrls(themes: readonly MarketplaceTheme[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!themes.length) return out;
  let live = new Set<string>();
  try {
    live = await liveDemoOrigins(Object.keys(SHOWCASE_STORES));
  } catch (error) {
    logger.warn("marketing.theme_demos_unavailable", { error: error instanceof Error ? error.message : "unknown" });
  }
  for (const t of themes) {
    const demo = pickPreviewDemo(t, live);
    if (!demo) continue;
    try {
      out.set(t.key, livePreviewUrl(storeOrigin(storeSubdomain(demo)), t.key));
    } catch {
      // storeSubdomain needs the platform env; without it there is simply no live preview.
    }
  }
  return out;
}
