"use server";

import { refresh } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { assertPermission, can, requireTenant } from "@/lib/tenant/membership";
import { getAiCreditBalance } from "@/features/ai-credits/server";
import { applyFaqsProposalAction } from "../actions";
import { runSellerAiGeneration } from "../server";
import { storeCopilotPrompt } from "./prompts";
import { matchProductByTitle, storeProposalViews } from "./proposals";
import { speakInputSchema, storeApplySchema, storeCopilotAskSchema, storeCopilotReplySchema } from "./schemas";
import { applyProductCopy, loadProductCopy, loadStoreCopilotContext, storeCopilotCosts } from "./server";
import { parseVoiceUpload, speakForCopilot, transcribeForCopilot } from "./voice";
import type { CopilotCosts, CopilotReply } from "./types";

/**
 * "Ask Pictocart AI" for the online-store dashboard. Order in every action: validate → tenant from
 * the member's own membership (requireTenant) → permission → execute. Asking spends `store_agent`
 * credits (shown before sending); nothing is written until the seller presses Apply.
 */

const ASK_DAILY_LIMIT = 60;

export async function askStoreCopilotAction(input: unknown): Promise<ActionResult<CopilotReply>> {
  return runAction("sellerAi.copilot.ask", async () => {
    const v = parseInput(storeCopilotAskSchema, input);
    const ctx = await requireTenant();
    assertPermission(ctx, "analytics.read");
    const [{ snapshot, products }, costs] = await Promise.all([loadStoreCopilotContext(ctx), storeCopilotCosts()]);
    const r = await runSellerAiGeneration({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      feature: "store_agent",
      creditKind: "store_agent",
      input: { question: v.messages[v.messages.length - 1]!.content.slice(0, 500), turns: v.messages.length, language: v.language, intent: v.intent ?? null, copilot: true },
      prompt: storeCopilotPrompt({ storeName: ctx.tenantName, language: v.language, snapshot, messages: v.messages, intent: v.intent ?? null }),
      schema: storeCopilotReplySchema,
      limit: { key: "seller-agent", perDay: ASK_DAILY_LIMIT, message: `You've asked Pictocart AI ${ASK_DAILY_LIMIT} questions today. Try again tomorrow.` },
    });
    // Only offer changes this member may apply.
    const allowed = r.data.proposals.filter((p) => (p.type === "faq" ? can(ctx, "content.write") : can(ctx, "catalog.write")));
    const ids = allowed.flatMap((p) => (p.type === "product_copy" ? [matchProductByTitle(p.productTitle, products)?.id].filter((x): x is string => !!x) : []));
    const current = await loadProductCopy(ctx.tenantId, ids);
    return {
      answer: r.data.answer,
      links: r.data.links,
      proposals: storeProposalViews(allowed, { products, current, faqApplyCredits: costs.faqApply }),
    };
  });
}

export async function applyStoreCopilotProposalAction(payload: unknown): Promise<ActionResult<{ message: string }>> {
  const parsed = storeApplySchema.safeParse(payload);
  if (parsed.success && parsed.data.type === "faq") {
    // Existing confirm-Apply path: content.write, debits generate_faq, inserts, audits.
    const r = await applyFaqsProposalAction({ groupName: parsed.data.groupName, items: parsed.data.items });
    return r.ok ? { ok: true, data: { message: `Added ${r.data.inserted} FAQ${r.data.inserted === 1 ? "" : "s"} to your store.` } } : r;
  }
  const result = await runAction("sellerAi.copilot.applyProductCopy", async () => {
    const v = parseInput(storeApplySchema, payload);
    const ctx = await requireTenant();
    if (v.type !== "product_copy") throw new AppError("VALIDATION", { fieldErrors: { _form: ["Nothing to apply"] } });
    return applyProductCopy(ctx, v);
  });
  if (result.ok) refresh();
  return result;
}

export async function storeCopilotCostsAction(): Promise<ActionResult<CopilotCosts>> {
  return runAction("sellerAi.copilot.costs", async () => {
    const ctx = await requireTenant();
    assertPermission(ctx, "analytics.read");
    const [costs, balance] = await Promise.all([storeCopilotCosts(), getAiCreditBalance(ctx.tenantId).catch(() => null)]);
    return { ask: costs.ask, balance };
  });
}

export async function transcribeStoreCopilotAudioAction(fd: FormData): Promise<ActionResult<{ transcript: string }>> {
  return runAction("sellerAi.copilot.transcribe", async () => {
    const upload = parseVoiceUpload(fd);
    const ctx = await requireTenant();
    assertPermission(ctx, "analytics.read");
    return transcribeForCopilot(ctx.tenantId, upload);
  });
}

export async function speakStoreCopilotAction(input: unknown): Promise<ActionResult<{ audioBase64: string; mimeType: string } | null>> {
  return runAction("sellerAi.copilot.speak", async () => {
    const v = parseInput(speakInputSchema, input);
    const ctx = await requireTenant();
    assertPermission(ctx, "analytics.read");
    return speakForCopilot(ctx.tenantId, v);
  });
}
