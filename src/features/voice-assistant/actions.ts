"use server";

import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/observability/logger";
import { assertPermission, can, requireTenant, type TenantContext } from "@/lib/tenant/membership";
import { runSellerAiGeneration } from "@/features/seller-ai/server";
import { detectLocale } from "./languages";
import { voiceAssistantPrompt } from "./prompt";
import { assistantActionInputSchema, assistantModelReplySchema, assistantSessionInputSchema, assistantTurnSchema, type AssistantActionView, type AssistantTurnResult } from "./schemas";
import { assertVoiceAssistantEnabled } from "./server/gate";
import {
  actionView,
  appendMessage,
  createSession,
  findOwnSession,
  getOwnAction,
  insertThemeProposal,
  latestOwnSession,
  loadHistory,
  loadTranscript,
  themePatchArgs,
  touchSession,
  transitionAction,
  type TranscriptItem,
} from "./server/sessions";
import { readThemeColors, writeThemeColor } from "./server/theme-tool";

/**
 * Voice assistant server actions (docs/voice-assistant/PLAN.md). Order in every action:
 * validate → feature gate → tenant from the member's own membership (requireTenant) →
 * permission → rate limit → execute → audit. The model only proposes; nothing in the store changes
 * until the merchant presses Apply, and every apply can be undone.
 */

const TURNS_PER_MINUTE = 10;
const TURNS_PER_DAY = 120;

async function memberContext(): Promise<TenantContext> {
  const ctx = await requireTenant();
  await assertVoiceAssistantEnabled(ctx.user.id);
  assertPermission(ctx, "analytics.read");
  return ctx;
}

export async function voiceAssistantTurnAction(input: unknown): Promise<ActionResult<AssistantTurnResult>> {
  return runAction("voiceAssistant.turn", async () => {
    const v = parseInput(assistantTurnSchema, input);
    const ctx = await memberContext();
    try {
      await rateLimit("voice-assistant-burst", ctx.user.id, TURNS_PER_MINUTE, 60);
    } catch (err) {
      if (err instanceof AppError && err.code === "RATE_LIMITED") throw new AppError("RATE_LIMITED", { fieldErrors: { _form: ["You're talking faster than I can keep up. Wait a few seconds and try again."] } });
      throw err;
    }
    const locale = detectLocale(v.text, v.locale);

    const existing = v.sessionId ? await findOwnSession(ctx, v.sessionId) : null;
    const session = existing ?? (await createSession(ctx, locale, v.text));
    const canTheme = can(ctx, "theme.edit");
    const [history, colors] = await Promise.all([existing ? loadHistory(ctx, session.id) : Promise.resolve([]), canTheme ? readThemeColors(ctx.tenantId) : Promise.resolve(null)]);

    // Persist the merchant's turn first, so an interrupted reply can be resumed and retried.
    await appendMessage(ctx, { sessionId: session.id, role: "user", content: v.text, locale, inputMode: v.inputMode });

    const r = await runSellerAiGeneration({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      feature: "voice_assistant",
      creditKind: "store_agent",
      input: { voice: true, locale, inputMode: v.inputMode, turns: history.length + 1, question: v.text.slice(0, 300) },
      prompt: voiceAssistantPrompt({ storeName: ctx.tenantName, locale, page: v.page ?? null, colors, history, text: v.text }),
      schema: assistantModelReplySchema,
      limit: { key: "voice-assistant", perDay: TURNS_PER_DAY, message: `You've used the voice assistant ${TURNS_PER_DAY} times today. Try again tomorrow.` },
    });

    let action: AssistantActionView | null = null;
    if (r.data.intent === "theme_color" && r.data.themePatch && canTheme) {
      const before = colors?.[r.data.themePatch.token] ?? null;
      if (before !== r.data.themePatch.color) action = await insertThemeProposal(ctx, session.id, r.data.themePatch, before);
    }

    await appendMessage(ctx, { sessionId: session.id, role: "assistant", content: r.data.reply, locale, provider: r.provider, model: r.model, tokens: r.tokens });
    await touchSession(ctx, session.id, locale);
    logger.info("voice_assistant.turn", { tenantId: ctx.tenantId, locale, intent: r.data.intent, proposal: !!action, provider: r.provider });
    return { sessionId: session.id, locale, reply: r.data.reply, action };
  });
}

