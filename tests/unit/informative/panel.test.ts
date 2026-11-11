import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DASHBOARD_NAV } from "@/components/dashboard/nav";
import { INFORMATIVE_NAV, informativeNavFor } from "@/features/informative/panel/nav";
import { TENANT_ROLE_PERMISSIONS } from "@/lib/permissions/matrix";

const PANEL = "src/app/informative/(panel)";
function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? pages(p) : f === "page.tsx" ? [p] : [];
  });
}

describe("informative panel routing", () => {
  it("every sidebar item has a page, and the store sidebar is untouched", () => {
    for (const g of INFORMATIVE_NAV) for (const i of g.items) {
      const rel = i.href.replace(/^\/informative/, "");
      expect(statSync(join(PANEL, rel, "page.tsx")).isFile(), i.href).toBe(true);
    }
    expect(JSON.stringify(DASHBOARD_NAV)).not.toContain("/informative");
  });

  it("InformativeRouteGuard: every panel page resolves its tenant through requireInformativeTenant", () => {
    const files = pages(PANEL);
    expect(files.length).toBeGreaterThanOrEqual(17);
    for (const f of files) expect(readFileSync(f, "utf8"), f).toContain("requireInformativeTenant()");
    expect(readFileSync(join(PANEL, "layout.tsx"), "utf8")).toContain("requireInformativeTenant()");
  });

  it("the sidebar follows the member's permissions", () => {
    const associate = informativeNavFor(TENANT_ROLE_PERMISSIONS.sales_associate);
    const owner = informativeNavFor(TENANT_ROLE_PERMISSIONS.owner);
    const hrefs = (g: ReturnType<typeof informativeNavFor>) => g.flatMap((x) => x.items.map((i) => i.href));
    expect(hrefs(owner)).toContain("/informative/settings");
    expect(hrefs(associate)).not.toContain("/informative/settings");
    expect(hrefs(associate)).toContain("/informative/services");
    expect(hrefs(associate)).toContain("/informative/enquiries");
    expect(hrefs(associate)).not.toContain("/informative/appearance");
  });
});

// ---- Server actions (tenant from context, validation, repo calls) ---------------------------------

