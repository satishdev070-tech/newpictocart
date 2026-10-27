"use server";

import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { assertPermission, requireTenant } from "@/lib/tenant/membership";
import { audit } from "@/lib/audit";
import { contactReplyInput, generateBlogInput, type ContactReplyDraft, type GenerateBlogDraft } from "./schemas";
import { draftContactReply, generateBlogDraft } from "./server";

async function contentWriter() {
  const ctx = await requireTenant();
  assertPermission(ctx, "content.write");
  return ctx;
}

/** Blog editor → AI Write. Tenant from membership; credits debited inside generateBlogDraft. */
export async function generateBlogAction(input: { topic: string; tone?: string; language?: string }): Promise<ActionResult<GenerateBlogDraft>> {
  return runAction("sellerAi.generateBlog", async () => {
    const ctx = await contentWriter();
    const v = parseInput(generateBlogInput, input);
    const r = await generateBlogDraft({ tenantId: ctx.tenantId, userId: ctx.user.id, topic: v.topic, tone: v.tone, language: v.language });
    await audit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.user.id,
      action: "seller_ai.blog_generated",
      entityType: "ai_generation",
      entityId: r.id ?? ctx.tenantId,
      metadata: { provider: r.provider, model: r.model },
    });
    return r.data;
  });
}

/** Content → Messages → Draft reply (not sent). */
export async function draftContactReplyAction(input: { messageId: string }): Promise<ActionResult<ContactReplyDraft>> {
  return runAction("sellerAi.draftContactReply", async () => {
    const ctx = await contentWriter();
    const v = parseInput(contactReplyInput, input);
    const r = await draftContactReply({ tenantId: ctx.tenantId, userId: ctx.user.id, messageId: v.messageId });
    await audit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.user.id,
      action: "seller_ai.contact_reply_drafted",
      entityType: "contact_message",
      entityId: v.messageId,
      metadata: { provider: r.provider, model: r.model },
    });
    return r.data;
  });
}
