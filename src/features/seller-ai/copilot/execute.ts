import "server-only";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/observability/logger";
import { toDecimalString } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import type { Json } from "@/lib/supabase/database.types";
import { assertPermission, type TenantContext } from "@/lib/tenant/membership";
import { revalidateStorefront } from "@/lib/cache/storefront";
import { debitAiCredit, refundAiCredit, type AiCreditCharge } from "@/features/ai-credits/server";
import { cleanSearch, dbMoneyToMinor, likeEscape } from "@/features/catalog/format";
import { slugify } from "@/features/catalog/variants";
import { bulkUpdateProducts } from "@/features/catalog/server/products";
import { adjustStock, setStock } from "@/features/inventory/server/inventory";
import { blogWritePrompt } from "../prompts";
import { generateBlogContentSchema, toContentBlocks } from "../schemas";
import { runSellerAiGeneration } from "../server";
import { matchProductByTitle } from "./proposals";
import { variantLabel, type ActionApplyPayload, type ActionFacts, type ProductFact, type VariantFact } from "./actions-plan";

/**
 * Tara's store actions on the server. Facts: products are found by title inside the member's own
 * store (RLS + tenant filter), never by an id from the model. Execution: every step re-checks the
 * permission it needs, re-reads the row from this store, debits its credits first and refunds them
 * if the write fails, then audits.
 */

/** Credit kind for one executed data step (stock / price / status). Unknown to the DB = 1 credit. */
export const TARA_ACTION_KIND = "tara_action";

type Ctx = Pick<TenantContext, "tenantId" | "tenantName" | "permissions" | "user">;

/** Products and their variants for the titles the model used (one round trip each). */
export async function loadActionFacts(tenantId: string, titles: string[]): Promise<ActionFacts> {
  const products = new Map<string, ProductFact | null>();
  const variants = new Map<string, VariantFact[]>();
  if (!titles.length) return { product: () => null, variants: () => [] };
  const supabase = await createSupabaseServerClient();
  await Promise.all(
    titles.slice(0, 8).map(async (t) => {
      const search = cleanSearch(t);
      if (!search) return products.set(t, null);
      const find = async (q: string) => {
        const { data, error } = await supabase.from("products").select("id, title, status").eq("tenant_id", tenantId).ilike("title", `%${likeEscape(q)}%`).limit(12);
        if (error) logger.warn("seller_ai.copilot_action_lookup_failed", { code: error.code });
        return data ?? [];
      };
      // Whole title first; then its longest word ("blue kurti size M" still finds "Blue Kurti").
      let rows = await find(search);
      if (!rows.length) {
        const word = search.split(/\s+/).sort((a, b) => b.length - a.length)[0];
        if (word && word.length >= 3 && word !== search) rows = await find(word);
      }
      // Exact title first, else a single unambiguous partial match (same rule as copy proposals).
      const hit = matchProductByTitle(t, rows);
      products.set(t, hit ? (rows.find((p) => p.id === hit.id) ?? null) : null);
    }),
  );
  const ids = [...new Set([...products.values()].flatMap((p) => (p ? [p.id] : [])))];
  if (ids.length) {
    const [overview, prices] = await Promise.all([
      supabase.rpc("inventory_overview", { p_tenant: tenantId }).select("*").in("product_id", ids).eq("variant_status", "active"),
      supabase.from("product_variants").select("id, product_id, price, compare_at_price, position").eq("tenant_id", tenantId).in("product_id", ids).eq("status", "active").order("position"),
    ]);
    if (overview.error) throw mapDbError(overview.error);
    if (prices.error) throw mapDbError(prices.error);
    const stock = new Map(
      ((overview.data ?? []) as { variant_id: string; variant_title: string; sku: string | null; available: number; track_inventory: boolean }[]).map((r) => [r.variant_id, r]),
    );
    for (const v of prices.data ?? []) {
      const s = stock.get(v.id);
      const list = variants.get(v.product_id) ?? [];
      list.push({
        id: v.id,
        productId: v.product_id,
        title: s?.variant_title ?? "",
        sku: s?.sku ?? null,
        available: s?.available ?? 0,
        tracked: s?.track_inventory ?? false,
        pricePaise: dbMoneyToMinor(v.price) ?? 0,
        compareAtPaise: dbMoneyToMinor(v.compare_at_price),
      });
      variants.set(v.product_id, list);
    }
  }
  return { product: (t) => products.get(t) ?? null, variants: (id) => variants.get(id) ?? [] };
}

