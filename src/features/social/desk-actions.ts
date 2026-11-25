"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import type { Json } from "@/lib/supabase/database.types";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { storePrimaryHost } from "@/features/integrations/server/store";
import { marketingCtx } from "./server/context";
import { connectLinkedInManual, connectMetaManual } from "./server/manual-connect";
import { generateSocialCopy } from "./server/ai-copy";
import { getAutomation, processPendingAi, queueLaunchPost, saveAutomation } from "./server/automation";
import { ALL_CHANNELS, type PostVariants } from "./compose";
import { buildUtmLink } from "./planner";
import { nextProductEnabledAt } from "./automation";
import { META_ID_RE } from "./payloads";

/**
 * Social marketing desk actions (docs/social/SOCIAL_PLAN.md). Every action: runAction +
 * parseInput, tenant from membership via marketingCtx() (marketing.write + social_media plan).
 */

const opt = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());
const checkbox = z.preprocess((v) => v === "on" || v === "1" || v === "true" || v === true, z.boolean());

// ------------------------------------------------------------------ manual connect

const metaManualSchema = z.object({
  token: z.string().trim().min(20, "Paste the access token").max(1000).regex(/^[A-Za-z0-9_\-|.]+$/, "That doesn't look like a Meta access token"),
  pageId: opt(25).refine((v) => !v || META_ID_RE.test(v), "Use the numeric Page ID"),
  appId: opt(25).refine((v) => !v || META_ID_RE.test(v), "Use the numeric App ID"),
  appSecret: opt(64).refine((v) => !v || /^[a-f0-9]{32}$/i.test(v), "The App secret is 32 letters and digits"),
  instagram: checkbox,
});

export async function connectMetaManualAction(_prev: ActionResult<string> | null, fd: FormData): Promise<ActionResult<string>> {
  const result = await runAction("social.connectMetaManual", async () => {
    const ctx = await marketingCtx();
    await rateLimit("social-manual-connect", ctx.tenantId, 20, 3600);
    const v = parseInput(metaManualSchema, formToObject(fd));
    return connectMetaManual(ctx, { token: v.token, pageId: v.pageId, appId: v.appId, appSecret: v.appSecret, instagram: v.instagram });
  });
  if (result.ok) refresh();
  return result;
}

const linkedinManualSchema = z.object({
  token: z.string().trim().min(20, "Paste the access token").max(2000).regex(/^[A-Za-z0-9_\-.~+/=]+$/, "That doesn't look like a LinkedIn access token"),
  organizationId: opt(20).refine((v) => !v || /^[0-9]{1,20}$/.test(v), "Use the numeric company page ID"),
});

export async function connectLinkedInManualAction(_prev: ActionResult<string> | null, fd: FormData): Promise<ActionResult<string>> {
  const result = await runAction("social.connectLinkedInManual", async () => {
    const ctx = await marketingCtx();
    await rateLimit("social-manual-connect", ctx.tenantId, 20, 3600);
    const v = parseInput(linkedinManualSchema, formToObject(fd));
    return connectLinkedInManual(ctx, { token: v.token, organizationId: v.organizationId });
  });
  if (result.ok) refresh();
  return result;
}

// ------------------------------------------------------------------ automation

const automationSchema = z.object({
  launchEnabled: checkbox,
  productEnabled: checkbox,
  mode: z.enum(["review", "auto"]),
  useAi: checkbox,
  delayMinutes: z.coerce.number().int().min(5, "At least 5 minutes").max(1440, "At most 24 hours"),
  platforms: z.array(z.enum(ALL_CHANNELS)).max(9),
});

export async function saveAutomationAction(_prev: ActionResult<string> | null, fd: FormData): Promise<ActionResult<string>> {
  const result = await runAction("social.saveAutomation", async () => {
    const ctx = await marketingCtx();
    const v = parseInput(automationSchema, { ...formToObject(fd), platforms: [...new Set(fd.getAll("platforms"))] });
    if (v.mode === "auto" && !v.platforms.length) throw new AppError("VALIDATION", { fieldErrors: { platforms: ["Pick the networks to post to automatically"] } });
    const before = await getAutomation(ctx.tenantId);
    const productEnabledAt = nextProductEnabledAt(before, v.productEnabled, new Date());
    await saveAutomation(ctx.tenantId, ctx.user.id, { launch_enabled: v.launchEnabled, product_enabled: v.productEnabled, mode: v.mode, platforms: v.platforms, use_ai: v.useAi, delay_minutes: v.delayMinutes, product_enabled_at: productEnabledAt });
    await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "social.automation_updated", entityType: "social_automation", entityId: ctx.tenantId, metadata: { launch: v.launchEnabled, product: v.productEnabled, mode: v.mode, ai: v.useAi, platforms: v.platforms, delay: v.delayMinutes } });
    return "Automation saved.";
  });
  if (result.ok) refresh();
  return result;
}

