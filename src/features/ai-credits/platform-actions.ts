"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { assertPlatformPermission, getPlatformContext } from "@/lib/platform/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { creditAdjustmentSchema, creditPurchaseDecisionSchema } from "./schemas";

async function platformActor() {
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  assertPlatformPermission(ctx, "platform.settings.manage");
  return ctx;
}

export async function decideAiCreditPurchasePlatformAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.aiCredits.purchase.decide", async () => {
    const input = parseInput(creditPurchaseDecisionSchema, formToObject(fd));
    const ctx = await platformActor();
    const { error } = await (await createSupabaseServerClient()).rpc("decide_ai_credit_purchase", { p_request: input.requestId, p_approve: input.decision === "approve", p_note: input.note ?? null, p_payment_reference: input.paymentReference ?? null });
    if (error) throw new AppError("CONFLICT", { fieldErrors: { _form: [error.message.includes("already decided") ? "This request was already decided." : "The credit purchase could not be decided."] }, context: { code: error.code } });
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "ai_credits.purchase_decided", entityType: "ai_credit_purchase", entityId: input.requestId, metadata: { decision: input.decision } });
  });
  if (result.ok) revalidatePath("/admin/ai-credits");
  return result;
}

export async function grantAiCreditsPlatformAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.aiCredits.adjust", async () => {
    const input = parseInput(creditAdjustmentSchema, formToObject(fd));
    const ctx = await platformActor();
    const { error } = await (await createSupabaseServerClient()).rpc("grant_ai_credits", { p_tenant: input.tenantId, p_credits: input.credits, p_note: input.note });
    if (error) throw new AppError("CONFLICT", { fieldErrors: { _form: [error.message.includes("negative") ? "This adjustment would make the balance negative." : "The credit adjustment could not be saved."] }, context: { code: error.code } });
    await audit({ tenantId: input.tenantId, actorUserId: ctx.user.id, actorType: "platform", action: "ai_credits.adjusted", entityType: "ai_credit_account", entityId: input.tenantId, metadata: { credits: input.credits, note: input.note } });
  });
  if (result.ok) revalidatePath("/admin/ai-credits");
  return result;
}
