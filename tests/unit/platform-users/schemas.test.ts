import { describe, expect, it } from "vitest";
import { accountStatusSchema, accountTargetSchema, createAccountSchema, userDirectoryFilterSchema, userTypes } from "@/features/platform-users/schemas";
import { adminNavFor, ADMIN_NAV } from "@/features/platform/nav";
import { PLATFORM_ROLE_PERMISSIONS } from "@/lib/permissions/matrix";

describe("user directory filters", () => {
  it("parses and falls back safely", () => {
    expect(userDirectoryFilterSchema.parse({})).toEqual({ q: undefined, type: undefined, store: undefined, view: "list", page: 1 });
    expect(userDirectoryFilterSchema.parse({ q: "  asha ", type: "seller", view: "grid", page: "3" })).toMatchObject({ q: "asha", type: "seller", view: "grid", page: 3 });
    expect(userDirectoryFilterSchema.parse({ type: "robot", store: "nope", view: "table", page: "-2" })).toMatchObject({ type: undefined, store: undefined, view: "list", page: 1 });
  });
});

describe("user types", () => {
  it("labels staff, sellers, customers and bare accounts", () => {
    expect(userTypes({ platformRole: "super_admin", stores: [{}], customerStores: 1 })).toEqual(["platform", "seller", "customer"]);
    expect(userTypes({ platformRole: null, stores: [], customerStores: 2 })).toEqual(["customer"]);
    expect(userTypes({ platformRole: null, stores: [], customerStores: 0 })).toEqual(["account"]);
  });
});

describe("account action inputs", () => {
  it("validates create, reset and status changes", () => {
    expect(createAccountSchema.parse({ email: "Asha@Example.COM", displayName: "Asha", password: "" })).toEqual({ email: "asha@example.com", displayName: "Asha", password: undefined });
    expect(createAccountSchema.safeParse({ email: "asha@example.com", displayName: "Asha", password: "short" }).success).toBe(false);
    expect(accountTargetSchema.safeParse({ userId: "00000000-0000-4000-a000-000000000001", reason: "too short" }).success).toBe(false);
    expect(accountStatusSchema.safeParse({ userId: "00000000-0000-4000-a000-000000000001", status: "disabled", reason: "Fraud report from a shopper" }).success).toBe(true);
    expect(accountStatusSchema.safeParse({ userId: "00000000-0000-4000-a000-000000000001", status: "deleted", reason: "Fraud report from a shopper" }).success).toBe(false);
  });
});

describe("super admin nav for the ported modules", () => {
  const hrefs = (role: keyof typeof PLATFORM_ROLE_PERMISSIONS) => adminNavFor(PLATFORM_ROLE_PERMISSIONS[role]).flatMap((g) => g.items.map((i) => i.href));
  it("shows every module to super admins", () => {
    const all = hrefs("super_admin");
    for (const h of ["/admin/users", "/admin/revenue", "/admin/commissions", "/admin/partner-analytics", "/admin/partner-payouts", "/admin/agencies", "/admin/partners", "/admin/ai-health", "/admin/credits-economy"]) expect(all).toContain(h);
    expect(ADMIN_NAV.flatMap((g) => g.items).length).toBe(all.length);
  });
  it("shows finance only finance pages, and support none of them", () => {
    expect(hrefs("finance")).toEqual(expect.arrayContaining(["/admin/revenue", "/admin/commissions", "/admin/partner-analytics", "/admin/partner-payouts"]));
    expect(hrefs("finance")).not.toContain("/admin/partners");
    expect(hrefs("finance")).not.toContain("/admin/users");
    expect(hrefs("support")).not.toContain("/admin/revenue");
  });
});
