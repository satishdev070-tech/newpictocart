/**
 * Credits economy contracts (pure). SQL stores ai_credit_settings in rupees (numeric) and the
 * margin as a plain multiplier; TS works in integers: base cost in centi-paise (₹1 = 10,000),
 * margin ×100, money in paise. Conversions live here and are unit tested.
 */
import { z } from "zod";
import { checkbox } from "@/lib/actions/form";
import { toDecimalString, toMinor } from "@/lib/money";
import { DEFAULT_CREDIT_PRICING, validateCreditPricing, type CreditPricing } from "@/features/platform-finance/calc";

export const ECONOMY_TABS = [
  { key: "pricing", label: "Pricing" },
  { key: "actions", label: "AI actions" },
  { key: "packs", label: "Packs" },
  { key: "promos", label: "Promos" },
  { key: "payments", label: "Payments" },
  { key: "insights", label: "Insights" },
  { key: "grant", label: "Grant credits" },
] as const;
export type EconomyTab = (typeof ECONOMY_TABS)[number]["key"];
export const economyTab = (v: unknown): EconomyTab => (ECONOMY_TABS.some((t) => t.key === v) ? (v as EconomyTab) : "pricing");

// ---- Conversions --------------------------------------------------------------------------

/** "0.03" (₹, up to 4 decimals) → 300 centi-paise. String maths: no float rounding. */
export function rupeesToCentiPaise(input: string | number): number {
  const str = typeof input === "number" ? input.toFixed(4) : input.trim();
  const m = /^(\d{1,6})(?:\.(\d{1,4}))?$/.exec(str);
  if (!m) throw new RangeError(`Invalid rupee amount: ${JSON.stringify(input)}`);
  return Number(m[1]) * 10_000 + Number((m[2] ?? "").padEnd(4, "0"));
}

/** 300 → "0.0300" (the numeric(10,4) value sent to Postgres). */
export function centiPaiseToRupees(cp: number): string {
  if (!Number.isSafeInteger(cp) || cp < 0) throw new RangeError("centi-paise must be a non-negative integer");
  return `${Math.floor(cp / 10_000)}.${String(cp % 10_000).padStart(4, "0")}`;
}

