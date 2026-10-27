import "server-only";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/observability/logger";
import { invokeEdgeFunction } from "@/lib/supabase/edge";
import { debitAiCredit, refundAiCredit } from "@/features/ai-credits/server";
import {
  GENERATE_PRODUCT_CREDIT_KIND,
  generateProductEdgeResponseSchema,
  type GenerateProductInput,
  type GeneratedProduct,
} from "../ai-schemas";

export const GENERATE_PRODUCT_SETUP =
  "Product AI isn't ready yet. A platform admin needs to deploy the generate-product edge function and set a Gemini, OpenAI or Anthropic API key on the edge runtime.";
export const GENERATE_PRODUCT_FAILED = "The AI couldn't build product details from that image. Try another photo or try again in a minute.";
export const GENERATE_PRODUCT_LIMIT = "You've used today's product AI generations for this store. Try again tomorrow.";

const DAILY_LIMIT = 40;

/**
 * Debit credits, call `generate-product` edge, refund on failure.
 * Caller must have already checked catalog.write for the membership tenant.
 */
export async function generateProductFromImage(tenantId: string, input: GenerateProductInput): Promise<GeneratedProduct> {
  try {
    await rateLimit("catalog-generate-product", tenantId, DAILY_LIMIT, 86_400);
  } catch (err) {
    if (err instanceof AppError && err.code === "RATE_LIMITED") {
      throw new AppError("RATE_LIMITED", { fieldErrors: { _form: [GENERATE_PRODUCT_LIMIT] } });
    }
    throw err;
  }

  const charge = await debitAiCredit(tenantId, GENERATE_PRODUCT_CREDIT_KIND);
  const refundFail = async (note: string) => {
    await refundAiCredit(charge, note);
  };

  const edge = await invokeEdgeFunction<unknown>("generate-product", {
    imageUrls: input.imageUrls,
    images: input.images,
    hints: input.hints,
  });

  if (!edge.ok) {
    await refundFail(edge.error);
    if (edge.status === 0 || edge.status === 404 || edge.status === 503) {
      throw new AppError("VALIDATION", { fieldErrors: { _form: [GENERATE_PRODUCT_SETUP] }, context: { reason: "edge_unavailable", status: edge.status } });
    }
    if (edge.status === 401) {
      logger.error("catalog.generate_product.unauthorized", { tenantId });
      throw new AppError("INTERNAL", { fieldErrors: { _form: [GENERATE_PRODUCT_SETUP] }, context: { reason: "edge_unauthorized" } });
    }
    throw new AppError("VALIDATION", { fieldErrors: { _form: [GENERATE_PRODUCT_FAILED] }, context: { reason: edge.error.slice(0, 120) } });
  }

  const parsed = generateProductEdgeResponseSchema.safeParse(edge.data);
  if (!parsed.success) {
    await refundFail("invalid edge product payload");
    logger.warn("catalog.generate_product.bad_payload", { tenantId, issues: parsed.error.issues.slice(0, 3) });
    throw new AppError("VALIDATION", { fieldErrors: { _form: [GENERATE_PRODUCT_FAILED] }, context: { reason: "bad_payload" } });
  }

  logger.info("catalog.generate_product", {
    tenantId,
    provider: parsed.data.meta?.provider ?? null,
    model: parsed.data.meta?.model ?? null,
    images: input.imageUrls.length + input.images.length,
  });
  return parsed.data.product;
}
