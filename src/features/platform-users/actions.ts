"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { assertPlatformPermission, getPlatformContext } from "@/lib/platform/access";
import { accountStatusSchema, accountTargetSchema, createAccountSchema } from "./schemas";
import { createAccount, sendAccountPasswordReset, setAccountStatus } from "./server";

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
