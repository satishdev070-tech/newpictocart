import { planCouponDiscountPaise } from "./plan-coupons";

/** List price minus coupon discount (integer paise). */
export function applyPlanDiscountPaise(amountPaise: number, discountPercent: number): number {
  return Math.max(0, amountPaise - planCouponDiscountPaise(amountPaise, discountPercent));
}
