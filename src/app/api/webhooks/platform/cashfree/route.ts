import { NextResponse, type NextRequest } from "next/server";
import { handlePlatformCashfreeWebhook } from "@/features/ai-credits/platform-gateways";

/**
 * Platform Cashfree webhook for AI credit wallet recharge.
 * Configure as notify_url {platform origin}/api/webhooks/platform/cashfree
 * (uses platform_app_credentials, not tenant_integrations).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (rawBody.length > 256 * 1024) return NextResponse.json({ error: "payload too large" }, { status: 413 });
  const res = await handlePlatformCashfreeWebhook({
    rawBody,
    timestamp: request.headers.get("x-webhook-timestamp"),
    signature: request.headers.get("x-webhook-signature"),
  });
  return NextResponse.json(res.body, { status: res.status });
}
