"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { toDecimalString } from "@/lib/money";
import { logger } from "@/lib/observability/logger";
import { assertPlatformPermission, getPlatformContext } from "@/lib/platform/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/features/platform/schemas";
import { getAppCredential } from "@/features/platform-apps/server";
import { LlmError, generateJson, resolveModel } from "@/features/neural-pulse/server/llm";
import { featureRouteSchema, modelPriceSchema, resetFeatureRouteSchema, testModelSchema, type TestResult } from "./schemas";

const PATH = "/admin/ai-health";
const PENDING = "AI health needs migration 20261025003900_ai_economy.sql. Apply it, then try again.";

async function platformActor() {
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  assertPlatformPermission(ctx, "platform.settings.manage");
  return ctx;
}

function dbFail(error: { code?: string }, operation: string): never {
  if (isMissingSchemaError(error)) throw new AppError("CONFLICT", { fieldErrors: { _form: [PENDING] }, context: { code: error.code } });
  if (error.code === "23514") throw new AppError("VALIDATION", { fieldErrors: { _form: ["These values are not allowed. Check the provider and model names."] } });
  throw new AppError("INTERNAL", { context: { operation, code: error.code } });
}

export async function saveFeatureRouteAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.aiHealth.route.save", async () => {
    const input = parseInput(featureRouteSchema, formToObject(fd));
    const ctx = await platformActor();
    const row = {
      feature_key: input.featureKey,
      primary_provider: input.primaryProvider,
      primary_model: input.primaryModel ?? null,
      fallback_provider: input.fallbackProvider ?? null,
      fallback_model: input.fallbackProvider ? (input.fallbackModel ?? null) : null,
      enabled: input.enabled,
      updated_by: ctx.user.id,
    };
    const { error } = await (await createSupabaseServerClient()).from("ai_feature_routes").upsert(row, { onConflict: "feature_key" });
    if (error) dbFail(error, "ai_feature_route_save");
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "ai_health.route_saved", entityType: "ai_feature_route", entityId: input.featureKey, metadata: { primary: `${row.primary_provider}:${row.primary_model ?? "default"}`, fallback: row.fallback_provider ? `${row.fallback_provider}:${row.fallback_model ?? "default"}` : null, enabled: row.enabled } });
  });
  if (result.ok) revalidatePath(PATH);
  return result;
}

export async function resetFeatureRouteAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.aiHealth.route.reset", async () => {
    const input = parseInput(resetFeatureRouteSchema, formToObject(fd));
    const ctx = await platformActor();
    const { error } = await (await createSupabaseServerClient()).from("ai_feature_routes").delete().eq("feature_key", input.featureKey);
    if (error) dbFail(error, "ai_feature_route_reset");
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "ai_health.route_reset", entityType: "ai_feature_route", entityId: input.featureKey });
  });
  if (result.ok) revalidatePath(PATH);
  return result;
}

export async function saveModelPriceAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.aiHealth.price.save", async () => {
    const input = parseInput(modelPriceSchema, formToObject(fd));
    const ctx = await platformActor();
    const { error } = await (await createSupabaseServerClient())
      .from("ai_model_prices")
      .upsert({ provider: input.provider, model: input.model, price_per_million: Number(toDecimalString(input.pricePerMillionMinor)), updated_by: ctx.user.id }, { onConflict: "provider,model" });
    if (error) dbFail(error, "ai_model_price_save");
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "ai_health.price_saved", entityType: "ai_model_price", entityId: `${input.provider}:${input.model}`, metadata: { pricePerMillionMinor: input.pricePerMillionMinor } });
  });
  if (result.ok) revalidatePath(PATH);
  return result;
}

const TEST_PROMPT = { system: "You are a health check. Reply with JSON only.", user: 'Return exactly this JSON object: {"ok":true}' };
const testOutput = z.object({ ok: z.literal(true) });
const TEST_LIMIT_PER_HOUR = 20;

/**
 * One tiny JSON call to ONE provider (no fallback) with the platform key. Reports ok, latency and a
 * key-free failure reason. Rate limited per admin and audited; nothing is logged in ai_generations.
 */
export async function testModelAction(_prev: ActionResult<TestResult> | null, fd: FormData): Promise<ActionResult<TestResult>> {
  return runAction("platform.aiHealth.test", async () => {
    const input = parseInput(testModelSchema, formToObject(fd));
    const ctx = await platformActor();
    try {
      await rateLimit("ai-health-test", ctx.user.id, TEST_LIMIT_PER_HOUR, 3600);
    } catch (err) {
      if (err instanceof AppError && err.code === "RATE_LIMITED") throw new AppError("RATE_LIMITED", { fieldErrors: { _form: [`You can run ${TEST_LIMIT_PER_HOUR} AI tests an hour. Try again later.`] } });
      throw err;
    }
    const cred = await getAppCredential(input.provider);
    const model = input.model ?? resolveModel(input.provider, cred?.extra.model);
    let out: TestResult;
    if (!cred?.secret) {
      out = { ok: false, provider: input.provider, model, latencyMs: 0, error: "No API key is set for this provider (Admin → Social apps)." };
    } else {
      const started = Date.now();
      try {
        await generateJson([{ id: input.provider, apiKey: cred.secret, model }], TEST_PROMPT, testOutput);
        out = { ok: true, provider: input.provider, model, latencyMs: Date.now() - started, error: null };
      } catch (err) {
        const reason = err instanceof LlmError ? (err.failures[0]?.error ?? "failed") : "unexpected error";
        out = { ok: false, provider: input.provider, model, latencyMs: Date.now() - started, error: reason.slice(0, 200) };
        logger.warn("ai_health.test_failed", { provider: input.provider, model, error: out.error });
      }
    }
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "ai_health.tested", entityType: "ai_feature_route", entityId: input.featureKey ?? `${input.provider}:${model}`, metadata: { provider: input.provider, model, ok: out.ok, latencyMs: out.latencyMs, error: out.error } });
    return out;
  });
}
