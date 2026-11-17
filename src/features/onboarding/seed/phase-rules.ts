import { readyStorePlanSchema, type ReadyStorePlan } from "./schemas";

/** Audit action whose metadata.plan caches the generated ready-store plan for a tenant. */
export const SEED_PLAN_AUDIT_ACTION = "onboarding.seed_plan_generated" as const;
/** Audit action written once the whole ready-store seed finished. */
export const SEED_READY_AUDIT_ACTION = "onboarding.ready_store_seeded" as const;
/** metadata.source on the theme.marketplace_applied row the seed writes (marks the theme step done). */
export const SEED_THEME_SOURCE = "onboarding_seed" as const;

/** Plan from a cache row's metadata, or null when missing / no longer valid. PURE. */
export function parseCachedSeedPlan(metadata: unknown): ReadyStorePlan | null {
  if (!metadata || typeof metadata !== "object") return null;
  const parsed = readyStorePlanSchema.safeParse((metadata as { plan?: unknown }).plan);
  return parsed.success ? parsed.data : null;
}