const ctx = {
  user: { id: "u1", email: "o@x.in", displayName: null },
  tenantId: "20000000-0000-4000-a000-0000000000a1",
  tenantName: "Calm",
  tenantSlug: "calm",
  tenantStatus: "active",
  role: "owner",
  permissions: new Set(TENANT_ROLE_PERMISSIONS.owner),
  memberships: [],
  websiteType: "INFORMATIVE",
};
let current: typeof ctx = ctx;
const repo = {
  createService: vi.fn(async () => ({ id: "s-new" })),
  updateService: vi.fn(async (_c: unknown, id: string) => ({ id })),
  softDeleteContent: vi.fn(async () => undefined),
  reorderContent: vi.fn(async () => undefined),
  listFaqs: vi.fn(async () => [{ id: "a" }, { id: "b" }, { id: "c" }]),
  setSiteStatus: vi.fn(async () => ({})),
  getSite: vi.fn(async () => ({ themeId: "nexus-core" })),
  updateAppearance: vi.fn(async () => ({})),
};
const storesUpdate = vi.fn();
const rpc = vi.fn(async () => ({ error: null }));
const audit = vi.fn(async () => undefined);
vi.mock("@/features/informative/server/context", () => ({ requireInformativeTenant: async () => current }));
vi.mock("@/features/informative/server/repo", () => repo);
vi.mock("@/lib/audit", () => ({ audit }));
vi.mock("@/lib/cache/storefront", () => ({ revalidateStorefront: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant/active", () => ({ setActiveTenant: vi.fn() }));
vi.mock("@/lib/storage/assets", () => ({ assetUrl: (p: string | null) => (p ? `https://cdn.test/${p}` : null) }));
vi.mock("@/lib/storage/upload", () => ({ uploadTenantImage: vi.fn(async () => ({ path: "tenant/20000000-0000-4000-a000-0000000000a1/informative/x.png" })) }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc,
    from: () => ({ update: (v: unknown) => { storesUpdate(v); return { eq: async () => ({ error: null }) }; } }),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => { throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { to }); },
  unstable_rethrow: (e: unknown) => { if (e && typeof e === "object" && "to" in e) throw e; },
}));

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeEach(() => {
  current = ctx;
  for (const fn of [...Object.values(repo), storesUpdate, rpc, audit]) fn.mockClear();
});

describe("panel server actions", () => {
  it("saveService creates without an id and updates with one; price typed in rupees becomes paise", async () => {
    const a = await import("@/features/informative/actions");
    const r1 = await a.saveServiceAction(null, fd({ name: "Cut", priceType: "FIXED", pricePaise: "499.50" }));
    expect(r1.ok).toBe(true);
    expect(repo.createService).toHaveBeenCalledWith(ctx, expect.objectContaining({ name: "Cut", pricePaise: 49950 }));
    await a.saveServiceAction(null, fd({ id: "21000000-0000-4000-a000-0000000000a1", name: "Cut", priceType: "ON_REQUEST" }));
    expect(repo.updateService).toHaveBeenCalledWith(ctx, "21000000-0000-4000-a000-0000000000a1", expect.anything());
  });

  it("rejects bad input before touching the repo", async () => {
    const a = await import("@/features/informative/actions");
    const r = await a.saveServiceAction(null, fd({ name: "", priceType: "FIXED" }));
    expect(r.ok).toBe(false);
    expect(repo.createService).not.toHaveBeenCalled();
    await expect(a.deleteContentAction(fd({ kind: "products", id: "21000000-0000-4000-a000-0000000000a1" }))).rejects.toThrow();
    expect(repo.softDeleteContent).not.toHaveBeenCalled();
  });

  it("moving a row swaps it with its neighbour", async () => {
    const a = await import("@/features/informative/actions");
    const ids = { a: "21000000-0000-4000-a000-00000000000a", b: "21000000-0000-4000-a000-00000000000b", c: "21000000-0000-4000-a000-00000000000c" };
    repo.listFaqs.mockResolvedValueOnce([{ id: ids.a }, { id: ids.b }, { id: ids.c }]);
    await a.moveContentAction(fd({ kind: "faqs", id: ids.b, dir: "up" }));
    expect(repo.reorderContent).toHaveBeenCalledWith(ctx, "faqs", [ids.b, ids.a, ids.c]);
  });

  it("publishing also takes the profile live and is audited", async () => {
    const a = await import("@/features/informative/actions");
    await a.setSiteStatusAction(null, fd({ status: "PUBLISHED" }));
    expect(repo.setSiteStatus).toHaveBeenCalledWith(ctx, "PUBLISHED");
    expect(storesUpdate).toHaveBeenCalledWith(expect.objectContaining({ launch_status: "live" }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "informative.published", tenantId: ctx.tenantId }));
  });

  it("appearance refuses unknown designs and audits a theme switch", async () => {
    const a = await import("@/features/informative/actions");
    const bad = await a.saveAppearanceAction(null, fd({ themeId: "not-a-theme" }));
    expect(bad.ok).toBe(false);
    await a.saveAppearanceAction(null, fd({ themeId: "pure-gold" }));
    expect(repo.updateAppearance).toHaveBeenCalledWith(ctx, expect.objectContaining({ themeId: "pure-gold" }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "informative.theme_changed" }));
  });

  it("only the owner can delete the website", async () => {
    const a = await import("@/features/informative/actions");
    current = { ...ctx, role: "admin" };
    const r = await a.closeSiteAction(null, fd({ confirmSlug: "calm" }));
    expect(r.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    current = ctx;
    await expect(a.closeSiteAction(null, fd({ confirmSlug: "calm" }))).rejects.toMatchObject({ to: "/start" });
    expect(rpc).toHaveBeenCalledWith("close_own_store", { p_tenant: ctx.tenantId, p_confirm_slug: "calm" });
  });

  it("image upload needs content or theme permission and stores under informative/", async () => {
    const a = await import("@/features/informative/actions");
    current = { ...ctx, permissions: new Set(TENANT_ROLE_PERMISSIONS.sales_associate) };
    const f = new FormData();
    f.set("file", new File([new Uint8Array([1])], "a.png", { type: "image/png" }));
    expect((await a.uploadInformativeImageAction(f)).ok).toBe(false);
    current = ctx;
    const r = await a.uploadInformativeImageAction(f);
    expect(r.ok && r.data.path).toContain("/informative/");
  });
});
