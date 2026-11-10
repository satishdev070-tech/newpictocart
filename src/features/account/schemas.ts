import { z } from "zod";
import { password } from "@/features/auth/schemas";

/** Own profile (profiles row). Phone is optional; Indian and international formats are accepted. */
export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name").max(80),
  phone: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/[\s-]/g, "") : v),
    z.union([z.literal(""), z.string().regex(/^\+?[0-9]{7,15}$/, "Enter a valid phone number")]).optional(),
  ),
});

export const changePasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export const deletionRequestSchema = z.object({ reason: z.string().trim().max(500).optional() });

export type Countdown = { expired: boolean; days: number; hours: number; minutes: number };

/** Time left until `iso` (whole days/hours/minutes), or null without a date. */
export function countdown(iso: string | null | undefined, now: number = Date.now()): Countdown | null {
  if (!iso) return null;
  const end = Date.parse(iso);
  if (!Number.isFinite(end)) return null;
  const ms = end - now;
  if (ms <= 0) return { expired: true, days: 0, hours: 0, minutes: 0 };
  const minutes = Math.floor(ms / 60_000);
  return { expired: false, days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 };
}

/** "300d : 22h : 01m" */
export function formatCountdown(c: Countdown): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${c.days}d : ${pad(c.hours)}h : ${pad(c.minutes)}m`;
}

/** First letter for the avatar circle. */
export function avatarInitial(name: string | null | undefined, email: string | null | undefined): string {
  const src = (name ?? "").trim() || (email ?? "").trim() || "?";
  return src.slice(0, 1).toUpperCase();
}

export type ExportInput = {
  user: { id: string; email: string | null };
  profile: Record<string, unknown> | null;
  memberships: { tenant_id: string; role: string; status: string; created_at?: string | null }[];
  stores: Record<string, unknown>[];
  products: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  generatedAt: string;
};

/** Shape of the "Export your data" JSON (DPDP access request). Pure, so it is unit tested. */
export function buildExport(i: ExportInput) {
  return {
    format: "pictocart-account-export",
    version: 1,
    generatedAt: i.generatedAt,
    account: { id: i.user.id, email: i.user.email },
    profile: i.profile,
    memberships: i.memberships,
    stores: i.stores,
    products: i.products,
    orders: i.orders,
    counts: { stores: i.stores.length, products: i.products.length, orders: i.orders.length },
  };
}

export function exportFilename(date: Date): string {
  return `pictocart-data-${date.toISOString().slice(0, 10)}.json`;
}
