"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { listMemberships } from "@/lib/tenant/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { sendEmail } from "@/lib/email/send";
import { randomToken } from "@/lib/crypto";
import { PLATFORM_NAME } from "@/config/platform";
import { logger } from "@/lib/observability/logger";
import { changePasswordSchema, deletionRequestSchema, updateProfileSchema } from "./schemas";

/**
 * My Profile actions for the signed-in person (seller or platform staff). Every write uses the
 * user's own session, so RLS limits it to their own profiles row / auth account.
 */

export async function updateProfileAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("account.updateProfile", async () => {
    const input = parseInput(updateProfileSchema, formToObject(fd));
    const user = await requireUser();
    await rateLimit("account-profile", user.id, 30, 3600);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("profiles").update({ display_name: input.displayName, phone: input.phone || null }).eq("id", user.id);
    if (error) throw mapDbError(error);
    await supabase.auth.updateUser({ data: { display_name: input.displayName } });
    revalidatePath("/dashboard", "layout");
    revalidatePath("/admin", "layout");
  });
}

export async function changePasswordAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("account.changePassword", async () => {
    const input = parseInput(changePasswordSchema, formToObject(fd));
    const user = await requireUser();
    await rateLimit("account-password", user.id, 5, 3600);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) {
      const msg = /same|different/i.test(error.message) ? "Choose a password you haven't used for this account." : /weak|pwned|leaked/i.test(error.message) ? "That password is too easy to guess. Try a longer one." : "Couldn't change your password. Sign in again and retry.";
      throw new AppError("VALIDATION", { fieldErrors: { password: [msg] } });
    }
    await audit({ tenantId: null, actorUserId: user.id, actorType: "user", action: "account.password_changed", entityType: "user", entityId: user.id });
  });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * DPDP deletion request. Nothing is deleted here: the request is audited (platform level, and in
 * each store the person belongs to) and a super admin completes it from Admin → Users.
 */
export async function requestAccountDeletionAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("account.requestDeletion", async () => {
    const input = parseInput(deletionRequestSchema, formToObject(fd));
    const user = await requireUser();
    await rateLimit("account-deletion", user.id, 3, 86_400);
    const memberships = await listMemberships(user.id);
    const metadata = { reason: input.reason ?? null, email: user.email, stores: memberships.map((m) => m.tenantId) };
    await audit({ tenantId: null, actorUserId: user.id, actorType: "user", action: "account.deletion_requested", entityType: "user", entityId: user.id, metadata });
    for (const m of memberships) {
      await audit({ tenantId: m.tenantId, actorUserId: user.id, actorType: "user", action: "account.deletion_requested", entityType: "user", entityId: user.id, metadata: { reason: input.reason ?? null } });
    }
    if (user.email) {
      const text = `We received your request to delete your ${PLATFORM_NAME} account (${user.email}). It is processed within 7 days; your stores and their data will be permanently removed. If you didn't ask for this, reply to this email right away.`;
      try {
        await sendEmail({
          tenantId: null,
          kind: "account_deletion_requested",
          to: user.email,
          subject: `Your ${PLATFORM_NAME} account deletion request`,
          html: `<p>${esc(text)}</p>`,
          text,
          fromName: PLATFORM_NAME,
          idempotencyKey: `account-deletion:${user.id}:${randomToken(6)}`,
        });
      } catch (err) {
        logger.warn("account.deletion_email_failed", { error: err });
      }
    }
  });
}
