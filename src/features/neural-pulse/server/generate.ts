import "server-only";
import type { z } from "zod";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";
import type { Json } from "@/lib/supabase/database.types";
import { getAiProviderOrder, getAppCredential } from "@/features/platform-apps/server";
import { DAILY_GENERATION_LIMIT, type AiProvider, type GenerationKind } from "../schemas";
import type { Prompt } from "../prompts";
import { LlmError, generateJson, resolveModel, type ProviderConfig } from "./llm";
import { debitAiCredit, refundAiCredit } from "@/features/ai-credits/server";
import { loadFeatureRoute } from "@/features/ai-health/route-loader";
import { routeProviders } from "@/features/ai-health/routing";

export const SETUP_MESSAGE = "AI writing isn't set up yet. A platform admin needs to add a Gemini, Groq or Anthropic API key in Admin → Social apps.";
export const LIMIT_MESSAGE = `You've used today's ${DAILY_GENERATION_LIMIT} AI generations for this store. Try again tomorrow.`;
export const FAILED_MESSAGE = "The AI service didn't return a usable answer. Please try again in a minute.";

/**
 * Configured providers with keys. Server-only; never pass to the client. With a `feature` key the
 * Admin → AI health route applies (primary + fallback, see routeProviders); otherwise, or with no
 * enabled route, the platform's order.
 */
export async function loadProviders(feature?: string): Promise<ProviderConfig[]> {
  const order = await getAiProviderOrder();
  const out: ProviderConfig[] = [];
  for (const id of order) {
    const cred = await getAppCredential(id);
    if (cred?.secret) out.push({ id, apiKey: cred.secret, model: resolveModel(id, cred.extra.model) });
  }
  if (!feature || !out.length) return out;
  return routeProviders(out, await loadFeatureRoute(feature));
}

/** Names of configured providers only (safe for the UI). */
export async function configuredProviders(): Promise<AiProvider[]> {
  return getAiProviderOrder();
}

export type GenerationOutcome<T> = { id: string | null; data: T; provider: AiProvider; model: string; tokens: number | null };

/**
 * One generation for an already authorised tenant: per-store daily limit, durable credit debit,
 * provider fallback and schema validation, then a log row in ai_generations. The debit occurs
 * before the provider call and is refunded on every provider/schema failure. Until the additive
 * credit migration is applied, debitAiCredit deliberately returns null so existing AI remains live.
 * Callers must have checked membership + marketing.write first.
 */
export async function runGeneration<S extends z.ZodType>(args: { tenantId: string; userId: string; kind: GenerationKind; input: Record<string, unknown>; prompt: Prompt; schema: S }): Promise<GenerationOutcome<z.output<S>>> {
  const providers = await loadProviders(args.kind);
  if (!providers.length) throw new AppError("VALIDATION", { fieldErrors: { _form: [SETUP_MESSAGE] }, context: { reason: "ai_not_configured" } });
  try {
    await rateLimit("neural-pulse", args.tenantId, DAILY_GENERATION_LIMIT, 86_400);
  } catch (err) {
    if (err instanceof AppError && err.code === "RATE_LIMITED") throw new AppError("RATE_LIMITED", { fieldErrors: { _form: [LIMIT_MESSAGE] } });
    throw err;
  }
  const charge = await debitAiCredit(args.tenantId, args.kind);
  let result;
  try {
    result = await generateJson(providers, args.prompt, args.schema);
  } catch (err) {
    await refundAiCredit(charge, err instanceof Error ? err.message : "AI generation failed");
    if (err instanceof LlmError) {
      logger.warn("neural_pulse.generation_failed", { tenantId: args.tenantId, kind: args.kind, failures: err.failures });
      throw new AppError("INTERNAL", { fieldErrors: { _form: [FAILED_MESSAGE] }, context: { failures: err.failures } });
    }
    throw err;
  }
  let id: string | null = null;
  const { data, error } = await createSupabaseAdminClient()
    .from("ai_generations")
    .insert({ tenant_id: args.tenantId, kind: args.kind, input: args.input as Json, output: result.data as Json, provider: result.provider, model: result.model.slice(0, 100), tokens: result.tokens == null ? null : Math.round(result.tokens), created_by: args.userId })
    .select("id")
    .single();
  if (error) logger.warn("neural_pulse.log_failed", { tenantId: args.tenantId, kind: args.kind, code: error.code });
  else id = data.id;
  logger.info("neural_pulse.generated", { tenantId: args.tenantId, kind: args.kind, provider: result.provider, model: result.model, usage: result.tokens, attempts: result.attempts });
  return { id, data: result.data, provider: result.provider, model: result.model, tokens: result.tokens };
}
