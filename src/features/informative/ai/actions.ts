"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { revalidateStorefront } from "@/lib/cache/storefront";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireInformativeTenant, type InformativeContext } from "../server/context";
import { applyProposal, askAssistant, buildSiteWithAi } from "./server";
import { applyProposalInputSchema, assistantChatInputSchema, type AssistantReply } from "./schemas";

/**
 * Informative Website AI actions (M9): validate → tenant from the member's own membership
 * (requireInformativeTenant) → permission → execute (ai/server.ts; writes via the panel repo) →
 * audit → revalidate. Asking costs credits; nothing is written until the owner applies.
 */

function needContentWrite(ctx: InformativeContext) {
  if (!ctx.permissions.has("content.write")) throw new AppError("FORBIDDEN", { context: { permission: "content.write" } });
}

function refresh(ctx: InformativeContext) {
  revalidateStorefront(ctx.tenantId);
  revalidatePath("/informative", "layout");
}

export async function askInformativeAssistantAction(input: unknown): Promise<ActionResult<AssistantReply>> {
  return runAction("informative.ai.ask", async () => {
    const parsed = parseInput(assistantChatInputSchema, input);
    const ctx = await requireInformativeTenant();
    needContentWrite(ctx);
    return askAssistant(ctx, parsed);
  });
}

export async function applyInformativeProposalAction(input: unknown): Promise<ActionResult<{ changed: string }>> {
  return runAction("informative.ai.apply", async () => {
    const { proposal } = parseInput(applyProposalInputSchema, input);
    const ctx = await requireInformativeTenant();
    needContentWrite(ctx);
    const r = await applyProposal(ctx, proposal);
    await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "informative.ai_applied", entityType: "info_site", entityId: ctx.tenantId, metadata: { kind: proposal.kind, changed: r.changed } });
    refresh(ctx);
    return r;
  });
}

const buildInputSchema = z.object({ onboarding: z.boolean().default(false), notes: z.string().trim().max(1000).optional() });

/** Free right after onboarding (the site is under an hour old); otherwise it costs credits. */
const FREE_WINDOW_MS = 60 * 60 * 1000;

async function siteIsNew(tenantId: string): Promise<boolean> {
  const { data } = await (await createSupabaseServerClient()).from("tenants").select("created_at").eq("id", tenantId).maybeSingle();
  return !!data && Date.now() - new Date(data.created_at).getTime() < FREE_WINDOW_MS;
}

export async function buildInformativeSiteWithAiAction(input: unknown): Promise<ActionResult<{ built: boolean; reason?: string }>> {
  return runAction("informative.ai.build", async () => {
    const parsed = parseInput(buildInputSchema, input ?? {});
    const ctx = await requireInformativeTenant();
    needContentWrite(ctx);
    if (!ctx.permissions.has("settings.write")) throw new AppError("FORBIDDEN", { context: { permission: "settings.write" } });
    const free = parsed.onboarding && (await siteIsNew(ctx.tenantId));
    const r = await buildSiteWithAi(ctx, { free, notes: parsed.notes ?? null });
    if (r.built) {
      await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "informative.ai_site_built", entityType: "info_site", entityId: ctx.tenantId, metadata: { free } });
      refresh(ctx);
    }
    return r;
  });
}