async function productInStore(tenantId: string, productId: string): Promise<ProductFact> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("products").select("id, title, status").eq("tenant_id", tenantId).eq("id", productId).maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new AppError("NOT_FOUND", { fieldErrors: { _form: ["That product isn't in your store any more."] } });
  return data;
}

/** Debit → run → refund on failure. */
async function charged<T>(tenantId: string, kind: string, run: () => Promise<T>): Promise<T> {
  const charge: AiCreditCharge = await debitAiCredit(tenantId, kind);
  try {
    return await run();
  } catch (err) {
    await refundAiCredit(charge, err instanceof Error ? err.message : "Tara action failed");
    throw err;
  }
}

export type ActionResultMessage = { message: string; href?: string };

export async function applyStoreAction(ctx: Ctx, p: ActionApplyPayload): Promise<ActionResultMessage> {
  switch (p.type) {
    case "stock":
      return applyStock(ctx, p);
    case "price":
      return applyPrice(ctx, p);
    case "product_status":
      return applyStatus(ctx, p);
    case "blog_post":
      return applyBlog(ctx, p);
  }
}

async function applyStock(ctx: Ctx, p: Extract<ActionApplyPayload, { type: "stock" }>): Promise<ActionResultMessage> {
  assertPermission(ctx, "inventory.write");
  if (p.enableTracking) assertPermission(ctx, "catalog.write");
  const product = await productInStore(ctx.tenantId, p.productId);
  const supabase = await createSupabaseServerClient();
  const { data: variant, error } = await supabase.from("product_variants").select("id, product_id, title, track_inventory").eq("tenant_id", ctx.tenantId).eq("id", p.variantId).eq("product_id", p.productId).maybeSingle();
  if (error) throw mapDbError(error);
  if (!variant) throw new AppError("NOT_FOUND", { fieldErrors: { _form: ["That option isn't on this product any more."] } });
  const available = await charged(ctx.tenantId, TARA_ACTION_KIND, async () => {
    if (p.enableTracking && !variant.track_inventory) {
      const { error: trackError } = await supabase.from("product_variants").update({ track_inventory: true }).eq("tenant_id", ctx.tenantId).eq("id", variant.id);
      if (trackError) throw mapDbError(trackError);
    }
    const note = "Updated by Tara (AI assistant)";
    if (p.mode === "set") return (await setStock(ctx.tenantId, { variantId: variant.id, available: p.quantity, note })).available;
    if (p.quantity === 0) throw new AppError("VALIDATION", { fieldErrors: { _form: ["Enter a quantity above 0."] } });
    const delta = p.mode === "add" ? p.quantity : -p.quantity;
    return (await adjustStock(ctx.tenantId, { variantId: variant.id, delta, reason: p.mode === "add" ? "received" : "correction", note })).available;
  });
  await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "inventory.tara_updated", entityType: "product_variant", entityId: variant.id, metadata: { mode: p.mode, quantity: p.quantity, available } });
  revalidateStorefront(ctx.tenantId);
  const label = variantLabel(product, { id: variant.id, productId: product.id, title: variant.title, sku: null, available: 0, tracked: true, pricePaise: 0, compareAtPaise: null });
  return { message: `${label}: stock is now ${available}.`, href: "/dashboard/inventory" };
}

