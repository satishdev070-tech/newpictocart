import "server-only";
import { cache } from "react";
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { platformOrigin } from "@/lib/platform/urls";
import { getAppCredential } from "@/features/platform-apps/server";
import type { RazorpayCredentials } from "@/features/payments/credentials";
import { createRazorpayOrder, testRazorpay } from "@/features/payments/razorpay";
import { createCashfreeOrder, testCashfree, type CashfreeCredentials } from "@/features/payments/cashfree";
import { buildPayuForm, testPayu, verifyPayuTransaction, type PayuCredentials } from "@/features/payments/payu";
import { verifyRazorpayWebhookSignature, verifyCashfreeWebhookSignature, verifyPayuResponse } from "@/features/payments/signature";
import { parseRazorpayEvent, webhookEventId } from "@/features/payments/webhook";
import { toMinor } from "@/lib/money";
import type { PlatformGatewayCheckout, PlatformGatewayId, PlatformGatewayStatus } from "./gateway-schemas";

export type { PlatformGatewayCheckout, PlatformGatewayId, PlatformGatewayStatus };

const PURPOSE = "platform-app-credentials";

/** Decrypts the Razorpay webhook secret stored as ciphertext in `extra`. */
function decryptWebhookSecret(ciphertext: string | undefined): string | null {
  if (!ciphertext) return null;
  try {
    return decryptSecret(ciphertext, PURPOSE) || null;
  } catch {
    return null;
  }
}

/** Platform Razorpay keys for AI wallet + plan upgrades (never tenant_integrations). */
export const loadPlatformRazorpayCredentials = cache(async (): Promise<RazorpayCredentials | null> => {
  const cred = await getAppCredential("razorpay");
  if (!cred?.clientId || !cred.secret) return null;
  return {
    keyId: cred.clientId,
    keySecret: cred.secret,
    webhookSecret: decryptWebhookSecret(cred.extra.webhookSecretCiphertext),
    mode: cred.clientId.startsWith("rzp_live_") ? "live" : "test",
  };
});

/** Platform Cashfree keys for AI wallet + plan upgrades (never tenant_integrations). */
export const loadPlatformCashfreeCredentials = cache(async (): Promise<CashfreeCredentials | null> => {
  const cred = await getAppCredential("cashfree");
  if (!cred?.clientId || !cred.secret) return null;
  const environment = cred.extra.environment === "live" ? "live" : "test";
  return { appId: cred.clientId, secretKey: cred.secret, environment };
});

/** Platform PayU keys for AI wallet + plan upgrades (never tenant_integrations). */
export const loadPlatformPayuCredentials = cache(async (): Promise<PayuCredentials | null> => {
  const cred = await getAppCredential("payu");
  if (!cred?.clientId || !cred.secret) return null;
  const environment = cred.extra.environment === "live" ? "live" : "test";
  return { merchantKey: cred.clientId, salt: cred.secret, environment };
});

/** Prefer Razorpay, then Cashfree, then PayU; null → offline / manual admin approve. */
export async function resolvePlatformAiGateway(): Promise<PlatformGatewayId | null> {
  return resolvePlatformPaymentGateway();
}

/** Same preference order for AI credits and plan upgrades. */
export async function resolvePlatformPaymentGateway(): Promise<PlatformGatewayId | null> {
  const [rz, cf, pu] = await Promise.all([loadPlatformRazorpayCredentials(), loadPlatformCashfreeCredentials(), loadPlatformPayuCredentials()]);
  if (rz) return "razorpay";
  if (cf) return "cashfree";
  if (pu) return "payu";
  return null;
}

