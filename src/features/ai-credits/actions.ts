"use server";

import { refresh } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { assertPermission, requireTenant } from "@/lib/tenant/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toDecimalString } from "@/lib/money";
import { creditPurchaseSchema } from "./schemas";

/** "Custom amount must be between 99.00 and 50000.00" → "Enter an amount between ₹99 and ₹50,000." */
function customRangeMessage(message: string): string {
  const m = /between ([\d.]+) and ([\d.]+)/.exec(message);
  const fmt = (v: string) => `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  return m?.[1] && m[2] ? `Enter an amount between ${fmt(m[1])} and ${fmt(m[2])}.` : "This amount is outside the allowed range.";
}

export async function requestAiCreditPurchaseAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("aiCredits.purchase.request", async () => {
    const input = parseInput(creditPurchaseSchema, formToObject(fd));
    const ctx = await requireTenant();
    assertPermission(ctx, "billing.manage");
    const { data, error } = await (await createSupabaseServerClient()).rpc("request_ai_credit_purchase", {
      p_tenant: ctx.tenantId,
      p_pack: input.pack,
      p_method: input.method,
      ...(input.promo ? { p_promo: input.promo } : {}),
      ...(input.amount !== undefined ? { p_amount: Number(toDecimalString(input.amount)) } : {}),
    });
    if (error) {
      if (["PGRST202", "PGRST204", "PGRST205", "42883", "42P01"].includes(error.code ?? "")) throw new AppError("CONFLICT", { fieldErrors: { _form: ["AI credits are being set up. Please try again after the pending database migration is applied."] } });
      if (error.hint === "AI_CREDIT_PURCHASE_PENDING") throw new AppError("CONFLICT", { fieldErrors: { _form: ["You already have a credit purchase awaiting review."] } });
      if (error.hint === "AI_CREDIT_PROMO_INVALID") throw new AppError("VALIDATION", { fieldErrors: { promo: ["This promo code is not valid or has expired."] } });
      if (error.hint === "AI_CREDIT_CUSTOM_RANGE") throw new AppError("VALIDATION", { fieldErrors: { amount: [customRangeMessage(error.message)] } });
      if (error.message.includes("unknown pack")) throw new AppError("VALIDATION", { fieldErrors: { _form: ["This pack is no longer available. Reload the page and choose another."] } });
      throw new AppError("INTERNAL", { context: { operation: "request_ai_credit_purchase", code: error.code } });
    }
    await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "ai_credits.purchase_requested", entityType: "ai_credit_purchase", entityId: typeof data === "string" ? data : input.pack, metadata: { pack: input.pack, method: input.method, promo: input.promo ?? null, amountMinor: input.amount ?? null } });
  });
  if (result.ok) refresh();
  return result;
}

