import { describe, expect, it } from "vitest";
import { defaultLanding, landingFor, type AccountAccess } from "@/lib/auth/role-routing";

const seller: AccountAccess = { platformStaff: false, storeCount: 1 };
const informative: AccountAccess = { platformStaff: false, storeCount: 1, informativeOnly: true };
const mixed: AccountAccess = { platformStaff: false, storeCount: 2, informativeOnly: false };
const staffInformative: AccountAccess = { platformStaff: true, storeCount: 1, informativeOnly: true };
const nobody: AccountAccess = { platformStaff: false, storeCount: 0 };

describe("post-login redirect by website type", () => {
  it("unknown type (flag off / older callers) lands exactly as before", () => {
    expect(defaultLanding(seller)).toBe("/dashboard");
    expect(landingFor(seller, "/start")).toBe("/dashboard");
    expect(landingFor(seller, "/dashboard/orders")).toBe("/dashboard/orders");
  });

  it("Informative-only accounts land on the Informative dashboard", () => {
    expect(defaultLanding(informative)).toBe("/informative/dashboard");
    expect(landingFor(informative, null)).toBe("/informative/dashboard");
    expect(landingFor(informative, "/")).toBe("/informative/dashboard");
    expect(landingFor(informative, "/start/lang")).toBe("/informative/dashboard");
    expect(landingFor(informative, "/onboarding")).toBe("/informative/dashboard");
  });

  it("accounts with any store land on the store dashboard", () => {
    expect(defaultLanding(mixed)).toBe("/dashboard");
  });

  it("platform staff still land on the console", () => {
    expect(defaultLanding(staffInformative)).toBe("/admin");
    expect(landingFor(staffInformative, "/start")).toBe("/admin");
  });

  it("a requested /informative path is kept for store members only", () => {
    expect(landingFor(informative, "/informative/services")).toBe("/informative/services");
    expect(landingFor(seller, "/informative/services")).toBe("/informative/services");
    expect(landingFor(nobody, "/informative/services")).toBe("/start");
  });
});