export async function getPlatformGatewayStatus(): Promise<PlatformGatewayStatus> {
  const [rz, cf, pu] = await Promise.all([loadPlatformRazorpayCredentials(), loadPlatformCashfreeCredentials(), loadPlatformPayuCredentials()]);
  return {
    razorpay: {
      configured: Boolean(rz),
      mode: rz?.mode ?? null,
      hasWebhookSecret: Boolean(rz?.webhookSecret),
      keyHint: rz ? `••${rz.keyId.slice(-4)}` : null,
      clientId: rz?.keyId ?? null,
    },
    cashfree: {
      configured: Boolean(cf),
      environment: cf?.environment ?? null,
      keyHint: cf ? `••${cf.appId.slice(-4)}` : null,
      clientId: cf?.appId ?? null,
    },
    payu: {
      configured: Boolean(pu),
      environment: pu?.environment ?? null,
      keyHint: pu ? `••${pu.merchantKey.slice(-4)}` : null,
      clientId: pu?.merchantKey ?? null,
    },
    active: rz ? "razorpay" : cf ? "cashfree" : pu ? "payu" : null,
  };
}

export async function testPlatformRazorpay(creds: { keyId: string; keySecret: string }) {
  return testRazorpay({ ...creds, webhookSecret: null, mode: creds.keyId.startsWith("rzp_live_") ? "live" : "test" });
}

export async function testPlatformCashfree(creds: CashfreeCredentials) {
  return testCashfree(creds);
}

export async function testPlatformPayu(creds: PayuCredentials) {
  return testPayu(creds);
}

/** Cashfree / receipt-safe id from a purchase or plan request uuid. */
function gatewayOrderId(prefix: string, requestId: string): string {
  return `${prefix}${requestId.replace(/-/g, "").slice(0, 24)}`;
}

type CheckoutCustomer = { id: string; email: string | null; phone: string | null; name: string | null };

function customerPhone(phone: string | null): string {
  return (phone ?? "").replace(/\D/g, "").slice(-10) || "9999999999";
}

function customerName(name: string | null): string {
  return (name ?? "Seller").trim().slice(0, 60) || "Seller";
}

/**
 * Creates a Razorpay, Cashfree or PayU order with **platform** credentials and stamps the purchase
 * request. Caller must have already inserted a pending request and checked billing.manage.
 */
