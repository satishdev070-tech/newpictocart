import "server-only";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env/public";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { toMinor } from "@/lib/money";
import type { Json } from "@/lib/supabase/database.types";
import { rankStoreHosts } from "@/features/integrations/server/store";
import { loadProviders } from "@/features/neural-pulse/server/generate";
import { generateJson } from "@/features/neural-pulse/server/llm";
import { getProductBrief, loadPromptContext } from "@/features/neural-pulse/server/context";
import { BRAND_LANGUAGES, EMPTY_BRAND, type BrandLanguage, type BrandProfile } from "@/features/neural-pulse/schemas";
import type { ProductBrief, PromptContext } from "@/features/neural-pulse/prompts";
import { runSellerAiGeneration } from "@/features/seller-ai/server";
import { istDayKey } from "../planner";
import { SOCIAL_AI_KIND, copyToPost, socialCopyOutput, socialCopyPrompt, type SocialSubject } from "../ai";
import type { PostVariants } from "../compose";

/**
 * Social desk AI. Two paths:
 *  - generateSocialCopy: the seller asked (dashboard session). runSellerAiGeneration debits the
 *    store's credits with the member's session, refunds on failure and logs the generation.
 *  - runAutomationAi: an automatic post (no session: after() or cron). Reads with the secret-key
 *    client for the tenant on the post row, debits through social_ai_credit_debit (which only
 *    works while the store's automation AI is on) and refunds through social_ai_credit_refund.
 */

type Admin = ReturnType<typeof createSupabaseAdminClient>;
const priceMinor = (v: number | string | null): number | null => {
  if (v == null) return null;
  try {
    return toMinor(v);
  } catch {
    return null;
  }
};

/** Seller-triggered generation: product (by id, RLS), store launch, or a free idea. */
export async function generateSocialCopy(ctx: { tenantId: string; userId: string }, input: { subject: "launch" | "product" | "idea"; productId?: string; idea?: string; link: string | null }) {
  let subject: SocialSubject;
  if (input.subject === "product") {
    const product = input.productId ? await getProductBrief(ctx.tenantId, input.productId) : null;
    if (!product) throw new AppError("VALIDATION", { fieldErrors: { productId: ["Choose one of your products"] } });
    subject = { kind: "product", product, link: input.link };
  } else if (input.subject === "idea") {
    if (!input.idea?.trim()) throw new AppError("VALIDATION", { fieldErrors: { idea: ["Write what the post is about"] } });
    subject = { kind: "idea", idea: input.idea, link: input.link };
  } else subject = { kind: "launch", storeUrl: input.link };
  const promptCtx = await loadPromptContext(ctx.tenantId);
  const r = await runSellerAiGeneration({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    feature: SOCIAL_AI_KIND,
    creditKind: SOCIAL_AI_KIND,
    input: { subject: input.subject, productId: input.productId ?? null },
    prompt: socialCopyPrompt(promptCtx, subject),
    schema: socialCopyOutput,
  });
  return { ...copyToPost(r.data), provider: r.provider, model: r.model };
}

// ------------------------------------------------------------------ system (automation) path

/** Best public https origin of a store (secret-key read; tenant from the caller's trusted source). */
export async function storeOriginFor(admin: Admin, tenantId: string): Promise<string | null> {
  const [{ data: domains }, { data: tenant }] = await Promise.all([
    admin.from("domains").select("hostname, is_primary, type").eq("tenant_id", tenantId).eq("status", "verified").limit(20),
    admin.from("tenants").select("slug").eq("id", tenantId).maybeSingle(),
  ]);
  const host = rankStoreHosts(domains ?? [], publicEnv().NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN)[0] ?? (tenant?.slug ? storeSubdomain(tenant.slug) : null);
  if (!host) return null;
  const origin = storeOrigin(host);
  return origin.startsWith("https://") ? origin : null;
}

async function systemPromptContext(admin: Admin, tenantId: string): Promise<PromptContext> {
  const [{ data: store }, { data: brand }, { data: products }] = await Promise.all([
    admin.from("stores").select("name, tagline, description").eq("tenant_id", tenantId).maybeSingle(),
    admin.from("brand_profiles").select("voice, audience, keywords, dos, donts, languages").eq("tenant_id", tenantId).maybeSingle(),
    admin.from("products").select("title, min_price, short_description").eq("tenant_id", tenantId).eq("status", "active").order("sales_count", { ascending: false }).limit(8),
  ]);
  const languages = (brand?.languages ?? []).filter((l): l is BrandLanguage => (BRAND_LANGUAGES as readonly string[]).includes(l));
  const b: BrandProfile = brand ? { voice: brand.voice, audience: brand.audience, keywords: brand.keywords, dos: brand.dos, donts: brand.donts, languages: languages.length ? languages : ["en"] } : EMPTY_BRAND;
  return {
    store: { name: store?.name ?? "Our store", tagline: store?.tagline ?? null, description: store?.description ?? null, storeCategory: null, categories: [] },
    brand: b,
    products: (products ?? []).map((p) => ({ title: p.title, priceMinor: priceMinor(p.min_price), category: null, summary: p.short_description })),
    dates: [],
    today: istDayKey(new Date().toISOString()),
  };
}

