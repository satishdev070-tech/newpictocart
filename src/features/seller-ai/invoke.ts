import "server-only";
import { z } from "zod";
import { serverEnv } from "@/lib/env/server";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { SETUP_MESSAGE, FAILED_MESSAGE } from "@/features/neural-pulse/server/generate";
import type { ProviderConfig } from "@/features/neural-pulse/server/llm";

export type SellerAiFunction =
  | "generate-product"
  | "generate-blog"
  | "generate-contact-reply"
  | "business-coach"
  | "merchant-assistant";

export const SELLER_AI_SETUP = SETUP_MESSAGE;
export const SELLER_AI_FAILED = FAILED_MESSAGE;
/** Edge Function unreachable or errored — distinct from missing API keys (SETUP). */
export const SELLER_AI_EDGE_UNAVAILABLE =
  "The AI edge service is temporarily unavailable. Please try again in a minute.";

/**
 * Optional Edge Function invoke. The seller-ai happy path uses in-process generateJson instead;
 * this helper remains for ops/fallback callers. Sends ephemeral provider keys over HTTPS; gated by
 * the Supabase secret key (apikey + Authorization) and optional AI_EDGE_INVOKE_SECRET.
 *
 * SETUP is only thrown when Next has no providers, or the Edge body explicitly says
 * `error: "not_configured"`. Other 502/503 responses map to a distinct edge-unavailable message
 * (not the false "AI writing isn't set up" copy).
 */
export async function invokeSellerAi<S extends z.ZodType>(
  name: SellerAiFunction,
  providers: ProviderConfig[],
  body: Record<string, unknown>,
  schema: S,
): Promise<z.output<S>> {
  if (!providers.length) {
    throw new AppError("VALIDATION", { fieldErrors: { _form: [SELLER_AI_SETUP] }, context: { reason: "ai_not_configured" } });
  }
  const env = serverEnv();
  const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const url = `${base}/functions/v1/${name}`;
  const secret = env.SUPABASE_SECRET_KEY;
  const payload = {
    ...body,
    providers: providers.map((p) => ({ id: p.id, apiKey: p.apiKey, model: p.model })),
  };
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: secret,
        authorization: `Bearer ${secret}`,
        ...(env.AI_EDGE_INVOKE_SECRET ? { "x-seller-ai-invoke": env.AI_EDGE_INVOKE_SECRET } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(95_000),
      cache: "no-store",
    });
  } catch (err) {
    const nameErr = err instanceof Error ? err.name : "";
    logger.warn("seller_ai.invoke_network", { name, error: nameErr });
    throw new AppError("INTERNAL", { fieldErrors: { _form: [SELLER_AI_EDGE_UNAVAILABLE] }, context: { reason: "edge_network" } });
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const errCode = json && typeof json === "object" && "error" in json ? String((json as { error: unknown }).error) : `HTTP ${res.status}`;
    logger.warn("seller_ai.invoke_failed", { name, status: res.status, error: errCode.slice(0, 80) });
    if (errCode === "not_configured") {
      throw new AppError("VALIDATION", { fieldErrors: { _form: [SELLER_AI_SETUP] }, context: { reason: "ai_not_configured" } });
    }
    if (res.status === 502 || res.status === 503) {
      throw new AppError("INTERNAL", {
        fieldErrors: { _form: [SELLER_AI_EDGE_UNAVAILABLE] },
        context: { reason: "edge_unavailable", status: res.status, error: errCode.slice(0, 80) },
      });
    }
    throw new AppError("INTERNAL", { fieldErrors: { _form: [SELLER_AI_FAILED] }, context: { reason: "edge_http", status: res.status } });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    logger.warn("seller_ai.schema_failed", { name, issues: parsed.error.issues.slice(0, 3).map((i) => i.message) });
    throw new AppError("INTERNAL", { fieldErrors: { _form: [SELLER_AI_FAILED] }, context: { reason: "edge_schema" } });
  }
  return parsed.data;
}
