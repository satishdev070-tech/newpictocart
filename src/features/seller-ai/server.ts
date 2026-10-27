import "server-only";
import type { z } from "zod";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import type { Json } from "@/lib/supabase/database.types";
import { debitAiCredit, refundAiCredit } from "@/features/ai-credits/server";
import { loadProviders } from "@/features/neural-pulse/server/generate";
import { LlmError, generateJson, type ProviderConfig } from "@/features/neural-pulse/server/llm";
import type { Prompt } from "@/features/neural-pulse/prompts";
import { invokeSellerAi, SELLER_AI_FAILED, SELLER_AI_SETUP, type SellerAiFunction } from "./invoke";
import { blogWritePrompt, contactReplyPrompt, type StoreBrief } from "./prompts";
import {
  contactReplyDraftSchema,
  contactReplyEdgeResponse,
  generateBlogDraftSchema,
  generateBlogEdgeResponse,
  type ContactReplyDraft,
  type GenerateBlogDraft,
  type SellerAiKind,
} from "./schemas";

const DAILY_LIMIT = 40;
const LIMIT_MESSAGE = `You've used today's ${DAILY_LIMIT} seller AI generations for this store. Try again tomorrow.`;

export type SellerAiOutcome<T> = { id: string | null; data: T; provider: string; model: string; tokens: number | null };

async function loadStoreBrief(tenantId: string): Promise<StoreBrief> {
  const supabase = await createSupabaseServerClient();
  const { data: store } = await supabase.from("stores").select("name, tagline, description, category_id").eq("tenant_id", tenantId).maybeSingle();
  let industry: string | null = null;
  if (store?.category_id) {
    const { data } = await supabase.from("store_categories").select("name").eq("id", store.category_id).maybeSingle();
    industry = data?.name ?? null;
  }
  return {
    name: store?.name ?? "Store",
    tagline: store?.tagline ?? null,
    description: store?.description ?? null,
    industry,
  };
}

async function logGeneration(args: {
  tenantId: string;
  userId: string;
  kind: SellerAiKind;
  input: Record<string, unknown>;
  output: unknown;
  provider: string;
  model: string;
  tokens: number | null;
}): Promise<string | null> {
  const { data, error } = await createSupabaseAdminClient()
    .from("ai_generations")
    .insert({
      tenant_id: args.tenantId,
      kind: args.kind,
      input: args.input as Json,
      output: args.output as Json,
      provider: args.provider.slice(0, 40),
      model: args.model.slice(0, 100),
      tokens: args.tokens == null ? null : Math.round(args.tokens),
      created_by: args.userId,
    })
    .select("id")
    .single();
  if (error) {
    logger.warn("seller_ai.log_failed", { tenantId: args.tenantId, kind: args.kind, code: error.code });
    return null;
  }
  return data.id;
}

/**
 * Shared charged generation path for seller AI (Phase 2 blog/contact; Phase 1 product-generate
 * should reuse this). Debits `kind`, invokes the Edge Function with platform provider keys, refunds
 * on failure, and logs `ai_generations`. Falls back to in-process `generateJson` when the Edge
 * Function is unreachable (local stacks without `supabase functions serve`).
 */
export async function runChargedSellerAiEdge<Edge extends z.ZodType, Local extends z.ZodType>(args: {
  tenantId: string;
  userId: string;
  kind: SellerAiKind;
  featureKey: string;
  functionName: SellerAiFunction;
  edgeBody: Record<string, unknown>;
  edgeSchema: Edge;
  pick: (edge: z.output<Edge>) => { data: unknown; provider: string; model: string; tokens: number | null };
  /** Used only when the Edge Function is unavailable. */
  localPrompt: Prompt;
  localSchema: Local;
}): Promise<SellerAiOutcome<z.output<Local>>> {
  const providers = await loadProviders(args.featureKey);
  if (!providers.length) throw new AppError("VALIDATION", { fieldErrors: { _form: [SELLER_AI_SETUP] }, context: { reason: "ai_not_configured" } });
  try {
    await rateLimit("seller-ai", args.tenantId, DAILY_LIMIT, 86_400);
  } catch (err) {
    if (err instanceof AppError && err.code === "RATE_LIMITED") throw new AppError("RATE_LIMITED", { fieldErrors: { _form: [LIMIT_MESSAGE] } });
    throw err;
  }

  const charge = await debitAiCredit(args.tenantId, args.kind);
  let picked: { data: unknown; provider: string; model: string; tokens: number | null };
  try {
    picked = await callEdgeOrLocal(providers, args);
  } catch (err) {
    await refundAiCredit(charge, err instanceof Error ? err.message : "Seller AI failed");
    if (err instanceof AppError) throw err;
    if (err instanceof LlmError) {
      logger.warn("seller_ai.failed", { tenantId: args.tenantId, kind: args.kind, failures: err.failures });
      throw new AppError("INTERNAL", { fieldErrors: { _form: [SELLER_AI_FAILED] }, context: { failures: err.failures } });
    }
    throw err;
  }

  const localParsed = args.localSchema.safeParse(picked.data);
  if (!localParsed.success) {
    await refundAiCredit(charge, "Seller AI schema failed after generation");
    throw new AppError("INTERNAL", { fieldErrors: { _form: [SELLER_AI_FAILED] }, context: { reason: "local_schema" } });
  }

  const id = await logGeneration({
    tenantId: args.tenantId,
    userId: args.userId,
    kind: args.kind,
    input: args.edgeBody,
    output: localParsed.data,
    provider: picked.provider,
    model: picked.model,
    tokens: picked.tokens,
  });
  logger.info("seller_ai.generated", { tenantId: args.tenantId, kind: args.kind, provider: picked.provider, model: picked.model });
  return { id, data: localParsed.data, provider: picked.provider, model: picked.model, tokens: picked.tokens };
}

