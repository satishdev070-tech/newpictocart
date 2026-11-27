"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { clientIpKey, rateLimit } from "@/lib/rate-limit";
import { sha256Hex } from "@/lib/crypto";
import { assertPermission, requireTenant } from "@/lib/tenant/membership";
import { assertPlatformPermission, getPlatformContext } from "@/lib/platform/access";
import {
  addDaySlotsSchema,
  bookTeamCallPublicSchema,
  bookTeamCallSchema,
  cancelTeamCallSchema,
  istLocalToIso,
  saveSlotSchema,
  slotIdSchema,
  updateBookingSchema,
} from "./schemas";
import { addDaySlots, bookTeamCall, cancelMyTeamCall, deleteSlot, saveSlot, updateBooking } from "./server";

export type BookResult = { bookingId: string };

const RATE_MESSAGE = "Too many booking attempts. Please try again in a little while.";
async function limited(bucket: string, subject: string, limit: number, windowSeconds: number) {
  try {
    await rateLimit(bucket, subject, limit, windowSeconds);
  } catch (err) {
    if (err instanceof AppError && err.code === "RATE_LIMITED") throw new AppError("RATE_LIMITED", { fieldErrors: { _form: [RATE_MESSAGE] } });
    throw err;
  }
}

/** Dashboard → Book a free call. The store is the member's own (never from the form). */
export async function bookTeamCallAction(_prev: ActionResult<BookResult> | null, fd: FormData): Promise<ActionResult<BookResult>> {
  return runAction("teamCalls.book", async () => {
    const input = parseInput(bookTeamCallSchema, formToObject(fd));
    const ctx = await requireTenant();
    assertPermission(ctx, "store.read");
    await limited("team-call-book", ctx.user.id, 10, 3600);
    const bookingId = await bookTeamCall({ ...input, email: ctx.user.email, source: "dashboard", tenantId: ctx.tenantId });
    revalidatePath("/dashboard/book-call");
    return { bookingId };
  });
}

/** Marketing site → Book a free call (no account). Rate-limited per IP and per phone. */
export async function bookTeamCallPublicAction(_prev: ActionResult<BookResult> | null, fd: FormData): Promise<ActionResult<BookResult>> {
  return runAction("teamCalls.bookPublic", async () => {
    const input = parseInput(bookTeamCallPublicSchema, formToObject(fd));
    // Bots fill the hidden field; answer like a success so they learn nothing.
    if (input.website) return { bookingId: "00000000-0000-4000-8000-000000000000" };
    await limited("team-call-public-ip", await clientIpKey(), 5, 3600);
    await limited("team-call-public-phone", sha256Hex(input.phone).slice(0, 24), 3, 86_400);
    const bookingId = await bookTeamCall({ slotId: input.slotId, name: input.name, email: input.email, phone: input.phone, topic: input.topic, source: "landing" });
    return { bookingId };
  });
}

export async function cancelMyTeamCallAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("teamCalls.cancelMine", async () => {
    const input = parseInput(cancelTeamCallSchema, formToObject(fd));
    await requireTenant();
    await cancelMyTeamCall(input.bookingId);
    revalidatePath("/dashboard/book-call");
  });
}

// ------------------------------------------------------------------ Super Admin

async function staff() {
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  assertPlatformPermission(ctx, "platform.users.manage");
  return ctx;
}

export async function saveTeamCallSlotAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("teamCalls.saveSlot", async () => {
    const input = parseInput(saveSlotSchema, formToObject(fd));
    await staff();
    await saveSlot({ ...input, startsAt: istLocalToIso(input.startsAt) });
    revalidatePath("/admin/team-calls");
  });
}

export async function addTeamCallDayAction(_prev: ActionResult<{ added: number }> | null, fd: FormData): Promise<ActionResult<{ added: number }>> {
  return runAction("teamCalls.addDay", async () => {
    const input = parseInput(addDaySlotsSchema, formToObject(fd));
    await staff();
    const added = await addDaySlots(input);
    revalidatePath("/admin/team-calls");
    return { added };
  });
}

export async function deleteTeamCallSlotAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("teamCalls.deleteSlot", async () => {
    const input = parseInput(slotIdSchema, formToObject(fd));
    await staff();
    await deleteSlot(input.id);
    revalidatePath("/admin/team-calls");
  });
}

export async function updateTeamCallBookingAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("teamCalls.updateBooking", async () => {
    const input = parseInput(updateBookingSchema, formToObject(fd));
    await staff();
    await updateBooking(input);
    revalidatePath("/admin/team-calls");
  });
}
