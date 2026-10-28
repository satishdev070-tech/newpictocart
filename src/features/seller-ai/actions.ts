"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { assertPermission, requireTenant } from "@/lib/tenant/membership";
import { AppError } from "@/lib/errors";
import { getDashboardHome } from "@/features/analytics/home";
import { fetchHttpsImages, fileToImagePayload, runSellerAiGeneration } from "./server";
import { blogWritePrompt, businessCoachPrompt, contactReplyPrompt, productGeneratePrompt } from "./prompts";
import {
  businessCoachContentSchema,
  businessCoachResultSchema,
  contactReplyContentSchema,
  contactReplyInputSchema,
  contactReplyResultSchema,
  generateBlogContentSchema,
  generateBlogInputSchema,
  generateBlogResultSchema,
  generateProductContentSchema,
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
    const fromFiles = (await Promise.all(uploads.map(fileToImagePayload))).filter((x): x is NonNullable<typeof x> => Boolean(x));
    const fromUrls = parsed.imageUrls.length ? await fetchHttpsImages(parsed.imageUrls) : [];
    const images = [...fromFiles, ...fromUrls].slice(0, 4);
    if (!images.length && !(parsed.hint && parsed.hint.length >= 3)) {
      throw new AppError("VALIDATION", { fieldErrors: { _form: ["Add a product photo or a short hint describing what to generate"] } });
    }
    const prompt = productGeneratePrompt({ hint: parsed.hint, locale: parsed.locale ?? "en-IN", images });
    const r = await runSellerAiGeneration({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      feature: "generate_product",
      creditKind: "generate_product",
      input: { imageCount: images.length, hint: parsed.hint ?? null },
      prompt,
      schema: generateProductContentSchema,
    });
    return generateProductResultSchema.parse(r.data);
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
    const prompt = blogWritePrompt({ storeName: ctx.tenantName, topic: v.topic, locale: v.locale ?? "en-IN" });
    const r = await runSellerAiGeneration({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      feature: "generate_blog",
      creditKind: "generate_blog",
      input: { topic: v.topic },
      prompt,
      schema: generateBlogContentSchema,
    });
    const data = generateBlogResultSchema.parse(r.data);
    return { ...data, contentBlocks: toContentBlocks(data.blocks) };
  });
}

export async function generateContactReplyAction(input: z.input<typeof contactReplyInputSchema>): Promise<ActionResult<ContactReplyResult>> {
  return runAction("sellerAi.contactReply", async () => {
    const ctx = await requireTenant();
    assertPermission(ctx, "content.write");
    const v = parseInput(contactReplyInputSchema, input);
    const prompt = contactReplyPrompt({
      storeName: ctx.tenantName,
      name: v.name,
      subject: v.subject,
      message: v.message,
    });
    const r = await runSellerAiGeneration({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      feature: "contact_reply",
      creditKind: "contact_reply",
      input: { messageId: v.messageId },
      prompt,
      schema: contactReplyContentSchema,
    });
    return contactReplyResultSchema.parse(r.data);
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
    const prompt = businessCoachPrompt({
      storeName: ctx.tenantName,
      locale: "en-IN",
      metrics,
      setupPending,
    });
    const r = await runSellerAiGeneration({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      feature: "business_coach",
      creditKind: "business_coach",
      input: { metrics, setupPending },
      prompt,
      schema: businessCoachContentSchema,
    });
    return businessCoachResultSchema.parse(r.data);
  });
}
