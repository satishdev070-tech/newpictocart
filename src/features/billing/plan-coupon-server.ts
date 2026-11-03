import "server-only";

import { AppError } from "@/lib/errors";
import { assertPlatformPermission, type PlatformContext } from "@/lib/platform/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/features/platform/schemas";
import {
  normalizePlanCouponCode,
  PLAN_COUPON_ERROR_MESSAGE,
  validatePlanCoupon,
  type PlanCoupon,
} from "./plan-coupons";

/**
 * Super Admin plan-coupon reads use the session client + RLS (platform.plans.manage).
 * Seller checkout reads use the secret-key client after the caller checked billing.manage
 * (ADR-006: platform catalog row, RLS is staff-only).
 */

const PENDING = "Plan coupons need migration 20261103006200_platform_plan_coupons.sql. Apply it, then try again.";
const SELECT =
  "id, code, percent_off, active, starts_at, ends_at, applies_to_plan_codes, max_uses, uses, created_by, created_at, updated_at";

export type LoadedPlanCoupons = { available: boolean; data: PlanCoupon[] };

export type PlanCouponCheckoutResult =
  | { ok: true; code: string; discountPercent: number }
  | { ok: false; message: string };

function fail(error: { code?: string }, operation: string): never {
  throw new AppError("INTERNAL", { context: { operation, code: error.code } });
}

function mapRow(r: {
  id: string;
  code: string;
  percent_off: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  applies_to_plan_codes: string[] | null;
  max_uses: number | null;
  uses: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}): PlanCoupon {
  return {
    id: r.id,
    code: r.code,
    percentOff: r.percent_off,
    active: r.active,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    appliesToPlanCodes: r.applies_to_plan_codes ?? [],
    maxUses: r.max_uses,
    uses: r.uses,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function db(ctx: PlatformContext) {
  assertPlatformPermission(ctx, "platform.plans.manage");
  return createSupabaseServerClient();
}

export async function listPlanCoupons(ctx: PlatformContext): Promise<LoadedPlanCoupons> {
  const { data, error } = await (await db(ctx)).from("platform_plan_coupons").select(SELECT).order("created_at", { ascending: false }).limit(200);
  if (error) {
    if (isMissingSchemaError(error)) return { available: false, data: [] };
    fail(error, "platform_plan_coupons_list");
  }
  return { available: true, data: (data ?? []).map(mapRow) };
}

export async function getPlanCouponById(ctx: PlatformContext, id: string): Promise<PlanCoupon | null> {
  const { data, error } = await (await db(ctx)).from("platform_plan_coupons").select(SELECT).eq("id", id).maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) throw new AppError("CONFLICT", { fieldErrors: { _form: [PENDING] } });
    fail(error, "platform_plan_coupons_get");
  }
  return data ? mapRow(data) : null;
}

/** Lookup by code for staff tooling (session + RLS). */
export async function getPlanCouponByCode(ctx: PlatformContext, code: string): Promise<PlanCoupon | null> {
  const { data, error } = await (await db(ctx)).from("platform_plan_coupons").select(SELECT).eq("code", normalizePlanCouponCode(code)).maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) throw new AppError("CONFLICT", { fieldErrors: { _form: [PENDING] } });
    fail(error, "platform_plan_coupons_get_by_code");
  }
  return data ? mapRow(data) : null;
}

/**
 * Seller checkout: load coupon + plan by id, run pure validatePlanCoupon.
 * Caller must already have verified tenant membership / billing.manage.
 */
export async function validatePlanCouponForCheckout(input: {
  code: string;
  planId: string;
  cycle?: string;
  amountPaise?: number;
  now?: Date;
}): Promise<PlanCouponCheckoutResult> {
  const code = normalizePlanCouponCode(input.code);
  if (!code) return { ok: false, message: PLAN_COUPON_ERROR_MESSAGE.not_found };

  const admin = createSupabaseAdminClient();
  const [{ data: plan, error: planError }, { data: coupon, error: couponError }] = await Promise.all([
    admin.from("plans").select("code").eq("id", input.planId).maybeSingle(),
    admin.from("platform_plan_coupons").select(SELECT).eq("code", code).maybeSingle(),
  ]);

  if (planError && !isMissingSchemaError(planError)) fail(planError, "plan_coupon_plan_lookup");
  if (couponError) {
    if (isMissingSchemaError(couponError)) return { ok: false, message: PLAN_COUPON_ERROR_MESSAGE.not_found };
    fail(couponError, "plan_coupon_lookup");
  }
  if (!plan?.code) return { ok: false, message: "That plan isn't available." };

  const result = validatePlanCoupon(coupon ? mapRow(coupon) : null, plan.code, input.now ?? new Date());
  if (!result.ok) return { ok: false, message: PLAN_COUPON_ERROR_MESSAGE[result.error] };
  return { ok: true, code: result.code, discountPercent: result.percentOff };
}