export async function startPlatformAiCreditCheckout(input: {
  requestId: string;
  tenantId: string;
  amountMinor: number;
  pack: string;
  customer: CheckoutCustomer;
}): Promise<PlatformGatewayCheckout> {
  const gateway = await resolvePlatformPaymentGateway();
  if (!gateway) throw new AppError("CONFLICT", { fieldErrors: { _form: ["Online payment isn't available. Choose offline payment or try again later."] } });
  const admin = createSupabaseAdminClient();
  const origin = platformOrigin();
  const returnUrl = `${origin}/dashboard/wallet?credits=paid&request=${encodeURIComponent(input.requestId)}`;

  if (gateway === "razorpay") {
    const creds = await loadPlatformRazorpayCredentials();
    if (!creds) throw new AppError("CONFLICT", { fieldErrors: { _form: ["Online payment isn't available right now."] } });
    const rzp = await createRazorpayOrder(creds, {
      amountMinor: input.amountMinor,
      receipt: gatewayOrderId("aicr_", input.requestId).slice(0, 40),
      notes: { purchase_request_id: input.requestId, tenant_id: input.tenantId, pack: input.pack, purpose: "ai_credits" },
    });
    if (rzp.amount !== input.amountMinor) throw new AppError("INTERNAL", { context: { reason: "platform razorpay amount mismatch" } });
    const { error } = await admin
      .from("ai_credit_purchase_requests")
      .update({ provider: "razorpay", provider_order_id: rzp.id })
      .eq("id", input.requestId)
      .eq("tenant_id", input.tenantId)
      .eq("status", "pending");
    if (error) throw new AppError("INTERNAL", { cause: error, context: { operation: "stamp_ai_credit_provider" } });
    return { kind: "razorpay", keyId: creds.keyId, providerOrderId: rzp.id, amountMinor: input.amountMinor, requestId: input.requestId };
  }

  if (gateway === "cashfree") {
    const creds = await loadPlatformCashfreeCredentials();
    if (!creds) throw new AppError("CONFLICT", { fieldErrors: { _form: ["Online payment isn't available right now."] } });
    const orderId = gatewayOrderId("aicr_", input.requestId);
    const cf = await createCashfreeOrder(creds, {
      orderId,
      amountRupees: input.amountMinor / 100,
      customer: {
        id: input.customer.id.replace(/-/g, "").slice(0, 50),
        phone: customerPhone(input.customer.phone),
        email: input.customer.email,
        name: input.customer.name,
      },
      returnUrl,
      notifyUrl: `${origin}/api/webhooks/platform/cashfree`,
      note: `AI credits ${input.pack} ${input.requestId}`,
    });
    if (!cf.payment_session_id) throw new AppError("CONFLICT", { message: "Cashfree couldn't start this payment. Please try again." });
    const { error } = await admin
      .from("ai_credit_purchase_requests")
      .update({ provider: "cashfree", provider_order_id: orderId })
      .eq("id", input.requestId)
      .eq("tenant_id", input.tenantId)
      .eq("status", "pending");
    if (error) throw new AppError("INTERNAL", { cause: error, context: { operation: "stamp_ai_credit_provider" } });
    return {
      kind: "cashfree",
      mode: creds.environment === "live" ? "production" : "sandbox",
      paymentSessionId: cf.payment_session_id,
      requestId: input.requestId,
    };
  }

  const creds = await loadPlatformPayuCredentials();
  if (!creds) throw new AppError("CONFLICT", { fieldErrors: { _form: ["Online payment isn't available right now."] } });
  const txnid = gatewayOrderId("aicr", input.requestId).slice(0, 25);
  const form = buildPayuForm(creds, {
    txnid,
    amount: (input.amountMinor / 100).toFixed(2),
    productinfo: `AI credits ${input.pack}`.slice(0, 100),
    firstname: customerName(input.customer.name),
    email: (input.customer.email ?? "seller@pictocart.in").slice(0, 100),
    phone: customerPhone(input.customer.phone),
    udf1: input.requestId,
    udf2: "ai_credits",
    udf3: input.tenantId,
    surl: returnUrl,
    furl: returnUrl,
  });
  const { error } = await admin
    .from("ai_credit_purchase_requests")
    .update({ provider: "payu", provider_order_id: txnid })
    .eq("id", input.requestId)
    .eq("tenant_id", input.tenantId)
    .eq("status", "pending");
  if (error) throw new AppError("INTERNAL", { cause: error, context: { operation: "stamp_ai_credit_provider" } });
  return { kind: "payu", action: form.action, fields: form.fields, requestId: input.requestId };
}

/**
 * Creates a platform gateway order for a pending plan request and stamps provider fields.
 * Caller must have created the pending `plan_requests` row (with amount_paise) and checked billing.manage.
 */
