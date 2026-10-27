/**
 * Business coach contracts. Pure — safe for client and server.
 */
import { z } from "zod";

export const BUSINESS_COACH_KIND = "business_coach" as const;

export const businessCoachTip = z.object({
  title: z.string().trim().min(1).max(80),
  detail: z.string().trim().min(1).max(320),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
});
export type BusinessCoachTip = z.infer<typeof businessCoachTip>;

export const businessCoachOutput = z.object({
  headline: z.string().trim().min(1).max(120),
  focus: z.string().trim().min(1).max(280),
  tips: z.array(businessCoachTip).min(1).max(6),
});
export type BusinessCoachOutput = z.infer<typeof businessCoachOutput>;

export const businessCoachInput = z.object({
  focus: z.enum(["catalog", "orders", "marketing", "conversion", "operations", "auto"]).default("auto"),
});
export type BusinessCoachInput = z.infer<typeof businessCoachInput>;

/** Default credits when the economy migration cost row is not readable yet. */
export const BUSINESS_COACH_FALLBACK_CREDITS = 1;