async function systemProductBrief(admin: Admin, tenantId: string, productId: string): Promise<ProductBrief | null> {
  const { data } = await admin.from("products").select("title, min_price, short_description, status").eq("tenant_id", tenantId).eq("id", productId).maybeSingle();
  if (!data || data.status === "archived") return null;
  return { title: data.title, priceMinor: priceMinor(data.min_price), category: null, summary: data.short_description };
}

export type AutomationAiOutcome = { state: "done" | "failed" | "skipped"; note: string | null };

/**
 * Writes AI text onto one automatic post that was claimed (ai_state pending → running). Leaves the
 * template caption in place on any failure. Never throws.
 */
export async function runAutomationAi(tenantId: string, postId: string): Promise<AutomationAiOutcome> {
  const admin = createSupabaseAdminClient();
  const finish = async (o: AutomationAiOutcome, patch: { caption?: string; hashtags?: string[]; variants?: PostVariants } = {}) => {
    await admin
      .from("social_posts")
      .update({ ...patch, ...(patch.variants ? { variants: patch.variants as Json } : {}), ai_state: o.state, ai_note: o.note?.slice(0, 300) ?? null })
      .eq("tenant_id", tenantId)
      .eq("id", postId);
    return o;
  };
  const { data: post } = await admin.from("social_posts").select("id, source, product_id, link_url, status").eq("tenant_id", tenantId).eq("id", postId).maybeSingle();
  if (!post) return { state: "skipped", note: "Post not found" };
  if (!["draft", "scheduled"].includes(post.status)) return finish({ state: "skipped", note: "The post was already published or cancelled." });

  const providers = await loadProviders(SOCIAL_AI_KIND);
  if (!providers.length) return finish({ state: "skipped", note: "AI isn't set up on the platform yet, so the template text was kept." });

  let subject: SocialSubject;
  if (post.source === "auto_product" && post.product_id) {
    const product = await systemProductBrief(admin, tenantId, post.product_id);
    if (!product) return finish({ state: "skipped", note: "The product is no longer available." });
    subject = { kind: "product", product, link: post.link_url };
  } else subject = { kind: "launch", storeUrl: post.link_url };

  const { data: debit, error: debitErr } = await admin.rpc("social_ai_credit_debit", { p_tenant: tenantId, p_post: postId });
  if (debitErr) {
    const note = debitErr.hint === "AI_CREDITS_EXHAUSTED" ? "No AI credits left, so the template text was kept." : "AI writing is switched off or unavailable, so the template text was kept.";
    if (debitErr.hint !== "AI_CREDITS_EXHAUSTED") logger.warn("social.automation_debit_failed", { tenantId, postId, code: debitErr.code });
    return finish({ state: "skipped", note });
  }
  const ledgerId = debit?.[0]?.ledger_id ?? null;
  try {
    const result = await generateJson(providers, socialCopyPrompt(await systemPromptContext(admin, tenantId), subject), socialCopyOutput);
    const mapped = copyToPost(result.data);
    const { error } = await admin.from("ai_generations").insert({
      tenant_id: tenantId,
      kind: SOCIAL_AI_KIND,
      input: { subject: subject.kind, postId, automation: true } as Json,
      output: result.data as Json,
      provider: result.provider.slice(0, 40),
      model: result.model.slice(0, 100) || null,
      tokens: result.tokens == null ? null : Math.round(result.tokens),
      created_by: null,
    });
    if (error) logger.warn("social.automation_log_failed", { tenantId, code: error.code });
    return finish({ state: "done", note: null }, mapped);
  } catch (err) {
    logger.warn("social.automation_ai_failed", { tenantId, postId, error: err });
    if (ledgerId) {
      const { error } = await admin.rpc("social_ai_credit_refund", { p_ledger: ledgerId, p_note: "Automatic social post: AI failed" });
      if (error) logger.error("social.automation_refund_failed", { tenantId, ledgerId, code: error.code });
    }
    return finish({ state: "failed", note: "AI couldn't write this post (credits refunded), so the template text was kept." });
  }
}
