import { z } from "zod";
import { toMinor } from "@/lib/money";
import type { MarketingPlan } from "./plan-view";

export * from "./plan-view";

/**
 * Plan-row parsing for the marketing site (types and display helpers live in plan-view.ts and are
 * re-exported here). Plan rows come from `public.plans` (anon-readable when active). PostgREST
 * returns numeric columns as JS numbers in rupees, so every price is converted to integer paise
 * with `toMinor()` before any arithmetic.
 */

/** Shape of the columns we select from `public.plans`. */
export type PlanRow = {
  code: string;
  name: string;
  description: string | null;
  price_monthly: number | string;
  price_yearly: number | string;
  currency: string;
  limits: unknown;
  features: unknown;
  trial_days: number;
  sort_order: number;
  active: boolean;
};

const optionalCount = z.number().int().nonnegative().nullable().catch(null);

const limitsSchema = z
  .object({
    products: optionalCount.optional(),
    staff: optionalCount.optional(),
    storage_mb: optionalCount.optional(),
    custom_domains: optionalCount.optional(),
  })
  .catch({});

const flag = z.boolean().catch(false);

const featuresSchema = z
  .object({
    custom_domains: flag.optional(),
    blog: flag.optional(),
    store_locator: flag.optional(),
    analytics_export: flag.optional(),
  })
  .catch({});

function safeMinor(value: number | string): number | null {
  try {
    const minor = toMinor(value);
    return minor >= 0 ? minor : null;
  } catch {
    return null;
  }
}

/** Maps one DB row to a display model. Returns null for rows that cannot be priced safely. */
export function parsePlanRow(row: PlanRow): MarketingPlan | null {
  if (!row.active) return null;
  if (row.currency !== "INR") return null;
  const monthlyMinor = safeMinor(row.price_monthly);
  const yearlyMinor = safeMinor(row.price_yearly);
  if (monthlyMinor === null || yearlyMinor === null) return null;
  const name = row.name.trim();
  if (!name) return null;

  const limits = limitsSchema.parse(row.limits ?? {});
  const features = featuresSchema.parse(row.features ?? {});

  return {
    code: row.code,
    name,
    description: row.description?.trim() ?? "",
    monthlyMinor,
    yearlyMinor,
    currency: "INR",
    trialDays: Number.isInteger(row.trial_days) && row.trial_days > 0 ? row.trial_days : 0,
    limits: {
      products: limits.products ?? null,
      staff: limits.staff ?? null,
      storageMb: limits.storage_mb ?? null,
      customDomains: limits.custom_domains ?? null,
    },
    features: {
      customDomains: features.custom_domains ?? false,
      blog: features.blog ?? false,
      storeLocator: features.store_locator ?? false,
      analyticsExport: features.analytics_export ?? false,
    },
  };
}

/** Active, valid plans in display order. */
export function normalizePlans(rows: readonly PlanRow[]): MarketingPlan[] {
  return [...rows]
    .filter((r) => r.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code))
    .map(parsePlanRow)
    .filter((p): p is MarketingPlan => p !== null);
}

/**
 * Mirror of the plans seeded in `supabase/migrations/20260924000600_reference_data.sql`.
 * Shown only when the database cannot be reached (e.g. a build without env), so the
 * page still renders; the route revalidates and picks up live prices afterwards.
 */
export const FALLBACK_PLANS: MarketingPlan[] = normalizePlans([
  {
    code: "free",
    name: "Free",
    description: "Free forever for getting started — up to 10 products",
    price_monthly: 0,
    price_yearly: 0,
    currency: "INR",
    limits: { products: 10, staff: 1, storage_mb: 512, custom_domains: 0 },
    features: { custom_domains: false, blog: true },
    trial_days: 0,
    sort_order: 0,
    active: true,
  },
  {
    code: "starter",
    name: "Starter",
    description: "For new labels getting online",
    price_monthly: 999,
    price_yearly: 9990,
    currency: "INR",
    limits: { products: 200, staff: 2, storage_mb: 2048, custom_domains: 0 },
    features: { custom_domains: false, blog: true },
    trial_days: 14,
    sort_order: 1,
    active: true,
  },
  {
    code: "growth",
    name: "Growth",
    description: "For growing D2C brands",
    price_monthly: 2999,
    price_yearly: 29990,
    currency: "INR",
    limits: { products: 2000, staff: 8, storage_mb: 10240, custom_domains: 1 },
    features: { custom_domains: true, blog: true, store_locator: true },
    trial_days: 14,
    sort_order: 2,
    active: true,
  },
  {
    code: "scale",
    name: "Scale",
    description: "For established fashion houses",
    price_monthly: 7999,
    price_yearly: 79990,
    currency: "INR",
    limits: { products: 20000, staff: 30, storage_mb: 51200, custom_domains: 3 },
    features: { custom_domains: true, blog: true, store_locator: true, analytics_export: true },
    trial_days: 14,
    sort_order: 3,
    active: true,
  },
]);
