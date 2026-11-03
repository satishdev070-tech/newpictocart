"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { assertPermission, requireTenant } from "@/lib/tenant/membership";
import { assertPlatformPermission, getPlatformContext } from "@/lib/platform/access";
import { revalidateStorefront } from "@/lib/cache/storefront";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toMinor } from "@/lib/money";
import { changeTenantPlan, setTenantStatus } from "@/features/platform/server/mutations";
import type { PlatformGatewayCheckout } from "@/features/ai-credits/gateway-schemas";
import { resolvePlatformPaymentGateway, startPlatformPlanCheckout } from "@/features/ai-credits/platform-gateways";
import {
  normalizePlanCouponCode,
  validatePlanCoupon,
  type PlanCouponError,
  type PlanCouponForValidation,
} from "@/features/billing/plan-coupons";
import { applyPlanDiscountPaise } from "@/features/billing/plan-discount";
import { activatePlanSchema, cancelPlanRequestSchema, decidePlanRequestSchema, previewPlanCouponSchema, requestPlanSchema } from "./schemas";
import { cancelPlanRequest, decidePlanRequest, listActivePlans, requestPlan } from "./server";

export type PlanCheckoutResult = {
  requestId: string;
  checkout: PlatformGatewayCheckout | null;
  amountPaise: number;
  discountPercent: number;
};

export type PlanCouponPreview = {
  code: string;
  discountPercent: number;
  listPaise: number;
  amountPaise: number;
};

const COUPON_MESSAGES: Record<PlanCouponError, string> = {
  not_found: "This coupon isn't valid or has expired.",
  inactive: "This coupon isn't active anymore.",
  not_started: "This coupon isn't valid yet.",
  expired: "This coupon has expired.",
  wrong_plan: "This coupon doesn't apply to the selected plan.",
  max_uses: "This coupon has reached its use limit.",
};

/** Seller checkout may read a coupon by code via the secret-key client (RLS is staff-only). */
async function loadCouponForCheckout(code: string): Promise<PlanCouponForValidation | null> {
  const normalized = normalizePlanCouponCode(code);
  if (!normalized) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("platform_plan_coupons")
    .select("code, percent_off, active, starts_at, ends_at, applies_to_plan_codes, max_uses, uses")
    .eq("code", normalized)
    .maybeSingle();
  if (error) {
    // Table missing → treat as invalid coupon rather than crashing checkout.
    if (["42P01", "PGRST205", "PGRST204"].includes(error.code ?? "")) return null;
    throw new AppError("INTERNAL", { cause: error, context: { operation: "load_plan_coupon" } });
  }
  if (!data) return null;
  return {
    code: data.code,
    percentOff: data.percent_off,
    active: data.active,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    appliesToPlanCodes: data.applies_to_plan_codes ?? [],
    maxUses: data.max_uses,
    uses: data.uses,
  };
}

function assertCoupon(coupon: PlanCouponForValidation | null, planCode: string) {
  const result = validatePlanCoupon(coupon, planCode);
  if (!result.ok) throw new AppError("VALIDATION", { fieldErrors: { couponCode: [COUPON_MESSAGES[result.error]] } });
  return result;
}

/** Seller: preview a plan coupon against the selected plan + cycle (does not create a request). */
export async function previewPlanCouponAction(_prev: ActionResult<PlanCouponPreview> | null, fd: FormData): Promise<ActionResult<PlanCouponPreview>> {
  return runAction("billing.previewPlanCoupon", async () => {
    const input = parseInput(previewPlanCouponSchema, formToObject(fd));
    const ctx = await requireTenant();
    assertPermission(ctx, "billing.manage");
    await rateLimit("plan-coupon-preview", ctx.tenantId, 30, 600);
    const plans = await listActivePlans();
    const plan = plans.find((p) => p.id === input.planId);
    if (!plan) throw new AppError("VALIDATION", { fieldErrors: { planId: ["That plan isn't available."] } });
    const listPaise = toMinor(input.cycle === "yearly" ? plan.priceYearly : plan.priceMonthly);
    const coupon = await loadCouponForCheckout(input.couponCode);
    const ok = assertCoupon(coupon, plan.code);
    const amountPaise = applyPlanDiscountPaise(listPaise, ok.percentOff);
    return { code: ok.code, discountPercent: ok.percentOff, listPaise, amountPaise };
  });
}

