import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { rateLimit } from "@/lib/rate-limit";
import { debitAiCredit, refundAiCredit } from "@/features/ai-credits/server";
import { loadProviders, SETUP_MESSAGE } from "@/features/neural-pulse/server/generate";
import { BUSINESS_COACH_KIND, type BusinessCoachInput, type BusinessCoachOutput } from "../schemas";
import { loadCoachStoreContext } from "./context";
import { invokeBusinessCoach } from "./invoke";
import type { TenantContext } from "@/lib/tenant/membership";

const DAILY_LIMIT = 20;

export type CoachResult = BusinessCoachOutput & { provider: string; model: string; balance: number | null };

/**
 * Debit credits → invoke Edge Function → log generation. Refunds the debit on every failure after
 * the charge. Callers must have checked membership + marketing.write (required by ai_credit_debit).
 */
export async function runBusinessCoach(ctx: TenantContext, input: BusinessCoachInput): Promise<CoachResult> {
  const providers = await loadProviders(BUSINESS_COACH_KIND);
  if (!providers.length) throw new AppError("VALIDATION", { fieldErrors: { _form: [SETUP_MESSAGE] }, context: { reason: "ai_not_configured" } });

  try {
    await rateLimit("business-coach", ctx.tenantId, DAILY_LIMIT, 86_400);
  } catch (err) {
    if (err instanceof AppError && err.code === "RATE_LIMITED") {
      throw new AppError("RATE_LIMITED", { fieldErrors: { _form: [`You've used today's ${DAILY_LIMIT} business coach tips for this store. Try again tomorrow.`] } });
    }
    throw err;
  }

  const store = await loadCoachStoreContext(ctx);
  const charge = await debitAiCredit(ctx.tenantId, BUSINESS_COACH_KIND);

  let result;
  try {
    result = await invokeBusinessCoach({
      storeName: store.storeName,
      focus: input.focus,
      metrics: store.metrics,
      products: store.products,
      setupPending: store.setupPending,
      providers: providers.map((p) => ({ id: p.id, apiKey: p.apiKey, model: p.model })),
    });
  } catch (err) {
    await refundAiCredit(charge, err instanceof Error ? err.message : "Business coach failed");
    throw err;
  }

  const { data, error } = await createSupabaseAdminClient()
    .from("ai_generations")
    .insert({
      tenant_id: ctx.tenantId,
      kind: BUSINESS_COACH_KIND,
      input: { focus: input.focus, metrics: store.metrics } as Json,
      output: { headline: result.headline, focus: result.focus, tips: result.tips } as Json,
      provider: result.provider,
      model: result.model.slice(0, 100) || null,
      tokens: result.tokens,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error) logger.warn("business_coach.log_failed", { tenantId: ctx.tenantId, code: error.code });
  else logger.info("business_coach.generated", { tenantId: ctx.tenantId, id: data.id, provider: result.provider, model: result.model });

  return {
    headline: result.headline,
    focus: result.focus,
    tips: result.tips,
    provider: result.provider,
    model: result.model,
    balance: charge?.balance ?? null,
  };
}
