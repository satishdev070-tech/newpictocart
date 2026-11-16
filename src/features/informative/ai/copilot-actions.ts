"use server";

import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { getAiCreditBalance } from "@/features/ai-credits/server";
import { informativeCopilotAskSchema, speakInputSchema } from "@/features/seller-ai/copilot/schemas";
import { parseVoiceUpload, speakForCopilot, transcribeForCopilot } from "@/features/seller-ai/copilot/voice";
import type { CopilotCosts, CopilotReply } from "@/features/seller-ai/copilot/types";
import { assertInformativePermission, requireInformativeTenant } from "../server/context";
import { applyInformativeProposalAction } from "./actions";
import { askInformativeCopilot, informativeAskCredits } from "./copilot-server";

/**
 * "Ask Pictocart AI" for the informative-website panel. Order: validate → tenant from the
 * member's own membership (requireInformativeTenant) → permission (content.write, as the
 * existing website assistant) → execute. Apply reuses applyInformativeProposalAction.
 */

export async function askInformativeCopilotAction(input: unknown): Promise<ActionResult<CopilotReply>> {
  return runAction("informative.copilot.ask", async () => {
    const v = parseInput(informativeCopilotAskSchema, input);
    const ctx = await requireInformativeTenant();
    assertInformativePermission(ctx, "content.write");
    return askInformativeCopilot(ctx, v);
  });
}

export async function applyInformativeCopilotProposalAction(payload: unknown): Promise<ActionResult<{ message: string }>> {
  const r = await applyInformativeProposalAction(payload);
  return r.ok ? { ok: true, data: { message: "Added to your website." } } : r;
}

export async function informativeCopilotCostsAction(): Promise<ActionResult<CopilotCosts>> {
  return runAction("informative.copilot.costs", async () => {
    const ctx = await requireInformativeTenant();
    assertInformativePermission(ctx, "content.write");
    const [ask, balance] = await Promise.all([informativeAskCredits(), getAiCreditBalance(ctx.tenantId).catch(() => null)]);
    return { ask, balance };
  });
}

export async function transcribeInformativeCopilotAudioAction(fd: FormData): Promise<ActionResult<{ transcript: string }>> {
  return runAction("informative.copilot.transcribe", async () => {
    const upload = parseVoiceUpload(fd);
    const ctx = await requireInformativeTenant();
    assertInformativePermission(ctx, "content.write");
    return transcribeForCopilot(ctx.tenantId, upload);
  });
}

export async function speakInformativeCopilotAction(input: unknown): Promise<ActionResult<{ audioBase64: string; mimeType: string } | null>> {
  return runAction("informative.copilot.speak", async () => {
    const v = parseInput(speakInputSchema, input);
    const ctx = await requireInformativeTenant();
    assertInformativePermission(ctx, "content.write");
    return speakForCopilot(ctx.tenantId, v);
  });
}
