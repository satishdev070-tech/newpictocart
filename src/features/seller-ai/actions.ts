"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { assertPermission, requireTenant } from "@/lib/tenant/membership";
import { AppError } from "@/lib/errors";
import { getDashboardHome } from "@/features/analytics/home";
import { fileToImagePayload, runSellerAiGeneration } from "./server";
import {
  businessCoachResultSchema,
  contactReplyInputSchema,
  contactReplyResultSchema,
  generateBlogInputSchema,
  generateBlogResultSchema,
  generateProductInputSchema,
  generateProductResultSchema,
  toContentBlocks,
  type BusinessCoachResult,
  type ContactReplyResult,
  type GenerateBlogResult,
  type GenerateProductResult,
} from "./schemas";

function filesFromForm(fd: FormData, key = "images"): File[] {
  const all = fd.getAll(key);
  return all.filter((f): f is File => f instanceof File && f.size > 0).slice(0, 4);
}

/** Product editor: image URL(s) and/or uploaded files → draft fields. */
export async function generateProductFromImageAction(input: {
  imageUrls?: string[];
  hint?: string;
  locale?: string;
  images?: File[];
}): Promise<ActionResult<GenerateProductResult>> {
  return runAction("sellerAi.generateProduct", async () => {
    const ctx = await requireTenant();
    assertPermission(ctx, "catalog.write");
    const parsed = parseInput(generateProductInputSchema, {
      imageUrls: input.imageUrls ?? [],
      hint: input.hint,
      locale: input.locale,
    });
    const uploads = input.images?.length ? input.images : [];
    const imagePayloads = (await Promise.all(uploads.map(fileToImagePayload))).filter((x): x is NonNullable<typeof x> => Boolean(x));
    if (!parsed.imageUrls.length && !imagePayloads.length && !(parsed.hint && parsed.hint.length >= 3)) {
      throw new AppError("VALIDATION", { fieldErrors: { _form: ["Add a product photo or a short hint describing what to generate"] } });
    }
    const r = await runSellerAiGeneration({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      feature: "generate_product",
      creditKind: "generate_product",
      fn: "generate-product",
      input: { imageCount: parsed.imageUrls.length + imagePayloads.length, hint: parsed.hint ?? null },
      body: { imageUrls: parsed.imageUrls, images: imagePayloads, hint: parsed.hint, locale: parsed.locale ?? "en-IN" },
      schema: generateProductResultSchema,
    });
    return r.data;
  });
}

/** FormData variant used by the product editor (file input + hint). */
export async function generateProductFromImageFormAction(fd: FormData): Promise<ActionResult<GenerateProductResult>> {
  const urlsRaw = fd.get("imageUrls");
  let imageUrls: string[] = [];
  if (typeof urlsRaw === "string" && urlsRaw.trim()) {
    try {
      const parsed = JSON.parse(urlsRaw) as unknown;
      imageUrls = Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : [];
    } catch {
      imageUrls = [];
    }
  }
  return generateProductFromImageAction({
    imageUrls,
    hint: typeof fd.get("hint") === "string" ? String(fd.get("hint")) : undefined,
    locale: typeof fd.get("locale") === "string" ? String(fd.get("locale")) : undefined,
    images: filesFromForm(fd),
  });
}

export async function generateBlogAction(input: { topic: string; locale?: string }): Promise<ActionResult<GenerateBlogResult & { contentBlocks: ReturnType<typeof toContentBlocks> }>> {
  return runAction("sellerAi.generateBlog", async () => {
    const ctx = await requireTenant();
    assertPermission(ctx, "content.write");
    const v = parseInput(generateBlogInputSchema, input);
    const r = await runSellerAiGeneration({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      feature: "generate_blog",
      creditKind: "generate_blog",
      fn: "generate-blog",
      input: { topic: v.topic },
      body: { topic: v.topic, storeName: ctx.tenantName, locale: v.locale ?? "en-IN" },
      schema: generateBlogResultSchema,
    });
    return { ...r.data, contentBlocks: toContentBlocks(r.data.blocks) };
  });
}

export async function generateContactReplyAction(input: z.input<typeof contactReplyInputSchema>): Promise<ActionResult<ContactReplyResult>> {
  return runAction("sellerAi.contactReply", async () => {
    const ctx = await requireTenant();
    assertPermission(ctx, "content.write");
    const v = parseInput(contactReplyInputSchema, input);
    const r = await runSellerAiGeneration({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      feature: "contact_reply",
      creditKind: "contact_reply",
      fn: "generate-contact-reply",
      input: { messageId: v.messageId },
      body: { name: v.name, subject: v.subject, message: v.message, storeName: ctx.tenantName },
      schema: contactReplyResultSchema,
    });
    return r.data;
  });
}

export async function refreshBusinessCoachAction(): Promise<ActionResult<BusinessCoachResult>> {
  return runAction("sellerAi.businessCoach", async () => {
    const ctx = await requireTenant();
    assertPermission(ctx, "analytics.read");
    const home = await getDashboardHome(ctx);
    const metrics = {
      revenueMinor30d: home.sales?.kpis.revenueMinor ?? null,
      orders30d: home.sales?.kpis.orders ?? null,
      aovMinor30d: home.sales?.kpis.aovMinor ?? null,
      activeProducts: home.counts.activeProducts,
      allProducts: home.counts.allProducts,
      customers: home.counts.customers,
      toFulfil: home.counts.toFulfil,
      lowStock: home.lowStock?.total ?? null,
      revenueChangePct: home.sales?.kpis.revenueChange ?? null,
    };
    const setupPending = home.setup.filter((s) => !s.done).map((s) => s.label);
    const r = await runSellerAiGeneration({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      feature: "business_coach",
      creditKind: "business_coach",
      fn: "business-coach",
      input: { metrics, setupPending },
      body: { storeName: ctx.tenantName, locale: "en-IN", metrics, setupPending },
      schema: businessCoachResultSchema,
    });
    return r.data;
  });
}
