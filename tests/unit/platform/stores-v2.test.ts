import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  calls: [] as { fn: string; args: Record<string, unknown> }[],
  v2: { data: null as unknown, error: null as { code: string } | null },
  v1: { data: [] as unknown[], error: null as { code: string } | null },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({ select: () => ({ order: () => ({ order: async () => ({ data: [{ id: "c1", name: "Fashion" }], error: null }) }) }) }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      db.calls.push({ fn, args });
      return fn === "platform_list_stores_v2" ? db.v2 : db.v1;
    },
  }),
}));

import { listStores } from "@/features/platform/server/queries";
import { storeListFilterSchema } from "@/features/platform/schemas";

const row = {
  tenant_id: "t1",
  name: "Nuts",
  slug: "nuts",
  status: "trial",
  plan_name: "Free",
  created_at: "2026-11-27T00:00:00Z",
  owner_email: "o@x.test",
  primary_domain: null,
  products: 3,
  orders: 0,
  customers: 0,
  revenue: 0,
  last_activity: null,
  total_count: 1,
  store_type: "real",
  category_name: null,
};

beforeEach(() => {
  db.calls = [];
  db.v2 = { data: [{ ...row, owner_phone: "+919876543210", website_type: "INFORMATIVE" }], error: null };
  db.v1 = { data: [row], error: null };
});

describe("Admin → Stores listing v2", () => {
  it("parses the website-type filter leniently", () => {
    expect(storeListFilterSchema.parse({ site: "INFORMATIVE" }).site).toBe("INFORMATIVE");
    expect(storeListFilterSchema.parse({ site: "shop" }).site).toBeUndefined();
  });

  it("uses v2: site type, owner phone, and passes the site filter and phone search", async () => {
    const r = await listStores(storeListFilterSchema.parse({ q: "+91 98765", site: "INFORMATIVE" }));
    expect(db.calls[0]).toMatchObject({ fn: "platform_list_stores_v2", args: { p_q: "+91 98765", p_site_type: "INFORMATIVE" } });
    expect(r.siteTyped).toBe(true);
    expect(r.rows[0]).toMatchObject({ siteType: "INFORMATIVE", ownerPhone: "+919876543210", storeType: "real" });
  });

  it("falls back to the old listing until the migration is applied", async () => {
    db.v2 = { data: null, error: { code: "PGRST202" } };
    const r = await listStores(storeListFilterSchema.parse({}));
    expect(db.calls.map((c) => c.fn)).toEqual(["platform_list_stores_v2", "platform_list_stores"]);
    expect(r.siteTyped).toBe(false);
    expect(r.rows[0]).toMatchObject({ siteType: null, ownerPhone: null, name: "Nuts" });
  });

  it("surfaces real errors instead of silently falling back", async () => {
    db.v2 = { data: null, error: { code: "42501" } };
    await expect(listStores(storeListFilterSchema.parse({}))).rejects.toBeTruthy();
    expect(db.calls).toHaveLength(1);
  });
});
