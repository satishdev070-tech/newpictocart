"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { assertPlatformPermission, getPlatformContext } from "@/lib/platform/access";
import { clearAppCredential, saveAppCredential } from "@/features/platform-apps/server";
import { platformOrigin } from "@/lib/platform/urls";
import { savePlatformCashfreeSchema, savePlatformRazorpaySchema } from "./gateway-schemas";
import { getPlatformGatewayStatus, testPlatformCashfree, testPlatformRazorpay } from "./platform-gateways";

const PATH = "/admin/credits-economy";
const form = (message: string, field = "_form") => new AppError("VALIDATION", { message, fieldErrors: { [field]: [message] } });

async function actor() {
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  assertPlatformPermission(ctx, "platform.settings.manage");
  return ctx;
}

function refresh() {
  revalidatePath(PATH);
}

export async function savePlatformRazorpayAction(_prev: ActionResult<{ message: string }> | null, fd: FormData): Promise<ActionResult<{ message: string }>> {
  return runAction("platform.aiCredits.gateway.razorpay.save", async () => {
    const input = parseInput(savePlatformRazorpaySchema, formToObject(fd));
    const ctx = await actor();
    await rateLimit("platform-ai-gateway", ctx.user.id, 10, 600);
    const test = await testPlatformRazorpay({ keyId: input.keyId, keySecret: input.keySecret });
    if (!test.ok) throw form(test.message, "keySecret");
    try {
      await saveAppCredential(ctx, {
        provider: "razorpay",
        clientId: input.keyId,
        secret: input.keySecret,
        ...(input.webhookSecret ? { webhookSecret: input.webhookSecret } : {}),
      });
    } catch (error) {
      const code = error instanceof AppError && error.cause && typeof error.cause === "object" && "code" in error.cause ? String(error.cause.code) : null;
      if (code === "23514") throw form("The keys work, but this database can't store them yet: apply migration 20261028004500_platform_ai_payment_gateways.sql first.");
      throw error;
    }
    refresh();
    const wh = input.webhookSecret
      ? ` Webhook URL: ${platformOrigin()}/api/webhooks/platform/razorpay`
      : " Add the webhook secret (and point Razorpay at /api/webhooks/platform/razorpay) so purchases credit automatically.";
    return { message: `Saved. ${test.message}${wh}` };
  });
}

export async function testPlatformRazorpayAction(_prev: ActionResult<{ message: string }> | null, _fd: FormData): Promise<ActionResult<{ message: string }>> {
  return runAction("platform.aiCredits.gateway.razorpay.test", async () => {
    const ctx = await actor();
    await rateLimit("platform-ai-gateway", ctx.user.id, 10, 600);
    const status = await getPlatformGatewayStatus();
    if (!status.razorpay.configured) throw form("No Razorpay keys saved yet. Paste them above and save.");
    // Re-read via status is presence-only; load through save path's credential for the live test.
    const { loadPlatformRazorpayCredentials } = await import("./platform-gateways");
    const creds = await loadPlatformRazorpayCredentials();
    if (!creds) throw form("No Razorpay keys saved yet.");
    const test = await testPlatformRazorpay({ keyId: creds.keyId, keySecret: creds.keySecret });
    await audit({
      tenantId: null,
      actorUserId: ctx.user.id,
      actorType: "platform",
      action: "platform_app_credential.tested",
      entityType: "platform_app_credential",
      entityId: "razorpay",
      metadata: { ok: test.ok },
    });
    if (!test.ok) throw form(test.message);
    return { message: test.message };
  });
}

export async function clearPlatformRazorpayAction(_prev: ActionResult | null, _fd: FormData): Promise<ActionResult> {
  return runAction("platform.aiCredits.gateway.razorpay.clear", async () => {
    const ctx = await actor();
    await clearAppCredential(ctx, "razorpay");
    refresh();
  });
}

export async function savePlatformCashfreeAction(_prev: ActionResult<{ message: string }> | null, fd: FormData): Promise<ActionResult<{ message: string }>> {
  return runAction("platform.aiCredits.gateway.cashfree.save", async () => {
    const input = parseInput(savePlatformCashfreeSchema, formToObject(fd));
    const ctx = await actor();
    await rateLimit("platform-ai-gateway", ctx.user.id, 10, 600);
    const test = await testPlatformCashfree({ appId: input.appId, secretKey: input.secretKey, environment: input.environment });
    if (!test.ok) throw form(test.message, "secretKey");
    try {
      await saveAppCredential(ctx, {
        provider: "cashfree",
        clientId: input.appId,
        secret: input.secretKey,
        environment: input.environment,
      });
    } catch (error) {
      const code = error instanceof AppError && error.cause && typeof error.cause === "object" && "code" in error.cause ? String(error.cause.code) : null;
      if (code === "23514") throw form("The keys work, but this database can't store them yet: apply migration 20261028004500_platform_ai_payment_gateways.sql first.");
      throw error;
    }
    refresh();
    return { message: `Saved. ${test.message} Notify URL: ${platformOrigin()}/api/webhooks/platform/cashfree` };
  });
}

export async function testPlatformCashfreeAction(_prev: ActionResult<{ message: string }> | null, _fd: FormData): Promise<ActionResult<{ message: string }>> {
  return runAction("platform.aiCredits.gateway.cashfree.test", async () => {
    const ctx = await actor();
    await rateLimit("platform-ai-gateway", ctx.user.id, 10, 600);
    const { loadPlatformCashfreeCredentials } = await import("./platform-gateways");
    const creds = await loadPlatformCashfreeCredentials();
    if (!creds) throw form("No Cashfree keys saved yet. Paste them above and save.");
    const test = await testPlatformCashfree(creds);
    await audit({
      tenantId: null,
      actorUserId: ctx.user.id,
      actorType: "platform",
      action: "platform_app_credential.tested",
      entityType: "platform_app_credential",
      entityId: "cashfree",
      metadata: { ok: test.ok },
    });
    if (!test.ok) throw form(test.message);
    return { message: test.message };
  });
}

export async function clearPlatformCashfreeAction(_prev: ActionResult | null, _fd: FormData): Promise<ActionResult> {
  return runAction("platform.aiCredits.gateway.cashfree.clear", async () => {
    const ctx = await actor();
    await clearAppCredential(ctx, "cashfree");
    refresh();
  });
}
