import "server-only";
import { AppError } from "@/lib/errors";
import { toMinor } from "@/lib/money";
import { assertPlatformPermission, type PlatformContext } from "@/lib/platform/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSarvamConfigured } from "@/lib/sarvam/client";
import { isMissingSchemaError } from "@/features/platform/schemas";
import { getAiProviderOrder, getAppCredential } from "@/features/platform-apps/server";
import { AI_PROVIDERS, type AiProvider } from "@/features/neural-pulse/schemas";
import { DEFAULT_MODELS, resolveModel } from "@/features/neural-pulse/server/llm";
import { AI_FEATURES, type FeatureRoute } from "./registry";
import { modelKey, tokenCostMinor } from "./schemas";

export type ProviderStatus = { id: AiProvider | "sarvam"; configured: boolean; defaultModel: string };
export type ModelUsageRow = { provider: string; model: string; calls: number; tokens: number; pricePerMillionMinor: number | null; costMinor: number; inRoutes: boolean };

export type AiHealthOverview = {
  available: boolean;
  providers: ProviderStatus[];
  routes: Record<string, FeatureRoute>;
  models: ModelUsageRow[];
  stats: { features: number; apisConnected: number; apisTotal: number; uniqueModels: number; calls30d: number; tokens30d: number; costMinor30d: number };
};

const isProvider = (v: unknown): v is AiProvider => (AI_PROVIDERS as readonly unknown[]).includes(v);

/** Providers configured (booleans and model names only; keys never leave platform-apps). */
async function providerStatus(): Promise<ProviderStatus[]> {
  const configured = new Set(await getAiProviderOrder());
  const llm = await Promise.all(
    AI_PROVIDERS.map(async (id) => {
      const cred = configured.has(id) ? await getAppCredential(id) : null;
      return { id, configured: configured.has(id), defaultModel: resolveModel(id, cred?.extra.model) };
    }),
  );
  return [...llm, { id: "sarvam" as const, configured: isSarvamConfigured(), defaultModel: "sarvam-105b-conversations" }];
}

export async function getAiHealthOverview(ctx: PlatformContext): Promise<AiHealthOverview> {
  assertPlatformPermission(ctx, "platform.settings.manage");
  const supabase = await createSupabaseServerClient();
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [providers, routesRes, usageRes, pricesRes] = await Promise.all([
    providerStatus(),
    supabase.from("ai_feature_routes").select("feature_key, primary_provider, primary_model, fallback_provider, fallback_model, enabled"),
    supabase.rpc("platform_ai_usage", { p_from: from }),
    supabase.from("ai_model_prices").select("provider, model, price_per_million"),
  ]);
  const firstError = routesRes.error ?? usageRes.error ?? pricesRes.error;
  const available = !firstError;
  if (firstError && !isMissingSchemaError(firstError)) throw new AppError("INTERNAL", { context: { operation: "ai_health_overview", code: firstError.code } });

  const routes: Record<string, FeatureRoute> = {};
  for (const r of available ? (routesRes.data ?? []) : []) {
    if (!isProvider(r.primary_provider)) continue;
    routes[r.feature_key] = { featureKey: r.feature_key, primaryProvider: r.primary_provider, primaryModel: r.primary_model, fallbackProvider: isProvider(r.fallback_provider) ? r.fallback_provider : null, fallbackModel: r.fallback_model, enabled: r.enabled };
  }
  const defaults = new Map(providers.map((p) => [p.id, p.defaultModel]));
  const routeModels = new Set<string>();
  for (const r of Object.values(routes)) {
    routeModels.add(modelKey(r.primaryProvider, r.primaryModel || (defaults.get(r.primaryProvider) ?? DEFAULT_MODELS[r.primaryProvider])));
    if (r.fallbackProvider) routeModels.add(modelKey(r.fallbackProvider, r.fallbackModel || (defaults.get(r.fallbackProvider) ?? DEFAULT_MODELS[r.fallbackProvider])));
  }
  // Configured providers' default models are what un-routed features use.
  for (const p of providers) if (p.configured && p.id !== "sarvam") routeModels.add(modelKey(p.id, p.defaultModel));

  const prices = new Map<string, number>();
  for (const p of available ? (pricesRes.data ?? []) : []) prices.set(modelKey(p.provider, p.model), toMinor(String(p.price_per_million)));

  const rows = new Map<string, ModelUsageRow>();
  for (const u of available ? (usageRes.data ?? []) : []) {
    const key = modelKey(u.provider, u.model);
    const price = prices.get(key) ?? null;
    const tokens = Number(u.tokens);
    rows.set(key, { provider: u.provider, model: u.model, calls: u.calls, tokens, pricePerMillionMinor: price, costMinor: price == null ? 0 : tokenCostMinor(tokens, price), inRoutes: routeModels.has(key) });
  }
  for (const key of [...routeModels, ...prices.keys()]) {
    if (rows.has(key)) continue;
    const [provider = "", ...rest] = key.split(":");
    const model = rest.join(":");
    rows.set(key, { provider, model, calls: 0, tokens: 0, pricePerMillionMinor: prices.get(key) ?? null, costMinor: 0, inRoutes: routeModels.has(key) });
  }
  const models = [...rows.values()].sort((a, b) => b.calls - a.calls || a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model));
  const llmConnected = providers.filter((p) => p.configured).length;
  return {
    available,
    providers,
    routes,
    models,
    stats: {
      features: AI_FEATURES.length,
      apisConnected: llmConnected,
      apisTotal: providers.length,
      uniqueModels: new Set(models.filter((m) => m.calls > 0 || m.inRoutes).map((m) => modelKey(m.provider, m.model))).size,
      calls30d: models.reduce((n, m) => n + m.calls, 0),
      tokens30d: models.reduce((n, m) => n + m.tokens, 0),
      costMinor30d: models.reduce((n, m) => n + m.costMinor, 0),
    },
  };
}
