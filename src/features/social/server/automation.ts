import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { logger } from "@/lib/observability/logger";
import { audit } from "@/lib/audit";
import { toMinor } from "@/lib/money";
import { getEntitlements } from "@/features/platform";
import { buildUtmLink } from "../planner";
import { isAutoPlatform, parseVariants, type PostVariants, type SocialPlatform } from "../compose";
import { launchTemplate, parseAutomation, planAutoPost, productTemplate, type AutomationRow, type AutomationSettings } from "../automation";
import { runAutomationAi, storeOriginFor } from "./ai-copy";

/**
 * Social desk automation (docs/social/SOCIAL_PLAN.md, phase 5).
 *
 * Triggers run inside after() of the seller's own action (store publish, product publish), so they
 * never slow down or break it. The tenant id always comes from the acting member's membership
 * (passed in by the action) or, in the cron, from the post row. Writes use the secret-key client
 * (ADR-006 addition: automation) because the acting member may publish products without
 * marketing.write; they happen only when the store's social_automation row (written only by
 * marketing.write members through RLS) allows it and the plan includes social_media.
 */

type Admin = ReturnType<typeof createSupabaseAdminClient>;
const SELECT = "launch_enabled, product_enabled, mode, platforms, use_ai, delay_minutes, product_enabled_at";

/** Dashboard read (RLS, member session). Defaults when never saved or the migration is pending. */
export async function getAutomation(tenantId: string): Promise<AutomationSettings> {
  const { data, error } = await (await createSupabaseServerClient()).from("social_automation").select(SELECT).eq("tenant_id", tenantId).maybeSingle<AutomationRow>();
  if (error) {
    logger.warn("social.automation_read_failed", { tenantId, code: error.code });
    return parseAutomation(null);
  }
  return parseAutomation(data);
}

async function loadSettings(admin: Admin, tenantId: string): Promise<AutomationSettings | null> {
  const { data, error } = await admin.from("social_automation").select(SELECT).eq("tenant_id", tenantId).maybeSingle<AutomationRow>();
  if (error) {
    logger.warn("social.automation_unavailable", { tenantId, code: error.code });
    return null;
  }
  return parseAutomation(data);
}

async function connectedAuto(admin: Admin, tenantId: string): Promise<SocialPlatform[]> {
  const { data } = await admin.from("tenant_integrations").select("provider").eq("tenant_id", tenantId).eq("kind", "social").eq("status", "connected").eq("enabled", true);
  return (data ?? []).map((r) => r.provider).filter(isAutoPlatform);
}

async function socialAllowed(tenantId: string): Promise<boolean> {
  try {
    return (await getEntitlements(tenantId)).isEnabled("social_media");
  } catch {
    return false;
  }
}

async function brandKeywords(admin: Admin, tenantId: string): Promise<string[]> {
  const { data } = await admin.from("brand_profiles").select("keywords").eq("tenant_id", tenantId).maybeSingle();
  return (data?.keywords ?? []).slice(0, 5);
}

type Created = { id: string; aiPending: boolean };

/**
 * Store went live (or the seller pressed "Announce my store"). `force` skips the launch toggle
 * (the explicit button). At most one launch post per store (unique index).
 */
export async function queueLaunchPost(tenantId: string, actorUserId: string, opts: { force?: boolean } = {}): Promise<Created | null> {
  const admin = createSupabaseAdminClient();
  if (!(await socialAllowed(tenantId))) return null;
  const settings = await loadSettings(admin, tenantId);
  if (!settings) return null;
  const s = opts.force ? { ...settings, launchEnabled: true } : settings;
  const plan = planAutoPost(s, { kind: "launch" }, await connectedAuto(admin, tenantId), new Date());
  if (!plan.create) return null;
  const [{ data: store }, origin, keywords] = await Promise.all([admin.from("stores").select("name, tagline, logo_path").eq("tenant_id", tenantId).maybeSingle(), storeOriginFor(admin, tenantId), brandKeywords(admin, tenantId)]);
  const link = origin ? `${origin}/?utm_source=social&utm_medium=organic&utm_campaign=launch` : null;
  const t = launchTemplate({ storeName: store?.name ?? "Our store", tagline: store?.tagline ?? null, link, keywords });
  const image = store?.logo_path && store.logo_path.startsWith(`tenant/${tenantId}/`) ? [store.logo_path] : [];
  return insertAutoPost(admin, tenantId, actorUserId, "auto_launch", null, plan, { ...t, link, media: image, pillar: "announcement" });
}

