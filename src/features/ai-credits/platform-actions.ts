"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { assertPlatformPermission, getPlatformContext } from "@/lib/platform/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAiCreditCodeSchema, creditAdjustmentSchema, creditPurchaseDecisionSchema, revokeAiCreditCodeSchema } from "./schemas";

async function platformActor() {
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  assertPlatformPermission(ctx, "platform.settings.manage");
  return ctx;
}

function otcMigrationMessage(message?: string | null) {
  return /schema cache|does not exist|PGRST202|42883|42P01/i.test(message ?? "")
    ? "AI credit codes are being set up. Apply migration 20261028004500_ai_credit_one_time_codes.sql first."
    : null;
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

export async function createAiCreditCodeAction(_prev: ActionResult<{ code: string }> | null, fd: FormData): Promise<ActionResult<{ code: string }>> {
  const result = await runAction("platform.aiCredits.otc.create", async () => {
    const input = parseInput(createAiCreditCodeSchema, formToObject(fd));
    const ctx = await platformActor();
    const { data, error } = await (await createSupabaseServerClient()).rpc("platform_create_ai_credit_code", {
      p_credits: input.credits,
      ...(input.note ? { p_note: input.note } : {}),
    });
    if (error || !data) {
      const pending = otcMigrationMessage(error?.message);
      throw new AppError("CONFLICT", { fieldErrors: { _form: [pending ?? "The code could not be generated."] }, context: { code: error?.code } });
    }
    await audit({
      tenantId: null,
      actorUserId: ctx.user.id,
      actorType: "platform",
      action: "ai_credits.otc_created",
      entityType: "ai_credit_one_time_code",
      entityId: String(data).slice(-4),
      metadata: { credits: input.credits, note: input.note ?? null },
    });
    return { code: String(data) };
  });
  if (result.ok) revalidatePath("/admin/ai-credits");
  return result;
}

export async function revokeAiCreditCodeAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.aiCredits.otc.revoke", async () => {
    const input = parseInput(revokeAiCreditCodeSchema, formToObject(fd));
    const ctx = await platformActor();
    const { error } = await (await createSupabaseServerClient()).rpc("platform_revoke_ai_credit_code", { p_code: input.codeId });
    if (error) {
      const pending = otcMigrationMessage(error.message);
      throw new AppError("CONFLICT", {
        fieldErrors: { _form: [pending ?? (error.message.includes("not unused") ? "Only unused codes can be revoked." : "The code could not be revoked.")] },
        context: { code: error.code },
      });
    }
    await audit({
      tenantId: null,
      actorUserId: ctx.user.id,
      actorType: "platform",
      action: "ai_credits.otc_revoked",
      entityType: "ai_credit_one_time_code",
      entityId: input.codeId,
    });
  });
  if (result.ok) revalidatePath("/admin/ai-credits");
  return result;
}
