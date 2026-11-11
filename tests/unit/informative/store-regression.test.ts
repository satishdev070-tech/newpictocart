import { beforeEach, describe, expect, it, vi } from "vitest";

/** Online Store regression for M6: new routes behave like the catch-all; resolver tolerates a missing column. */

let informative: unknown = null;
const redirectOrNotFound = vi.fn(async () => {
  throw Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true });
});
vi.mock("@/features/informative/public/branch", () => ({ informativeTenantFor: async () => informative }));
vi.mock("@/features/storefront/server/context", () => ({ requireStorefront: async () => ({ tenant: { tenantId: "store-1" } }) }));
vi.mock("@/features/storefront/server/redirects", () => ({ redirectOrNotFound }));

beforeEach(() => {
  informative = null;
  redirectOrNotFound.mockClear();
});

describe("new public routes keep Online Store behaviour", () => {
  it.each([
    ["@/app/store/[host]/about/page", {}, "/about"],
    ["@/app/store/[host]/services/page", {}, "/services"],
    ["@/app/store/[host]/gallery/page", {}, "/gallery"],
    ["@/app/store/[host]/services/[slug]/page", { slug: "a b" }, "/services/a%20b"],
  ])("%s → the store's redirects, else 404 (as before)", async (mod, extra, path) => {
    const { default: Page, generateMetadata } = await import(mod);
    await expect(Page({ params: Promise.resolve({ host: "acme.pictocart.in", ...extra }) })).rejects.toMatchObject({ notFound: true });
    expect(redirectOrNotFound).toHaveBeenCalledWith("store-1", path);
    expect(await generateMetadata({ params: Promise.resolve({ host: "acme.pictocart.in", ...extra }) })).toEqual({});
  });
});

// ---- Directory: website_type with a pre-migration fallback -------------------------------------------

const calls: string[] = [];
let firstError: { code: string; message: string } | null = null;
vi.mock("@/lib/cache/storefront", () => ({
  cachedStorefront: (_n: string, fn: (...a: string[]) => unknown) => fn,
  storefrontTag: (id: string) => `t:${id}`,
  TENANT_DIRECTORY_TAG: "dir",
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      let cols = "";
      b.select = (c: string) => { cols = c; calls.push(`${table}:${c}`); return b; };
      b.eq = () => b;
      b.maybeSingle = async () => {
        if (table === "domains") return { data: { tenant_id: "t1", type: "platform_subdomain" }, error: null };
        if (cols.includes("website_type") && firstError) return { data: null, error: firstError };
        return { data: { slug: "acme", status: "active", ...(cols.includes("website_type") ? { website_type: "INFORMATIVE" } : {}), stores: { name: "Acme" }, domains: [{ hostname: "acme.pictocart.in" }] }, error: null };
      };
      return b;
    },
  }),
}));

describe("tenant directory websiteType", () => {
  beforeEach(() => {
    calls.length = 0;
    firstError = null;
    vi.resetModules();
  });
  it("reads website_type", async () => {
    const { tenantDirectory } = await import("@/lib/tenant/directory");
    const t = await tenantDirectory.findByHost("acme.pictocart.in");
    expect(t?.websiteType).toBe("INFORMATIVE");
  });
  it("falls back to ONLINE_STORE when the column doesn't exist yet", async () => {
    firstError = { code: "42703", message: "column tenants.website_type does not exist" };
    const { tenantDirectory } = await import("@/lib/tenant/directory");
    const t = await tenantDirectory.findByHost("acme.pictocart.in");
    expect(t?.websiteType).toBe("ONLINE_STORE");
    expect(calls.filter((c) => c.startsWith("tenants:"))).toHaveLength(2);
  });
});
