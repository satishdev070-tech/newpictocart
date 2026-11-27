import { z } from "zod";
import { email } from "@/lib/validation/common";

/** Account types shown in the Super Admin user directory (a person can have several). */
export const USER_TYPES = ["platform", "seller", "customer", "account"] as const;
export type UserType = (typeof USER_TYPES)[number];
export const USER_TYPE_LABEL: Record<UserType, string> = { platform: "Platform staff", seller: "Seller", customer: "Customer", account: "No store yet" };

const optionalText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().max(max).optional());

/** Website type of a store (tenants.website_type, migration 8000). */
export const SITE_TYPES = ["ONLINE_STORE", "INFORMATIVE"] as const;
export type SiteType = (typeof SITE_TYPES)[number];
export const SITE_TYPE_LABEL: Record<SiteType, string> = { ONLINE_STORE: "Online Store", INFORMATIVE: "Informative Website" };

export const userDirectoryFilterSchema = z.object({
  q: optionalText(120),
  type: z.enum(USER_TYPES).optional().catch(undefined),
  site: z.enum(SITE_TYPES).optional().catch(undefined),
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
export const addCustomerRoleSchema = z.object({ userId: z.uuid(), tenantId: z.uuid("Choose a store"), reason });
/** `confirm` is checked against the exact phrase in rules.ts (server side too). */
export const deleteAccountSchema = z.object({ userId: z.uuid(), reason, confirm: z.string().max(20) });
export const accountStatusSchema = z.object({ userId: z.uuid(), status: z.enum(["active", "disabled"]), reason });

export type DirectoryStore = { tenantId: string; name: string; slug: string; role: string; status: string; theme: string | null; websiteType: SiteType };

/** One store in the directory/detail `stores` JSON; `websiteType` is only sent by v2 (9300). */
export const directoryStoreSchema = z.object({
  tenantId: z.string(),
  name: z.string(),
  slug: z.string(),
  role: z.string(),
  status: z.string(),
  theme: z.string().nullable().catch(null),
  websiteType: z.enum(SITE_TYPES).catch("ONLINE_STORE"),
});

export type DirectoryUser = {
  userId: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  /** Phone confirmed over WhatsApp (profiles.phone_verified_at); false on the v1 directory. */
  phoneVerified: boolean;
  platformRole: string | null;
  stores: DirectoryStore[];
  customerStores: number;
  types: UserType[];
  /** Website types across the user's stores (both when they run one of each). */
  siteTypes: SiteType[];
};

/** A row from platform_user_directory (3700) or platform_user_directory_v2 (9300). */
export type DirectoryRow = {
  user_id: string;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean | null;
  platform_role: string | null;
  stores: unknown;
  customer_stores: number | null;
  phone_verified?: boolean | null;
  site_types?: string[] | null;
};

/** Maps one RPC row to the page model. v1 rows have no phone_verified/site_types: derive from stores. */
export function toDirectoryUser(r: DirectoryRow): DirectoryUser {
  const stores: DirectoryStore[] = z.array(directoryStoreSchema).catch([]).parse(r.stores);
  const base = { platformRole: r.platform_role, stores, customerStores: r.customer_stores ?? 0 };
  const fromRow = Array.isArray(r.site_types) ? r.site_types : stores.map((s) => s.websiteType);
  const siteTypes = SITE_TYPES.filter((t) => fromRow.includes(t));
  return {
    userId: r.user_id,
    email: r.email,
    phone: r.phone,
    displayName: r.display_name,
    createdAt: r.created_at,
    lastSignInAt: r.last_sign_in_at,
    emailConfirmed: Boolean(r.email_confirmed),
    phoneVerified: Boolean(r.phone_verified),
    ...base,
    types: userTypes(base),
    siteTypes,
  };
}

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
