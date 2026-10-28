"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { assertPermission, requireTenant } from "@/lib/tenant/membership";
import { AppError } from "@/lib/errors";
import { getDashboardHome } from "@/features/analytics/home";
import { can } from "@/lib/tenant/membership";
import { getLocale } from "@/lib/i18n/server";
import { logger } from "@/lib/observability/logger";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { refresh } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { audit } from "@/lib/audit";
import { listCategoryFilterOptions } from "@/features/catalog/server/categories";
import { getTenantTypeCatalogue } from "@/features/catalog/server/product-types";
import { productListQuerySchema } from "@/features/catalog/schemas";
import { getAiCreditBalance, refundAiCredit } from "@/features/ai-credits/server";
import { assertProductCapacity, listProducts } from "@/features/catalog/server/products";
import { INDUSTRY_SLUGS, isIndustry } from "@/features/stores/industries";
import { fetchHttpsImages, fileToImagePayload, runSellerAiGeneration } from "./server";
import { blogWritePrompt, businessCoachPrompt, contactReplyPrompt, generateReviewsPrompt, productGeneratePrompt, storeAgentPrompt, storeSetupPrompt } from "./prompts";
import { buildStoreSnapshot, coachMetrics, lowStockLines, topProductLines } from "./snapshot";
import { persistStoreSetup } from "./store-setup";
import {
  AGENT_PRODUCT_SNAPSHOT_LIMIT,
  agentChatInputSchema,
  agentReplyContentSchema,
  agentReplyResultSchema,
  storeSetupContentSchema,
  storeSetupInputSchema,
  STORE_SETUP_MAX_PRODUCTS,
  type AgentChatInput,
  type AgentReplyResult,
  type StoreSetupResult,
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
  generateReviewsContentSchema,
  generateReviewsInputSchema,
  generateReviewsResultSchema,
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
    // The store's own categories and product types, so the AI's hints map onto real options.
    const [categories, types] = await Promise.all([
      listCategoryFilterOptions(ctx.tenantId).catch(() => []),
      getTenantTypeCatalogue(ctx.tenantId).catch(() => null),
    ]);
    const prompt = productGeneratePrompt({
      hint: parsed.hint,
      locale: parsed.locale ?? "en-IN",
      images,
      storeName: ctx.tenantName,
      categories: categories.map((c) => c.name),
      productTypes: types?.types.map((t) => t.key) ?? [],
    });
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

/** Dashboard → Reviews: draft N positive reviews for one product and insert them as pending. */
export async function generateReviewsAction(input: {
  productId: string;
  count: 3 | 5;
  tone?: "positive";
}): Promise<ActionResult<{ inserted: number }>> {
  const result = await runAction("sellerAi.generateReviews", async () => {
    const ctx = await requireTenant();
    assertPermission(ctx, "reviews.moderate");
    const v = parseInput(generateReviewsInputSchema, { ...input, tone: input.tone ?? "positive" });
    const supabase = await createSupabaseServerClient();
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, title, description, short_description")
      .eq("id", v.productId)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    if (productError) throw mapDbError(productError);
    if (!product) throw new AppError("NOT_FOUND", { fieldErrors: { productId: ["Product not found"] } });

    const prompt = generateReviewsPrompt({
      storeName: ctx.tenantName,
      productTitle: product.title,
      productDescription: product.short_description || product.description,
      count: v.count,
      tone: v.tone,
    });
    const r = await runSellerAiGeneration({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      feature: "generate_reviews",
      creditKind: "generate_reviews",
      input: { productId: v.productId, count: v.count, tone: v.tone },
      prompt,
      schema: generateReviewsContentSchema,
    });
    const data = generateReviewsResultSchema.parse(r.data);
    const reviews = data.reviews.slice(0, v.count);
    const rows = reviews.map((rev) => ({
      tenant_id: ctx.tenantId,
      product_id: v.productId,
      rating: rev.rating,
      title: rev.title.slice(0, 120),
      body: rev.body.slice(0, 3000),
      author_name: rev.authorName.slice(0, 80),
      status: "pending" as const,
      verified_purchase: false,
      source: "import" as const,
    }));
    const { data: inserted, error } = await supabase.from("reviews").insert(rows).select("id");
    if (error) throw mapDbError(error);
    const count = inserted?.length ?? 0;
    await audit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.user.id,
      action: "review.ai_generated",
      entityType: "product",
      entityId: v.productId,
      metadata: { count, tone: v.tone },
    });
    return { inserted: count };
  });
  if (result.ok) refresh();
  return result;
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
    const [home, language] = await Promise.all([getDashboardHome(ctx), getLocale()]);
    const metrics = coachMetrics(home);
    const setupPending = home.setup.filter((s) => !s.done).map((s) => s.label);
    const prompt = businessCoachPrompt({
      storeName: ctx.tenantName,
      language,
      metrics,
      setupPending,
      topProducts: topProductLines(home),
      lowStock: lowStockLines(home),
    });
    const r = await runSellerAiGeneration({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      feature: "business_coach",
      creditKind: "business_coach",
      input: { metrics, setupPending, language },
      prompt,
      schema: businessCoachContentSchema,
    });
    return businessCoachResultSchema.parse(r.data);
  });
}