async function applyPrice(ctx: Ctx, p: Extract<ActionApplyPayload, { type: "price" }>): Promise<ActionResultMessage> {
  assertPermission(ctx, "catalog.write");
  const product = await productInStore(ctx.tenantId, p.productId);
  const supabase = await createSupabaseServerClient();
  const { data: rows, error } = await supabase.from("product_variants").select("id, compare_at_price").eq("tenant_id", ctx.tenantId).eq("product_id", p.productId).in("id", p.variantIds);
  if (error) throw mapDbError(error);
  if ((rows ?? []).length !== p.variantIds.length) throw new AppError("NOT_FOUND", { fieldErrors: { _form: ["Some options of this product changed. Ask Tara again."] } });
  await charged(ctx.tenantId, TARA_ACTION_KIND, async () => {
    for (const r of rows ?? []) {
      const currentMrp = dbMoneyToMinor(r.compare_at_price);
      // Keep the MRP unless told otherwise; an MRP below the new price is removed (DB rule).
      const mrp = p.compareAtPaise !== undefined ? p.compareAtPaise : currentMrp != null && currentMrp < p.pricePaise ? null : currentMrp;
      const { error: updateError } = await supabase
        .from("product_variants")
        .update({ price: Number(toDecimalString(p.pricePaise)), compare_at_price: mrp == null ? null : Number(toDecimalString(mrp)) })
        .eq("tenant_id", ctx.tenantId)
        .eq("id", r.id);
      if (updateError) throw mapDbError(updateError);
    }
  });
  await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "product.tara_price_updated", entityType: "product", entityId: p.productId, metadata: { variants: p.variantIds.length, pricePaise: p.pricePaise } });
  revalidateStorefront(ctx.tenantId);
  return { message: `${product.title}: price updated.`, href: `/dashboard/products/${p.productId}` };
}

async function applyStatus(ctx: Ctx, p: Extract<ActionApplyPayload, { type: "product_status" }>): Promise<ActionResultMessage> {
  assertPermission(ctx, "catalog.write");
  if (p.op === "publish") assertPermission(ctx, "catalog.publish");
  const product = await productInStore(ctx.tenantId, p.productId);
  await charged(ctx.tenantId, TARA_ACTION_KIND, async () => {
    const r = await bulkUpdateProducts(ctx.tenantId, p.op, [p.productId]);
    if (!r.changed.length) {
      throw new AppError("CONFLICT", { fieldErrors: { _form: [p.op === "publish" ? `"${product.title}" needs a price before it can go live.` : `"${product.title}" couldn't be changed.`] } });
    }
  });
  await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: `product.tara_${p.op}`, entityType: "product", entityId: p.productId });
  revalidateStorefront(ctx.tenantId);
  const done = p.op === "publish" ? "is live on your store" : p.op === "unpublish" ? "is hidden (draft)" : "is archived";
  return { message: `"${product.title}" ${done}.`, href: `/dashboard/products/${p.productId}` };
}

async function uniqueBlogSlug(tenantId: string, base: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const root = slugify(base, 80) || "post";
  const { data } = await supabase.from("blog_posts").select("slug").eq("tenant_id", tenantId).like("slug", `${root}%`).limit(50);
  const taken = new Set((data ?? []).map((r) => r.slug));
  if (!taken.has(root)) return root;
  for (let i = 2; i < 60; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
  return `${root}-${Date.now().toString(36)}`;
}

async function applyBlog(ctx: Ctx, p: Extract<ActionApplyPayload, { type: "blog_post" }>): Promise<ActionResultMessage> {
  assertPermission(ctx, "content.write");
  // Debits generate_blog itself (and refunds when the AI fails).
  const r = await runSellerAiGeneration({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    feature: "generate_blog",
    creditKind: "generate_blog",
    input: { topic: p.topic, via: "tara" },
    prompt: blogWritePrompt({ storeName: ctx.tenantName, topic: p.title ? `${p.topic} (title: ${p.title})` : p.topic }),
    schema: generateBlogContentSchema,
  });
  try {
    const title = (p.title || r.data.title).slice(0, 200);
    const supabase = await createSupabaseServerClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        tenant_id: ctx.tenantId,
        title,
        slug: await uniqueBlogSlug(ctx.tenantId, title),
        status: p.publish ? "published" : "draft",
        body: toContentBlocks(r.data.blocks) as unknown as Json,
        seo: { title: r.data.seoTitle || null, description: r.data.seoDescription || null },
        excerpt: r.data.excerpt || null,
        tags: r.data.tags.map((t) => t.toLowerCase()).slice(0, 20),
        published_at: p.publish ? now : null,
        created_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error) throw mapDbError(error);
    await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "content.post_saved", entityType: "blog_posts", entityId: data.id, metadata: { status: p.publish ? "published" : "draft", via: "tara" } });
    if (p.publish) revalidateStorefront(ctx.tenantId);
    return { message: p.publish ? `Published "${title}".` : `Blog draft "${title}" is ready to review.`, href: `/dashboard/content/blog/${data.id}` };
  } catch (err) {
    await refundAiCredit(r.charge, err instanceof Error ? err.message : "blog save failed");
    throw err;
  }
}
