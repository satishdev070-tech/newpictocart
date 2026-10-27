import { beforeEach, describe, expect, it, vi } from "vitest";

const activePublicConfigs = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));
vi.mock("@/features/integrations/server/store", () => ({ activePublicConfigs }));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const load = () => import("@/features/tracking/server/config");

beforeEach(() => {
  vi.resetModules();
  activePublicConfigs.mockReset();
});

describe("getTrackingConfig", () => {
  it("asks only for the tracking providers and maps their public IDs", async () => {
    activePublicConfigs.mockResolvedValue({ ga4: { measurement_id: "G-1" }, google_ads: { ads_id: "AW-2", purchase_label: "x" }, meta_pixel: { pixel_id: "3" } });
    const { getTrackingConfig } = await load();
    await expect(getTrackingConfig("t1")).resolves.toEqual({ ga4: "G-1", ads: { id: "AW-2", label: "x" }, pixel: "3" });
    expect(activePublicConfigs).toHaveBeenCalledWith("t1", ["ga4", "google_ads", "meta_pixel"]);
  });

  it("is null with no usable tags (Ads needs both ID and label)", async () => {
    activePublicConfigs.mockResolvedValue({ google_ads: { ads_id: "AW-2" } });
    const { getTrackingConfig } = await load();
    await expect(getTrackingConfig("t1")).resolves.toBeNull();
  });

  it("never throws: a failed lookup renders no tags", async () => {
    activePublicConfigs.mockRejectedValue(new Error("db down"));
    const { getTrackingConfig } = await load();
    await expect(getTrackingConfig("t1")).resolves.toBeNull();
  });
});
