import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { platformOrigin } from "@/lib/platform/urls";
import { getAppCredential } from "@/features/platform-apps/server";
import type { RazorpayCredentials } from "@/features/payments/credentials";
import { createRazorpayOrder, testRazorpay } from "@/features/payments/razorpay";
import { createCashfreeOrder, testCashfree, type CashfreeCredentials } from "@/features/payments/cashfree";
import { verifyRazorpayWebhookSignature, verifyCashfreeWebhookSignature } from "@/features/payments/signature";
import { parseRazorpayEvent, webhookEventId } from "@/features/payments/webhook";
import { createHash } from "node:crypto";
import type { PlatformGatewayId, PlatformGatewayStatus } from "./gateway-schemas";

export type { PlatformGatewayId, PlatformGatewayStatus };

const PURPOSE = "platform-app-credentials";

export type PlatformGatewayCheckout =
  | { kind: "razorpay"; keyId: string; providerOrderId: string; amountMinor: number; requestId: string }
  | { kind: "cashfree"; mode: "sandbox" | "production"; paymentSessionId: string; requestId: string };

/** Decrypts the Razorpay webhook secret stored as ciphertext in `extra`. */
function decryptWebhookSecret(ciphertext: string | undefined): string | null {
  if (!ciphertext) return null;
  try {
    return decryptSecret(ciphertext, PURPOSE) || null;
  } catch {
    return null;
  }
}

/** Platform Razorpay keys for AI wallet recharge (never tenant_integrations). */
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

/** Platform Cashfree keys for AI wallet recharge (never tenant_integrations). */
export const loadPlatformCashfreeCredentials = cache(async (): Promise<CashfreeCredentials | null> => {
  const cred = await getAppCredential("cashfree");
  if (!cred?.clientId || !cred.secret) return null;
  const environment = cred.extra.environment === "live" ? "live" : "test";
  return { appId: cred.clientId, secretKey: cred.secret, environment };
});

/** Prefer Razorpay when both are configured; null → offline / manual admin approve. */
export async function resolvePlatformAiGateway(): Promise<PlatformGatewayId | null> {
  const [rz, cf] = await Promise.all([loadPlatformRazorpayCredentials(), loadPlatformCashfreeCredentials()]);
  if (rz) return "razorpay";
  if (cf) return "cashfree";
  return null;
}

export async function getPlatformGatewayStatus(): Promise<PlatformGatewayStatus> {
  const [rz, cf] = await Promise.all([loadPlatformRazorpayCredentials(), loadPlatformCashfreeCredentials()]);
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
    active: rz ? "razorpay" : cf ? "cashfree" : null,
  };
}

export async function testPlatformRazorpay(creds: { keyId: string; keySecret: string }) {
  return testRazorpay({ ...creds, webhookSecret: null, mode: creds.keyId.startsWith("rzp_live_") ? "live" : "test" });
}

export async function testPlatformCashfree(creds: CashfreeCredentials) {
  return testCashfree(creds);
}

/** Cashfree / receipt-safe id from a purchase request uuid. */
function gatewayOrderId(requestId: string): string {
  return `aicr_${requestId.replace(/-/g, "").slice(0, 24)}`;
}

/**
 * Creates a Razorpay or Cashfree order with **platform** credentials and stamps the purchase
 * request. Caller must have already inserted a pending request and checked billing.manage.
 */
