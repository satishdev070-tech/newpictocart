import "server-only";
import { z } from "zod";
import { serverEnv } from "@/lib/env/server";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import type { ProviderConfig } from "@/features/neural-pulse/server/llm";

export type SellerAiFunction = "generate-product" | "generate-blog" | "generate-contact-reply" | "business-coach";

const FAILED = "The AI service didn't return a usable answer. Please try again in a minute.";
const SETUP = "AI writing isn't set up yet. A platform admin needs to add a Gemini, Groq or Anthropic API key in Admin → Social apps.";

/**
 * Invokes a seller-ai Edge Function after Next has already checked membership, permissions and
 * credits. Sends ephemeral provider keys (from Admin → Social apps / env) over HTTPS; the function
 * is gated by the Supabase secret key so browsers cannot call it usefully.
 */
export async function invokeSellerAi<S extends z.ZodType>(
  name: SellerAiFunction,
  providers: ProviderConfig[],
  body: Record<string, unknown>,
  schema: S,
): Promise<z.output<S>> {
  if (!providers.length) throw new AppError("VALIDATION", { fieldErrors: { _form: [SETUP] }, context: { reason: "ai_not_configured" } });
  const env = serverEnv();
  const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const url = `${base}/functions/v1/${name}`;
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
        authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        ...(env.AI_EDGE_INVOKE_SECRET ? { "x-seller-ai-invoke": env.AI_EDGE_INVOKE_SECRET } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(95_000),
      cache: "no-store",
    });
  } catch (err) {
    const nameErr = err instanceof Error ? err.name : "";
    logger.warn("seller_ai.invoke_network", { name, error: nameErr });
    throw new AppError("INTERNAL", { fieldErrors: { _form: [FAILED] }, context: { reason: "edge_network" } });
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
    if (res.status === 503 || errCode === "not_configured") {
      throw new AppError("VALIDATION", { fieldErrors: { _form: [SETUP] }, context: { reason: "ai_not_configured" } });
    }
    throw new AppError("INTERNAL", { fieldErrors: { _form: [FAILED] }, context: { reason: "edge_http", status: res.status } });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    logger.warn("seller_ai.schema_failed", { name, issues: parsed.error.issues.slice(0, 3).map((i) => i.message) });
    throw new AppError("INTERNAL", { fieldErrors: { _form: [FAILED] }, context: { reason: "edge_schema" } });
  }
  return parsed.data;
}