export async function startPlatformPlanCheckout(input: {
  requestId: string;
  tenantId: string;
  amountPaise: number;
  planName: string;
  cycle: "monthly" | "yearly";
  customer: CheckoutCustomer;
}): Promise<PlatformGatewayCheckout> {
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new AppError("CONFLICT", { fieldErrors: { _form: ["This plan doesn't need an online payment."] } });
  }
  const gateway = await resolvePlatformPaymentGateway();
  if (!gateway) throw new AppError("CONFLICT", { fieldErrors: { _form: ["Online payment isn't available. Send a plan request instead."] } });
  const admin = createSupabaseAdminClient();
  const origin = platformOrigin();
  const returnUrl = `${origin}/dashboard/settings/plan?paid=1&request=${encodeURIComponent(input.requestId)}`;
  const product = `${input.planName} (${input.cycle})`.slice(0, 100);

  if (gateway === "razorpay") {
    const creds = await loadPlatformRazorpayCredentials();
    if (!creds) throw new AppError("CONFLICT", { fieldErrors: { _form: ["Online payment isn't available right now."] } });
    const rzp = await createRazorpayOrder(creds, {
      amountMinor: input.amountPaise,
      receipt: gatewayOrderId("plan_", input.requestId).slice(0, 40),
      notes: { plan_request_id: input.requestId, tenant_id: input.tenantId, purpose: "plan_upgrade", cycle: input.cycle },
    });
    if (rzp.amount !== input.amountPaise) throw new AppError("INTERNAL", { context: { reason: "platform plan razorpay amount mismatch" } });
    const { error } = await admin
      .from("plan_requests")
      .update({ provider: "razorpay", provider_order_id: rzp.id, amount_paise: input.amountPaise })
      .eq("id", input.requestId)
      .eq("tenant_id", input.tenantId)
      .eq("status", "pending");
    if (error) throw new AppError("INTERNAL", { cause: error, context: { operation: "stamp_plan_provider" } });
    return { kind: "razorpay", keyId: creds.keyId, providerOrderId: rzp.id, amountMinor: input.amountPaise, requestId: input.requestId };
  }

  if (gateway === "cashfree") {
    const creds = await loadPlatformCashfreeCredentials();
    if (!creds) throw new AppError("CONFLICT", { fieldErrors: { _form: ["Online payment isn't available right now."] } });
    const orderId = gatewayOrderId("plan_", input.requestId);
    const cf = await createCashfreeOrder(creds, {
      orderId,
      amountRupees: input.amountPaise / 100,
      customer: {
        id: input.customer.id.replace(/-/g, "").slice(0, 50),
        phone: customerPhone(input.customer.phone),
        email: input.customer.email,
        name: input.customer.name,
      },
      returnUrl,
      notifyUrl: `${origin}/api/webhooks/platform/cashfree`,
      note: `Plan ${product} ${input.requestId}`,
    });
    if (!cf.payment_session_id) throw new AppError("CONFLICT", { message: "Cashfree couldn't start this payment. Please try again." });
    const { error } = await admin
      .from("plan_requests")
      .update({ provider: "cashfree", provider_order_id: orderId, amount_paise: input.amountPaise })
      .eq("id", input.requestId)
      .eq("tenant_id", input.tenantId)
      .eq("status", "pending");
    if (error) throw new AppError("INTERNAL", { cause: error, context: { operation: "stamp_plan_provider" } });
    return {
      kind: "cashfree",
      mode: creds.environment === "live" ? "production" : "sandbox",
      paymentSessionId: cf.payment_session_id,
      requestId: input.requestId,
    };
  }

  const creds = await loadPlatformPayuCredentials();
  if (!creds) throw new AppError("CONFLICT", { fieldErrors: { _form: ["Online payment isn't available right now."] } });
  const txnid = gatewayOrderId("plan", input.requestId).slice(0, 25);
  const form = buildPayuForm(creds, {
    txnid,
    amount: (input.amountPaise / 100).toFixed(2),
    productinfo: product,
    firstname: customerName(input.customer.name),
    email: (input.customer.email ?? "seller@pictocart.in").slice(0, 100),
    phone: customerPhone(input.customer.phone),
    udf1: input.requestId,
    udf2: "plan",
    udf3: input.tenantId,
    surl: returnUrl,
    furl: returnUrl,
  });
  const { error } = await admin
    .from("plan_requests")
    .update({ provider: "payu", provider_order_id: txnid, amount_paise: input.amountPaise })
    .eq("id", input.requestId)
    .eq("tenant_id", input.tenantId)
    .eq("status", "pending");
  if (error) throw new AppError("INTERNAL", { cause: error, context: { operation: "stamp_plan_provider" } });
  return { kind: "payu", action: form.action, fields: form.fields, requestId: input.requestId };
}

