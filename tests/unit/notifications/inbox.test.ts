import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({ getBellData: vi.fn(), markRead: vi.fn(), markUnread: vi.fn(), saveMutedTypes: vi.fn() }));
const auth = vi.hoisted(() => ({ requireTenant: vi.fn(), getPlatformContext: vi.fn() }));
vi.mock("@/features/notifications/inbox/server", () => server);
vi.mock("@/lib/tenant/membership", () => ({
  requireTenant: auth.requireTenant,
  assertPermission: (ctx: { permissions: Set<string> }, p: string) => {
    if (!ctx.permissions.has(p)) throw Object.assign(new Error("forbidden"), { name: "AppError" });
  },
}));
vi.mock("@/lib/platform/access", () => ({ getPlatformContext: auth.getPlatformContext }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { GROUP_LABELS, NOTIFICATION_TYPES, groupsForScope, receivableTypes, relativeTime, safeLink, typesForScope } from "@/features/notifications/inbox/catalog";
import { markAllReadAction, markReadAction, savePreferencesAction } from "@/features/notifications/inbox/actions";
import { PLATFORM_PERMISSIONS, TENANT_PERMISSIONS } from "@/lib/permissions/matrix";
import { DAILY_GENERATION_LIMIT } from "@/features/neural-pulse/schemas";

const MIGRATION = readFileSync(new URL("../../../supabase/migrations/20261016003000_in_app_notifications.sql", import.meta.url), "utf8");

describe("notification catalog", () => {
  it("every type uses a real permission of its scope and a labelled group", () => {
    for (const [type, info] of Object.entries(NOTIFICATION_TYPES)) {
      const perms: readonly string[] = info.scope === "tenant" ? TENANT_PERMISSIONS : PLATFORM_PERMISSIONS;
      expect(perms, type).toContain(info.permission);
      expect(GROUP_LABELS[info.group]).toBeTruthy();
      expect(type).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
    expect(typesForScope("platform").every((t) => t.startsWith("platform."))).toBe(true);
    expect(groupsForScope("tenant")).not.toContain("platform");
  });

  it("matches the SQL producers: each (permission, type) the migration fans out on is in the catalog", () => {
    const calls = [...MIGRATION.matchAll(/notify_(tenant|platform)\((?:[a-z_.]+,\s*)?'([a-z_.]+)',\s*'([a-z_.]+)'/g)];
    expect(calls.length).toBeGreaterThan(15);
    for (const [, scope, perm, type] of calls) {
      const info = (NOTIFICATION_TYPES as Record<string, { scope: string; permission: string }>)[type!];
      expect(info, type).toBeDefined();
      expect(info!.scope).toBe(scope);
      expect(info!.permission, type).toBe(perm);
    }
  });

  it("the SQL AI-credit limit equals DAILY_GENERATION_LIMIT", () => {
    expect(MIGRATION).toContain(`v_limit constant int := ${DAILY_GENERATION_LIMIT};`);
  });

  it("offers only the types a user's permissions can receive", () => {
    const staff = new Set(["orders.read", "inventory.read", "customers.read"]);
    const types = receivableTypes("tenant", (p) => staff.has(p));
    expect(types).toContain("order.new");
    expect(types).toContain("stock.low");
    expect(types).not.toContain("review.new");
    expect(types).not.toContain("plan.trial_expiring");
  });

  it("follows only in-app links", () => {
    expect(safeLink("/dashboard/orders/1")).toBe("/dashboard/orders/1");
    expect(safeLink("/admin")).toBe("/admin");
    expect(safeLink("//evil.com/dashboard")).toBeNull();
    expect(safeLink("https://evil.com")).toBeNull();
    expect(safeLink("/dashboardx")).toBeNull();
    expect(safeLink(null)).toBeNull();
  });

  it("formats relative time", () => {
    const now = Date.parse("2026-10-16T12:00:00Z");
    expect(relativeTime("2026-10-16T11:59:40Z", now)).toBe("just now");
    expect(relativeTime("2026-10-16T11:55:00Z", now)).toMatch(/5 min/);
    expect(relativeTime("2026-10-16T09:00:00Z", now)).toMatch(/3 hr/);
    expect(relativeTime("2026-10-15T11:00:00Z", now)).toBe("yesterday");
    expect(relativeTime("2026-09-01T00:00:00Z", now)).toMatch(/1 Sept? 2026/);
  });
});

describe("notification actions resolve the audience on the server", () => {
  const tenantCtx = { user: { id: "u1" }, tenantId: "t-from-membership", permissions: new Set(["store.read"]) };
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireTenant.mockResolvedValue(tenantCtx);
    auth.getPlatformContext.mockResolvedValue(null);
    server.markRead.mockResolvedValue(1);
  });

  it("marks read for the membership's tenant, never a client-supplied one", async () => {
    const id = "00000000-0000-4000-a000-000000000001";
    const r = await markReadAction({ scope: "tenant", ids: [id], tenantId: "attacker" } as never);
    expect(r).toEqual({ ok: true, data: 1 });
    expect(server.markRead).toHaveBeenCalledWith({ userId: "u1", scope: "tenant", tenantId: "t-from-membership" }, [id]);
  });

  it("rejects bad input and non-staff platform access", async () => {
    expect((await markReadAction({ scope: "tenant", ids: ["nope"] })).ok).toBe(false);
    const r = await markAllReadAction({ scope: "platform" });
    expect(r.ok).toBe(false);
    expect(server.markRead).not.toHaveBeenCalled();
  });

  it("saves unchecked offered types as muted, ignoring unknown types", async () => {
    const fd = new FormData();
    fd.set("scope", "tenant");
    for (const t of ["order.new", "stock.low", "customer.new"]) fd.append("offered[]", t);
    fd.append("enabled[]", "order.new");
    expect((await savePreferencesAction(null, fd)).ok).toBe(true);
    expect(server.saveMutedTypes).toHaveBeenCalledWith("u1", "tenant", ["stock.low", "customer.new"]);

    const bad = new FormData();
    bad.set("scope", "tenant");
    bad.append("offered[]", "order.new; drop table");
    expect((await savePreferencesAction(null, bad)).ok).toBe(false);
  });
});
