/**
 * Pure provider ordering for runGeneration / loadProviders (unit tested, no I/O).
 * With an enabled route: [primary(model), fallback(model)] restricted to configured providers.
 * Without a route, with a disabled one, or when none of its providers is configured: the platform
 * order (today's behaviour), so a stale route never switches AI off.
 */
import type { AiProvider } from "@/features/neural-pulse/schemas";
import type { FeatureRoute } from "./registry";

export type RoutableProvider = { id: AiProvider; apiKey: string; model: string };

export function routeProviders<P extends RoutableProvider>(configured: readonly P[], route: Pick<FeatureRoute, "primaryProvider" | "primaryModel" | "fallbackProvider" | "fallbackModel" | "enabled"> | null | undefined): P[] {
  if (!route || !route.enabled) return [...configured];
  const steps: { id: AiProvider; model: string | null }[] = [{ id: route.primaryProvider, model: route.primaryModel }];
  if (route.fallbackProvider) steps.push({ id: route.fallbackProvider, model: route.fallbackModel });
  const out: P[] = [];
  for (const step of steps) {
    const base = configured.find((p) => p.id === step.id);
    if (!base) continue;
    const model = step.model || base.model;
    if (out.some((p) => p.id === step.id && p.model === model)) continue;
    out.push({ ...base, model });
  }
  return out.length ? out : [...configured];
}