const AGENT_DAILY_LIMIT = 60;

/** Lean plan/trial brief for the Pica2 snapshot (seller session + RLS). */
async function loadAgentPlanBrief(tenantId: string): Promise<{ planName: string | null; status: string | null; trialEndsAt: string | null }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("tenants").select("status, trial_ends_at, plans(name)").eq("id", tenantId).maybeSingle();
  if (error || !data) {
    if (error) logger.warn("seller_ai.agent_plan_unavailable", { message: error.message.slice(0, 120) });
    return { planName: null, status: null, trialEndsAt: null };
  }
  const plan = data.plans as { name: string } | { name: string }[] | null;
  const planName = Array.isArray(plan) ? (plan[0]?.name ?? null) : (plan?.name ?? null);
  return { planName, status: data.status, trialEndsAt: data.trial_ends_at };
}

/**
 * Pica2 AI Assistant chat. The store is the caller's active membership (never a client id); facts
 * are read with the seller's own session, so RLS limits them to this store and to what the
 * member's role may see. One credit-debited generation per question.
 */
export async function askStoreAgentAction(input: AgentChatInput): Promise<ActionResult<AgentReplyResult>> {
  return runAction("sellerAi.storeAgent", async () => {
    const v = parseInput(agentChatInputSchema, input);
    const ctx = await requireTenant();
    assertPermission(ctx, "analytics.read");
    const catalog = can(ctx, "catalog.read");
    const [home, language, balance, products, categories, plan] = await Promise.all([
      getDashboardHome(ctx),
      getLocale(),
      getAiCreditBalance(ctx.tenantId),
      catalog
        ? listProducts(ctx.tenantId, productListQuerySchema.parse({}), AGENT_PRODUCT_SNAPSHOT_LIMIT)
            .then((r) => r.rows)
            .catch((err: unknown) => {
              logger.warn("seller_ai.agent_products_unavailable", { message: err instanceof Error ? err.message.slice(0, 120) : "unknown" });
              return [];
            })
        : Promise.resolve([]),
      catalog
        ? listCategoryFilterOptions(ctx.tenantId)
            .then((rows) => rows.map((c) => c.name).filter(Boolean).slice(0, 40))
            .catch((err: unknown) => {
              logger.warn("seller_ai.agent_categories_unavailable", { message: err instanceof Error ? err.message.slice(0, 120) : "unknown" });
              return [] as string[];
            })
        : Promise.resolve([] as string[]),
      can(ctx, "store.read")
        ? loadAgentPlanBrief(ctx.tenantId)
        : Promise.resolve({ planName: null, status: null, trialEndsAt: null }),
    ]);
    const snapshot = buildStoreSnapshot({
      storeName: ctx.tenantName,
      storeStatus: ctx.tenantStatus,
      storeUrl: storeOrigin(storeSubdomain(ctx.tenantSlug)),
      home,
      products: products.map((p) => ({ title: p.title, status: p.status, minPrice: p.minPrice, stockTotal: p.stockTotal, categoryName: p.categoryName })),
      creditBalance: balance,
      categories,
      plan,
    });
    const prompt = storeAgentPrompt({ storeName: ctx.tenantName, language, snapshot, messages: v.messages });
    const r = await runSellerAiGeneration({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      feature: "store_agent",
      creditKind: "store_agent",
      input: { question: v.messages[v.messages.length - 1]!.content.slice(0, 500), turns: v.messages.length, language },
      prompt,
      schema: agentReplyContentSchema,
      limit: { key: "seller-agent", perDay: AGENT_DAILY_LIMIT, message: `You've asked Pica2 AI Assistant ${AGENT_DAILY_LIMIT} questions today. Try again tomorrow.` },
      // In-process generateJson is primary; merchant-assistant Edge is an optional fallback.
      edgeFallback: {
        name: "merchant-assistant",
        body: { storeName: ctx.tenantName, language, snapshot, messages: v.messages },
      },
    });
    return agentReplyResultSchema.parse(r.data);
  });
}

