import { describe, expect, it, vi } from "vitest";
import { softCount, softData } from "@/features/analytics/soft-query";

vi.mock("@/lib/observability/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe("getDashboardHome soft helpers", () => {
  it("softData returns null on error instead of throwing", () => {
    expect(softData({ data: { ok: true }, error: null }, "ok")).toEqual({ ok: true });
    expect(softData(null, "missing")).toBeNull();
    expect(softData({ data: { ok: true }, error: { message: "timeout", code: "57014" } }, "rpc")).toBeNull();
  });

  it("softCount returns 0 on error / missing so KPI tiles stay empty not pink", () => {
    expect(softCount({ data: null, error: null, count: 4 }, "count")).toBe(4);
    expect(softCount(null, "missing")).toBe(0);
    expect(softCount({ data: null, error: { message: "boom" }, count: 9 }, "fail")).toBe(0);
    expect(softCount({ data: null, error: null, count: null }, "null_count")).toBe(0);
  });
});
