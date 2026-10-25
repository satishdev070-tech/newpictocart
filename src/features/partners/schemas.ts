import { z } from "zod";
import { email } from "@/lib/validation/common";
import { toDecimalString, toMinor } from "@/lib/money";
import { PARTNER_TIERS, PARTNER_TYPES, type PartnerTier, type PartnerType, type RangePreset, type RankBy, monthEnd, percentToBps, presetRange } from "@/features/platform-finance/calc";
import { sanitizeSearchTerm } from "@/features/platform/schemas";

/**
 * Super Admin partner programme (migration 3800): forms, list filters and pure display helpers.
 * Pure module, shared by forms, server actions and unit tests. Money is entered in rupees and
 * converted to integer paise here; rates are entered as percentages and stored as basis points.
 */

export const PARTNER_STATUSES = ["pending", "active", "suspended"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
export const LICENSE_TYPES = ["starter", "growth"] as const;
export type LicenseType = (typeof LICENSE_TYPES)[number];
export const LICENSE_STATUSES = ["available", "consumed", "revoked"] as const;
export const PAYOUT_METHODS = ["upi", "bank", "other"] as const;

export const TIER_LABEL: Record<PartnerTier, string> = { partner: "Partner", state_head: "State head", regional_head: "Regional head" };
export const TYPE_LABEL: Record<PartnerType, string> = { agency: "Agency", freelancer: "Freelancer", intern: "Intern", agent: "Agent" };
export const tierLabel = (v: string) => TIER_LABEL[v as PartnerTier] ?? v;
export const typeLabel = (v: string) => TYPE_LABEL[v as PartnerType] ?? v;

// ---- Field helpers ------------------------------------------------------------------------

const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
const optional = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (blank(v) ? undefined : typeof v === "string" ? v.trim() : v), schema.optional());
const optionalText = (max: number) => optional(z.string().max(max, `Use at most ${max} characters`));
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const optionalUuid = optional(z.uuid());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date (YYYY-MM-DD)");

/** Rupees as typed ("1,299.50", "₹ 499") → integer paise. */
export function rupeesToMinor(v: unknown): number | undefined {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const s = typeof v === "number" ? v : v.replace(/[₹,\s]/g, "");
  if (s === "") return undefined;
  try {
    return toMinor(s);
  } catch {
    return Number.NaN;
  }
}
const rupees = (opts: { min?: number; max: number; label: string }) =>
  z.preprocess(
    rupeesToMinor,
    z
      .number({ error: `Enter ${opts.label}` })
      .refine((n) => Number.isSafeInteger(n), `Enter ${opts.label} in rupees, e.g. 499 or 499.50`)
      .refine((n) => n >= (opts.min ?? 0), opts.min ? `Must be at least ₹${opts.min / 100}` : "Cannot be negative")
      .refine((n) => n <= opts.max, `Must be at most ₹${(opts.max / 100).toLocaleString("en-IN")}`),
  );

/** "12.5" / "12.5%" → 1250 bps. */
export function percentInputToBps(v: unknown): number | undefined {
  if (blank(v)) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[%\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 100) return Number.NaN;
  return percentToBps(n);
}
const percent = z.preprocess(percentInputToBps, z.number({ error: "Enter a percentage" }).refine((n) => Number.isInteger(n) && n >= 0 && n <= 10_000, "Enter a percentage between 0 and 100"));

/** Indian mobile → E.164 (+91…); other numbers must already be in +E.164. */
export function normalisePhone(v: unknown): string | undefined {
  if (blank(v)) return undefined;
  const s = String(v).replace(/[\s()-]/g, "");
  if (/^[6-9]\d{9}$/.test(s)) return `+91${s}`;
  if (/^0[6-9]\d{9}$/.test(s)) return `+91${s.slice(1)}`;
  return s;
}
const phone = z.preprocess(normalisePhone, z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter a 10-digit mobile or +country number").optional());

// ---- Partner profile ------------------------------------------------------------------------

const profileFields = {
  name: z.string().trim().min(2, "Enter the partner's name").max(120),
  // Trim before validating so a pasted " name@x.in " is accepted.
  email: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), email),
  phone,
  companyName: optionalText(160),
  partnerType: z.enum(PARTNER_TYPES, { error: "Choose a type" }),
  city: optionalText(80),
  notes: optionalText(2000),
};

export const invitePartnerSchema = z.object({ ...profileFields, tier: z.enum(PARTNER_TIERS).default("partner") });
export type InvitePartnerInput = z.infer<typeof invitePartnerSchema>;