async function callEdgeOrLocal<S extends z.ZodType>(
  providers: ProviderConfig[],
  args: {
    functionName: SellerAiFunction;
    edgeBody: Record<string, unknown>;
    edgeSchema: S;
    pick: (edge: z.output<S>) => { data: unknown; provider: string; model: string; tokens: number | null };
    localPrompt: Prompt;
    localSchema: z.ZodType;
    tenantId: string;
    kind: SellerAiKind;
  },
): Promise<{ data: unknown; provider: string; model: string; tokens: number | null }> {
  try {
    const edge = await invokeSellerAi(args.functionName, providers, args.edgeBody, args.edgeSchema);
    return args.pick(edge);
  } catch (err) {
    const reason = err instanceof AppError ? String(err.context?.reason ?? "") : "";
    if (reason !== "edge_network" && reason !== "edge_http") throw err;
    logger.warn("seller_ai.edge_fallback_local", { tenantId: args.tenantId, kind: args.kind, reason });
    const local = await generateJson(providers, args.localPrompt, args.localSchema);
    return { data: local.data, provider: local.provider, model: local.model, tokens: local.tokens };
  }
}

export async function generateBlogDraft(args: {
  tenantId: string;
  userId: string;
  topic: string;
  tone?: string;
  language?: string;
}): Promise<SellerAiOutcome<GenerateBlogDraft>> {
  const store = await loadStoreBrief(args.tenantId);
  const prompt = blogWritePrompt({ store, topic: args.topic, tone: args.tone, language: args.language });
  return runChargedSellerAiEdge({
    tenantId: args.tenantId,
    userId: args.userId,
    kind: "generate_blog",
    featureKey: "generate_blog",
    functionName: "generate-blog",
    edgeBody: {
      topic: args.topic,
      tone: args.tone ?? null,
      language: args.language ?? "en-IN",
      storeName: store.name,
      locale: args.language ?? "en-IN",
      system: prompt.system,
      user: prompt.user,
    },
    edgeSchema: generateBlogEdgeResponse,
    pick: (edge) => {
      const { provider, model, tokens, ...data } = edge;
      return { data, provider, model, tokens: tokens ?? null };
    },
    localPrompt: prompt,
    localSchema: generateBlogDraftSchema,
  });
}

export async function draftContactReply(args: {
  tenantId: string;
  userId: string;
  messageId: string;
}): Promise<SellerAiOutcome<ContactReplyDraft>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("contact_messages")
    .select("id, name, email, subject, message")
    .eq("tenant_id", args.tenantId)
    .eq("id", args.messageId)
    .maybeSingle();
  if (error || !data) throw new AppError("NOT_FOUND", { fieldErrors: { messageId: ["Message not found."] } });
  const store = await loadStoreBrief(args.tenantId);
  const prompt = contactReplyPrompt({
    store,
    name: data.name,
    email: data.email,
    subject: data.subject,
    message: data.message,
  });
  return runChargedSellerAiEdge({
    tenantId: args.tenantId,
    userId: args.userId,
    kind: "draft_contact_reply",
    featureKey: "draft_contact_reply",
    functionName: "generate-contact-reply",
    edgeBody: {
      name: data.name,
      email: data.email,
      subject: data.subject ?? "",
      message: data.message,
      storeName: store.name,
      system: prompt.system,
      user: prompt.user,
    },
    edgeSchema: contactReplyEdgeResponse,
    pick: (edge) => {
      const { provider, model, tokens, ...draft } = edge;
      return { data: draft, provider, model, tokens: tokens ?? null };
    },
    localPrompt: prompt,
    localSchema: contactReplyDraftSchema,
  });
}
