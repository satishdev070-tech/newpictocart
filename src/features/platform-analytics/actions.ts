"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { assertPlatformPermission, getPlatformContext } from "@/lib/platform/access";
import { updatePlatformSetting } from "@/features/platform/server/mutations";
import { revalidatePublicConfig } from "@/features/platform/server/public-config";
import { PUBLIC_CONFIG_KEYS } from "@/features/platform/public-config";
import { parseSettingValue } from "@/features/platform/settings-registry";

/**
 * Super Admin → Analytics settings. Each key is validated by the settings registry and
 * audited by updatePlatformSetting (platform_setting.updated with from/to).
 */

const ANALYTICS_SETTING_GROUPS = {
  google: [
    { key: PUBLIC_CONFIG_KEYS.ga4, field: "ga4_id" },
    { key: PUBLIC_CONFIG_KEYS.ga4Enabled, field: "ga4_enabled" },
    { key: PUBLIC_CONFIG_KEYS.firstParty, field: "first_party" },
  ],
  meta: [
    { key: PUBLIC_CONFIG_KEYS.metaPixel, field: "meta_pixel" },
    { key: PUBLIC_CONFIG_KEYS.metaPixelEnabled, field: "meta_pixel_enabled" },
  ],
} as const;

export async function saveAnalyticsSettingsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("platform.analytics.saveSettings", async () => {
    const raw = formToObject(fd);
    const { group } = parseInput(z.object({ group: z.enum(["google", "meta"]) }), raw);
    const ctx = await getPlatformContext();
    if (!ctx) throw new AppError("FORBIDDEN");
    assertPlatformPermission(ctx, "platform.settings.manage");
    await rateLimit("platform-analytics-settings", ctx.user.id, 30, 600);
    const fields = ANALYTICS_SETTING_GROUPS[group];
    // Validate every field first so a bad ID never leaves the group half-saved.
    const fieldErrors: Record<string, string[]> = {};
    for (const { key, field } of fields) {
      const parsed = parseSettingValue(key, raw[field] ?? null);
      if (!parsed.ok) fieldErrors[field] = [parsed.message];
    }
    if (Object.keys(fieldErrors).length) throw new AppError("VALIDATION", { fieldErrors });
    for (const { key, field } of fields) await updatePlatformSetting(ctx, key, raw[field] ?? null);
    revalidatePublicConfig();
    revalidatePath("/admin/analytics");
  });
}
