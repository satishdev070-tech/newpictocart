import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { TENANT_ROLE_PERMISSIONS, type TenantPermission } from "@/lib/permissions/matrix";

const TENANT = "20000000-0000-4000-a000-0000000000a1";
const PAGE = "30000000-0000-4000-a000-0000000000b2";
const ctxFor = (permissions: Iterable<TenantPermission>) => ({
  user: { id: "u1", email: "o@x.in", displayName: null },
  tenantId: TENANT,
  tenantName: "Calm",
  tenantSlug: "calm",
  tenantStatus: "active",
  role: "owner",
  permissions: new Set<TenantPermission>(permissions),
  memberships: [],
  websiteType: "INFORMATIVE",
});
let current = ctxFor(TENANT_ROLE_PERMISSIONS.owner);
const saveEditorPageSections = vi.fn(async (..._args: unknown[]) => "2026-11-17T10:00:00.000001+00:00");
const revalidateStorefront = vi.fn();

vi.mock("@/features/informative/server/context", () => ({
  requireInformativeTenant: async () => current,
  assertInformativePermission: (ctx: { permissions: ReadonlySet<string> }, p: string) => {
    if (!ctx.permissions.has(p)) throw new AppError("FORBIDDEN");
  },
}));
vi.mock("@/features/informative/server/editor-repo", () => ({ saveEditorPageSections }));
vi.mock("@/lib/cache/storefront", () => ({ revalidateStorefront }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => undefined }));

const { saveEditorPageAction } = await import("@/features/informative/editor/actions");
const hero = { id: "hero-0", type: "hero", props: { heading: "  Hello  ", subheading: "" }, order: 4, visible: true };

beforeEach(() => {
  current = ctxFor(TENANT_ROLE_PERMISSIONS.owner);
  saveEditorPageSections.mockClear();
  revalidateStorefront.mockClear();
});

describe("saveEditorPageAction", () => {
  it("validates, compacts and writes for the member's own tenant", async () => {
    const r = await saveEditorPageAction({ pageId: PAGE, sections: [hero], expectedUpdatedAt: "2026-11-17T09:00:00+00:00" });
    expect(r).toEqual({ ok: true, data: { updatedAt: "2026-11-17T10:00:00.000001+00:00" } });
    const [ctx, pageId, sections, expected] = saveEditorPageSections.mock.calls[0]!;
    expect((ctx as { tenantId: string }).tenantId).toBe(TENANT);
    expect(pageId).toBe(PAGE);
    expect(sections).toEqual([{ id: "hero-0", type: "hero", props: { heading: "Hello" }, order: 0, visible: true }]);
    expect(expected).toBe("2026-11-17T09:00:00+00:00");
    expect(revalidateStorefront).toHaveBeenCalledWith(TENANT);
  });

  it("needs content.write", async () => {
    current = ctxFor([...TENANT_ROLE_PERMISSIONS.sales_associate].filter((p) => p !== "content.write"));
    const r = await saveEditorPageAction({ pageId: PAGE, sections: [hero] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
    expect(saveEditorPageSections).not.toHaveBeenCalled();
  });

  it("rejects sections the schema rejects, bad page ids and unsafe links", async () => {
    const cases: unknown[] = [
      { pageId: "not-a-uuid", sections: [hero] },
      { pageId: PAGE, sections: [{ ...hero, type: "script" }] },
      { pageId: PAGE, sections: [hero, hero] },
      { pageId: PAGE, sections: [{ ...hero, props: { primaryCta: { label: "x", href: "javascript:alert(1)" } } }] },
    ];
    for (const c of cases) {
      const r = await saveEditorPageAction(c as never);
      expect(r.ok, JSON.stringify(c).slice(0, 80)).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("VALIDATION");
    }
    expect(saveEditorPageSections).not.toHaveBeenCalled();
  });

  it("surfaces a conflict clearly", async () => {
    saveEditorPageSections.mockRejectedValueOnce(new AppError("CONFLICT"));
    const r = await saveEditorPageAction({ pageId: PAGE, sections: [hero], expectedUpdatedAt: "2026-11-17T09:00:00+00:00" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONFLICT");
  });
});
