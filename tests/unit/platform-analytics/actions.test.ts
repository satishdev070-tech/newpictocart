import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({ getPlatformContext: vi.fn() }));
const mut = vi.hoisted(() => ({ updatePlatformSetting: vi.fn() }));
vi.mock("@/lib/platform/access", async () => {
  const { AppError } = await import("@/lib/errors");
  return {
    getPlatformContext: access.getPlatformContext,
    assertPlatformPermission: (ctx: { permissions: ReadonlySet<string> }, p: string) => {
      if (!ctx.permissions.has(p)) throw new AppError("FORBIDDEN");
    },
  };
});
vi.mock("@/features/platform/server/mutations", () => mut);
vi.mock("@/features/platform/server/public-config", () => ({ revalidatePublicConfig: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { saveAnalyticsSettingsAction } from "@/features/platform-analytics/actions";
import { PLATFORM_ROLE_PERMISSIONS } from "@/lib/permissions/matrix";

const superAdmin = { user: { id: "u1" }, role: "super_admin", permissions: PLATFORM_ROLE_PERMISSIONS.super_admin };
const form = (f: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(f)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  access.getPlatformContext.mockResolvedValue(superAdmin);
});

describe("saveAnalyticsSettingsAction", () => {
  it("saves every Google key (unchecked switches as off)", async () => {
    expect(await saveAnalyticsSettingsAction(null, form({ group: "google", ga4_id: "G-66HS2SH61E", ga4_enabled: "on" }))).toEqual({ ok: true, data: undefined });
    expect(mut.updatePlatformSetting.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      ["public.analytics.ga4_id", "G-66HS2SH61E"],
      ["public.analytics.ga4_enabled", "on"],
      ["public.analytics.first_party", null],
    ]);
  });

  it("rejects an invalid pixel without saving anything", async () => {
    const res = await saveAnalyticsSettingsAction(null, form({ group: "meta", meta_pixel: "<script>bad</script>", meta_pixel_enabled: "on" }));
    expect(res).toMatchObject({ ok: false, error: { code: "VALIDATION", fieldErrors: { meta_pixel: [expect.any(String)] } } });
    expect(mut.updatePlatformSetting).not.toHaveBeenCalled();
  });

  it("is super-admin only", async () => {
    access.getPlatformContext.mockResolvedValue({ user: { id: "u2" }, role: "support", permissions: PLATFORM_ROLE_PERMISSIONS.support });
    expect(await saveAnalyticsSettingsAction(null, form({ group: "meta", meta_pixel: "1381937640384459" }))).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(mut.updatePlatformSetting).not.toHaveBeenCalled();
  });
});