async function completeAiPurchase(requestId: string, paymentReference: string): Promise<"credited" | "already" | "missing"> {
  const admin = createSupabaseAdminClient();
  const { data: before } = await admin.from("ai_credit_purchase_requests").select("status").eq("id", requestId).maybeSingle();
  if (!before) return "missing";
  if (before.status === "approved") return "already";
  const { error } = await admin.rpc("complete_ai_credit_purchase_payment", {
    p_request: requestId,
    p_payment_reference: paymentReference.slice(0, 160),
  });
  if (error) {
    if (error.hint === "AI_CREDIT_PURCHASE_DECIDED" || /already decided/i.test(error.message)) return "already";
    if (["PGRST202", "42883"].includes(error.code ?? "")) {
      logger.warn("ai_credits.complete_rpc_missing", { code: error.code });
      throw new AppError("INTERNAL", { context: { operation: "complete_ai_credit_purchase_payment", code: error.code } });
    }
    throw new AppError("INTERNAL", { cause: error, context: { operation: "complete_ai_credit_purchase_payment" } });
  }
  return "credited";
}

async function completePlanPayment(requestId: string, paymentReference: string): Promise<"activated" | "already" | "missing"> {
  const admin = createSupabaseAdminClient();
  const { data: before } = await admin.from("plan_requests").select("status").eq("id", requestId).maybeSingle();
  if (!before) return "missing";
  if (before.status === "approved") return "already";
  const { error } = await admin.rpc("complete_plan_request_payment", {
    p_request: requestId,
    p_payment_reference: paymentReference.slice(0, 160),
  });
  if (error) {
    if (error.hint === "NOT_PENDING" || /already decided|not pending/i.test(error.message)) return "already";
    if (["PGRST202", "42883"].includes(error.code ?? "")) {
      logger.warn("billing.complete_plan_rpc_missing", { code: error.code });
      throw new AppError("INTERNAL", { context: { operation: "complete_plan_request_payment", code: error.code } });
    }
    throw new AppError("INTERNAL", { cause: error, context: { operation: "complete_plan_request_payment" } });
  }
  return "activated";
}

type PendingAi = { kind: "ai_credits"; id: string; tenant_id: string; amount: number };
type PendingPlan = { kind: "plan"; id: string; tenant_id: string; amount_paise: number | null };
type PendingPlatformPayment = PendingAi | PendingPlan;

async function findPendingByProviderOrder(provider: PlatformGatewayId, providerOrderId: string): Promise<PendingPlatformPayment | null> {
  const admin = createSupabaseAdminClient();
  const { data: ai } = await admin
    .from("ai_credit_purchase_requests")
    .select("id, tenant_id, status, amount, provider, provider_order_id")
    .eq("provider", provider)
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  if (ai) return { kind: "ai_credits", id: ai.id, tenant_id: ai.tenant_id, amount: Number(ai.amount) };

  const { data: plan } = await admin
    .from("plan_requests")
    .select("id, tenant_id, status, amount_paise, provider, provider_order_id")
    .eq("provider", provider)
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  if (plan) return { kind: "plan", id: plan.id, tenant_id: plan.tenant_id, amount_paise: plan.amount_paise };
  return null;
}

async function settlePending(pending: PendingPlatformPayment, paymentReference: string): Promise<string> {
  if (pending.kind === "ai_credits") return completeAiPurchase(pending.id, paymentReference);
  return completePlanPayment(pending.id, paymentReference);
}

async function claimPlatformEvent(provider: string, eventId: string, tenantId: string | null, type: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("webhook_events").insert({ provider, event_id: eventId, tenant_id: tenantId, event_type: type });
  if (!error) return true;
  if (error.code !== "23505") throw new AppError("INTERNAL", { context: { db: error.message } });
  const { data } = await admin.from("webhook_events").select("processed_at").eq("provider", provider).eq("event_id", eventId).maybeSingle();
  return !data?.processed_at;
}

export type PlatformWebhookResult = { status: number; body: Record<string, unknown> };

