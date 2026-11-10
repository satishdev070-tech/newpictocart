import { describe, expect, it } from "vitest";
import { createPlanCouponSchema, updatePlanCouponSchema } from "@/features/billing/plan-coupon-schemas";
import {
  normalizePlanCouponCode,
  planCouponDiscountPaise,
  validatePlanCoupon,
  type PlanCouponForValidation,
} from "@/features/billing/plan-coupons";

const base: PlanCouponForValidation = {
  code: "MISSHUMANN20",
  percentOff: 20,
  active: true,
  startsAt: null,
  endsAt: null,
  appliesToPlanCodes: ["starter", "growth"],
  maxUses: null,
  uses: 0,
};

const now = new Date("2026-11-03T12:00:00.000Z");

describe("normalizePlanCouponCode", () => {
  it("trims and uppercases", () => {
    expect(normalizePlanCouponCode("  misshumann20 ")).toBe("MISSHUMANN20");
    expect(normalizePlanCouponCode(null)).toBe("");
  });
});

describe("validatePlanCoupon", () => {
  it("returns percent off for a matching active coupon", () => {
    expect(validatePlanCoupon(base, "starter", now)).toEqual({ ok: true, percentOff: 20, code: "MISSHUMANN20" });
    expect(validatePlanCoupon(base, "growth", now)).toEqual({ ok: true, percentOff: 20, code: "MISSHUMANN20" });
  });

  it("rejects missing, inactive, wrong plan, and max uses", () => {
    expect(validatePlanCoupon(null, "starter", now)).toEqual({ ok: false, error: "not_found" });
    expect(validatePlanCoupon({ ...base, active: false }, "starter", now)).toEqual({ ok: false, error: "inactive" });
    expect(validatePlanCoupon(base, "scale", now)).toEqual({ ok: false, error: "wrong_plan" });
    expect(validatePlanCoupon({ ...base, maxUses: 2, uses: 2 }, "starter", now)).toEqual({ ok: false, error: "max_uses" });
  });

  it("rejects outside the start/end window", () => {
    expect(validatePlanCoupon({ ...base, startsAt: "2026-12-01T00:00:00.000Z" }, "starter", now)).toEqual({ ok: false, error: "not_started" });
    expect(validatePlanCoupon({ ...base, endsAt: "2026-11-01T00:00:00.000Z" }, "starter", now)).toEqual({ ok: false, error: "expired" });
    expect(validatePlanCoupon({ ...base, startsAt: "2026-11-01T00:00:00.000Z", endsAt: "2026-11-30T23:59:59.999Z" }, "starter", now).ok).toBe(true);
  });
});

describe("planCouponDiscountPaise", () => {
  it("floors the percent of the amount", () => {
    expect(planCouponDiscountPaise(99900, 20)).toBe(19980);
    expect(planCouponDiscountPaise(100, 33)).toBe(33);
    expect(planCouponDiscountPaise(0, 20)).toBe(0);
  });
});

describe("createPlanCouponSchema", () => {
  it("normalizes code and defaults plan codes", () => {
    const parsed = createPlanCouponSchema.parse({ code: "misshumann20", percentOff: "20" });
    expect(parsed).toMatchObject({ code: "MISSHUMANN20", percentOff: 20, appliesToPlanCodes: ["starter", "growth"] });
  });

  it("accepts plan checkboxes and date window", () => {
    const parsed = createPlanCouponSchema.parse({
      code: "SAVE10",
      percentOff: 10,
      appliesToPlanCodes: ["growth", "scale"],
      startsAt: "2026-11-01",
      endsAt: "2026-11-30",
      maxUses: "100",
    });
    expect(parsed.appliesToPlanCodes).toEqual(["growth", "scale"]);
    expect(parsed.startsAt).toBe("2026-11-01T00:00:00.000Z");
    expect(parsed.endsAt).toBe("2026-11-30T23:59:59.999Z");
    expect(parsed.maxUses).toBe(100);
  });

  it("rejects bad codes and percent", () => {
    expect(createPlanCouponSchema.safeParse({ code: "ab", percentOff: 20 }).success).toBe(false);
    expect(createPlanCouponSchema.safeParse({ code: "OKAY", percentOff: 0 }).success).toBe(false);
    expect(updatePlanCouponSchema.parse({ id: "10000000-0000-4000-a000-000000000001", active: "false" }).active).toBe(false);
  });
});
