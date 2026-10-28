import { NextResponse, type NextRequest } from "next/server";
import { handlePlatformRazorpayWebhook } from "@/features/ai-credits/platform-gateways";

/**
 * Platform Razorpay webhook for AI credit wallet recharge.
 * Configure in Razorpay as {platform origin}/api/webhooks/platform/razorpay
 * (uses platform_app_credentials, not tenant_integrations).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (rawBody.length > 256 * 1024) return NextResponse.json({ error: "payload too large" }, { status: 413 });
  const res = await handlePlatformRazorpayWebhook({
    rawBody,
    signature: request.headers.get("x-razorpay-signature"),
    eventIdHeader: request.headers.get("x-razorpay-event-id"),
  });
  return NextResponse.json(res.body, { status: res.status });
}
