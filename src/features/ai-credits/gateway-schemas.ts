import { z } from "zod";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v);

export type PlatformGatewayId = "razorpay" | "cashfree" | "payu";

/** Checkout payload returned to the browser after starting a platform gateway order. */
export type PlatformGatewayCheckout =
  | { kind: "razorpay"; keyId: string; providerOrderId: string; amountMinor: number; requestId: string }
  | { kind: "cashfree"; mode: "sandbox" | "production"; paymentSessionId: string; requestId: string }
  | { kind: "payu"; action: string; fields: Record<string, string>; requestId: string };

/** Presence-only status for Admin → Credits economy → Payments (never secrets). */
export type PlatformGatewayStatus = {
  razorpay: { configured: boolean; mode: "test" | "live" | null; hasWebhookSecret: boolean; keyHint: string | null; clientId: string | null };
  cashfree: { configured: boolean; environment: "test" | "live" | null; keyHint: string | null; clientId: string | null };
  payu: { configured: boolean; environment: "test" | "live" | null; keyHint: string | null; clientId: string | null };
  active: PlatformGatewayId | null;
};

/** Admin → Credits economy → Payments: Razorpay (platform AI wallet + plans). */
export const savePlatformRazorpaySchema = z.object({
  keyId: z.preprocess(blank, z.string({ error: "Enter the Key ID" }).regex(/^rzp_(test|live)_[A-Za-z0-9]{8,32}$/, "Looks like rzp_test_… or rzp_live_…")),
  keySecret: z.preprocess(blank, z.string({ error: "Enter the Key Secret" }).min(10, "That secret looks too short").max(500).regex(/^\S+$/, "Secrets don't contain spaces")),
  webhookSecret: z.preprocess(blank, z.string().min(10, "That webhook secret looks too short").max(500).regex(/^\S+$/, "Secrets don't contain spaces").optional()),
});

export const savePlatformCashfreeSchema = z.object({
  appId: z.preprocess(blank, z.string({ error: "Enter the App ID" }).min(3).max(300).regex(/^[A-Za-z0-9._-]{3,300}$/, "Use the App ID from Cashfree")),
  secretKey: z.preprocess(blank, z.string({ error: "Enter the Secret Key" }).min(10, "That secret looks too short").max(500).regex(/^\S+$/, "Secrets don't contain spaces")),
  environment: z.enum(["test", "live"]),
});

export const savePlatformPayuSchema = z.object({
  merchantKey: z.preprocess(blank, z.string({ error: "Enter the Merchant Key" }).min(4).max(20).regex(/^[A-Za-z0-9]{4,20}$/, "Use the Merchant Key from PayU Dashboard → Developers")),
  salt: z.preprocess(blank, z.string({ error: "Enter the Merchant Salt" }).min(8, "That salt looks too short").max(500).regex(/^\S+$/, "Secrets don't contain spaces")),
  environment: z.enum(["test", "live"]),
});
