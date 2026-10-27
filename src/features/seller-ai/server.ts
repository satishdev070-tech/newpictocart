import "server-only";
import type { z } from "zod";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";
import type { Json } from "@/lib/supabase/database.types";
import { debitAiCredit, refundAiCredit, type AiCreditCharge } from "@/features/ai-credits/server";
import { loadProviders } from "@/features/neural-pulse/server/generate";
import { invokeSellerAi, type SellerAiFunction } from "./invoke";
import type { SellerAiCreditKind } from "./schemas";

const DAILY_LIMIT = 40;
const LIMIT_MESSAGE = `You've used today's ${DAILY_LIMIT} seller AI generations for this store. Try again tomorrow.`;

export type SellerAiOutcome<T> = { data: T; charge: AiCreditCharge; provider: string; model: string; tokens: number | null };

/**
 * Shared debit → edge invoke → refund-on-failure → ai_generations log path for seller AI features.
 * Callers must already have checked the matching tenant permission.
 */
export async function runSellerAiGeneration<S extends z.ZodType>(args: {
  tenantId: string;
  userId: string;
  feature: string;
  creditKind: SellerAiCreditKind;
  fn: SellerAiFunction;
  input: Record<string, unknown>;
  body: Record<string, unknown>;
  schema: S;
}): Promise<SellerAiOutcome<z.output<S>>> {
  const providers = await loadProviders(args.feature);
  try {
    await rateLimit("seller-ai", args.tenantId, DAILY_LIMIT, 86_400);
  } catch (err) {
    if (err instanceof AppError && err.code === "RATE_LIMITED") throw new AppError("RATE_LIMITED", { fieldErrors: { _form: [LIMIT_MESSAGE] } });
    throw err;
  }
  const charge = await debitAiCredit(args.tenantId, args.creditKind);
  let result: z.output<S>;
  try {
    result = await invokeSellerAi(args.fn, providers, args.body, args.schema);
  } catch (err) {
    await refundAiCredit(charge, err instanceof Error ? err.message : "seller AI failed");
    throw err;
  }
  const meta = result as { provider?: string; model?: string; tokens?: number | null };
  const { error } = await createSupabaseAdminClient()
    .from("ai_generations")
    .insert({
      tenant_id: args.tenantId,
      kind: args.creditKind,
      input: args.input as Json,
      output: result as Json,
      provider: (meta.provider ?? "gemini").slice(0, 40),
      model: (meta.model ?? "").slice(0, 100) || null,
      tokens: meta.tokens == null ? null : Math.round(meta.tokens),
      created_by: args.userId,
    });
  if (error) logger.warn("seller_ai.log_failed", { tenantId: args.tenantId, kind: args.creditKind, code: error.code });
  logger.info("seller_ai.generated", { tenantId: args.tenantId, kind: args.creditKind, provider: meta.provider, model: meta.model });
  return { data: result, charge, provider: meta.provider ?? "unknown", model: meta.model ?? "", tokens: meta.tokens ?? null };
}

/** Convert an uploaded File into a base64 image payload for the edge function. */
export async function fileToImagePayload(file: File): Promise<{ mediaType: "image/png" | "image/jpeg" | "image/webp"; data: string } | null> {
  const type = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (type !== "image/png" && type !== "image/jpeg" && type !== "image/webp") return null;
  if (file.size < 32 || file.size > 3_500_000) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  return { mediaType: type, data: buf.toString("base64") };
}
