import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";
import type { Json } from "@/lib/supabase/database.types";
import { debitAiCredit, getAiCreditBalance, refundAiCredit, type AiCreditCharge } from "@/features/ai-credits/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { summarizeWallet, type WalletSummary } from "./wallet";
import { loadProviders, SETUP_MESSAGE } from "@/features/neural-pulse/server/generate";
import { LlmError, generateJson } from "@/features/neural-pulse/server/llm";
import type { Prompt, PromptImage } from "@/features/neural-pulse/prompts";
import { orderForImages } from "@/features/theme/builder/server/generate";
import type { SellerAiCreditKind } from "./schemas";
import type { AiProvider } from "@/features/neural-pulse/schemas";
import { invokeSellerAi, type SellerAiFunction } from "./invoke";
import { friendlySellerAiFailure } from "./errors";

const DAILY_LIMIT = 40;
const LIMIT_MESSAGE = `You've used today's ${DAILY_LIMIT} seller AI generations for this store. Try again tomorrow.`;

export type SellerAiOutcome<T> = { data: T; charge: AiCreditCharge; provider: string; model: string; tokens: number | null };

/**
 * Shared debit → in-process generateJson → refund-on-failure → ai_generations log path for seller AI.
 * Happy path does not call Edge Functions (invokeSellerAi remains optional). Callers must already
 * have checked the matching tenant permission via runAction + membership.
 *
 * Optional `edgeFallback`: when in-process generateJson fails (providers configured but all
 * exhausted), try the named Edge Function once before refunding. In-process stays primary.
 */
export async function runSellerAiGeneration<S extends z.ZodType>(args: {
  tenantId: string;
  userId: string;
  feature: string;
  creditKind: SellerAiCreditKind;
  input: Record<string, unknown>;
  prompt: Prompt;
  /** Content schema only (no provider/model/tokens) — those are attached after generateJson. */
  schema: S;
  /** Separate daily bucket (e.g. chat), instead of the shared seller AI limit. */
  limit?: { key: string; perDay: number; message: string };
  /** Optional Edge Function fallback after in-process failure (e.g. merchant-assistant). */
  edgeFallback?: { name: SellerAiFunction; body: Record<string, unknown> };
}): Promise<SellerAiOutcome<z.output<S> & { provider: AiProvider; model: string; tokens: number | null }>> {
  const providers = await loadProviders(args.feature);
  if (!providers.length) {
    throw new AppError("VALIDATION", { fieldErrors: { _form: [SETUP_MESSAGE] }, context: { reason: "ai_not_configured" } });
  }
  try {
    await rateLimit(args.limit?.key ?? "seller-ai", args.tenantId, args.limit?.perDay ?? DAILY_LIMIT, 86_400);
  } catch (err) {
    if (err instanceof AppError && err.code === "RATE_LIMITED") throw new AppError("RATE_LIMITED", { fieldErrors: { _form: [args.limit?.message ?? LIMIT_MESSAGE] } });
    throw err;
  }
  const charge = await debitAiCredit(args.tenantId, args.creditKind);
  let generated: { data: z.output<S>; provider: AiProvider; model: string; tokens: number | null };
  try {
    const ordered = orderForImages(providers, !!args.prompt.images?.length);
    try {
      generated = await generateJson(ordered, args.prompt, args.schema);
    } catch (err) {
      if (!(err instanceof LlmError) || err.reason !== "failed" || !args.edgeFallback) throw err;
      // Optional Edge fallback (in-process remains primary).
      const edgeMeta = z
        .object({
          provider: z.enum(["nvidia", "gemini", "groq", "anthropic"]),
          model: z.string().max(100),
          tokens: z.number().nullable().optional(),
        })
        .passthrough();
      const edge = await invokeSellerAi(args.edgeFallback.name, providers, args.edgeFallback.body, edgeMeta);
      const parsed = args.schema.safeParse(edge);
      if (!parsed.success) throw err;
      generated = { data: parsed.data, provider: edge.provider, model: edge.model, tokens: edge.tokens ?? null };
      logger.info("seller_ai.edge_fallback_ok", {
        tenantId: args.tenantId,
        kind: args.creditKind,
        name: args.edgeFallback.name,
        provider: edge.provider,
      });
    }
  } catch (err) {
    await refundAiCredit(charge, err instanceof Error ? err.message : "seller AI failed");
    if (err instanceof LlmError) {
      logger.warn("seller_ai.generation_failed", { tenantId: args.tenantId, kind: args.creditKind, failures: err.failures });
      if (err.reason === "not_configured") {
        throw new AppError("VALIDATION", { fieldErrors: { _form: [SETUP_MESSAGE] }, context: { reason: "ai_not_configured" } });
      }
      throw new AppError("INTERNAL", {
        fieldErrors: { _form: [friendlySellerAiFailure(err.failures)] },
        context: { failures: err.failures },
      });
    }
    throw err;
  }
  const data = {
    ...(generated.data as Record<string, unknown>),
    provider: generated.provider,
    model: generated.model,
    tokens: generated.tokens,
  } as z.output<S> & { provider: AiProvider; model: string; tokens: number | null };
  const { error } = await createSupabaseAdminClient()
    .from("ai_generations")
    .insert({
      tenant_id: args.tenantId,
      kind: args.creditKind,
      input: args.input as Json,
      output: data as Json,
      provider: generated.provider.slice(0, 40),
      model: generated.model.slice(0, 100) || null,
      tokens: generated.tokens == null ? null : Math.round(generated.tokens),
      created_by: args.userId,
    });
  if (error) logger.warn("seller_ai.log_failed", { tenantId: args.tenantId, kind: args.creditKind, code: error.code });
  logger.info("seller_ai.generated", { tenantId: args.tenantId, kind: args.creditKind, provider: generated.provider, model: generated.model });
  return { data, charge, provider: generated.provider, model: generated.model, tokens: generated.tokens };
}

