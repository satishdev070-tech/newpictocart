import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantPermission } from "@/lib/permissions/matrix";

/** Records the query chain so tests can assert the tenant filter always comes from the context. */
type Call = { table: string; op: string; args: unknown[] };
let calls: Call[] = [];
let nextResult: { data: unknown; error: unknown; count?: number } = { data: [], error: null };

function builder(table: string) {
  const b: Record<string, unknown> = {};
  const rec = (op: string) => (...args: unknown[]) => {
    calls.push({ table, op, args });
    return b;
  };
  for (const op of ["select", "insert", "update", "upsert", "eq", "neq", "is", "order", "limit", "range", "gte", "lte"]) b[op] = rec(op);
  b.maybeSingle = async () => nextResult;
  b.single = async () => nextResult;
  b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(nextResult).then(res, rej);
  return b;
}

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ from: (t: string) => builder(t) }) }));

const TENANT = "20000000-0000-4000-a000-0000000000a1";
const ctx = (perms: TenantPermission[]) => ({ tenantId: TENANT, permissions: new Set(perms) });

beforeEach(() => {
  calls = [];
  nextResult = { data: [], error: null };
});

describe("informative repo", () => {
  it("checks the permission before touching the database", async () => {
    const repo = await import("@/features/informative/server/repo");
    await expect(repo.softDeleteContent(ctx(["store.read"]), "faqs", "x")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(repo.listEnquiries(ctx(["store.read"]), { page: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(repo.setSiteStatus(ctx(["content.write"]), "PUBLISHED")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(repo.updateAppearance(ctx(["settings.write"]), { themeId: "aura-one" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls).toHaveLength(0);
  });

  it("filters every read by the context tenant and hides soft-deleted rows", async () => {
    const repo = await import("@/features/informative/server/repo");
    await repo.listServices(ctx(["store.read"]));
    expect(calls).toContainEqual({ table: "info_services", op: "eq", args: ["tenant_id", TENANT] });
    expect(calls).toContainEqual({ table: "info_services", op: "is", args: ["deleted_at", null] });
  });

  it("soft delete sets deleted_at for this tenant's row and 404s when nothing matched", async () => {
    const repo = await import("@/features/informative/server/repo");
    nextResult = { data: [], error: null };
    await expect(repo.softDeleteContent(ctx(["content.write"]), "faqs", "f1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    const upd = calls.find((c) => c.op === "update");
    expect(upd?.table).toBe("info_faqs");
    expect(Object.keys(upd?.args[0] as object)).toEqual(["deleted_at"]);
    expect(calls).toContainEqual({ table: "info_faqs", op: "eq", args: ["tenant_id", TENANT] });
  });

  it("system pages cannot be deleted", async () => {
    const repo = await import("@/features/informative/server/repo");
    nextResult = { data: { id: "p1", tenant_id: TENANT, type: "HOME", title: "Home", slug: "home", sections: [], is_published: true, sort_order: 0, seo: {} }, error: null };
    await expect(repo.softDeleteContent(ctx(["content.write", "store.read"]), "pages", "p1")).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("reorder refuses a list that is not exactly the tenant's live rows", async () => {
    const repo = await import("@/features/informative/server/repo");
    nextResult = { data: [{ id: "a" }, { id: "b" }], error: null };
    await expect(repo.reorderContent(ctx(["content.write"]), "faqs", ["a"])).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(repo.reorderContent(ctx(["content.write"]), "faqs", ["a", "c"])).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("publishing stamps published_at", async () => {
    const repo = await import("@/features/informative/server/repo");
    nextResult = {
      data: { tenant_id: TENANT, theme_id: "nexus-core", business_name: "Calm", category: "other", contact: {}, hours: [], social_links: {}, seo: {}, options: {}, status: "PUBLISHED", published_at: "now", updated_at: "" },
      error: null,
    };
    const site = await repo.setSiteStatus(ctx(["theme.publish"]), "PUBLISHED");
    expect(site.status).toBe("PUBLISHED");
    const upd = calls.find((c) => c.op === "update");
    expect(upd?.args[0]).toMatchObject({ status: "PUBLISHED" });
    expect((upd?.args[0] as { published_at?: string }).published_at).toBeTruthy();
  });

  it("enquiry updates touch status/notes only", async () => {
    const repo = await import("@/features/informative/server/repo");
    await expect(repo.updateEnquiry(ctx(["customers.write"]), "e1", {})).rejects.toMatchObject({ code: "VALIDATION" });
    nextResult = { data: { id: "e1", name: "A", phone: "+919876543210", source: "CONTACT_FORM", status: "CONTACTED", created_at: "" }, error: null };
    await repo.updateEnquiry(ctx(["customers.write"]), "e1", { status: "CONTACTED", notes: "" });
    const upd = calls.find((c) => c.op === "update");
    expect(upd?.args[0]).toEqual({ status: "CONTACTED", notes: null });
  });
});