const strongPassword = z
  .string({ error: "Set a password" })
  .min(10, "Use at least 10 characters")
  .max(72, "Use at most 72 characters")
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), "Use upper- and lower-case letters and a number");

export const createPartnerDirectSchema = z
  .object({ ...profileFields, tier: z.enum(PARTNER_TIERS).default("partner"), password: strongPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
export type CreatePartnerDirectInput = z.infer<typeof createPartnerDirectSchema>;

export const updatePartnerProfileSchema = z.object({ partnerId: z.uuid(), ...profileFields, licensePrice: optional(rupees({ max: 10_000_000, label: "a licence price" })) });

export const partnerStatusSchema = z.object({ partnerId: z.uuid(), status: z.enum(["active", "suspended"], { error: "Choose active or suspended" }) });

export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,64}$/;

export const payoutDetailsSchema = z
  .object({
    partnerId: z.uuid(),
    payoutMethod: z.enum(["upi", "bank"], { error: "Choose UPI or bank transfer" }),
    upiId: optional(z.string().regex(UPI_RE, "Enter a UPI ID like name@bank")),
    bankAccountHolder: optionalText(120),
    /** Blank keeps the saved number (the form only ever shows it masked). */
    bankAccountNumber: optional(z.string().regex(/^\d{6,20}$/, "Use 6–20 digits")),
    bankIfsc: z.preprocess((v) => (blank(v) ? undefined : String(v).trim().toUpperCase()), z.string().regex(IFSC_RE, "Enter an 11-character IFSC like HDFC0001234").optional()),
    pan: z.preprocess((v) => (blank(v) ? undefined : String(v).trim().toUpperCase()), z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Enter a 10-character PAN").optional()),
    gstin: z.preprocess((v) => (blank(v) ? undefined : String(v).trim().toUpperCase()), z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a 15-character GSTIN").optional()),
  })
  .superRefine((v, ctx) => {
    if (v.payoutMethod === "upi" && !v.upiId) ctx.addIssue({ code: "custom", path: ["upiId"], message: "Enter the UPI ID" });
    if (v.payoutMethod === "bank") {
      if (!v.bankAccountHolder) ctx.addIssue({ code: "custom", path: ["bankAccountHolder"], message: "Enter the account holder" });
      if (!v.bankIfsc) ctx.addIssue({ code: "custom", path: ["bankIfsc"], message: "Enter the IFSC" });
    }
  });

export const promotePartnerSchema = z.object({
  partnerId: z.uuid(),
  tier: z.enum(PARTNER_TIERS, { error: "Choose a tier" }),
  overridePercent: percent,
  stateName: optionalText(80),
  regionName: optionalText(80),
});

export const parentSchema = z.object({ partnerId: z.uuid(), parentId: optionalUuid });
export const directRateSchema = z.object({ partnerId: z.uuid(), directPercent: percent });
export const agencyPayoutSchema = z.object({ partnerId: z.uuid(), agencyPercent: percent });

export const creditAdjustSchema = z.object({
  partnerId: z.uuid(),
  kind: z.enum(["onboarding_credit", "adjustment"]).default("onboarding_credit"),
  amount: z.preprocess(
    (v) => {
      if (blank(v)) return undefined;
      const s = String(v).replace(/[₹,\s]/g, "");
      const neg = s.startsWith("-");
      const m = rupeesToMinor(neg ? s.slice(1) : s);
      return m === undefined ? undefined : neg ? -m : m;
    },
    z
      .number({ error: "Enter an amount" })
      .refine((n) => Number.isSafeInteger(n) && n !== 0, "Enter a non-zero amount in rupees")
      .refine((n) => Math.abs(n) <= 100_000_000, "At most ₹10,00,000 at a time"),
  ),
  note: z.string().trim().min(3, "Give a reason of at least 3 characters").max(500),
});

export const redeemCodeSchema = z.object({ partnerId: z.uuid(), code: z.string().trim().toUpperCase().regex(/^OTC-[0-9A-F]{12}$/, "Codes look like OTC-1A2B3C4D5E6F") });

// ---- Licences -------------------------------------------------------------------------------

export const issueBatchSchema = z.object({
  partnerId: z.uuid(),
  licenseType: z.enum(LICENSE_TYPES, { error: "Choose a licence type" }),
  qty: z.coerce.number({ error: "Enter a quantity" }).int("Whole licences only").min(1, "At least 1").max(10_000, "At most 10,000"),
  unitPrice: rupees({ max: 10_000_000, label: "a unit price" }),
  paid: checkbox,
  reference: optionalText(160),
});

export const licenseRequestSchema = z.object({
  partnerId: z.uuid({ error: "Choose a partner" }),
  licenseType: z.enum(LICENSE_TYPES, { error: "Choose a licence type" }),
  qty: z.coerce.number({ error: "Enter a quantity" }).int("Whole licences only").min(1, "At least 1").max(10_000, "At most 10,000"),
  notes: optionalText(1000),
});

export const decideLicenseRequestSchema = z
  .object({
    requestId: z.uuid(),
    decision: z.enum(["approve", "reject"]),
    unitPrice: optional(rupees({ max: 10_000_000, label: "a unit price" })),
    paid: checkbox,
    reference: optionalText(160),
    note: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.decision === "reject" && !v.note) ctx.addIssue({ code: "custom", path: ["note"], message: "Say why the request is rejected" });
  });

export const markBatchPaidSchema = z.object({ batchId: z.uuid(), partnerId: z.uuid(), reference: z.string().trim().min(3, "Enter the payment reference").max(160) });
export const revokeLicenseSchema = z.object({ licenseId: z.uuid(), partnerId: optionalUuid });

/** Store attribution by store id or slug; blank partner = remove attribution. */
export const attributeStoreSchema = z.object({
  partnerId: z.uuid(),
  store: z.string().trim().toLowerCase().min(3, "Enter a store ID or slug").max(80),
  remove: checkbox,
});

// ---- Demo shops and codes --------------------------------------------------------------------

export const demoShopSchema = z.object({
  tenantId: z.uuid({ error: "Choose a demo store" }),
  category: z.string().trim().min(2, "Enter a category").max(60),
  note: optionalText(500),
  position: z.preprocess((v) => (blank(v) ? 0 : v), z.coerce.number().int().min(0).max(10_000)),
  active: checkbox,
});
export const demoShopIdSchema = z.object({ id: z.uuid() });
export const demoShopToggleSchema = z.object({ id: z.uuid(), active: z.enum(["true", "false"]).transform((v) => v === "true") });

export const createCodeSchema = z.object({
  value: rupees({ min: 100, max: 100_000_000, label: "a value" }),
  expiresAt: optional(isoDate),
  note: optionalText(200),
});
export const codeIdSchema = z.object({ codeId: z.uuid() });

// ---- Invite acceptance ----------------------------------------------------------------------

/** Invite tokens are 32 random bytes, base64url. */
export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
export const acceptInviteSchema = z.object({ token: z.string().regex(INVITE_TOKEN_RE, "This invite link is not valid.") });
export const INVITE_TTL_DAYS = 7;

/** Friendly message for an accept_partner_invite() failure hint. */
export function inviteErrorMessage(hint: string | null | undefined): string {
  switch (hint) {
    case "INVITE_INVALID":
      return "This invite link is not valid any more. It may have expired, been used already or been withdrawn. Ask the platform team for a new one.";
    case "INVITE_EMAIL_MISMATCH":
      return "You're signed in with a different email address. Sign out and sign in with the address the invite was sent to.";
    case "INVITE_ACCOUNT_TAKEN":
      return "This account is already linked to another partner profile. Sign in with a different account.";
    default:
      return "The invite could not be accepted. Please try again.";
  }
}

// ---- Payouts --------------------------------------------------------------------------------

export const runPayoutBatchSchema = z.object({
  cutoff: isoDate,
  method: z.enum(PAYOUT_METHODS, { error: "Choose a method" }),
  minAmount: z.preprocess((v) => (blank(v) ? 0 : rupeesToMinor(v)), z.number().refine((n) => Number.isSafeInteger(n) && n >= 0 && n <= 100_000_000, "Enter a minimum in rupees (0 for none)")),
});
export const settlePayoutSchema = z
  .object({
    payoutId: z.uuid(),
    outcome: z.enum(["paid", "failed"]),
    utr: optional(z.string().regex(/^[A-Za-z0-9-]{6,40}$/, "Use 6–40 letters, numbers or hyphens")),
    note: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.outcome === "paid" && !v.utr) ctx.addIssue({ code: "custom", path: ["utr"], message: "Enter the UTR / bank reference" });
    if (v.outcome === "failed" && !v.note) ctx.addIssue({ code: "custom", path: ["note"], message: "Say why the transfer failed" });
  });

// ---- List filters ---------------------------------------------------------------------------

export const PARTNER_TABS = ["partners", "requests", "licenses", "demo", "codes"] as const;
export type PartnerTab = (typeof PARTNER_TABS)[number];
export const PARTNER_TAB_LABEL: Record<PartnerTab, string> = { partners: "Partners", requests: "License requests", licenses: "Licenses", demo: "Demo shops", codes: "One-time codes" };

export const partnersPageSchema = z.object({
  tab: z.enum(PARTNER_TABS).catch("partners").default("partners"),
  q: z.preprocess(sanitizeSearchTerm, z.string()).optional(),
  status: z.enum(LICENSE_STATUSES).optional().catch(undefined),
});

export const AGENCY_TABS = ["agency", "freelancer", "intern", "agent", "all"] as const;
export type AgencyTab = (typeof AGENCY_TABS)[number];
export const agenciesPageSchema = z.object({
  type: z.enum(AGENCY_TABS).catch("agency").default("agency"),
  q: z.preprocess(sanitizeSearchTerm, z.string()).optional(),
});

export const RANGE_PRESETS = ["7d", "30d", "90d", "ytd"] as const satisfies readonly RangePreset[];
export const RANK_BY = ["commission", "gmv", "licenses"] as const satisfies readonly RankBy[];
export const analyticsFilterSchema = z.object({
  preset: z.enum(RANGE_PRESETS).optional().catch(undefined),
  from: z.preprocess((v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined), z.string().optional()),
  to: z.preprocess((v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined), z.string().optional()),
  rank: z.enum(RANK_BY).catch("commission").default("commission"),
});

// ---- Display helpers ------------------------------------------------------------------------

/** "123456789012" → "•••• 9012"; short or missing numbers show as "—". */
export function maskAccount(last4OrNumber: string | null | undefined): string {
  if (!last4OrNumber) return "—";
  const digits = last4OrNumber.replace(/\D/g, "");
  if (digits.length < 4) return "—";
  return `•••• ${digits.slice(-4)}`;
}

/** Payout details for a table cell, never exposing a full bank account number. */
export function payoutSummary(p: { payoutMethod: string | null; upiId: string | null; bankAccountHolder: string | null; bankLast4: string | null; bankIfsc: string | null }): string {
  if (p.payoutMethod === "upi") return p.upiId ? `UPI ${p.upiId}` : "UPI (no ID)";
  if (p.payoutMethod === "bank") return [p.bankAccountHolder, maskAccount(p.bankLast4), p.bankIfsc].filter((x) => x && x !== "—").join(" · ") || "Bank (incomplete)";
  return "Not set";
}

/** Case-insensitive match on any of the given fields (search terms are already sanitised). */
export function matchesSearch(q: string | undefined, ...fields: (string | null | undefined)[]): boolean {
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q));
}