/** "Announce my store": creates the launch post now (once per store), using the automation settings. */
export async function announceLaunchAction(_prev: ActionResult<string> | null, _fd: FormData): Promise<ActionResult<string>> {
  void _fd;
  const result = await runAction("social.announceLaunch", async () => {
    const ctx = await marketingCtx();
    const created = await queueLaunchPost(ctx.tenantId, ctx.user.id, { force: true });
    if (!created) throw new AppError("CONFLICT", { message: "Your store already has a launch post. Find it under Posts (source: store launch)." });
    if (created.aiPending) await processPendingAi({ tenantId: ctx.tenantId, postIds: [created.id] });
    return created.id;
  });
  if (result.ok) refresh();
  return result;
}

// ------------------------------------------------------------------ AI copy

const copySchema = z.object({
  subject: z.enum(["launch", "product", "idea"]),
  productId: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  idea: opt(800),
});

type CopyResult = { caption: string; hashtags: string[]; variants: PostVariants; link: string | null; provider: string; model: string };

async function linkFor(ctx: { tenantId: string; tenantSlug: string }, productId?: string): Promise<string | null> {
  const origin = storeOrigin((await storePrimaryHost(ctx.tenantId)) ?? storeSubdomain(ctx.tenantSlug));
  if (!origin.startsWith("https://")) return null;
  if (!productId) return `${origin}/?utm_source=social&utm_medium=organic&utm_campaign=launch`;
  const { data } = await (await createSupabaseServerClient()).from("products").select("slug").eq("tenant_id", ctx.tenantId).eq("id", productId).maybeSingle();
  return data ? buildUtmLink(origin, data.slug, "ai_post") : null;
}

/** Composer "Write with AI": returns text for the seller to edit; nothing is saved here. */
export async function generateSocialCopyAction(input: { subject: string; productId?: string; idea?: string }): Promise<ActionResult<CopyResult>> {
  return runAction("social.aiCopy", async () => {
    const ctx = await marketingCtx();
    const v = parseInput(copySchema, input);
    const link = v.subject === "idea" ? null : await linkFor(ctx, v.subject === "product" ? v.productId : undefined);
    const r = await generateSocialCopy({ tenantId: ctx.tenantId, userId: ctx.user.id }, { subject: v.subject, productId: v.productId, idea: v.idea, link });
    return { caption: r.caption, hashtags: r.hashtags, variants: r.variants, link, provider: r.provider, model: r.model };
  });
}

/** Post page "Rewrite with AI": regenerates the text of a not-yet-published post. */
export async function rewritePostWithAiAction(_prev: ActionResult<string> | null, fd: FormData): Promise<ActionResult<string>> {
  const result = await runAction("social.aiRewrite", async () => {
    const ctx = await marketingCtx();
    const { id } = parseInput(z.object({ id: z.uuid() }), formToObject(fd));
    const supabase = await createSupabaseServerClient();
    const { data: post, error } = await supabase.from("social_posts").select("id, status, product_id, source, link_url, caption, title").eq("tenant_id", ctx.tenantId).eq("id", id).maybeSingle();
    if (error) throw mapDbError(error);
    if (!post) throw new AppError("NOT_FOUND");
    if (!["draft", "planned", "scheduled", "failed"].includes(post.status)) throw new AppError("CONFLICT", { message: "Only posts that aren't published yet can be rewritten." });
    const subject = post.product_id ? "product" : post.source === "auto_launch" ? "launch" : "idea";
    const r = await generateSocialCopy(
      { tenantId: ctx.tenantId, userId: ctx.user.id },
      { subject, productId: post.product_id ?? undefined, idea: subject === "idea" ? post.caption || post.title || "A post for our store" : undefined, link: post.link_url },
    );
    const { data: updated, error: upErr } = await supabase
      .from("social_posts")
      .update({ caption: r.caption, hashtags: r.hashtags, variants: r.variants as Json, ai_state: "done", ai_note: null })
      .eq("tenant_id", ctx.tenantId)
      .eq("id", id)
      .in("status", ["draft", "planned", "scheduled", "failed"])
      .select("id");
    if (upErr) throw mapDbError(upErr);
    if (!updated?.length) throw new AppError("CONFLICT", { message: "This post started publishing. Nothing was changed." });
    await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "social.post_ai_rewritten", entityType: "social_post", entityId: id, metadata: { provider: r.provider } });
    return "Rewritten with AI. Check each network's text before it goes out.";
  });
  if (result.ok) refresh();
  return result;
}
