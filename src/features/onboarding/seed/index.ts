/**
 * Voice onboarding → ready store seed (Sarvam).
 *
 * Public API:
 *  - seedReadyStoreAction(input)     — owner-gated server action
 *  - seedReadyStore(ctx, input)      — orchestrated pipeline (theme + generate + persist)
 *  - pickBestMarketplaceTheme / listRankedMarketplaceThemes / applyBestFitTheme / pickMarketplaceThemePair
 *  - generateReadyStorePlan / parseReadyStorePlan
 *  - persistReadyStore
 *  - schemas: seedReadyStoreInputSchema, readyStorePlanSchema, SeedReadyStoreResult
 */

export { seedReadyStoreAction } from "./actions";
export { seedReadyStore, type SeedReadyStoreArgs } from "./pipeline";
export {
  pickBestMarketplaceTheme,
  listRankedMarketplaceThemes,
  pickMarketplaceThemePair,
  applyBestFitTheme,
} from "./theme-pick";
export { generateReadyStorePlan, parseReadyStorePlan } from "./generate";
export { persistReadyStore } from "./persist";
export { READY_STORE_COUNTS } from "./counts";
export { buildFallbackReadyStorePlan, catalogFor } from "./fallback";
export { withSamplePrefix } from "./sample-title";
export {
  seedReadyStoreInputSchema,
  readyStorePlanSchema,
  type SeedReadyStoreInput,
  type ReadyStorePlan,
  type SeedReadyStoreResult,
} from "./schemas";