/** Postgres numeric (string or number) → integer paise; null/invalid → 0. */
export function numericToMinor(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  try {
    return toMinor(typeof v === "number" ? v : String(v));
  } catch {
    return 0;
  }
}

/** Default payout cutoff: the last day of the month before `today` (YYYY-MM-DD). */
export function defaultPayoutCutoff(today: string): string {
  const [y, m] = today.split("-").map(Number) as [number, number];
  return monthEnd(new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10));
}

/**
 * Analytics range: explicit from/to win (swapped if reversed, capped at today); otherwise the
 * preset (default 30 days) from calc.presetRange on the IST date `today`.
 */
export function resolveAnalyticsRange(f: { preset?: RangePreset; from?: string; to?: string }, today: string): { from: string; to: string; preset: RangePreset | null } {
  if (!f.preset && f.from && f.to) {
    const [a, b] = f.from <= f.to ? [f.from, f.to] : [f.to, f.from];
    return { from: a > today ? today : a, to: b > today ? today : b, preset: null };
  }
  const preset = f.preset ?? "30d";
  return { ...presetRange(preset, today), preset };
}

export const LEADERBOARD_CSV_HEADER = ["Rank", "Partner ID", "Partner", "Type", "Tier", "State", "Licences", "GMV (INR)", "Commission (INR)"] as const;

export function leaderboardCsvRows(rows: readonly { code: string; name: string; type: string; tier: string; state: string | null; licenses: number; gmvMinor: number; commissionMinor: number }[]): (string | number)[][] {
  return rows.map((r, i) => [i + 1, r.code, r.name, typeLabel(r.type), tierLabel(r.tier), r.state ?? "", r.licenses, toDecimalString(r.gmvMinor), toDecimalString(r.commissionMinor)]);
}
