"use server";

import { after } from "next/server";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { clientIpKey, rateLimit } from "@/lib/rate-limit";
import { randomToken } from "@/lib/crypto";
import { logger } from "@/lib/observability/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { sendEmail } from "@/lib/email/send";
import { requireStoreTenant } from "@/features/cart/context";
import { renderContactForwardEmail } from "@/features/notifications/email/templates";
import { informativeFlagMode, informativeFlagOn } from "../flag";
import { enquiryFormSchema, HONEYPOT_FIELD, type EnquiryFormInput } from "./enquiry-schema";

/**
 * Public enquiry form (docs/informative/PLAN.md "Enquiry form"). Tenant = the verified host, never
 * form input. Spam controls: honeypot (bots get a fake success, nothing is stored), the plan's rate
 * limit of 5 per 10 minutes per IP + site, consent required, and a per-site cap in the database.
 * The owner is emailed after the response (existing mail service).
 */
export async function submitInformativeEnquiryAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("informative.enquiry", async () => {
    const tenant = await requireStoreTenant();
    if (tenant.websiteType !== "INFORMATIVE" || !informativeFlagOn(informativeFlagMode())) throw new AppError("TENANT_UNAVAILABLE");
    const raw = formToObject(fd);
    if (typeof raw[HONEYPOT_FIELD] === "string" && raw[HONEYPOT_FIELD].trim()) {
      logger.info("informative.enquiry_honeypot", { tenantId: tenant.tenantId });
      return;
    }
    const input = parseInput(enquiryFormSchema, raw);
    await rateLimit("info-enquiry", `${tenant.tenantId}:${await clientIpKey()}`, 5, 600);
    const { data, error } = await (await createSupabaseServerClient()).rpc("submit_info_enquiry", {
      p_tenant: tenant.tenantId,
      p_name: input.name,
      p_phone: input.phone,
      p_email: input.email ?? "",
      p_message: input.message ?? "",
      // Explicit nulls: an undefined key is dropped from the JSON and PostgREST would not match the signature.
      p_service: (input.serviceId ?? null) as unknown as string,
      p_preferred_date: (input.preferredDate ?? null) as unknown as string,
      p_preferred_time: input.preferredTime ?? "",
      p_source: input.source,
      p_consent: true,
    });
    if (error) {
      if (error.hint === "TENANT_UNAVAILABLE") throw new AppError("TENANT_UNAVAILABLE");
      if (error.hint === "RATE_LIMITED") throw new AppError("RATE_LIMITED");
      if (error.hint === "CONSENT_REQUIRED") throw new AppError("VALIDATION", { fieldErrors: { consent: ["Please agree so we can contact you"] } });
      if (error.code === "22023" || error.code === "23514") throw new AppError("VALIDATION", { fieldErrors: { _form: ["Please check your details and try again."] } });
      throw mapDbError(error, { op: "submit_info_enquiry" });
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (row?.notify_email && row.notify_email_enabled) {
      const to = row.notify_email;
      const key = `${tenant.tenantId}:enquiry:${row.enquiry_id ?? randomToken(12)}`;
      after(() => notifyOwner(tenant.tenantId, to, row.business_name ?? tenant.name, input, key));
    }
  });
}

async function notifyOwner(tenantId: string, to: string, businessName: string, input: EnquiryFormInput, idempotencyKey: string): Promise<void> {
  const lines = [input.message ?? "(no message)"];
  if (input.preferredDate || input.preferredTime) lines.push("", `Preferred: ${[input.preferredDate, input.preferredTime].filter(Boolean).join(" at ")}`);
  const mail = renderContactForwardEmail({
    brand: { storeName: businessName },
    name: input.name,
    email: input.email ?? "(not given)",
    phone: input.phone,
    subject: input.source === "SERVICE_PAGE" ? "New enquiry from a service page" : "New enquiry from your website",
    message: lines.join("\n"),
  });
  const r = await sendEmail({ tenantId, kind: "informative_enquiry", to, ...mail, fromName: `${businessName} website`, replyTo: input.email ?? null, idempotencyKey });
  if (r.status === "failed") logger.warn("informative.enquiry_email_failed", { tenantId });
}