/** Platform Razorpay webhook for AI credits + plan upgrades (`/api/webhooks/platform/razorpay`). */
export async function handlePlatformRazorpayWebhook(input: {
  rawBody: string;
  signature: string | null;
  eventIdHeader: string | null;
}): Promise<PlatformWebhookResult> {
  const creds = await loadPlatformRazorpayCredentials();
  if (!creds?.webhookSecret) {
    logger.warn("webhook.platform_razorpay.not_configured");
    return { status: 404, body: { error: "not configured" } };
  }
  if (!verifyRazorpayWebhookSignature(input.rawBody, input.signature, creds.webhookSecret)) {
    logger.warn("webhook.platform_razorpay.bad_signature");
    return { status: 401, body: { error: "invalid signature" } };
  }
  let body: unknown;
  try {
    body = JSON.parse(input.rawBody);
  } catch {
    return { status: 400, body: { error: "invalid json" } };
  }
  const event = parseRazorpayEvent(body);
  if (!event || !["payment.captured", "order.paid"].includes(event.event)) {
    return { status: 200, body: { ok: true, ignored: true } };
  }
  const payment = event.payload.payment?.entity;
  const orderId = payment?.order_id;
  if (!payment || !orderId || payment.status !== "captured") return { status: 200, body: { ok: true, ignored: true } };

  const pending = await findPendingByProviderOrder("razorpay", orderId);
  if (!pending) return { status: 200, body: { ok: true, unmatched: true } };

  const eventId = webhookEventId(input.eventIdHeader, input.rawBody);
  const admin = createSupabaseAdminClient();
  if (!(await claimPlatformEvent("platform_razorpay", eventId, pending.tenant_id, event.event))) {
    return { status: 200, body: { ok: true, duplicate: true } };
  }
  try {
    const outcome = await settlePending(pending, `razorpay:${payment.id}`);
    await admin.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("provider", "platform_razorpay").eq("event_id", eventId);
    logger.info("webhook.platform_razorpay.processed", { requestId: pending.id, kind: pending.kind, outcome, event: event.event });
    return { status: 200, body: { ok: true, outcome, kind: pending.kind } };
  } catch (err) {
    logger.error("webhook.platform_razorpay.failed", { requestId: pending.id, error: err });
    await admin
      .from("webhook_events")
      .update({ error: err instanceof Error ? err.message.slice(0, 200) : "failed" })
      .eq("provider", "platform_razorpay")
      .eq("event_id", eventId);
    return { status: 500, body: { error: "temporary failure" } };
  }
}

/** Platform Cashfree webhook for AI credits + plan upgrades (`/api/webhooks/platform/cashfree`). */
export async function handlePlatformCashfreeWebhook(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
}): Promise<PlatformWebhookResult> {
  const creds = await loadPlatformCashfreeCredentials();
  if (!creds) {
    logger.warn("webhook.platform_cashfree.not_configured");
    return { status: 404, body: { error: "not configured" } };
  }
  if (!verifyCashfreeWebhookSignature({ rawBody: input.rawBody, timestamp: input.timestamp, signature: input.signature, secretKey: creds.secretKey })) {
    return { status: 401, body: { error: "invalid signature" } };
  }
  let event: { type?: string; data?: { order?: { order_id?: string }; payment?: { cf_payment_id?: string | number } } };
  try {
    event = JSON.parse(input.rawBody);
  } catch {
    return { status: 400, body: { error: "invalid json" } };
  }
  const type = String(event.type ?? "");
  const cfOrderId = event.data?.order?.order_id;
  if (!cfOrderId || type !== "PAYMENT_SUCCESS_WEBHOOK") return { status: 200, body: { ok: true, ignored: true } };

  const pending = await findPendingByProviderOrder("cashfree", cfOrderId);
  if (!pending) return { status: 200, body: { ok: true, unmatched: true } };

  const eventId = createHash("sha256").update(`${type}:${cfOrderId}:${event.data?.payment?.cf_payment_id ?? ""}`).digest("hex");
  const admin = createSupabaseAdminClient();
  if (!(await claimPlatformEvent("platform_cashfree", eventId, pending.tenant_id, type))) {
    return { status: 200, body: { ok: true, duplicate: true } };
  }
  try {
    const paymentId = String(event.data?.payment?.cf_payment_id ?? cfOrderId);
    const outcome = await settlePending(pending, `cashfree:${paymentId}`);
    await admin.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("provider", "platform_cashfree").eq("event_id", eventId);
    logger.info("webhook.platform_cashfree.processed", { requestId: pending.id, kind: pending.kind, outcome });
    return { status: 200, body: { ok: true, outcome, kind: pending.kind } };
  } catch (err) {
    logger.error("webhook.platform_cashfree.failed", { requestId: pending.id, error: err });
    await admin
      .from("webhook_events")
      .update({ error: err instanceof Error ? err.message.slice(0, 200) : "failed" })
      .eq("provider", "platform_cashfree")
      .eq("event_id", eventId);
    return { status: 500, body: { error: "temporary failure" } };
  }
}

