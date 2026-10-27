import { describe, expect, it } from "vitest";
import {
  PLATFORM_PERMISSIONS,
  PLATFORM_ROLE_PERMISSIONS,
  TENANT_PERMISSIONS,
  SUPPORT_SESSION_PERMISSIONS,
  TENANT_ROLES,
  TENANT_ROLE_PERMISSIONS,
  platformRoleCan,
  tenantRoleCan,
} from "@/lib/permissions/matrix";

describe("tenant permission matrix", () => {
  it("gives owners every permission", () => {
    for (const p of TENANT_PERMISSIONS) expect(tenantRoleCan("owner", p)).toBe(true);
  });

  it("has exactly three standard roles: owner, manager, sales associate", () => {
    expect([...TENANT_ROLES]).toEqual(["owner", "manager", "sales_associate"]);
  });

  it("gives managers everything except owner-only billing", () => {
    for (const p of TENANT_PERMISSIONS) expect(tenantRoleCan("manager", p)).toBe(p !== "billing.manage");
  });

  it("keeps sales associates to orders, customers, products and stock", () => {
    for (const p of ["orders.read", "orders.write", "customers.read", "customers.write", "catalog.read", "catalog.write", "inventory.write"] as const) {
      expect(tenantRoleCan("sales_associate", p)).toBe(true);
    }
    for (const p of ["settings.write", "payments.manage", "domains.manage", "members.read", "members.manage", "roles.manage", "billing.manage", "orders.refund", "theme.publish"] as const) {
      expect(tenantRoleCan("sales_associate", p)).toBe(false);
    }
  });

  it("is monotonic: each role includes the role below it", () => {
    const ladder = ["sales_associate", "manager", "owner"] as const;
    for (let i = 1; i < ladder.length; i++) {
      for (const p of TENANT_ROLE_PERMISSIONS[ladder[i - 1]!]) expect(TENANT_ROLE_PERMISSIONS[ladder[i]!].has(p)).toBe(true);
    }
  });

  it("keeps platform support sessions read-only", () => {
    for (const p of SUPPORT_SESSION_PERMISSIONS) expect(p.endsWith(".read")).toBe(true);
  });
});

describe("platform permission matrix", () => {
  it("gives super_admin everything", () => {
    for (const p of PLATFORM_PERMISSIONS) expect(platformRoleCan("super_admin", p)).toBe(true);
  });

  it("does not let support manage tenants or platform users", () => {
    expect(platformRoleCan("support", "platform.tenants.manage")).toBe(false);
    expect(platformRoleCan("support", "platform.users.manage")).toBe(false);
  });

  it("lets finance read and run finance but not manage partners, users or settings", () => {
    expect(platformRoleCan("finance", "platform.finance.read")).toBe(true);
    expect(platformRoleCan("finance", "platform.finance.manage")).toBe(true);
    expect(platformRoleCan("finance", "platform.partners.manage")).toBe(false);
    expect(platformRoleCan("finance", "platform.users.manage")).toBe(false);
    expect(platformRoleCan("finance", "platform.settings.manage")).toBe(false);
  });

  it("keeps support out of finance and partners", () => {
    expect(platformRoleCan("support", "platform.finance.read")).toBe(false);
    expect(platformRoleCan("support", "platform.finance.manage")).toBe(false);
    expect(platformRoleCan("support", "platform.partners.manage")).toBe(false);
  });

  it("uses only declared permission keys", () => {
    for (const set of Object.values(PLATFORM_ROLE_PERMISSIONS)) for (const p of set) expect(PLATFORM_PERMISSIONS).toContain(p);
  });
});
