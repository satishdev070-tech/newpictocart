import "server-only";
import { serverEnv } from "@/lib/env/server";
import { publicEnv } from "@/lib/env/public";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";

export type EdgeInvokeResult<T> = { ok: true; data: T; status: number } | { ok: false; status: number; error: string; body: unknown };

/**
 * Invoke a Supabase Edge Function with the secret key (server-only).
 * Shared by Seller AI Phase 1+ (generate-product, later blog / contact reply / coach).
 * Never call from the browser — the secret must not leave the server.
 */
export async function invokeEdgeFunction<T = unknown>(
  name: string,
  body: unknown,
  opts?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<EdgeInvokeResult<T>> {
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(name)) {
    throw new AppError("INTERNAL", { context: { operation: "invoke_edge_bad_name", name } });
  }
  const base = publicEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const secret = serverEnv().SUPABASE_SECRET_KEY;
  const invokeSecret = process.env.AI_EDGE_INVOKE_SECRET?.trim();
  const timeoutMs = opts?.timeoutMs ?? 90_000;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${secret}`,
  };
  if (invokeSecret && invokeSecret.length >= 32) headers["x-seller-ai-invoke"] = invokeSecret;

  let res: Response;
  try {
    res = await fetch(`${base}/functions/v1/${name}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
      signal: opts?.signal ?? AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (err) {
    const reason = err instanceof Error ? err.name : "network";
    logger.warn("edge.invoke_network", { name, reason });
    return { ok: false, status: 0, error: reason === "TimeoutError" || reason === "AbortError" ? "timeout" : "network", body: null };
  }

  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = { raw: text.slice(0, 500) };
    }
  }

  if (!res.ok) {
    const msg =
      parsed && typeof parsed === "object" && "message" in parsed && typeof (parsed as { message: unknown }).message === "string"
        ? (parsed as { message: string }).message
        : parsed && typeof parsed === "object" && "error" in parsed && typeof (parsed as { error: unknown }).error === "string"
          ? (parsed as { error: string }).error
          : `HTTP ${res.status}`;
    logger.warn("edge.invoke_failed", { name, status: res.status, error: msg.slice(0, 200) });
    return { ok: false, status: res.status, error: msg.slice(0, 300), body: parsed };
  }

  return { ok: true, data: parsed as T, status: res.status };
}
