import { formatMoney } from "@/lib/money";

/**
 * Plan types and pure display helpers for the marketing site. Zod-free on purpose: the pricing
 * table renders in the browser, and importing plans.ts there shipped its row-parsing schemas (zod)
 * to every visitor. plans.ts parses `public.plans` rows and re-exports everything here.
 */

export type BillingPeriod = "monthly" | "yearly";

export type PlanLimits = {
  products: number | null;
  staff: number | null;
  storageMb: number | null;
  customDomains: number | null;
};

export type PlanFeatures = {
  customDomains: boolean;
  blog: boolean;
  storeLocator: boolean;
  analyticsExport: boolean;
};

export type MarketingPlan = {
  code: string;
  name: string;
  description: string;
  monthlyMinor: number;
  yearlyMinor: number;
  currency: "INR";
  trialDays: number;
  limits: PlanLimits;
  features: PlanFeatures;
};

/** Yearly price expressed per month, rounded to the nearest whole rupee for display. */
export function monthlyEquivalentMinor(yearlyMinor: number): number {
  return Math.round(yearlyMinor / 12 / 100) * 100;
}

/** Whole-percent saving of yearly billing vs 12 monthly payments (rounded down, never overstated). */
export function yearlySavingsPercent(monthlyMinor: number, yearlyMinor: number): number {
  const twelve = monthlyMinor * 12;
  if (twelve <= 0 || yearlyMinor >= twelve) return 0;
  return Math.floor(((twelve - yearlyMinor) / twelve) * 100);
}

/** Largest saving across plans, for the billing toggle label ("save up to 16%"). */
export function maxYearlySavingsPercent(plans: readonly MarketingPlan[]): number {
  return plans.reduce((max, p) => Math.max(max, yearlySavingsPercent(p.monthlyMinor, p.yearlyMinor)), 0);
}

/** Longest free trial offered, or 0 when no plan has one. */
export function maxTrialDays(plans: readonly MarketingPlan[]): number {
  return plans.reduce((max, p) => Math.max(max, p.trialDays), 0);
}

/** Entry plan (lowest sort_order) — what new stores get via create_tenant. */
export function entryPlan(plans: readonly MarketingPlan[]): MarketingPlan | undefined {
  return plans[0];
}

/**
 * Trial days for signup messaging. Prefer the entry plan so a free-forever tier
 * is not contradicted by a longer trial on a paid plan further up the ladder.
 */
export function signupTrialDays(plans: readonly MarketingPlan[]): number {
  return entryPlan(plans)?.trialDays ?? 0;
}

export function isFreeForeverPlan(plan: MarketingPlan): boolean {
  return plan.monthlyMinor === 0 && plan.yearlyMinor === 0 && plan.trialDays === 0;
}

const countFormat = new Intl.NumberFormat("en-IN");

/** 2048 -> "2 GB", 51200 -> "50 GB", 500 -> "500 MB". */
export function formatStorage(mb: number): string {
  if (mb >= 1024) {
    const gb = Math.round((mb / 1024) * 10) / 10;
    return `${countFormat.format(gb)} GB`;
  }
  return `${countFormat.format(mb)} MB`;
}

function plural(n: number, one: string, many: string): string {
  return `${countFormat.format(n)} ${n === 1 ? one : many}`;
}

/** Human-readable plan inclusions derived from `limits` and `features` JSON. */
export function planHighlights(plan: MarketingPlan): string[] {
  const lines: string[] = [];
  const { limits, features } = plan;
  if (limits.products !== null) lines.push(`Up to ${plural(limits.products, "product", "products")}`);
  if (limits.staff !== null) lines.push(plural(limits.staff, "staff account", "staff accounts"));
  if (limits.storageMb !== null) lines.push(`${formatStorage(limits.storageMb)} media storage`);
  if (features.customDomains && (limits.customDomains ?? 0) > 0) {
    lines.push(plural(limits.customDomains ?? 0, "custom domain", "custom domains"));
  } else {
    lines.push("Free store subdomain");
  }
  if (features.blog) lines.push("Blog");
  if (features.storeLocator) lines.push("Store locator page");
  if (features.analyticsExport) lines.push("Analytics CSV exports");
  return lines;
}

/** Code of the plan to visually recommend: the middle plan of three or more, else none. */
export function recommendedPlanCode(plans: readonly MarketingPlan[]): string | null {
  if (plans.length < 3) return null;
  return plans[Math.floor((plans.length - 1) / 2)]?.code ?? null;
}

export type PlanPriceView = {
  /** Headline amount, e.g. "₹2,999". */
  amount: string;
  /** Unit after the amount, e.g. "/month". */
  unit: string;
  /** Secondary line, e.g. "₹29,990 billed yearly". */
  note: string;
};

/** Everything the pricing card prints for one billing period. */
export function planPriceView(plan: MarketingPlan, period: BillingPeriod): PlanPriceView {
  if (isFreeForeverPlan(plan)) {
    return { amount: "Free", unit: "", note: "Forever · no card needed" };
  }
  if (period === "yearly") {
    return {
      amount: formatMoney(monthlyEquivalentMinor(plan.yearlyMinor)),
      unit: "/month",
      note: `${formatMoney(plan.yearlyMinor)} billed yearly`,
    };
  }
  return { amount: formatMoney(plan.monthlyMinor), unit: "/month", note: "Billed monthly" };
}

export type ComparisonCell = string | boolean;
export type ComparisonRow = { label: string; cells: ComparisonCell[] };

/**
 * Feature comparison rows built only from each plan's `limits` and `features` JSON, so the table
 * can never claim more than the entitlement system enforces. `null` limits mean "no limit set".
 */
export function planComparison(plans: readonly MarketingPlan[]): ComparisonRow[] {
  const count = (n: number | null) => (n === null ? "No limit" : countFormat.format(n));
  return [
    { label: "Monthly price", cells: plans.map((p) => `${formatMoney(p.monthlyMinor)}/month`) },
    { label: "Yearly price", cells: plans.map((p) => `${formatMoney(p.yearlyMinor)}/year`) },
    {
      label: "Free trial",
      cells: plans.map((p) => (p.trialDays > 0 ? `${p.trialDays} days` : isFreeForeverPlan(p) ? "Free forever" : false)),
    },
    { label: "Products", cells: plans.map((p) => count(p.limits.products)) },
    { label: "Staff accounts", cells: plans.map((p) => count(p.limits.staff)) },
    { label: "Media storage", cells: plans.map((p) => (p.limits.storageMb === null ? "No limit" : formatStorage(p.limits.storageMb))) },
    { label: "Free store subdomain", cells: plans.map(() => true) },
    { label: "Custom domains", cells: plans.map((p) => (p.features.customDomains && (p.limits.customDomains ?? 0) > 0 ? count(p.limits.customDomains) : false)) },
    { label: "Blog", cells: plans.map((p) => p.features.blog) },
    { label: "Store locator page", cells: plans.map((p) => p.features.storeLocator) },
    { label: "Analytics CSV exports", cells: plans.map((p) => p.features.analyticsExport) },
  ];
}

/** True when paid plans all have both prices, so the monthly/yearly switch is meaningful. */
export function hasYearlyBilling(plans: readonly MarketingPlan[]): boolean {
  const paid = plans.filter((p) => p.monthlyMinor > 0 || p.yearlyMinor > 0);
  return paid.length > 0 && paid.every((p) => p.yearlyMinor > 0 && p.monthlyMinor > 0);
}

export function findPlan(plans: readonly MarketingPlan[], code: string | null | undefined): MarketingPlan | undefined {
  return code ? plans.find((p) => p.code === code) : undefined;
}
