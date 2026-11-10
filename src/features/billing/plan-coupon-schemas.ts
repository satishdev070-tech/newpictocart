/**
 * Zod contracts for Super Admin plan coupon create / toggle.
 */
import { z } from "zod";
import { DEFAULT_PLAN_COUPON_PLAN_CODES, PLAN_COUPON_CODE_RE, PLAN_COUPON_PLAN_OPTIONS } from "./plan-coupons";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v);

const int = (label: string, min: number, max: number) =>
  z.preprocess(blank, z.coerce.number({ error: `Enter ${label}` }).int(`${label} must be a whole number`).min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`));

/** HTML date / datetime-local → ISO timestamptz. `endOfDay` makes date-only ends inclusive. */
function optionalTimestamp(label: string, endOfDay = false) {
  return z.preprocess((raw) => {
    const v = blank(raw);
    if (v === undefined) return undefined;
    if (typeof v !== "string") return v;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return endOfDay ? `${v}T23:59:59.999Z` : `${v}T00:00:00.000Z`;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return `${v}:00.000Z`;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v) && !(v.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(v))) return `${v}Z`;
    return v;
  }, z.iso.datetime({ offset: true, error: `Choose a valid ${label}` }).optional());
}

const planCode = z.string().regex(/^[a-z0-9_]{2,40}$/, "Unknown plan code");

function normalizePlanCodes(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : raw === undefined || raw === null || raw === "" ? [] : [raw];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const code = item.trim().toLowerCase();
    if (!code || out.includes(code)) continue;
    out.push(code);
  }
  return out;
}

export const createPlanCouponSchema = z
  .object({
    code: z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() || undefined : v), z.string({ error: "Enter a code" }).regex(PLAN_COUPON_CODE_RE, "3–30 letters, digits, _ or -")),
    percentOff: int("Percent off", 1, 100),
    startsAt: optionalTimestamp("start"),
    endsAt: optionalTimestamp("end", true),
    maxUses: z.preprocess(blank, z.coerce.number().int("Whole number").min(1, "At least 1").max(1_000_000).optional()),
    appliesToPlanCodes: z.preprocess(normalizePlanCodes, z.array(planCode).max(20)).transform((codes) => (codes.length ? codes : [...DEFAULT_PLAN_COUPON_PLAN_CODES])),
  })
  .superRefine((v, ctx) => {
    for (const code of v.appliesToPlanCodes) {
      if (!(PLAN_COUPON_PLAN_OPTIONS as readonly string[]).includes(code)) {
        ctx.addIssue({ code: "custom", path: ["appliesToPlanCodes"], message: `Unknown plan “${code}”` });
      }
    }
    if (v.startsAt && v.endsAt && v.endsAt < v.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be on or after the start" });
    }
  });

export const updatePlanCouponSchema = z.object({
  id: z.uuid(),
  active: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export type CreatePlanCouponInput = z.infer<typeof createPlanCouponSchema>;
export type UpdatePlanCouponInput = z.infer<typeof updatePlanCouponSchema>;
