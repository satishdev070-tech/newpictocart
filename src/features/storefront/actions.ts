"use server";

import { after } from "next/server";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput, email, uuid } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clientIpKey, rateLimit } from "@/lib/rate-limit";
import { randomToken } from "@/lib/crypto";
import { logger } from "@/lib/observability/logger";
import { requireStoreTenant } from "@/features/cart/context";
import { getStoreCustomer } from "@/features/customer-account/session";
import { sendContactFormEmail } from "@/features/notifications/email/direct";

const reviewSchema = z.object({
  productId: uuid,
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(3000).optional(),
});

/**
 * Shopper review. Requires a signed-in store customer; saved as `pending` for moderation.
 * Marked verified when the customer has a non-cancelled order containing the product.
 * Written with the secret-key client (customers have no insert policy) scoped to the
 * server-resolved tenant and customer.
 */
export async function submitReviewAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("storefront.review", async () => {
    const input = parseInput(reviewSchema, formToObject(fd));
    const tenant = await requireStoreTenant();
    const customer = await getStoreCustomer(tenant.tenantId);
    if (!customer) throw new AppError("UNAUTHENTICATED");
    await rateLimit("review:customer", customer.id, 5, 3600);
    const admin = createSupabaseAdminClient();
    const { data: product } = await admin.from("products").select("id").eq("id", input.productId).eq("tenant_id", tenant.tenantId).eq("status", "active").maybeSingle();
    if (!product) throw new AppError("NOT_FOUND");
    const { data: purchase } = await admin
      .from("order_items")
      .select("order_id, orders!inner(customer_id, status)")
      .eq("tenant_id", tenant.tenantId)
      .eq("product_id", input.productId)
      .eq("orders.customer_id", customer.id)
      .neq("orders.status", "cancelled")
      .limit(1);
    const author = [customer.firstName, customer.lastName?.slice(0, 1)].filter(Boolean).join(" ") || "Customer";
    const { error } = await admin.from("reviews").insert({
      tenant_id: tenant.tenantId,
      product_id: input.productId,
      customer_id: customer.id,
      order_id: purchase?.[0]?.order_id ?? null,
      rating: input.rating,
      title: input.title ?? null,
      body: input.body ?? null,
      author_name: author.slice(0, 80),
      status: "pending",
      verified_purchase: Boolean(purchase?.length),
    });
    if (error?.code === "23505") throw new AppError("CONFLICT", { message: "You've already reviewed this product.", fieldErrors: { _form: ["You've already reviewed this product."] } });
    if (error) throw new AppError("INTERNAL", { context: { db: error.message } });
  });
}

const newsletterSchema = z.object({ email });

/** Newsletter opt-in: upserts a marketing-consented customer record for this store. */
export async function subscribeNewsletterAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("storefront.newsletter", async () => {
    const input = parseInput(newsletterSchema, formToObject(fd));
    const tenant = await requireStoreTenant();
    await rateLimit("newsletter:ip", await clientIpKey(), 10, 3600);
    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data: existing } = await admin.from("customers").select("id").eq("tenant_id", tenant.tenantId).eq("email", input.email).maybeSingle();
    const { error } = existing
      ? await admin.from("customers").update({ accepts_marketing: true, marketing_consent_at: now }).eq("id", existing.id)
      : await admin.from("customers").insert({ tenant_id: tenant.tenantId, email: input.email, accepts_marketing: true, marketing_consent_at: now, tags: ["newsletter"] });
    if (error) throw new AppError("INTERNAL", { context: { db: error.message } });
  });
}

const popupFormSubmitSchema = z.object({
  popupName: z.string().trim().max(80).default("Popup"),
  name: z.string().trim().max(100).default(""),
  email: email,
  phone: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().trim().max(30).optional()),
  message: z.string().trim().min(1, "Add a message").max(5000),
  /** Honeypot: real visitors leave it empty. */
  website: z.string().max(0).optional().or(z.literal("")),
});

/**
 * Custom popup form → same contact-message pipeline as the storefront contact form
 * (RPC + optional email). Tenant = verified host. Field values are composed into `message`
 * by the client; email is required so the store can reply.
 */
export async function submitPopupFormAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("storefront.popup_form", async () => {
    const tenant = await requireStoreTenant();
    const input = parseInput(popupFormSubmitSchema, formToObject(fd));
    await rateLimit("popup-form", `${tenant.tenantId}:${await clientIpKey()}`, 5, 3600);
    const supabase = await createSupabaseServerClient();
    const name = input.name.trim() || "Visitor";
    const subject = `Popup: ${input.popupName}`.slice(0, 150);
    const { error } = await supabase.rpc("submit_contact_message", {
      p_tenant: tenant.tenantId,
      p_name: name,
      p_email: input.email,
      p_phone: input.phone ?? "",
      p_subject: subject,
      p_message: input.message,
    });
    if (error?.code === "PGRST202") {
      logger.warn("storefront.popup_form_persist_skipped", { tenantId: tenant.tenantId, code: error.code });
    } else if (error) {
      if (error.hint === "TENANT_UNAVAILABLE") {
        throw new AppError("TENANT_UNAVAILABLE", { fieldErrors: { _form: ["This store is temporarily unavailable."] } });
      }
      throw new AppError("INTERNAL", { context: { db: error.message } });
    }
    const key = `${tenant.tenantId}:popup:${randomToken(12)}`;
    after(() =>
      sendContactFormEmail({
        tenantId: tenant.tenantId,
        name,
        email: input.email,
        phone: input.phone ?? null,
        subject,
        message: input.message,
        idempotencyKey: key,
      }).then(() => undefined),
    );
  });
}
