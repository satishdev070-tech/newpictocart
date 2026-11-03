"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { assertPlatformPermission, getPlatformContext } from "@/lib/platform/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/features/platform/schemas";
import { createPlanCouponSchema, updatePlanCouponSchema } from "./plan-coupon-schemas";

const PATH = "/admin/plan-coupons";
const PENDING = "Plan coupons need migration 20261103006200_platform_plan_coupons.sql. Apply it, then try again.";

async function platformActor() {
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  assertPlatformPermission(ctx, "platform.plans.manage");
  return ctx;
}

function dbFail(error: { code?: string; message?: string }, operation: string, duplicate?: string): never {
  if (isMissingSchemaError(error)) throw new AppError("CONFLICT", { fieldErrors: { _form: [PENDING] }, context: { code: error.code } });
  if (error.code === "23505" && duplicate) throw new AppError("CONFLICT", { fieldErrors: { _form: [duplicate] } });
  if (error.code === "23514") throw new AppError("VALIDATION", { fieldErrors: { _form: ["These values are outside the allowed range."] } });
  if (error.code === "42501") throw new AppError("FORBIDDEN");
  throw new AppError("INTERNAL", { context: { operation, code: error.code } });
}

export async function createPlanCouponAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.planCoupon.create", async () => {
    const input = parseInput(createPlanCouponSchema, formToObject(fd));
    const ctx = await platformActor();
    const { data, error } = await (await createSupabaseServerClient())
      .from("platform_plan_coupons")
      .insert({
        code: input.code,
        percent_off: input.percentOff,
        starts_at: input.startsAt ?? null,
        ends_at: input.endsAt ?? null,
        max_uses: input.maxUses ?? null,
        applies_to_plan_codes: input.appliesToPlanCodes,
        created_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error) dbFail(error, "platform_plan_coupon_create", "A coupon with this code already exists.");
    await audit({
      tenantId: null,
      actorUserId: ctx.user.id,
      actorType: "platform",
      action: "plan_coupon.created",
      entityType: "platform_plan_coupon",
      entityId: data.id,
      metadata: { code: input.code, percentOff: input.percentOff, maxUses: input.maxUses ?? null, appliesToPlanCodes: input.appliesToPlanCodes },
    });
  });
  if (result.ok) revalidatePath(PATH);
  return result;
}

export async function setPlanCouponActiveAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.planCoupon.toggle", async () => {
    const input = parseInput(updatePlanCouponSchema, formToObject(fd));
    const ctx = await platformActor();
    const { data, error } = await (await createSupabaseServerClient()).from("platform_plan_coupons").update({ active: input.active }).eq("id", input.id).select("code");
    if (error) dbFail(error, "platform_plan_coupon_toggle");
    if (!data?.length) throw new AppError("NOT_FOUND");
    await audit({
      tenantId: null,
      actorUserId: ctx.user.id,
      actorType: "platform",
      action: input.active ? "plan_coupon.enabled" : "plan_coupon.disabled",
      entityType: "platform_plan_coupon",
      entityId: input.id,
      metadata: { code: data[0]?.code },
    });
  });
  if (result.ok) revalidatePath(PATH);
  return result;
}