/** Seller (owner): ask for a plan, optionally with coupon; Pay now when a platform gateway is configured. */
export async function requestPlanAction(_prev: ActionResult<PlanCheckoutResult> | null, fd: FormData): Promise<ActionResult<PlanCheckoutResult>> {
  const result = await runAction("billing.requestPlan", async () => {
    const input = parseInput(requestPlanSchema, formToObject(fd));
    const ctx = await requireTenant();
    assertPermission(ctx, "billing.manage");
    await rateLimit("plan-request", ctx.tenantId, 10, 3600);

    const plans = await listActivePlans();
    const plan = plans.find((p) => p.id === input.planId);
    if (!plan) throw new AppError("VALIDATION", { fieldErrors: { planId: ["That plan isn't available."] } });

    const listPaise = toMinor(input.cycle === "yearly" ? plan.priceYearly : plan.priceMonthly);
    let discountPercent = 0;
    let couponCode: string | null = null;
    if (input.couponCode) {
      const coupon = await loadCouponForCheckout(input.couponCode);
      const ok = assertCoupon(coupon, plan.code);
      discountPercent = ok.percentOff;
      couponCode = ok.code;
    }
    const amountPaise = applyPlanDiscountPaise(listPaise, discountPercent);

    const gateway = input.intent === "pay" ? await resolvePlatformPaymentGateway() : null;

    const requestId = await requestPlan(ctx, input);

    const admin = createSupabaseAdminClient();
    const { error: stampError } = await admin
      .from("plan_requests")
      .update({
        coupon_code: couponCode,
        discount_percent: discountPercent || null,
        amount_paise: amountPaise,
      })
      .eq("id", requestId)
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "pending");
    if (stampError && !["PGRST204", "42703", "42P01", "PGRST205"].includes(stampError.code ?? "")) {
      throw new AppError("INTERNAL", { cause: stampError, context: { operation: "stamp_plan_coupon" } });
    }

    let checkout: PlatformGatewayCheckout | null = null;
    if (input.intent === "pay" && gateway && amountPaise > 0) {
      const supabase = await createSupabaseServerClient();
      const { data: profile } = await supabase.from("profiles").select("phone").eq("id", ctx.user.id).maybeSingle();
      checkout = await startPlatformPlanCheckout({
        requestId,
        tenantId: ctx.tenantId,
        amountPaise,
        planName: plan.name,
        cycle: input.cycle,
        customer: {
          id: ctx.user.id,
          email: ctx.user.email,
          phone: profile?.phone ?? null,
          name: ctx.user.displayName,
        },
      });
    }

    return { requestId, checkout, amountPaise, discountPercent };
  });
  if (result.ok) revalidatePath("/dashboard/settings/plan");
  return result;
}

export async function cancelPlanRequestAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("billing.cancelRequest", async () => {
    const input = parseInput(cancelPlanRequestSchema, formToObject(fd));
    const ctx = await requireTenant();
    assertPermission(ctx, "billing.manage");
    await cancelPlanRequest(ctx, input.requestId);
  });
  if (result.ok) revalidatePath("/dashboard/settings/plan");
  return result;
}

async function platformManager() {
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  assertPlatformPermission(ctx, "platform.tenants.manage");
  return ctx;
}

/** Platform: approve (switch plan + activate the store) or decline a request. */
export async function decidePlanRequestAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("platform.planRequest.decide", async () => {
    const input = parseInput(decidePlanRequestSchema, formToObject(fd));
    const ctx = await platformManager();
    const { tenantId } = await decidePlanRequest(ctx, input);
    revalidateStorefront(tenantId);
    revalidatePath(`/admin/tenants/${tenantId}`);
    revalidatePath("/admin/plan-requests");
    revalidatePath("/admin/stores");
  });
}

/** Platform: put a store on a plan and make it active (paid) in one step, without a request. */
export async function activatePlanAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("platform.tenant.activatePlan", async () => {
    const input = parseInput(activatePlanSchema, formToObject(fd));
    const ctx = await platformManager();
    await changeTenantPlan(ctx, { tenantId: input.tenantId, planId: input.planId });
    await setTenantStatus(ctx, { tenantId: input.tenantId, status: "active", reason: input.reason, confirm: "yes" } as Parameters<typeof setTenantStatus>[1]);
    revalidateStorefront(input.tenantId);
    revalidatePath(`/admin/tenants/${input.tenantId}`);
    revalidatePath("/admin/stores");
  });
}