/** Products just published (status active). One automatic post per product, ever. */
export async function queueProductPosts(tenantId: string, actorUserId: string, productIds: string[]): Promise<Created[]> {
  if (!productIds.length) return [];
  const admin = createSupabaseAdminClient();
  if (!(await socialAllowed(tenantId))) return [];
  const settings = await loadSettings(admin, tenantId);
  if (!settings?.productEnabled) return [];
  const { data: products } = await admin
    .from("products")
    .select("id, title, slug, short_description, min_price, status, published_at")
    .eq("tenant_id", tenantId)
    .in("id", productIds.slice(0, 50))
    .eq("status", "active");
  if (!products?.length) return [];
  const [connected, origin, keywords, { data: store }] = await Promise.all([connectedAuto(admin, tenantId), storeOriginFor(admin, tenantId), brandKeywords(admin, tenantId), admin.from("stores").select("name").eq("tenant_id", tenantId).maybeSingle()]);
  const out: Created[] = [];
  for (const p of products.slice(0, 10)) {
    const plan = planAutoPost(settings, { kind: "product", publishedAt: p.published_at }, connected, new Date());
    if (!plan.create) continue;
    const { data: media } = await admin.from("product_media").select("storage_path").eq("tenant_id", tenantId).eq("product_id", p.id).eq("media_type", "image").order("position").limit(1);
    const image = media?.[0]?.storage_path;
    const link = origin ? buildUtmLink(origin, p.slug, "new_product") : null;
    let price: number | null = null;
    try {
      price = p.min_price == null ? null : toMinor(p.min_price);
    } catch {
      price = null;
    }
    const t = productTemplate({ title: p.title, priceMinor: price, summary: p.short_description, link, storeName: store?.name ?? "our store", keywords });
    const created = await insertAutoPost(admin, tenantId, actorUserId, "auto_product", p.id, plan, { ...t, link, media: image && image.startsWith(`tenant/${tenantId}/`) ? [image] : [], pillar: "product" });
    if (created) out.push(created);
  }
  return out;
}

async function insertAutoPost(
  admin: Admin,
  tenantId: string,
  actorUserId: string,
  source: "auto_launch" | "auto_product",
  productId: string | null,
  plan: Extract<ReturnType<typeof planAutoPost>, { create: true }>,
  c: { title: string; caption: string; hashtags: string[]; link: string | null; media: string[]; pillar: string },
): Promise<Created | null> {
  // Publishing needs an image on every auto network except LinkedIn; without one it stays a draft.
  const needsImage = plan.platforms.some((p) => isAutoPlatform(p) && p !== "linkedin");
  const status = plan.status === "scheduled" && needsImage && !c.media.length ? "draft" : plan.status;
  const note = status !== plan.status ? "Saved as a draft: add an image before it can be published." : plan.note;
  const { data, error } = await admin
    .from("social_posts")
    .insert({
      tenant_id: tenantId,
      created_by: actorUserId,
      source,
      product_id: productId,
      title: c.title,
      caption: c.caption,
      hashtags: c.hashtags,
      link_url: c.link && c.link.length <= 500 && c.link.startsWith("https://") ? c.link : null,
      media_paths: c.media,
      pillar: c.pillar,
      platforms: plan.platforms,
      status,
      scheduled_at: status === "scheduled" ? plan.scheduledAt : null,
      ai_state: plan.aiState,
      ai_note: note,
    })
    .select("id")
    .single();
  if (error) {
    // 23505 = this product / store already has its automatic post.
    if (error.code !== "23505") logger.warn("social.automation_insert_failed", { tenantId, source, code: error.code });
    return null;
  }
  await audit({ tenantId, actorUserId, action: "social.auto_post_created", entityType: "social_post", entityId: data.id, metadata: { source, status, product_id: productId, platforms: plan.platforms } });
  return { id: data.id, aiPending: plan.aiState === "pending" };
}

