"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { assertPermission, requireTenant } from "@/lib/tenant/membership";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/observability/logger";
import { chatTurn, isSarvamConfigured } from "@/lib/sarvam/client";
import { FAILED_MESSAGE, SETUP_MESSAGE, loadProviders } from "@/features/neural-pulse/server/generate";
import { LlmError, generateJson } from "@/features/neural-pulse/server/llm";
import { getStoreBrief } from "@/features/neural-pulse/server/context";
import { debitAiCredit, refundAiCredit } from "@/features/ai-credits/server";
import type { SectionType } from "@/features/theme/sections/types";
import { aiOutputSchema, aiSectionTypes, buildSectionPrompt, fallbackSettings, parseSectionJson, retryPrompt, sanitizeSectionSettings } from "./ai-section";
import { SLOT_KEY_RE, type ListKey } from "./slots";

/**
 * "Add with AI" (site builder): writes one section's settings from a seller prompt. Nothing is
 * stored here; the builder inserts the result into the draft document like any manual edit, and
 * saving re-validates the whole theme. Store context is read server-side for the member's tenant.
 * Gemini, Groq and Anthropic run first when configured. Sarvam chat is the fallback, and the only
 * model when those keys are missing. Failures stay VALIDATION so the panel can show the sentence.
 */

const DAILY_LIMIT = 30;
const LIMIT_MESSAGE = `You've used today's ${DAILY_LIMIT} AI sections for this store. Try again tomorrow, or add a section manually.`;

const inputSchema = z.object({
  prompt: z.string().trim().min(3, "Describe the section in a few words").max(500, "Keep it under 500 characters"),
  list: z
    .string()
    .regex(SLOT_KEY_RE, "Unknown page area")
    .refine((v) => !/\.(before|after)$/.test(v), "Unknown page area"),
  storeContext: z.object({ pageTitle: z.string().trim().max(80).optional() }).optional(),
});

export type GeneratedSection = { type: SectionType; settings: Record<string, unknown> };

export async function generateSectionAction(input: { prompt: string; list: string; storeContext?: { pageTitle?: string } }): Promise<ActionResult<GeneratedSection>> {
  return runAction("theme.generateSection", async () => {
    const data = parseInput(inputSchema, input);
    const ctx = await requireTenant();
    assertPermission(ctx, "theme.edit");

    const list = data.list as ListKey;
    const types = aiSectionTypes(list);
    if (!types.length) throw new AppError("VALIDATION", { fieldErrors: { _form: ["Sections can't be added here."] } });

    try {
      await rateLimit("theme-section-ai", ctx.tenantId, DAILY_LIMIT, 86_400);
    } catch (err) {
      if (err instanceof AppError && err.code === "RATE_LIMITED") throw new AppError("RATE_LIMITED", { fieldErrors: { _form: [LIMIT_MESSAGE] } });
      throw err;
    }

    const providers = await loadProviders("section");
    const sarvamReady = isSarvamConfigured();
    if (!providers.length && !sarvamReady) throw new AppError("VALIDATION", { fieldErrors: { _form: [SETUP_MESSAGE] }, context: { reason: "ai_not_configured" } });

    const store = await getStoreBrief(ctx.tenantId);
    const prompt = buildSectionPrompt({ prompt: data.prompt, types, store, pageTitle: data.storeContext?.pageTitle ?? null });
    const schema = aiOutputSchema(types);
    // One credit covers this user-visible request, including a provider fallback and the repair attempt.
    // Debit immediately before the model call so a context/read failure cannot consume one.
    const charge = await debitAiCredit(ctx.tenantId, "section");
    const failModels = async (note: string, context?: Record<string, unknown>): Promise<never> => {
      await refundAiCredit(charge, note);
      throw new AppError("VALIDATION", { fieldErrors: { _form: [FAILED_MESSAGE] }, context });
    };

    if (providers.length) {
      try {
        const first = await generateJson(providers, prompt, schema);
        let type = first.data.type;
        let result = sanitizeSectionSettings(type, first.data.settings);
        if (!result.ok) {
          try {
            const second = await generateJson(providers, retryPrompt(prompt, result.issues), schema);
            const again = sanitizeSectionSettings(second.data.type, second.data.settings);
            if (again.ok) {
              type = second.data.type;
              result = again;
            }
          } catch (err) {
            logger.warn("theme.generate_section.retry_failed", { tenantId: ctx.tenantId, error: err instanceof Error ? err.message.slice(0, 200) : "unknown" });
          }
        }
        const settings = result.ok ? result.settings : fallbackSettings(type, first.data.settings);
        logger.info("theme.generate_section", { tenantId: ctx.tenantId, type, provider: first.provider, model: first.model, usage: first.tokens, fallback: !result.ok });
        return { type, settings };
      } catch (err) {
        if (!sarvamReady) {
          throw await failModels(err instanceof Error ? err.message : "AI section generation failed", err instanceof LlmError ? { failures: err.failures } : { reason: "ai_section_failed" });
        }
        logger.warn("theme.generate_section.provider_failed", { tenantId: ctx.tenantId, error: err instanceof Error ? err.message.slice(0, 200) : "unknown" });
      }
    }

    // No languageCode: a translation pass would rewrite the JSON object.
    let turn;
    try {
      turn = await chatTurn({
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        responseFormat: "json",
        temperature: 0.3,
      });
    } catch (err) {
      throw await failModels(err instanceof Error ? err.message : "AI section generation failed", { reason: "sarvam_section_failed" });
    }

    const parsed = parseSectionJson(turn.content);
    const type = parsed ? types.find((t) => t === parsed.type) : undefined;
    if (!parsed || !type) throw await failModels("AI section response was not a usable section", { reason: "sarvam_section_unusable" });
    const result = sanitizeSectionSettings(type, parsed.settings);
    const settings = result.ok ? result.settings : fallbackSettings(type, parsed.settings);
    logger.info("theme.generate_section", { tenantId: ctx.tenantId, type, provider: "sarvam", model: turn.model ?? "sarvam-105b-conversations", usage: null, fallback: !result.ok });
    return { type, settings };
  });
}
