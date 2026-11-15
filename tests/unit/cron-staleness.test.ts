import { beforeEach, describe, expect, it, vi } from "vitest";
import { SOCIAL_POST_MAX_LATE_HOURS, WHATSAPP_RETRY_MAX_AGE_HOURS, staleBefore } from "@/lib/cron/stale";

/** Records every query chain (table, calls) and the order RPCs/queries happened in. */
type Call = { table: string; ops: [string, unknown[]][] };
const log: { calls: Call[]; order: string[] } = { calls: [], order: [] };
function fakeAdmin(dueRows: unknown[] = []) {
  return {
    from(table: string) {
      const call: Call = { table, ops: [] };
      log.calls.push(call);
      const b: Record<string, unknown> = {};
      for (const op of ["update", "select", "eq", "lt", "lte", "order", "limit", "in"]) {
        b[op] = (...args: unknown[]) => {
          call.ops.push([op, args]);
          if (op === "update" || op === "select") log.order.push(`${table}.${op}`);
          return b;
        };
      }
      b.then = (resolve: (v: unknown) => void) => resolve({ data: call.ops.some(([o]) => o === "select") ? dueRows : null, error: null });
      return b;
    },
    rpc(name: string) {
      log.order.push(`rpc.${name}`);
      return Promise.resolve({ data: [], error: null });
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => fakeAdmin() }));
vi.mock("@/lib/env/server", () => ({ serverEnv: () => ({ CRON_SECRET: "c".repeat(32) }) }));
vi.mock("@/features/social/server/publish", () => ({ claimPost: vi.fn(async () => false), publishPost: vi.fn() }));
vi.mock("@/features/inbox/server/whatsapp", () => ({ activeWhatsApp: vi.fn(), markWhatsAppExpired: vi.fn() }));

beforeEach(() => {
  log.calls = [];
  log.order = [];
});

const op = (c: Call, name: string) => c.ops.find(([o]) => o === name)?.[1];

describe("staleBefore", () => {
  it("returns the ISO time `hours` before now", () => {
    const now = Date.UTC(2026, 10, 15, 12, 0, 0);
    expect(staleBefore(6, now)).toBe("2026-11-15T06:00:00.000Z");
    expect(staleBefore(24, now)).toBe("2026-11-14T12:00:00.000Z");
  });
  it("keeps the agreed windows", () => {
    expect(SOCIAL_POST_MAX_LATE_HOURS).toBe(6);
    expect(WHATSAPP_RETRY_MAX_AGE_HOURS).toBe(24);
  });
});

describe("WhatsApp queue: stale retries are expired, never sent late", () => {
  it("fails queued jobs older than 24 h BEFORE claiming any job to send", async () => {
    const { processDueJobs } = await import("@/features/notifications/whatsapp/queue");
    await processDueJobs(5);
    const expire = log.calls.find((c) => c.table === "notification_jobs" && op(c, "update"));
    expect(expire, "expire update").toBeDefined();
    expect(op(expire!, "update")?.[0]).toMatchObject({ status: "failed" });
    expect(op(expire!, "eq")).toEqual(["status", "queued"]);
    expect(op(expire!, "lt")?.[0]).toBe("created_at");
    expect(log.order.indexOf("notification_jobs.update")).toBeLessThan(log.order.indexOf("rpc.svc_claim_notification_jobs"));
  });
});

describe("social-publish cron: overdue posts are failed, never published late", () => {
  it("fails scheduled posts more than 6 h past their slot BEFORE selecting due posts", async () => {
    const { GET } = await import("@/app/api/cron/social-publish/route");
    const req = { headers: new Headers({ authorization: `Bearer ${"c".repeat(32)}` }) } as unknown as Parameters<typeof GET>[0];
    const res = await GET(req);
    expect(res.status).toBe(200);
    const updates = log.calls.filter((c) => c.table === "social_posts" && op(c, "update"));
    const stale = updates.find((c) => op(c, "lt")?.[0] === "scheduled_at");
    expect(stale, "stale-post update").toBeDefined();
    expect(op(stale!, "update")?.[0]).toEqual({ status: "failed" });
    expect(op(stale!, "eq")).toEqual(["status", "scheduled"]);
    const staleIdx = log.calls.indexOf(stale!);
    const dueIdx = log.calls.findIndex((c) => c.table === "social_posts" && op(c, "select"));
    expect(staleIdx).toBeLessThan(dueIdx);
  });
});