export async function applyVoiceAssistantActionAction(input: unknown): Promise<ActionResult<{ action: AssistantActionView; message: string }>> {
  return runAction("voiceAssistant.apply", async () => {
    const v = parseInput(assistantActionInputSchema, input);
    const ctx = await memberContext();
    assertPermission(ctx, "theme.edit");
    const row = await getOwnAction(ctx, v.actionId);
    const patch = themePatchArgs(row.args);
    if (row.tool !== "propose_theme_patch" || !patch) throw new AppError("VALIDATION", { fieldErrors: { _form: ["That suggestion can't be applied."] } });
    // Idempotent: a second Apply of the same suggestion is a no-op success.
    if (row.status === "applied") return { action: actionView(row)!, message: "Already applied to your theme draft." };
    if (row.status !== "proposed") throw new AppError("CONFLICT", { fieldErrors: { _form: ["That suggestion was already handled."] } });

    const { before } = await writeThemeColor(ctx, patch.token, patch.color);
    const moved = await transitionAction(ctx, row.id, "proposed", "applied", { before_value: before });
    if (!moved) throw new AppError("CONFLICT", { fieldErrors: { _form: ["That suggestion was already handled."] } });
    await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "theme.assistant_patch_applied", entityType: "assistant_action", entityId: row.id, metadata: { token: patch.token, before, after: patch.color } });
    return { action: { ...actionView(row)!, status: "applied", before }, message: "Saved to your theme draft. Preview and publish it from Storefront → Theme editor when you're happy." };
  });
}

export async function undoVoiceAssistantActionAction(input: unknown): Promise<ActionResult<{ action: AssistantActionView; message: string }>> {
  return runAction("voiceAssistant.undo", async () => {
    const v = parseInput(assistantActionInputSchema, input);
    const ctx = await memberContext();
    assertPermission(ctx, "theme.edit");
    const row = await getOwnAction(ctx, v.actionId);
    const patch = themePatchArgs(row.args);
    const before = typeof row.before_value === "string" && /^#[0-9a-f]{6}$/.test(row.before_value) ? row.before_value : null;
    if (!patch || !before) throw new AppError("VALIDATION", { fieldErrors: { _form: ["This change can't be undone here. Change it in the theme editor."] } });
    if (row.status === "undone") return { action: actionView(row)!, message: "Already undone." };
    if (row.status !== "applied") throw new AppError("CONFLICT", { fieldErrors: { _form: ["Only an applied change can be undone."] } });

    // Don't clobber a newer edit: undo only while the draft still has the colour we set.
    const colors = await readThemeColors(ctx.tenantId);
    if (colors && colors[patch.token] !== patch.color) {
      throw new AppError("CONFLICT", { fieldErrors: { _form: ["The theme has changed since, so I won't undo this automatically. Adjust it in the theme editor."] } });
    }
    await writeThemeColor(ctx, patch.token, before);
    const moved = await transitionAction(ctx, row.id, "applied", "undone");
    if (!moved) throw new AppError("CONFLICT", { fieldErrors: { _form: ["That change was already undone."] } });
    await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "theme.assistant_patch_undone", entityType: "assistant_action", entityId: row.id, metadata: { token: patch.token, restored: before } });
    return { action: { ...actionView(row)!, status: "undone" }, message: "Undone. Your previous colour is back in the draft." };
  });
}

export async function dismissVoiceAssistantActionAction(input: unknown): Promise<ActionResult<{ ok: true }>> {
  return runAction("voiceAssistant.dismiss", async () => {
    const v = parseInput(assistantActionInputSchema, input);
    const ctx = await memberContext();
    await transitionAction(ctx, v.actionId, "proposed", "rejected");
    return { ok: true as const };
  });
}

export type VoiceAssistantResume = { sessionId: string; locale: "en-IN" | "hi-IN" | "hinglish"; messages: TranscriptItem[]; actions: AssistantActionView[] } | null;

/** The member's own latest conversation (last 7 days), or a given one of theirs. */
export async function resumeVoiceAssistantAction(input: unknown): Promise<ActionResult<VoiceAssistantResume>> {
  return runAction("voiceAssistant.resume", async () => {
    const sessionId = input && typeof input === "object" && "sessionId" in input ? parseInput(assistantSessionInputSchema, input).sessionId : null;
    const ctx = await memberContext();
    const session = sessionId ? await findOwnSession(ctx, sessionId) : await latestOwnSession(ctx);
    if (!session) return null;
    const t = await loadTranscript(ctx, session.id);
    return { sessionId: session.id, locale: session.locale, ...t };
  });
}
