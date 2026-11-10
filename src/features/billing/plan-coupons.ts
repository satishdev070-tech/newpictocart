/**
 * Platform plan coupons — pure types and validation for checkout and admin.
 * Persistence and mutations live in plan-coupon-server / plan-coupon-actions.
 * Async DB lookup for sellers: validatePlanCouponForCheckout in plan-coupon-server.
 */

export { applyPlanDiscountPaise } from "./plan-discount";

export const PLAN_COUPON_CODE_RE = /^[A-Z0-9_-]{3,30}$/;

/** Default applies_to when the admin leaves plan checkboxes empty. */
export const DEFAULT_PLAN_COUPON_PLAN_CODES = ["starter", "growth"] as const;

export const PLAN_COUPON_PLAN_OPTIONS = ["free", "starter", "growth", "scale"] as const;
export type PlanCouponPlanCode = (typeof PLAN_COUPON_PLAN_OPTIONS)[number];

export type PlanCoupon = {
  id: string;
  code: string;
  percentOff: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  appliesToPlanCodes: string[];
  maxUses: number | null;
  uses: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Fields validatePlanCoupon needs (DB row or in-memory fixture). */
export type PlanCouponForValidation = {
  code: string;
  percentOff: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  appliesToPlanCodes: readonly string[];
  maxUses: number | null;
  uses: number;
};

export type PlanCouponError = "not_found" | "inactive" | "not_started" | "expired" | "wrong_plan" | "max_uses";

export type PlanCouponValidation =
  | { ok: true; percentOff: number; code: string }
  | { ok: false; error: PlanCouponError };

export const PLAN_COUPON_ERROR_MESSAGE: Record<PlanCouponError, string> = {
  not_found: "That coupon code isn't valid.",
  inactive: "That coupon is no longer active.",
  not_started: "That coupon isn't valid yet.",
  expired: "That coupon has expired.",
  wrong_plan: "That coupon doesn't apply to this plan.",
  max_uses: "That coupon has reached its usage limit.",
};

/** Uppercase + trim; empty → "". Does not enforce the regex (schemas do). */
export function normalizePlanCouponCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toUpperCase();
}

function toDate(now: Date | string | number): Date {
  if (now instanceof Date) return now;
  const d = new Date(now);
  if (Number.isNaN(d.getTime())) throw new RangeError("Invalid now for validatePlanCoupon");
  return d;
}

/**
 * Pure coupon gate for plan checkout.
 * `code` is the coupon row looked up for that code (null when missing); `planCode` is the
 * plan being purchased; `now` is the evaluation instant.
 */
export function validatePlanCoupon(
  code: PlanCouponForValidation | null | undefined,
  planCode: string,
  now: Date | string | number = new Date(),
): PlanCouponValidation {
  if (!code) return { ok: false, error: "not_found" };
  if (!code.active) return { ok: false, error: "inactive" };

  const at = toDate(now).getTime();
  if (code.startsAt) {
    const start = Date.parse(code.startsAt);
    if (!Number.isNaN(start) && at < start) return { ok: false, error: "not_started" };
  }
  if (code.endsAt) {
    const end = Date.parse(code.endsAt);
    if (!Number.isNaN(end) && at > end) return { ok: false, error: "expired" };
  }

  const plans = code.appliesToPlanCodes ?? [];
  if (!plans.includes(planCode)) return { ok: false, error: "wrong_plan" };

  if (code.maxUses != null && code.uses >= code.maxUses) return { ok: false, error: "max_uses" };

  const percentOff = code.percentOff;
  if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 100) return { ok: false, error: "inactive" };

  return { ok: true, percentOff, code: code.code };
}

/** Discount portion in paise (floor); never negative; never more than amount. */
export function planCouponDiscountPaise(amountPaise: number, percentOff: number): number {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) return 0;
  if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 100) return 0;
  return Math.min(amountPaise, Math.floor((amountPaise * percentOff) / 100));
}
