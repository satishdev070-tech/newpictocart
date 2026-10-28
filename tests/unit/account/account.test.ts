import { describe, expect, it } from "vitest";
import { avatarInitial, buildExport, changePasswordSchema, countdown, exportFilename, formatCountdown, updateProfileSchema } from "@/features/account/schemas";
import { canSwitchPanels } from "@/lib/auth/role-routing";

describe("plan countdown", () => {
  const now = Date.parse("2026-10-28T00:00:00Z");
  it("splits the time left into days, hours and minutes", () => {
    const c = countdown("2027-08-24T22:01:30Z", now)!;
    expect(c).toEqual({ expired: false, days: 300, hours: 22, minutes: 1 });
    expect(formatCountdown(c)).toBe("300d : 22h : 01m");
  });
  it("is expired at or after the end, and null without a valid date", () => {
    expect(countdown("2026-10-27T00:00:00Z", now)).toEqual({ expired: true, days: 0, hours: 0, minutes: 0 });
    expect(countdown(null, now)).toBeNull();
    expect(countdown("not a date", now)).toBeNull();
  });
});

describe("profile schemas", () => {
  it("accepts a name with an optional, normalised phone", () => {
    expect(updateProfileSchema.parse({ displayName: " Asha ", phone: "+91 98765-43210" })).toEqual({ displayName: "Asha", phone: "+919876543210" });
    expect(updateProfileSchema.parse({ displayName: "Asha", phone: "" }).phone).toBe("");
    expect(updateProfileSchema.safeParse({ displayName: "Asha", phone: "call me" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ displayName: "A" }).success).toBe(false);
  });
  it("requires a strong password typed twice", () => {
    expect(changePasswordSchema.safeParse({ password: "Paliya@12345", confirm: "Paliya@12345" }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ password: "Paliya@12345", confirm: "Paliya@12346" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ password: "short1", confirm: "short1" }).success).toBe(false);
  });
});

describe("data export", () => {
  it("wraps own data with counts and a dated filename", () => {
    const out = buildExport({ user: { id: "u1", email: "a@b.in" }, profile: { display_name: "A" }, memberships: [{ tenant_id: "t1", role: "owner", status: "active" }], stores: [{ id: "t1" }], products: [{ id: "p1" }, { id: "p2" }], orders: [], generatedAt: "2026-10-28T00:00:00.000Z" });
    expect(out.account).toEqual({ id: "u1", email: "a@b.in" });
    expect(out.counts).toEqual({ stores: 1, products: 2, orders: 0 });
    expect(out.format).toBe("pictocart-account-export");
    expect(exportFilename(new Date("2026-10-28T10:00:00Z"))).toBe("pictocart-data-2026-10-28.json");
  });
  it("picks an avatar initial from the name, then the email", () => {
    expect(avatarInitial("antariksh", "x@y.in")).toBe("A");
    expect(avatarInitial("  ", "pictocart@gmail.com")).toBe("P");
    expect(avatarInitial(null, null)).toBe("?");
  });
});

describe("panel switch", () => {
  it("shows only for platform staff who also belong to a store", () => {
    expect(canSwitchPanels({ platformStaff: true, storeCount: 1 })).toBe(true);
    expect(canSwitchPanels({ platformStaff: true, storeCount: 0 })).toBe(false);
    expect(canSwitchPanels({ platformStaff: false, storeCount: 3 })).toBe(false);
  });
});
