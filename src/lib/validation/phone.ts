import { z } from "zod";

/**
 * Normalises a phone number to E.164. Indian numbers may be typed the usual ways
 * ("98765 43210", "098765-43210", "+91 98765 43210", "919876543210"); other countries need
 * a leading "+". Returns null when it can't be a real number.
 */
export function toE164Phone(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const plus = s.startsWith("+") || s.startsWith("00");
  let digits = s.replace(/[^0-9]/g, "");
  if (s.startsWith("00")) digits = digits.slice(2);
  if (!plus) {
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length === 10 && /^[6-9]/.test(digits)) digits = `91${digits}`;
    else if (!(digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2)))) return null;
  }
  if (digits.startsWith("91") && !(digits.length === 12 && /^[6-9]/.test(digits.slice(2)))) return null;
  const e164 = `+${digits}`;
  return /^\+[1-9][0-9]{7,14}$/.test(e164) ? e164 : null;
}

/** "+919876543210" → "+91 98765 43210" (other numbers are returned as stored). */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+91([6-9]\d{4})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

export const phoneSchema = z
  .string({ error: "Enter your mobile number" })
  .trim()
  .max(24)
  .transform((v, ctx) => {
    const e = toE164Phone(v);
    if (!e) {
      ctx.addIssue({ code: "custom", message: "Enter a valid mobile number, e.g. 98765 43210" });
      return z.NEVER;
    }
    return e;
  });
