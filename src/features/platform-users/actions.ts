"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { assertPlatformPermission, getPlatformContext } from "@/lib/platform/access";
import { accountStatusSchema, accountTargetSchema, addCustomerRoleSchema, createAccountSchema, deleteAccountSchema } from "./schemas";
import { addCustomerRole, createAccount, deleteAccount, grantSuperAdmin, revokeSuperAdmin, sendAccountPasswordReset, setAccountStatus, setTemporaryPassword, type DeletedAccount } from "./server";

async function actor() {
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  assertPlatformPermission(ctx, "platform.users.manage");
  return ctx;
}

export type AccountLinkResult = { email: string; link: string | null; emailStatus: string | null };

export async function createAccountAction(_prev: ActionResult<AccountLinkResult> | null, fd: FormData): Promise<ActionResult<AccountLinkResult>> {
  return runAction("platform.account.create", async () => {
    const input = parseInput(createAccountSchema, formToObject(fd));
    const ctx = await actor();
    await rateLimit("platform-account-create", ctx.user.id, 30, 3600);
    const r = await createAccount(ctx, input);
    revalidatePath("/admin/users");
    return { email: r.email, link: r.link, emailStatus: r.emailStatus };
  });
}

export async function sendAccountResetAction(_prev: ActionResult<AccountLinkResult> | null, fd: FormData): Promise<ActionResult<AccountLinkResult>> {
  return runAction("platform.account.resetPassword", async () => {
    const input = parseInput(accountTargetSchema, formToObject(fd));
    const ctx = await actor();
    await rateLimit("platform-account-reset", ctx.user.id, 30, 3600);
    const r = await sendAccountPasswordReset(ctx, input);
    return { email: r.email, link: r.link, emailStatus: r.emailStatus };
  });
}

export async function setAccountStatusAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("platform.account.setStatus", async () => {
    const input = parseInput(accountStatusSchema, formToObject(fd));
    const ctx = await actor();
    await setAccountStatus(ctx, input);
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${input.userId}`);
  });
}

function refresh(userId: string) {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/platform-users");
}

export async function grantSuperAdminAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("platform.account.grantSuperAdmin", async () => {
    const input = parseInput(accountTargetSchema, formToObject(fd));
    const ctx = await actor();
    await grantSuperAdmin(ctx, input);
    refresh(input.userId);
  });
}

export async function revokeSuperAdminAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("platform.account.revokeSuperAdmin", async () => {
    const input = parseInput(accountTargetSchema, formToObject(fd));
    const ctx = await actor();
    await revokeSuperAdmin(ctx, input);
    refresh(input.userId);
  });
}

export async function addCustomerRoleAction(_prev: ActionResult<{ storeName: string }> | null, fd: FormData): Promise<ActionResult<{ storeName: string }>> {
  return runAction("platform.account.addCustomer", async () => {
    const input = parseInput(addCustomerRoleSchema, formToObject(fd));
    const ctx = await actor();
    const r = await addCustomerRole(ctx, input);
    refresh(input.userId);
    return r;
  });
}

export async function setTemporaryPasswordAction(_prev: ActionResult<{ email: string | null; password: string }> | null, fd: FormData): Promise<ActionResult<{ email: string | null; password: string }>> {
  return runAction("platform.account.tempPassword", async () => {
    const input = parseInput(accountTargetSchema, formToObject(fd));
    const ctx = await actor();
    await rateLimit("platform-account-temp-password", ctx.user.id, 20, 3600);
    return setTemporaryPassword(ctx, input);
  });
}

export async function deleteAccountAction(_prev: ActionResult<DeletedAccount> | null, fd: FormData): Promise<ActionResult<DeletedAccount>> {
  return runAction("platform.account.delete", async () => {
    const input = parseInput(deleteAccountSchema, formToObject(fd));
    const ctx = await actor();
    await rateLimit("platform-account-delete", ctx.user.id, 20, 3600);
    const r = await deleteAccount(ctx, input);
    revalidatePath("/admin/users");
    revalidatePath("/admin/tenants");
    return r;
  });
}
