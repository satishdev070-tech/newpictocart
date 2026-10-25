/** AI Health contracts: route / model price / test inputs and the token cost maths (pure). */
import { z } from "zod";
import { AI_PROVIDERS } from "@/features/neural-pulse/schemas";
import { checkbox } from "@/lib/actions/form";
import { toMinor } from "@/lib/money";
import { ROUTABLE_FEATURE_KEYS } from "./registry";

export const AI_HEALTH_TABS = ["features", "models"] as const;
export type AiHealthTab = (typeof AI_HEALTH_TABS)[number];
export const aiHealthTab = (v: unknown): AiHealthTab => ((AI_HEALTH_TABS as readonly unknown[]).includes(v) ? (v as AiHealthTab) : "features");

/** Same pattern as the SQL check and llm.ts resolveModel. */
export const MODEL_RE = /^[a-zA-Z0-9][a-zA-Z0-9._/:-]{1,99}$/;

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v);
const optionalModel = z.preprocess(blank, z.string().regex(MODEL_RE, "Use letters, digits and . _ / : - only").optional());
const optionalProvider = z.preprocess((v) => (v === "none" ? undefined : blank(v)), z.enum(AI_PROVIDERS).optional());

export const featureRouteSchema = z
  .object({
    featureKey: z.enum(ROUTABLE_FEATURE_KEYS as [string, ...string[]], { error: "Unknown AI feature" }),
    primaryProvider: z.enum(AI_PROVIDERS, { error: "Choose a provider" }),
    primaryModel: optionalModel,
    fallbackProvider: optionalProvider,
    fallbackModel: optionalModel,
    enabled: z.preprocess(checkbox, z.boolean()),
  })
  .superRefine((v, ctx) => {
    if (!v.fallbackProvider && v.fallbackModel) ctx.addIssue({ code: "custom", path: ["fallbackModel"], message: "Choose a fallback provider for this model" });
    if (v.fallbackProvider && v.fallbackProvider === v.primaryProvider && (v.fallbackModel ?? "") === (v.primaryModel ?? "")) ctx.addIssue({ code: "custom", path: ["fallbackProvider"], message: "The fallback must differ from the primary" });
  });
export type FeatureRouteInput = z.infer<typeof featureRouteSchema>;

export const resetFeatureRouteSchema = z.object({ featureKey: z.enum(ROUTABLE_FEATURE_KEYS as [string, ...string[]]) });

export const PRICED_PROVIDERS = [...AI_PROVIDERS, "sarvam"] as const;

/** ₹ per 1M tokens typed as "12.50" → paise. */
export const rupeesField = (max: number) =>
  z.preprocess(
    blank,
    z
      .string({ error: "Enter an amount" })
      .regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an amount like 12 or 12.50")
      .transform((v) => toMinor(v))
      .refine((v) => v <= max, "Amount is too large"),
  );

export const modelPriceSchema = z.object({
  provider: z.enum(PRICED_PROVIDERS),
  model: z.string().trim().regex(MODEL_RE, "Invalid model name"),
  pricePerMillionMinor: rupeesField(99_999_999),
});

export const testModelSchema = z.object({
  featureKey: z.preprocess(blank, z.string().regex(/^[a-z_]{2,60}$/).optional()),
  provider: z.enum(AI_PROVIDERS),
  model: optionalModel,
});

export type TestResult = { ok: boolean; provider: string; model: string; latencyMs: number; error: string | null };

/** AI cost in paise: tokens × (paise per 1M tokens) / 1M, rounded to the nearest paisa. */
export function tokenCostMinor(tokens: number, pricePerMillionMinor: number): number {
  if (!Number.isFinite(tokens) || tokens <= 0 || pricePerMillionMinor <= 0) return 0;
  return Math.round((tokens * pricePerMillionMinor) / 1_000_000);
}

export const modelKey = (provider: string, model: string) => `${provider}:${model}`;
