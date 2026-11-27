import "server-only";
import { sendTemplateMessage } from "@/features/notifications/whatsapp/cloud-api";
import type { TemplateMessage } from "@/features/notifications/whatsapp/templates";
import { logger } from "@/lib/observability/logger";
import { buildWhatsappOtpPayload, whatsappOtpSender, type WhatsappOtpSender } from "./core";
import { getAppCredential } from "./server";

/**
 * Platform WhatsApp sender for verification codes. The credential is the `whatsapp` row of
 * `platform_app_credentials` (secret-key read, ADR-006), env fallback
 * PLATFORM_WHATSAPP_PHONE_NUMBER_ID / PLATFORM_WHATSAPP_ACCESS_TOKEN. The token never leaves
 * the server and the code is never logged.
 */
export async function getPlatformWhatsappSender(): Promise<WhatsappOtpSender | null> {
  return whatsappOtpSender(await getAppCredential("whatsapp"));
}

export type OtpSendResult = { ok: true } | { ok: false; message: string };

export async function sendWhatsappOtp(sender: WhatsappOtpSender, toE164: string, code: string): Promise<OtpSendResult> {
  const payload = buildWhatsappOtpPayload(toE164, code, sender.templateName, sender.templateLanguage);
  // The shared sender only types body components; an authentication template also needs the
  // copy-code button parameter. The payload is sent as JSON unchanged.
  const res = await sendTemplateMessage(sender.phoneNumberId, sender.token, payload as unknown as TemplateMessage);
  if (res.ok) return { ok: true };
  logger.warn("verification.whatsapp_send_failed", { httpStatus: res.httpStatus, code: res.code });
  return { ok: false, message: res.message };
}