/** Convert an uploaded File into a base64 image payload for vision prompts. */
export async function fileToImagePayload(file: File): Promise<PromptImage | null> {
  const type = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (type !== "image/png" && type !== "image/jpeg" && type !== "image/webp") return null;
  if (file.size < 32 || file.size > 3_500_000) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  return { mediaType: type, data: buf.toString("base64") };
}

/** Best-effort https image URL → PromptImage (skips bad URLs; size-capped). */
export async function fetchHttpsImages(urls: string[]): Promise<PromptImage[]> {
  const out: PromptImage[] = [];
  for (const url of urls.slice(0, 4)) {
    if (!/^https:\/\//i.test(url)) continue;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: "follow", cache: "no-store" });
      if (!res.ok) continue;
      const ct = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
      const mediaType =
        ct === "image/png" || ct === "image/webp" || ct === "image/jpeg" || ct === "image/jpg"
          ? ((ct === "image/jpg" ? "image/jpeg" : ct) as PromptImage["mediaType"])
          : null;
      if (!mediaType) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength < 32 || buf.byteLength > 3_500_000) continue;
      out.push({ mediaType, data: buf.toString("base64") });
    } catch {
      /* skip bad URLs */
    }
  }
  return out;
}

/**
 * Dashboard / wallet page summary: balance, credits used and time saved over the last 30 days.
 * Read with the seller's session (RLS: own store's ledger only). Unavailable while the credits
 * migration is pending. Money saved is computed by callers via minutesSaved × freelancer rate.
 */
export async function getAiWalletSummary(tenantId: string, now = new Date()): Promise<WalletSummary> {
  const balance = await getAiCreditBalance(tenantId);
  if (balance === null) return summarizeWallet(null, [], {});
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const supabase = await createSupabaseServerClient();
  const [ledger, costs] = await Promise.all([
    supabase.from("ai_credit_ledger").select("id, delta, kind, note, reference_id, created_at").eq("tenant_id", tenantId).in("kind", ["usage", "usage_refund"]).gte("created_at", since).order("created_at", { ascending: false }).limit(1000),
    supabase.from("ai_credit_action_costs").select("kind, minutes_saved"),
  ]);
  if (ledger.error) logger.warn("seller_ai.wallet_ledger_unavailable", { code: ledger.error.code });
  const minutes: Record<string, number> = {};
  for (const c of costs.data ?? []) minutes[c.kind] = c.minutes_saved;
  const rows = (ledger.data ?? []).map((r) => ({ id: r.id, delta: r.delta, kind: r.kind, note: r.note, referenceId: r.reference_id, createdAt: r.created_at }));
  return summarizeWallet(balance, rows, minutes);
}
