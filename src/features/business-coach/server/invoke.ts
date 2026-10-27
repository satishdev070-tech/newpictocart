import "server-only";
import { serverEnv } from "@/lib/env/server";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { businessCoachOutput, type BusinessCoachOutput } from "../schemas";

export type EdgeProvider = { id: "gemini" | "groq" | "anthropic"; apiKey: string; model: string };

type InvokeBody = {
  storeName: string;
  locale?: string;
  focus?: string;
  metrics: Record<string, unknown>;
  products: unknown[];
  setupPending: string[];
  providers: EdgeProvider[];
};

type EdgeOk = BusinessCoachOutput & { provider: string; model: string; tokens: number | null };
type EdgeErr = { error?: string; message?: string };

/**
 * Calls the `business-coach` Edge Function with the secret key (server-only). Auth and credit
 * debit happen in the Next action before this; the function only runs the LLM.
 */
export async function invokeBusinessCoach(body: InvokeBody): Promise<EdgeOk> {
  const env = serverEnv();
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/functions/v1/business-coach`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      },
      body: JSON.stringify({ ...body, locale: body.locale ?? "en-IN" }),
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
  } catch (err) {
    logger.warn("business_coach.invoke_network", { error: err instanceof Error ? err.name : "unknown" });
    throw new AppError("INTERNAL", { fieldErrors: { _form: ["Could not reach the AI coach. Try again in a minute."] } });
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new AppError("INTERNAL", { fieldErrors: { _form: ["The AI coach returned an unreadable response."] } });
  }

  if (!res.ok) {
    const err = (raw ?? {}) as EdgeErr;
    if (res.status === 503 || err.error === "not_configured") {
      throw new AppError("VALIDATION", { fieldErrors: { _form: ["AI writing isn't set up yet. A platform admin needs to add a Gemini, Groq or Anthropic API key in Admin → Social apps."] } });
    }
    logger.warn("business_coach.invoke_failed", { status: res.status, error: err.error, message: err.message?.slice(0, 200) });
    throw new AppError("INTERNAL", { fieldErrors: { _form: ["The AI coach didn't return a usable answer. Please try again."] } });
  }

  const parsed = businessCoachOutput.safeParse(raw);
  if (!parsed.success || !parsed.data.tips.length) {
    throw new AppError("INTERNAL", { fieldErrors: { _form: ["The AI coach didn't return a usable answer. Please try again."] } });
  }
  const row = raw as { provider?: string; model?: string; tokens?: number | null };
  return {
    ...parsed.data,
    provider: typeof row.provider === "string" ? row.provider.slice(0, 40) : "unknown",
    model: typeof row.model === "string" ? row.model.slice(0, 100) : "",
    tokens: typeof row.tokens === "number" && Number.isFinite(row.tokens) ? Math.round(row.tokens) : null,
  };
}
