import { z } from "zod";
import { email } from "@/lib/validation/common";

/** Account types shown in the Super Admin user directory (a person can have several). */
export const USER_TYPES = ["platform", "seller", "customer", "account"] as const;
export type UserType = (typeof USER_TYPES)[number];
export const USER_TYPE_LABEL: Record<UserType, string> = { platform: "Platform staff", seller: "Seller", customer: "Customer", account: "No store yet" };

const optionalText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().max(max).optional());

export const userDirectoryFilterSchema = z.object({
  q: optionalText(120),
  type: z.enum(USER_TYPES).optional().catch(undefined),
  store: z.uuid().optional().catch(undefined),
  view: z.enum(["list", "grid"]).catch("list"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type UserDirectoryFilter = z.infer<typeof userDirectoryFilterSchema>;
export const USER_PAGE_SIZE = 25;

export const createAccountSchema = z.object({
  email,
  displayName: z.string().trim().min(2, "Enter a name").max(120),
  password: z.preprocess((v) => (typeof v === "string" && v ? v : undefined), z.string().min(10, "Use at least 10 characters").max(72).optional()),
});

const reason = z.string().trim().min(10, "Give a reason of at least 10 characters").max(500);

export const accountTargetSchema = z.object({ userId: z.uuid(), reason });
export const accountStatusSchema = z.object({ userId: z.uuid(), status: z.enum(["active", "disabled"]), reason });

export type DirectoryStore = { tenantId: string; name: string; slug: string; role: string; status: string; theme: string | null };

export type DirectoryUser = {
  userId: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  platformRole: string | null;
  stores: DirectoryStore[];
  customerStores: number;
  types: UserType[];
};

export type UserStats = { total: number; platform: number; sellers: number; customers: number };

export type UserDetail = {
  userId: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  profileStatus: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  bannedUntil: string | null;
  /** Sign-in currently blocked (ban end in the future), computed on the server. */
  banned: boolean;
  providers: string[];
  platform: { role: string; status: string; since: string } | null;
  stores: (DirectoryStore & { tenantStatus: string; plan: string | null; since: string })[];
  customerOf: { tenantId: string; name: string; slug: string; orders: number; spentMinor: number; lastOrderAt: string | null; status: string }[];
  audit: { id: number; createdAt: string; action: string; actorType: string; tenantId: string | null; entityType: string | null; entityId: string | null; asActor: boolean }[];
  signIns: { at: string; action: string; ip: string | null }[];
};

/** Type labels in display order; an account with no store, shopper record or staff role is "account". */
export function userTypes(u: { platformRole: string | null; stores: readonly unknown[]; customerStores: number }): UserType[] {
  const t: UserType[] = [];
  if (u.platformRole) t.push("platform");
  if (u.stores.length) t.push("seller");
  if (u.customerStores > 0) t.push("customer");
  return t.length ? t : ["account"];
}