/**
 * Runs the AI step for pending automatic posts: one post (after the trigger), or the oldest few
 * of any store (cron). Each post is claimed (pending → running) so two workers never write it.
 */
export async function processPendingAi(opts: { tenantId?: string; postIds?: string[]; limit?: number } = {}): Promise<number> {
  const admin = createSupabaseAdminClient();
  let q = admin.from("social_posts").select("id, tenant_id").eq("ai_state", "pending").order("created_at").limit(opts.limit ?? 5);
  if (opts.tenantId) q = q.eq("tenant_id", opts.tenantId);
  if (opts.postIds?.length) q = q.in("id", opts.postIds);
  const { data, error } = await q;
  if (error) {
    if (error.code !== "42703") logger.warn("social.ai_pending_read_failed", { code: error.code });
    return 0;
  }
  let done = 0;
  for (const row of data ?? []) {
    const { data: claimed } = await admin.from("social_posts").update({ ai_state: "running" }).eq("tenant_id", row.tenant_id).eq("id", row.id).eq("ai_state", "pending").select("id");
    if (!claimed?.length) continue;
    await runAutomationAi(row.tenant_id, row.id);
    done++;
  }
  // A crashed run leaves "running": give it back to the queue after 15 minutes.
  await admin.from("social_posts").update({ ai_state: "pending" }).eq("ai_state", "running").lt("updated_at", new Date(Date.now() - 15 * 60_000).toISOString());
  return done;
}

/** For after(): queue the post(s), then write them with AI right away. Never throws. */
export async function afterStoreLaunched(tenantId: string, actorUserId: string): Promise<void> {
  try {
    const c = await queueLaunchPost(tenantId, actorUserId);
    if (c?.aiPending) await processPendingAi({ tenantId, postIds: [c.id] });
  } catch (err) {
    logger.error("social.automation_launch_failed", { tenantId, error: err });
  }
}

export async function afterProductsPublished(tenantId: string, actorUserId: string, productIds: string[]): Promise<void> {
  try {
    const created = await queueProductPosts(tenantId, actorUserId, productIds);
    const ai = created.filter((c) => c.aiPending).map((c) => c.id);
    if (ai.length) await processPendingAi({ tenantId, postIds: ai, limit: ai.length });
  } catch (err) {
    logger.error("social.automation_product_failed", { tenantId, error: err });
  }
}

/** Saves settings (RLS, marketing.write enforced by the caller and the policy). */
export async function saveAutomation(tenantId: string, userId: string, row: Omit<AutomationRow, "product_enabled_at"> & { product_enabled_at: string | null }): Promise<void> {
  const { error } = await (await createSupabaseServerClient()).from("social_automation").upsert({ tenant_id: tenantId, ...row, updated_by: userId }, { onConflict: "tenant_id" });
  if (error) throw mapDbError(error, { tenantId });
}

export type PostDeskFields = { source: string; variants: PostVariants; aiState: string | null; aiNote: string | null };

/** Desk columns of one post (RLS). Soft-fails to defaults while the migration is pending. */
export async function getPostDeskFields(tenantId: string, postId: string): Promise<PostDeskFields> {
  const { data, error } = await (await createSupabaseServerClient()).from("social_posts").select("source, variants, ai_state, ai_note").eq("tenant_id", tenantId).eq("id", postId).maybeSingle();
  if (error || !data) return { source: "manual", variants: {}, aiState: null, aiNote: null };
  return { source: data.source, variants: parseVariants(data.variants), aiState: data.ai_state, aiNote: data.ai_note };
}
