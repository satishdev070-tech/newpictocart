"use server";

import { after } from "next/server";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { email, parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { clientIpKey, rateLimit } from "@/lib/rate-limit";
import { randomToken } from "@/lib/crypto";
import { logger } from "@/lib/observability/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { requireStoreTenant } from "@/features/cart/context";
import { sendContactFormEmail } from "./direct";

const contactSchema = z.object({
  name: z.string({ error: "Enter your name" }).trim().min(2, "Enter your name").max(100),
  email,
  phone: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(20).optional()),
  subject: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(150).optional()),
  message: z.string({ error: "Write a message" }).trim().min(10, "Tell us a little more").max(5000),
  /** Honeypot: real visitors leave it empty. */
  website: z.string().max(0).optional().or(z.literal("")),
});

type DbError = { code?: string; message?: string; hint?: string; details?: string };

/** A missing RPC (migration not applied yet) must not become an INTERNAL error. */
function contactPersistError(error: DbError): AppError {
  if (error.hint === "TENANT_UNAVAILABLE") {
    return new AppError("TENANT_UNAVAILABLE", { fieldErrors: { _form: ["This store is temporarily unavailable."] } });
  }
  if (error.code === "22023" || error.code === "23514" || error.code === "22P02") {
    return new AppError("VALIDATION", { fieldErrors: { _form: ["Please check your details and try again."] } });
  }
  return mapDbError(error);
}

/**
 * Storefront contact form → saved message, then email to the store (reply-to = visitor).
 * Tenant = verified host, never a tenant id from the form.
 */
export async function submitContactFormAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("storefront.contact", async () => {
    const tenant = await requireStoreTenant();
    const input = parseInput(contactSchema, formToObject(fd));
    await rateLimit("contact-form", `${tenant.tenantId}:${await clientIpKey()}`, 5, 3600);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("submit_contact_message", {
      p_tenant: tenant.tenantId,
      p_name: input.name,
      p_email: input.email,
      p_phone: input.phone ?? "",
      p_subject: input.subject ?? "",
      p_message: input.message,
    });
    if (error?.code === "PGRST202") {
      logger.warn("storefront.contact_persist_skipped", { tenantId: tenant.tenantId, code: error.code });
    } else if (error) {
      throw contactPersistError(error);
    }
    const key = `${tenant.tenantId}:contact:${randomToken(12)}`;
    after(() =>
      sendContactFormEmail({
        tenantId: tenant.tenantId,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        subject: input.subject ?? null,
        message: input.message,
        idempotencyKey: key,
      }).then(() => undefined),
    );
  });
}
