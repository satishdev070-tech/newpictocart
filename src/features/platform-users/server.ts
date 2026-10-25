import "server-only";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { toMinor } from "@/lib/money";
import { randomToken } from "@/lib/crypto";
import { platformOrigin } from "@/lib/platform/urls";
import { assertPlatformPermission, type PlatformContext } from "@/lib/platform/access";
import { sendEmail, type EmailSendResult } from "@/lib/email/send";
import { PLATFORM_NAME } from "@/config/platform";
import { renderAdminPasswordResetEmail } from "@/features/notifications/email/account-templates";
import { isMissingSchemaError } from "@/features/platform/schemas";
import { USER_PAGE_SIZE, userTypes, type DirectoryStore, type DirectoryUser, type UserDetail, type UserDirectoryFilter, type UserStats } from "./schemas";

/**
 * Super Admin user directory: every auth account with its type (platform staff / seller /
 * customer). Reads go through SECURITY DEFINER functions gated on platform.users.manage
 * (migration 3700); account writes use the secret-key client only after that same check
 * (ADR-006) and are audited. Platform staff accounts are managed on Platform users, never here.
 */

const storeSchema = z.object({ tenantId: z.string(), name: z.string(), slug: z.string(), role: z.string(), status: z.string(), theme: z.string().nullable().catch(null) });

export type Directory = { available: boolean; rows: DirectoryUser[]; total: number };

export async function listUserDirectory(f: UserDirectoryFilter): Promise<Directory> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("platform_user_directory", {
    p_search: f.q ?? undefined,
    p_type: f.type ?? undefined,
    p_tenant: f.store ?? undefined,
    p_limit: USER_PAGE_SIZE,
    p_offset: (f.page - 1) * USER_PAGE_SIZE,
  });
  if (error) {
    if (isMissingSchemaError(error)) return { available: false, rows: [], total: 0 };
    throw mapDbError(error);
  }
  const rows = (data ?? []).map((r): DirectoryUser => {
    const stores = z.array(storeSchema).catch([]).parse(r.stores) as DirectoryStore[];
    const base = { platformRole: r.platform_role, stores, customerStores: r.customer_stores ?? 0 };
    return {
      userId: r.user_id,
      email: r.email,
      phone: r.phone,
      displayName: r.display_name,
      createdAt: r.created_at,
      lastSignInAt: r.last_sign_in_at,
      emailConfirmed: Boolean(r.email_confirmed),
      ...base,
      types: userTypes(base),
    };
  });
  return { available: true, rows, total: Number(data?.[0]?.total_count ?? 0) };
}

export async function getUserStats(): Promise<UserStats | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("platform_user_stats");
  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw mapDbError(error);
  }
  const r = data?.[0];
  return { total: Number(r?.total ?? 0), platform: Number(r?.platform ?? 0), sellers: Number(r?.sellers ?? 0), customers: Number(r?.customers ?? 0) };
}

const detailSchema = z.object({
  userId: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  displayName: z.string().nullable(),
  profileStatus: z.string().nullable(),
  createdAt: z.string(),
  lastSignInAt: z.string().nullable(),
  emailConfirmedAt: z.string().nullable(),
  bannedUntil: z.string().nullable(),
  providers: z.array(z.string()).catch([]),
  platform: z.object({ role: z.string(), status: z.string(), since: z.string() }).nullable(),
  stores: z.array(storeSchema.extend({ tenantStatus: z.string(), plan: z.string().nullable(), since: z.string() })).catch([]),
  customerOf: z
    .array(z.object({ tenantId: z.string(), name: z.string(), slug: z.string(), orders: z.coerce.number(), spent: z.union([z.number(), z.string()]), lastOrderAt: z.string().nullable(), status: z.string() }))
    .catch([]),
  audit: z
    .array(z.object({ id: z.coerce.number(), createdAt: z.string(), action: z.string(), actorType: z.string(), tenantId: z.string().nullable(), entityType: z.string().nullable(), entityId: z.string().nullable(), asActor: z.boolean() }))
    .catch([]),
  signIns: z.array(z.object({ at: z.string(), action: z.string().catch("sign-in"), ip: z.string().nullable().catch(null) })).catch([]),
});

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("platform_user_detail", { p_user: userId });
  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw mapDbError(error);
  }
  if (!data) return null;
  const d = detailSchema.parse(data);
  return { ...d, banned: d.bannedUntil !== null && Date.parse(d.bannedUntil) > Date.now(), customerOf: d.customerOf.map(({ spent, ...c }) => ({ ...c, spentMinor: toMinor(spent) })) };
}

/** Store filter options (newest 300). RLS limits this to platform.tenants.read. */
export async function listStoreOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("tenants").select("id, name").order("created_at", { ascending: false }).limit(300);
  if (error) throw mapDbError(error);
  return data ?? [];
}

// ---- Writes ---------------------------------------------------------------------------------

