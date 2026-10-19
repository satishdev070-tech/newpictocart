"use server";

import { refresh } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { assertPermission, requireTenant } from "@/lib/tenant/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { creditPurchaseSchema } from "./schemas";

export async function requestAiCreditPurchaseAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("aiCredits.purchase.request", async () => {
    const input = parseInput(creditPurchaseSchema, formToObject(fd));
    const ctx = await requireTenant();
    assertPermission(ctx, "billing.manage");
    const { error } = await (await createSupabaseServerClient()).rpc("request_ai_credit_purchase", { p_tenant: ctx.tenantId, p_pack: input.pack, p_method: input.method });
    if (error) {
      if (["PGRST202", "PGRST204", "PGRST205", "42883", "42P01"].includes(error.code ?? "")) throw new AppError("CONFLICT", { fieldErrors: { _form: ["AI credits are being set up. Please try again after the pending database migration is applied."] } });
      if (error.hint === "AI_CREDIT_PURCHASE_PENDING") throw new AppError("CONFLICT", { fieldErrors: { _form: ["You already have a credit purchase awaiting review."] } });
      throw new AppError("INTERNAL", { context: { operation: "request_ai_credit_purchase", code: error.code } });
    }
    await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "ai_credits.purchase_requested", entityType: "ai_credit_purchase", entityId: input.pack, metadata: { method: input.method } });
  });
  if (result.ok) refresh();
  return result;
}