/** Platform PayU webhook for AI credits + plan upgrades (`/api/webhooks/platform/payu`). */
export async function handlePlatformPayuWebhook(input: { params: Record<string, string> }): Promise<PlatformWebhookResult> {
  const creds = await loadPlatformPayuCredentials();
  if (!creds) {
    logger.warn("webhook.platform_payu.not_configured");
    return { status: 404, body: { error: "not configured" } };
  }
  if (!verifyPayuResponse(input.params, creds.salt) || input.params.key !== creds.merchantKey) {
    return { status: 401, body: { error: "invalid hash" } };
  }
  const txnid = input.params.txnid ?? "";
  if (!txnid) return { status: 200, body: { ok: true, ignored: true } };

  const pending = await findPendingByProviderOrder("payu", txnid);
  if (!pending) return { status: 200, body: { ok: true, unmatched: true } };

  // Authoritative status from PayU verify_payment (same as store checkout).
  const tx = await verifyPayuTransaction(creds, txnid).catch((err: unknown) => {
    logger.warn("webhook.platform_payu.verify_failed", { txnid, error: err });
    return null;
  });
  if (!tx) return { status: 500, body: { error: "verify unavailable" } };
  if (tx.status !== "success") return { status: 200, body: { ok: true, ignored: true, status: tx.status ?? "unknown" } };

  const paidMinor = Math.round(Number(tx.amt) * 100);
  if (pending.kind === "ai_credits") {
    const expected = toMinor(String(pending.amount));
    if (paidMinor !== expected) {
      logger.error("webhook.platform_payu.ai_amount_mismatch", { requestId: pending.id, paidMinor, expected });
      return { status: 200, body: { ok: true, amount_mismatch: true } };
    }
  } else if (pending.amount_paise != null && paidMinor !== pending.amount_paise) {
    logger.error("webhook.platform_payu.plan_amount_mismatch", { requestId: pending.id, paidMinor, expected: pending.amount_paise });
    return { status: 200, body: { ok: true, amount_mismatch: true } };
  }

  const eventId = `${txnid}:${input.params.mihpayid ?? ""}:${input.params.status ?? ""}`;
  const admin = createSupabaseAdminClient();
  if (!(await claimPlatformEvent("platform_payu", eventId, pending.tenant_id, input.params.status ?? "success"))) {
    return { status: 200, body: { ok: true, duplicate: true } };
  }
  try {
    const paymentId = String(tx.mihpayid ?? txnid);
    const outcome = await settlePending(pending, `payu:${paymentId}`);
    await admin.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("provider", "platform_payu").eq("event_id", eventId);
    logger.info("webhook.platform_payu.processed", { requestId: pending.id, kind: pending.kind, outcome });
    return { status: 200, body: { ok: true, outcome, kind: pending.kind } };
  } catch (err) {
    logger.error("webhook.platform_payu.failed", { requestId: pending.id, error: err });
    await admin
      .from("webhook_events")
      .update({ error: err instanceof Error ? err.message.slice(0, 200) : "failed" })
      .eq("provider", "platform_payu")
      .eq("event_id", eventId);
    return { status: 500, body: { error: "temporary failure" } };
  }
}