/** "3" / "2.5" → 300 / 250. */
export function multiplierToX100(input: string | number): number {
  const str = typeof input === "number" ? input.toFixed(2) : input.trim();
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(str);
  if (!m) throw new RangeError(`Invalid multiplier: ${JSON.stringify(input)}`);
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export function x100ToMultiplier(x: number): string {
  return `${Math.floor(x / 100)}.${String(x % 100).padStart(2, "0")}`;
}

/** Trims "0.0300" → "0.03", "3.00" → "3" for form defaults. */
export const trimDecimal = (s: string) => (s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s);

export type CreditSettingsRow = {
  base_cost_per_credit: number | string;
  margin_multiplier: number | string;
  custom_credits_per_rupee: number;
  custom_min: number | string;
  custom_max: number | string;
  welcome_credits: number;
  low_balance: number;
  critical_balance: number;
  freelancer_hourly: number | string;
};

export function pricingFromRow(row: CreditSettingsRow | null | undefined): CreditPricing {
  if (!row) return { ...DEFAULT_CREDIT_PRICING };
  return {
    baseCostCentiPaise: rupeesToCentiPaise(String(row.base_cost_per_credit)),
    marginX100: multiplierToX100(String(row.margin_multiplier)),
    creditsPerRupee: row.custom_credits_per_rupee,
    customMinMinor: toMinor(String(row.custom_min)),
    customMaxMinor: toMinor(String(row.custom_max)),
    welcomeCredits: row.welcome_credits,
    lowBalance: row.low_balance,
    criticalBalance: row.critical_balance,
    freelancerHourlyMinor: toMinor(String(row.freelancer_hourly)),
  };
}

/** Values for an update of ai_credit_settings (numbers PostgREST sends as numeric). */
export function pricingToRow(p: CreditPricing) {
  return {
    base_cost_per_credit: Number(centiPaiseToRupees(p.baseCostCentiPaise)),
    margin_multiplier: Number(x100ToMultiplier(p.marginX100)),
    custom_credits_per_rupee: p.creditsPerRupee,
    custom_min: Number(toDecimalString(p.customMinMinor)),
    custom_max: Number(toDecimalString(p.customMaxMinor)),
    welcome_credits: p.welcomeCredits,
    low_balance: p.lowBalance,
    critical_balance: p.criticalBalance,
    freelancer_hourly: Number(toDecimalString(p.freelancerHourlyMinor)),
  };
}

/** Credits a custom amount buys (same formula as request_ai_credit_purchase: floor(₹ × credits per ₹1)). */
export function customCredits(amountMinor: number, creditsPerRupee: number): number {
  if (amountMinor <= 0 || creditsPerRupee <= 0) return 0;
  return Math.floor((amountMinor * creditsPerRupee) / 100);
}

/** Bonus credits from a promo (floor, as in SQL). */
export function promoBonus(credits: number, bonusPct: number): number {
  return Math.floor((credits * bonusPct) / 100);
}

// ---- Form schemas -------------------------------------------------------------------------

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v);
const int = (label: string, min: number, max: number) => z.preprocess(blank, z.coerce.number({ error: `Enter ${label}` }).int(`${label} must be a whole number`).min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`));
const rupees = (label: string) =>
  z.preprocess(
    blank,
    z
      .string({ error: `Enter ${label}` })
      .regex(/^\d{1,8}(\.\d{1,2})?$/, `Enter ${label} like 99 or 99.50`)
      .transform((v) => toMinor(v)),
  );

export const pricingSchema = z
  .object({
    baseCost: z.preprocess(blank, z.string({ error: "Enter the base cost" }).regex(/^\d{1,6}(\.\d{1,4})?$/, "Enter ₹ with up to 4 decimals, like 0.03").transform(rupeesToCentiPaise)),
    margin: z.preprocess(blank, z.string({ error: "Enter the margin" }).regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a multiplier like 3 or 2.5").transform(multiplierToX100)),
    creditsPerRupee: int("Credits per ₹1", 1, 10_000),
    customMin: rupees("the minimum"),
    customMax: rupees("the maximum"),
    welcomeCredits: int("Welcome credits", 0, 100_000),
    lowBalance: int("The low warning", 0, 1_000_000),
    criticalBalance: int("The critical warning", 0, 1_000_000),
    freelancerHourly: rupees("the hourly rate"),
  })
  .transform(
    (v): CreditPricing => ({
      baseCostCentiPaise: v.baseCost,
      marginX100: v.margin,
      creditsPerRupee: v.creditsPerRupee,
      customMinMinor: v.customMin,
      customMaxMinor: v.customMax,
      welcomeCredits: v.welcomeCredits,
      lowBalance: v.lowBalance,
      criticalBalance: v.criticalBalance,
      freelancerHourlyMinor: v.freelancerHourly,
    }),
  )
  .superRefine((p, ctx) => {
    const FIELD: Record<keyof CreditPricing, string> = { baseCostCentiPaise: "baseCost", marginX100: "margin", creditsPerRupee: "creditsPerRupee", customMinMinor: "customMin", customMaxMinor: "customMax", welcomeCredits: "welcomeCredits", lowBalance: "lowBalance", criticalBalance: "criticalBalance", freelancerHourlyMinor: "freelancerHourly" };
    for (const [k, message] of Object.entries(validateCreditPricing(p)) as [keyof CreditPricing, string][]) ctx.addIssue({ code: "custom", path: [FIELD[k]], message });
    if (p.marginX100 > 10_000) ctx.addIssue({ code: "custom", path: ["margin"], message: "Margin must be at most 100×." });
  });

export const actionCostSchema = z.object({
  kind: z.string().regex(/^[a-z_]{2,60}$/, "Unknown action"),
  label: z.preprocess(blank, z.string({ error: "Enter a label" }).min(2, "Use 2–80 characters").max(80, "Use 2–80 characters")),
  credits: int("Credits", 1, 1000),
  minutesSaved: int("Minutes saved", 0, 6000),
});

export const PACK_CODE_RE = /^[a-z][a-z0-9_]{1,30}$/;

export const packSchema = z.object({
  code: z.preprocess(blank, z.string({ error: "Enter a code" }).toLowerCase().regex(PACK_CODE_RE, "Lowercase letters, digits and _ (2–31), starting with a letter").refine((v) => v !== "custom", "“custom” is reserved")),
  label: z.preprocess(blank, z.string({ error: "Enter a label" }).min(2, "Use 2–60 characters").max(60, "Use 2–60 characters")),
  credits: int("Credits", 1, 1_000_000),
  price: rupees("the price").refine((v) => v > 0, "Price must be above zero"),
  active: z.preprocess(checkbox, z.boolean()),
  sortOrder: z.preprocess((v) => blank(v) ?? "0", z.coerce.number().int().min(-1000).max(1000)),
});
export const packCodeSchema = z.object({ code: z.string().regex(PACK_CODE_RE) });

export const PROMO_CODE_RE = /^[A-Z0-9_-]{3,30}$/;
const optionalDate = z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date").optional());

export const promoSchema = z
  .object({
    code: z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() || undefined : v), z.string({ error: "Enter a code" }).regex(PROMO_CODE_RE, "3–30 letters, digits, _ or -")),
    bonusPct: int("Bonus %", 1, 500),
    startsAt: optionalDate,
    endsAt: optionalDate,
    maxUses: z.preprocess(blank, z.coerce.number().int("Whole number").min(1, "At least 1").max(1_000_000).optional()),
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt >= v.startsAt, { path: ["endsAt"], message: "End date must be on or after the start date" });

export const promoToggleSchema = z.object({ id: z.uuid(), active: z.enum(["true", "false"]).transform((v) => v === "true") });

export const storeSearchSchema = z.object({ q: z.preprocess(blank, z.string().max(80).optional()).catch(undefined) });

// ---- View types ----------------------------------------------------------------------------

export type ActionCostRow = { kind: string; label: string; credits: number; minutesSaved: number };
export type PackRow = { code: string; label: string; credits: number; priceMinor: number; active: boolean; sortOrder: number };
export type PromoRow = { id: string; code: string; bonusPct: number; startsAt: string | null; endsAt: string | null; maxUses: number | null; uses: number; active: boolean; createdAt: string };
export type CreditInsights = {
  accounts: number;
  balance: number;
  granted: number;
  purchased: number;
  used: number;
  revenueMinor: number;
  lowBalance: number;
  criticalBalance: number;
  byKind: { kind: string; uses: number; credits: number; minutesSaved: number }[];
  topStores: { tenantId: string; name: string; credits: number }[];
};

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : 0);

/** Parses the jsonb from platform_ai_credit_insights() defensively. */
export function parseInsights(raw: unknown): CreditInsights {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return {
    accounts: num(o.accounts),
    balance: num(o.balance),
    granted: num(o.granted),
    purchased: num(o.purchased),
    used: num(o.used),
    revenueMinor: toMinor(num(o.revenue).toFixed(2)),
    lowBalance: num(o.lowBalance),
    criticalBalance: num(o.criticalBalance),
    byKind: arr(o.byKind).map((k) => ({ kind: String(k.kind ?? "unknown"), uses: num(k.uses), credits: num(k.credits), minutesSaved: num(k.minutesSaved) })),
    topStores: arr(o.topStores).map((s) => ({ tenantId: String(s.tenantId ?? ""), name: String(s.name ?? ""), credits: num(s.credits) })),
  };
}
