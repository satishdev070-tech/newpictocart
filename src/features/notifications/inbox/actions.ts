"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { assertPermission, requireTenant } from "@/lib/tenant/membership";
import { getPlatformContext } from "@/lib/platform/access";
import type { NotificationScope, NotificationType } from "./catalog";
import { markAllReadSchema, markReadSchema, markUnreadSchema, preferencesSchema, scopeSchema } from "./schemas";
import { getBellData, markRead, markUnread, saveMutedTypes, type BellData, type InboxAudience } from "./server";

/**
 * The client only says WHICH inbox (seller dashboard or platform console). Who and which store are
 * resolved here: membership of the active store (any member has store.read) or active platform
 * staff. Read state is per user, so no further permission applies.
 */
async function audienceFor(scope: NotificationScope): Promise<InboxAudience> {
  if (scope === "tenant") {
    const ctx = await requireTenant();
    assertPermission(ctx, "store.read");
    return { userId: ctx.user.id, scope, tenantId: ctx.tenantId };
  }
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  return { userId: ctx.user.id, scope, tenantId: null };
}

const pagePath = (scope: NotificationScope) => (scope === "tenant" ? "/dashboard/notifications" : "/admin/notifications");

/** Bell refresh (realtime event or polling fallback). */
export async function refreshBellAction(scope: NotificationScope): Promise<ActionResult<BellData>> {
  return runAction("notifications.refresh", async () => {
    const s = parseInput(scopeSchema, scope);
    return getBellData(await audienceFor(s));
  });
}

export async function markReadAction(input: { scope: NotificationScope; ids: string[] }): Promise<ActionResult<number>> {
  return runAction("notifications.markRead", async () => {
    const { scope, ids } = parseInput(markReadSchema, input);
    return markRead(await audienceFor(scope), ids);
  });
}

export async function markAllReadAction(input: { scope: NotificationScope }): Promise<ActionResult<number>> {
  const result = await runAction("notifications.markAllRead", async () => {
    const { scope } = parseInput(markAllReadSchema, input);
    return markRead(await audienceFor(scope), "all");
  });
  if (result.ok) revalidatePath(pagePath(input.scope));
  return result;
}

export async function markUnreadAction(input: { scope: NotificationScope; id: string }): Promise<ActionResult> {
  const result = await runAction("notifications.markUnread", async () => {
    const { scope, id } = parseInput(markUnreadSchema, input);
    await markUnread(await audienceFor(scope), id);
  });
  if (result.ok) revalidatePath(pagePath(input.scope));
  return result;
}

/** In-app preferences: types left unchecked are muted for this user (producers skip them). */
export async function savePreferencesAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const raw = formToObject(fd);
  const result = await runAction("notifications.savePreferences", async () => {
    const input = parseInput(preferencesSchema, raw);
    const a = await audienceFor(input.scope);
    const enabled = new Set(input.enabled);
    const muted = input.offered.filter((t) => !enabled.has(t)) as NotificationType[];
    await saveMutedTypes(a.userId, input.scope, muted);
  });
  if (result.ok) revalidatePath(pagePath(raw.scope === "platform" ? "platform" : "tenant"));
  return result;
}
