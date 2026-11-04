import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const evaluateAndRecordAlertsForCron = vi.fn();

vi.mock("@/lib/env/server", () => ({
  serverEnv: () => ({ CRON_SECRET: "test-cron-secret-with-enough-length" }),
}));

vi.mock("@/features/domains/cron-auth", () => ({
  isAuthorizedCronRequest: (auth: string | null, secret: string | undefined) =>
    Boolean(secret && auth === `Bearer ${secret}`),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}));

vi.mock("@/features/observability/server/alerts", () => ({
  evaluateAndRecordAlertsForCron,
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("GET /api/cron/observability soft-fail alerts", () => {
  beforeEach(() => {
    rpc.mockReset();
    evaluateAndRecordAlertsForCron.mockReset();
  });

  it("runs cleanup then alert evaluation", async () => {
    rpc.mockResolvedValue({ data: { deleted_events: 1 }, error: null });
    evaluateAndRecordAlertsForCron.mockResolvedValue([{ ruleId: "r1" }]);
    const { GET } = await import("@/app/api/cron/observability/route");
    const res = await GET(
      new Request("http://localhost/api/cron/observability", {
        headers: { authorization: "Bearer test-cron-secret-with-enough-length" },
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.result).toEqual({ deleted_events: 1 });
    expect(body.alerts).toEqual({ ok: true, proposed: 1 });
    expect(evaluateAndRecordAlertsForCron).toHaveBeenCalledOnce();
  });

  it("still returns cleanup result when alert evaluation throws", async () => {
    rpc.mockResolvedValue({ data: { deleted_events: 0 }, error: null });
    evaluateAndRecordAlertsForCron.mockRejectedValue(new Error("db down"));
    const { logger } = await import("@/lib/observability/logger");
    const { GET } = await import("@/app/api/cron/observability/route");
    const res = await GET(
      new Request("http://localhost/api/cron/observability", {
        headers: { authorization: "Bearer test-cron-secret-with-enough-length" },
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.result).toEqual({ deleted_events: 0 });
    expect(body.alerts).toEqual({ ok: false, error: "db down" });
    expect(logger.error).toHaveBeenCalledWith(
      "cron.observability_alerts_failed",
      expect.objectContaining({ error: "db down" }),
    );
  });
});
