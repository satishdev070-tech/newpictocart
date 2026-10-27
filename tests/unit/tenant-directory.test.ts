import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: { code: string; message: string; details: string | null; hint: string | null } | null };
const results: Result[] = [];
const logError = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => results.shift() };
    return { from: () => query };
  },
}));
vi.mock("@/lib/observability/logger", () => ({ logger: { error: logError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));
vi.mock("@/lib/env/public", () => ({ publicEnv: () => ({ NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: "pictocart.in" }) }));

beforeEach(() => {
  vi.resetModules();
  results.length = 0;
  logError.mockReset();
});

const load = () => import("@/lib/tenant/directory");

describe("tenantDirectory.findByHost", () => {
  it("returns null for a hostname with no verified domain row (genuine not found)", async () => {
    results.push({ data: null, error: null }, { data: null, error: null }); // host, then its www partner
    const { tenantDirectory } = await load();
    await expect(tenantDirectory.findByHost("unknown.example.com")).resolves.toBeNull();
    expect(logError).not.toHaveBeenCalled();
  });

  it("resolves a verified store host", async () => {
    results.push({ data: { tenant_id: "t1", type: "custom" }, error: null });
    results.push({ data: { slug: "the-paliya", status: "active", stores: [{ name: "The Paliya" }], domains: [{ hostname: "www.thepaliya.com" }] }, error: null });
    const { tenantDirectory } = await load();
    await expect(tenantDirectory.findByHost("www.thepaliya.com")).resolves.toMatchObject({ tenantId: "t1", slug: "the-paliya", name: "The Paliya", primaryHost: "www.thepaliya.com" });
  });

  it("throws (5xx) and logs diagnostics when the lookup query fails, instead of reporting not found", async () => {
    results.push({ data: null, error: { code: "PGRST301", message: "JWT could not be decoded", details: null, hint: null } });
    const { tenantDirectory, TenantDirectoryError } = await load();
    await expect(tenantDirectory.findByHost("acme.pictocart.in")).rejects.toBeInstanceOf(TenantDirectoryError);
    expect(logError).toHaveBeenCalledWith("tenant_directory.lookup_failed", expect.objectContaining({ host: "acme.pictocart.in", code: "PGRST301" }));
  });

  it("throws when the tenant query fails rather than caching a wrong canonical host", async () => {
    results.push({ data: { tenant_id: "t2", type: "platform_subdomain" }, error: null });
    results.push({ data: null, error: { code: "08006", message: "connection failure", details: null, hint: null } });
    const { tenantDirectory, TenantDirectoryError } = await load();
    await expect(tenantDirectory.findByHost("acme.pictocart.in")).rejects.toBeInstanceOf(TenantDirectoryError);
  });
});

describe("www / apex partner of a custom domain", () => {
  const paliya = (type: string) => ({ data: { tenant_id: "t1", type }, error: null });
  const identity = (primary: string | null) => ({ data: { slug: "the-paliya", status: "active", stores: [{ name: "The Paliya" }], domains: primary ? [{ hostname: primary }] : [] }, error: null });

  it("serves www.brand.com from the verified brand.com (canonical stays on the primary)", async () => {
    results.push({ data: null, error: null }, paliya("custom"), identity("thepaliya.com"));
    const { tenantDirectory } = await load();
    await expect(tenantDirectory.findByHost("www.thepaliya.com")).resolves.toMatchObject({ tenantId: "t1", host: "www.thepaliya.com", primaryHost: "thepaliya.com" });
  });

  it("serves brand.com from the verified www.brand.com", async () => {
    results.push({ data: null, error: null }, paliya("custom"), identity(null));
    const { tenantDirectory } = await load();
    await expect(tenantDirectory.findByHost("thepaliya.com")).resolves.toMatchObject({ tenantId: "t1", host: "thepaliya.com", primaryHost: "www.thepaliya.com" });
  });

  it("never borrows a platform subdomain or a non-custom row", async () => {
    const { companionCustomHost } = await load();
    expect(companionCustomHost("acme.pictocart.in", "pictocart.in")).toBeNull();
    expect(companionCustomHost("pictocart.in", "pictocart.in")).toBeNull();
    expect(companionCustomHost("www.com", "pictocart.in")).toBeNull();
    expect(companionCustomHost("thepaliya.com", "pictocart.in")).toBe("www.thepaliya.com");
    expect(companionCustomHost("www.x", "pictocart.in")).toBeNull();
    results.push({ data: null, error: null }, paliya("platform_subdomain"), identity(null));
    const { tenantDirectory } = await load();
    await expect(tenantDirectory.findByHost("www.thepaliya.com")).resolves.toBeNull();
  });
});
