"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { mapDbError } from "@/lib/supabase/errors";
import { toMinor } from "@/lib/money";
import { assertPlatformPermission, getPlatformContext } from "@/lib/platform/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateInvoicesSchema, markInvoicePaidSchema, waiveInvoiceSchema } from "./schemas";

/** Commission invoice writes. The SQL functions re-check platform.finance.manage and write the audit rows. */

async function financeActor() {
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  assertPlatformPermission(ctx, "platform.finance.manage");
  return ctx;
}

function revalidateFinance() {
  revalidatePath("/admin/commissions");
  revalidatePath("/admin/revenue");
}

function invoiceError(error: { code?: string; message?: string }): AppError {
  const msg = error.message ?? "";
  const form = (m: string) => new AppError("CONFLICT", { fieldErrors: { _form: [m] }, context: { code: error.code } });
  if (msg.includes("already settled")) return form("This invoice is already settled. Refresh the list.");
  if (msg.includes("has not ended")) return form("That month has not ended yet. Choose an earlier month.");
  if (msg.includes("first of a month")) return form("Choose a month.");
  if (msg.includes("reason is required")) return form("Give a reason for waiving this invoice.");
  return mapDbError(error);
}

export type GenerateInvoicesResult = { period: string; created: number; totalMinor: number };

export async function generateCommissionInvoicesAction(_prev: ActionResult<GenerateInvoicesResult> | null, fd: FormData): Promise<ActionResult<GenerateInvoicesResult>> {
  const result = await runAction("platform.commissions.generate", async () => {
    const input = parseInput(generateInvoicesSchema, formToObject(fd));
    await financeActor();
    const { data, error } = await (await createSupabaseServerClient()).rpc("platform_generate_commission_invoices", { p_period_start: input.period });
    if (error) throw invoiceError(error);
    const row = data?.[0];
    return { period: input.period.slice(0, 7), created: Number(row?.created ?? 0), totalMinor: toMinor(String(row?.total_commission ?? 0)) };
  });
  if (result.ok) revalidateFinance();
  return result;
}

export async function markCommissionInvoicePaidAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.commissions.markPaid", async () => {
    const input = parseInput(markInvoicePaidSchema, formToObject(fd));
    await financeActor();
    const { error } = await (await createSupabaseServerClient()).rpc("platform_set_commission_invoice_status", {
      p_invoice: input.invoiceId,
      p_status: "paid",
      ...(input.reference ? { p_reference: input.reference } : {}),
    });
    if (error) throw invoiceError(error);
  });
  if (result.ok) revalidateFinance();
  return result;
}

export async function waiveCommissionInvoiceAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.commissions.waive", async () => {
    const input = parseInput(waiveInvoiceSchema, formToObject(fd));
    await financeActor();
    const { error } = await (await createSupabaseServerClient()).rpc("platform_set_commission_invoice_status", { p_invoice: input.invoiceId, p_status: "waived", p_note: input.reason });
    if (error) throw invoiceError(error);
  });
  if (result.ok) revalidateFinance();
  return result;
}