/**
 * Build your store from a prompt: description + product names (+ optional photos by position) →
 * categories, draft products, draft blogs and pending sample reviews in THIS store.
 */
export async function setupStoreFromPromptAction(fd: FormData): Promise<ActionResult<StoreSetupResult>> {
  return runAction("sellerAi.storeSetup", async () => {
    let names: unknown = [];
    try {
      names = JSON.parse(typeof fd.get("products") === "string" ? String(fd.get("products")) : "[]");
    } catch {
      names = [];
    }
    const v = parseInput(storeSetupInputSchema, {
      prompt: fd.get("prompt"),
      products: Array.isArray(names) ? names.filter((n) => typeof n === "string" && n.trim()) : [],
    });
    const ctx = await requireTenant();
    assertPermission(ctx, "catalog.write");
    // Fail on the plan's product limit before any credits are spent.
    await assertProductCapacity(ctx.tenantId, v.products.length || 4);

    const files: (File | null)[] = Array.from({ length: STORE_SETUP_MAX_PRODUCTS }, (_, i) => {
      const f = fd.get(`image_${i}`);
      return f instanceof File && f.size > 0 ? f : null;
    }).slice(0, Math.max(v.products.length, 0));
    const images = (await Promise.all(files.filter((f): f is File => Boolean(f)).slice(0, 4).map(fileToImagePayload))).filter((x): x is NonNullable<typeof x> => Boolean(x));

    const supabase = await createSupabaseServerClient();
    const [{ data: store }, categories] = await Promise.all([
      supabase.from("stores").select("store_categories(slug)").eq("tenant_id", ctx.tenantId).maybeSingle(),
      listCategoryFilterOptions(ctx.tenantId).catch(() => []),
    ]);
    const cat = store?.store_categories as { slug: string } | { slug: string }[] | null | undefined;
    const currentSlug = (Array.isArray(cat) ? cat[0]?.slug : cat?.slug) ?? null;
    const currentIndustry = currentSlug && isIndustry(currentSlug) ? currentSlug : null;

    const prompt = storeSetupPrompt({
      storeName: ctx.tenantName,
      prompt: v.prompt,
      products: v.products,
      industries: INDUSTRY_SLUGS,
      currentIndustry,
      existingCategories: categories.map((c) => c.name),
      // Catalogue copy is shopper-facing: written in English whatever the panel language.
      language: "en",
      images,
    });
    const r = await runSellerAiGeneration({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      feature: "store_setup",
      creditKind: "store_setup",
      input: { prompt: v.prompt.slice(0, 500), products: v.products, images: images.length },
      prompt,
      schema: storeSetupContentSchema,
    });
    const plan = storeSetupContentSchema.parse(r.data);
    const industry = currentIndustry ?? (plan.industry && isIndustry(plan.industry) ? plan.industry : null);
    try {
      return await persistStoreSetup(ctx, plan, { industry, images: files });
    } catch (err) {
      await refundAiCredit(r.charge, err instanceof Error ? err.message : "store setup failed");
      throw err;
    }
  });
}
