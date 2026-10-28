import { describe, expect, it } from "vitest";
import { canSwitchPanels, defaultLanding, isAdminPath, landingFor } from "@/lib/auth/role-routing";

const staff = { platformStaff: true, storeCount: 0 };
const seller = { platformStaff: false, storeCount: 2 };
const both = { platformStaff: true, storeCount: 1 };
const nobody = { platformStaff: false, storeCount: 0 };

describe("role routing after sign-in", () => {
  it("sends super admins to the console, sellers to the dashboard, new accounts to onboarding", () => {
    expect(defaultLanding(staff)).toBe("/admin");
    expect(defaultLanding(both)).toBe("/admin");
    expect(defaultLanding(seller)).toBe("/dashboard");
    expect(defaultLanding(nobody)).toBe("/onboarding");
  });

  it("honours a requested panel only when the account can use it", () => {
    expect(landingFor(seller, "/admin/users")).toBe("/dashboard");
    expect(landingFor(nobody, "/admin")).toBe("/onboarding");
    expect(landingFor(staff, "/admin/users?q=a")).toBe("/admin/users?q=a");
    expect(landingFor(staff, "/dashboard/orders")).toBe("/admin");
    expect(landingFor(both, "/dashboard/orders")).toBe("/dashboard/orders");
    expect(landingFor(seller, "/dashboard/products/new")).toBe("/dashboard/products/new");
  });

  it("keeps other same-origin destinations and ignores empty ones", () => {
    expect(landingFor(nobody, "/start?plan=pro")).toBe("/start?plan=pro");
    expect(landingFor(seller, "/invite/abc")).toBe("/invite/abc");
    expect(landingFor(seller, "")).toBe("/dashboard");
    expect(landingFor(staff, "/")).toBe("/admin");
    expect(landingFor(staff, null)).toBe("/admin");
  });

  it("does not treat look-alike paths as the console", () => {
    expect(isAdminPath("/administrator")).toBe(false);
    expect(isAdminPath("/admin")).toBe(true);
    expect(landingFor(seller, "/administrator")).toBe("/administrator");
  });

  it("shows the panel switch only for staff who also run a store", () => {
    expect(canSwitchPanels(both)).toBe(true);
    expect(canSwitchPanels(staff)).toBe(false);
    expect(canSwitchPanels(seller)).toBe(false);
  });
});
