"use server";

import { refresh } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { assertPermission, requireTenant } from "@/lib/tenant/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toDecimalString, toMinor } from "@/lib/money";
import { aiCreditOtcRedeemMessage, creditPurchaseSchema, redeemAiCreditCodeSchema } from "./schemas";
import { resolvePlatformAiGateway, startPlatformAiCreditCheckout, type PlatformGatewayCheckout } from "./platform-gateways";

/** "Custom amount must be between 99.00 and 50000.00" → "Enter an amount between ₹99 and ₹50,000." */
function customRangeMessage(message: string): string {
  const m = /between ([\d.]+) and ([\d.]+)/.exec(message);
  const fmt = (v: string) => `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  return m?.[1] && m[2] ? `Enter an amount between ${fmt(m[1])} and ${fmt(m[2])}.` : "This amount is outside the allowed range.";
}

export type AiCreditPurchaseResult = {
  requestId: string;
  /** Present when a platform Razorpay/Cashfree gateway is configured and method is online. */
  checkout: PlatformGatewayCheckout | null;
};

export async function requestAiCreditPurchaseAction(_prev: ActionResult<AiCreditPurchaseResult> | null, fd: FormData): Promise<ActionResult<AiCreditPurchaseResult>> {
  const result = await runAction("aiCredits.purchase.request", async () => {
    const input = parseInput(creditPurchaseSchema, formToObject(fd));
    const ctx = await requireTenant();
    assertPermission(ctx, "billing.manage");

    const gateway = input.method === "online" ? await resolvePlatformAiGateway() : null;
    const method = gateway ? "online" : input.method;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("request_ai_credit_purchase", {
      p_tenant: ctx.tenantId,
      p_pack: input.pack,
      p_method: method,
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
    const requestId = typeof data === "string" ? data : String(data);
    let checkout: PlatformGatewayCheckout | null = null;

    if (gateway) {
      const { data: row, error: readError } = await supabase
        .from("ai_credit_purchase_requests")
        .select("id, amount, pack")
        .eq("id", requestId)
        .eq("tenant_id", ctx.tenantId)
        .maybeSingle();
      if (readError || !row) throw new AppError("INTERNAL", { context: { operation: "read_ai_credit_purchase", code: readError?.code } });
      const { data: profile } = await supabase.from("profiles").select("phone").eq("id", ctx.user.id).maybeSingle();
      checkout = await startPlatformAiCreditCheckout({
        requestId: row.id,
        tenantId: ctx.tenantId,
        amountMinor: toMinor(String(row.amount)),
        pack: row.pack,
        customer: {
          id: ctx.user.id,
          email: ctx.user.email,
          phone: profile?.phone ?? null,
          name: ctx.user.displayName,
        },
      });
    }

    await audit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.user.id,
      action: "ai_credits.purchase_requested",
      entityType: "ai_credit_purchase",
      entityId: requestId,
      metadata: { pack: input.pack, method, promo: input.promo ?? null, amountMinor: input.amount ?? null, gateway: checkout?.kind ?? null },
    });
    return { requestId, checkout };
  });
  if (result.ok) refresh();
  return result;
}

/** Seller: redeem a platform OTC into this store's AI credit balance (`billing.manage`). Wallet page may import this. */
export async function redeemAiCreditCodeAction(_prev: ActionResult<{ balance: number }> | null, fd: FormData): Promise<ActionResult<{ balance: number }>> {
  const result = await runAction("aiCredits.otc.redeem", async () => {
    const input = parseInput(redeemAiCreditCodeSchema, formToObject(fd));
    const ctx = await requireTenant();
    assertPermission(ctx, "billing.manage");
    const { data, error } = await (await createSupabaseServerClient()).rpc("redeem_ai_credit_code", {
      p_tenant: ctx.tenantId,
      p_code: input.code,
    });
    if (error) {
      throw new AppError("VALIDATION", {
        fieldErrors: { code: [aiCreditOtcRedeemMessage(error.hint, error.message)] },
        context: { operation: "redeem_ai_credit_code", code: error.code },
      });
    }
    const balance = typeof data === "number" ? data : Number(data);
    await audit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.user.id,
      action: "ai_credits.otc_redeemed",
      entityType: "ai_credit_one_time_code",
      entityId: input.code.slice(-4),
      metadata: { balance, codeHint: input.code.slice(-4) },
    });
    return { balance };
  });
  if (result.ok) refresh();
  return result;
}