function formError(message: string, field = "_form"): AppError {
  return new AppError("VALIDATION", { message, fieldErrors: { [field]: [message] } });
}

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/** The target must exist, must not be platform staff and must not be the acting admin. */
async function manageableAccount(admin: Admin, ctx: PlatformContext, userId: string): Promise<{ email: string }> {
  if (userId === ctx.user.id) throw formError("You can't change your own account here.");
  const [{ data: staff }, { data: user }] = await Promise.all([admin.from("platform_memberships").select("user_id").eq("user_id", userId).maybeSingle(), admin.auth.admin.getUserById(userId)]);
  if (!user?.user) throw new AppError("NOT_FOUND", { message: "That account no longer exists." });
  if (staff) throw new AppError("FORBIDDEN", { message: "Platform staff are managed on Platform users." });
  if (!user.user.email) throw formError("This account has no email address.");
  return { email: user.user.email };
}

async function resetLink(admin: Admin, email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) throw new AppError("INTERNAL", { message: "Couldn't create a reset link.", context: { error: error?.message } });
  const url = new URL("/auth/confirm", platformOrigin());
  url.searchParams.set("token_hash", hash);
  url.searchParams.set("type", "recovery");
  url.searchParams.set("next", "/reset-password");
  return url.toString();
}

async function emailResetLink(email: string, link: string, userId: string): Promise<EmailSendResult> {
  const mail = renderAdminPasswordResetEmail({ brand: { storeName: PLATFORM_NAME, logoUrl: null, storeUrl: platformOrigin(), accent: null, supportEmail: null }, storeName: PLATFORM_NAME, actionUrl: link });
  return sendEmail({ tenantId: null, kind: "platform_password_reset", to: email, ...mail, fromName: PLATFORM_NAME, idempotencyKey: `account-reset:${userId}:${randomToken(6)}` });
}

export type CreatedAccount = { userId: string; email: string; link: string | null; emailStatus: EmailSendResult["status"] | null };

/**
 * Creates a confirmed account. With a password the person can sign in straight away; without one
 * they get a one-time set-password link by email (also returned once so it can be shared).
 */
export async function createAccount(ctx: PlatformContext, input: { email: string; displayName: string; password?: string }): Promise<CreatedAccount> {
  assertPlatformPermission(ctx, "platform.users.manage");
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.displayName },
  });
  if (error || !data.user) {
    const msg = error?.message ?? "";
    if (/already|registered|exists/i.test(msg)) throw formError("An account with this email already exists.", "email");
    if (/password/i.test(msg)) throw formError("That password was rejected as too weak. Try a longer one.", "password");
    throw new AppError("INTERNAL", { message: "Couldn't create the account.", context: { error: msg } });
  }
  const userId = data.user.id;
  await admin.from("profiles").upsert({ id: userId, display_name: input.displayName }, { onConflict: "id" });
  let link: string | null = null;
  let emailStatus: EmailSendResult["status"] | null = null;
  if (!input.password) {
    link = await resetLink(admin, input.email);
    emailStatus = (await emailResetLink(input.email, link, userId)).status;
  }
  await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "account.created_by_platform", entityType: "user", entityId: userId, metadata: { with_password: Boolean(input.password), email_status: emailStatus } });
  return { userId, email: input.email, link, emailStatus };
}

export async function sendAccountPasswordReset(ctx: PlatformContext, input: { userId: string; reason: string }): Promise<{ email: string; link: string; emailStatus: EmailSendResult["status"] }> {
  assertPlatformPermission(ctx, "platform.users.manage");
  const admin = createSupabaseAdminClient();
  const t = await manageableAccount(admin, ctx, input.userId);
  const link = await resetLink(admin, t.email);
  const r = await emailResetLink(t.email, link, input.userId);
  await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "account.password_reset_sent", entityType: "user", entityId: input.userId, metadata: { reason: input.reason, email_status: r.status } });
  return { email: t.email, link, emailStatus: r.status };
}

/** Disabling bans sign-in (Supabase Auth) and marks the profile disabled; enabling reverses both. */
export async function setAccountStatus(ctx: PlatformContext, input: { userId: string; status: "active" | "disabled"; reason: string }): Promise<void> {
  assertPlatformPermission(ctx, "platform.users.manage");
  const admin = createSupabaseAdminClient();
  await manageableAccount(admin, ctx, input.userId);
  const { error } = await admin.auth.admin.updateUserById(input.userId, { ban_duration: input.status === "disabled" ? "876000h" : "none" });
  if (error) throw new AppError("INTERNAL", { message: "Couldn't update the account.", context: { error: error.message } });
  const { error: pErr } = await admin.from("profiles").upsert({ id: input.userId, status: input.status }, { onConflict: "id" });
  if (pErr) throw mapDbError(pErr);
  await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: input.status === "disabled" ? "account.disabled" : "account.enabled", entityType: "user", entityId: input.userId, metadata: { reason: input.reason } });
}