export async function startPlatformAiCreditCheckout(input: {
  requestId: string;
  tenantId: string;
  amountMinor: number;
  pack: string;
  customer: { id: string; email: string | null; phone: string | null; name: string | null };
}): Promise<PlatformGatewayCheckout> {
  const gateway = await resolvePlatformAiGateway();
  if (!gateway) throw new AppError("CONFLICT", { fieldErrors: { _form: ["Online payment isn't available. Choose offline payment or try again later."] } });
  const admin = createSupabaseAdminClient();

  if (gateway === "razorpay") {
    const creds = await loadPlatformRazorpayCredentials();
    if (!creds) throw new AppError("CONFLICT", { fieldErrors: { _form: ["Online payment isn't available right now."] } });
    const rzp = await createRazorpayOrder(creds, {
      amountMinor: input.amountMinor,
      receipt: gatewayOrderId(input.requestId).slice(0, 40),
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

  const creds = await loadPlatformCashfreeCredentials();
  if (!creds) throw new AppError("CONFLICT", { fieldErrors: { _form: ["Online payment isn't available right now."] } });
  const orderId = gatewayOrderId(input.requestId);
  const origin = platformOrigin();
  const phone = (input.customer.phone ?? "").replace(/\D/g, "").slice(-10) || "9999999999";
  const cf = await createCashfreeOrder(creds, {
    orderId,
    amountRupees: input.amountMinor / 100,
    customer: {
      id: input.customer.id.replace(/-/g, "").slice(0, 50),
      phone,
      email: input.customer.email,
      name: input.customer.name,
    },
    returnUrl: `${origin}/dashboard/marketing/neural-pulse?credits=paid&request=${encodeURIComponent(input.requestId)}`,
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

async function completePurchase(requestId: string, paymentReference: string): Promise<"credited" | "already" | "missing"> {
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
    // Migration not applied yet — surface as temporary so the gateway retries.
    if (["PGRST202", "42883"].includes(error.code ?? "")) {
      logger.warn("ai_credits.complete_rpc_missing", { code: error.code });
      throw new AppError("INTERNAL", { context: { operation: "complete_ai_credit_purchase_payment", code: error.code } });
    }
    throw new AppError("INTERNAL", { cause: error, context: { operation: "complete_ai_credit_purchase_payment" } });
  }
  return "credited";
}

async function findPendingByProviderOrder(provider: PlatformGatewayId, providerOrderId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("ai_credit_purchase_requests")
    .select("id, tenant_id, status, amount, provider, provider_order_id")
    .eq("provider", provider)
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  return data;
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

/** Platform Razorpay webhook for AI credit recharge (`/api/webhooks/platform/razorpay`). */
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

  const request = await findPendingByProviderOrder("razorpay", orderId);
  if (!request) return { status: 200, body: { ok: true, unmatched: true } };

  const eventId = webhookEventId(input.eventIdHeader, input.rawBody);
  const admin = createSupabaseAdminClient();
  if (!(await claimPlatformEvent("platform_razorpay", eventId, request.tenant_id, event.event))) {
    return { status: 200, body: { ok: true, duplicate: true } };
  }
  try {
    const outcome = await completePurchase(request.id, `razorpay:${payment.id}`);
    await admin.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("provider", "platform_razorpay").eq("event_id", eventId);
    logger.info("webhook.platform_razorpay.processed", { requestId: request.id, outcome, event: event.event });
    return { status: 200, body: { ok: true, outcome } };
  } catch (err) {
    logger.error("webhook.platform_razorpay.failed", { requestId: request.id, error: err });
    await admin
      .from("webhook_events")
      .update({ error: err instanceof Error ? err.message.slice(0, 200) : "failed" })
      .eq("provider", "platform_razorpay")
      .eq("event_id", eventId);
    return { status: 500, body: { error: "temporary failure" } };
  }
}

/** Platform Cashfree webhook for AI credit recharge (`/api/webhooks/platform/cashfree`). */
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

  const request = await findPendingByProviderOrder("cashfree", cfOrderId);
  if (!request) return { status: 200, body: { ok: true, unmatched: true } };

  const eventId = createHash("sha256").update(`${type}:${cfOrderId}:${event.data?.payment?.cf_payment_id ?? ""}`).digest("hex");
  const admin = createSupabaseAdminClient();
  if (!(await claimPlatformEvent("platform_cashfree", eventId, request.tenant_id, type))) {
    return { status: 200, body: { ok: true, duplicate: true } };
  }
  try {
    const paymentId = String(event.data?.payment?.cf_payment_id ?? cfOrderId);
    const outcome = await completePurchase(request.id, `cashfree:${paymentId}`);
    await admin.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("provider", "platform_cashfree").eq("event_id", eventId);
    logger.info("webhook.platform_cashfree.processed", { requestId: request.id, outcome });
    return { status: 200, body: { ok: true, outcome } };
  } catch (err) {
    logger.error("webhook.platform_cashfree.failed", { requestId: request.id, error: err });
    await admin
      .from("webhook_events")
      .update({ error: err instanceof Error ? err.message.slice(0, 200) : "failed" })
      .eq("provider", "platform_cashfree")
      .eq("event_id", eventId);
    return { status: 500, body: { error: "temporary failure" } };
  }
}
