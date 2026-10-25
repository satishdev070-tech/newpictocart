"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { toDecimalString } from "@/lib/money";
import { assertPlatformPermission, getPlatformContext } from "@/lib/platform/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/features/platform/schemas";
import { actionCostSchema, packCodeSchema, packSchema, pricingSchema, pricingToRow, promoSchema, promoToggleSchema } from "./economy-schemas";
import { creditAdjustmentSchema } from "./schemas";

const PATH = "/admin/credits-economy";
const PENDING = "Credits economy needs migration 20261025003900_ai_economy.sql. Apply it, then try again.";

async function platformActor() {
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  assertPlatformPermission(ctx, "platform.settings.manage");
  return ctx;
}

function dbFail(error: { code?: string; message?: string }, operation: string, duplicate?: string): never {
  if (isMissingSchemaError(error)) throw new AppError("CONFLICT", { fieldErrors: { _form: [PENDING] }, context: { code: error.code } });
  if (error.code === "23505" && duplicate) throw new AppError("CONFLICT", { fieldErrors: { _form: [duplicate] } });
  if (error.code === "23514") throw new AppError("VALIDATION", { fieldErrors: { _form: ["These values are outside the allowed range."] } });
  if (error.code === "42501") throw new AppError("FORBIDDEN");
  throw new AppError("INTERNAL", { context: { operation, code: error.code } });
}

export async function savePricingAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.creditsEconomy.pricing.save", async () => {
    const p = parseInput(pricingSchema, formToObject(fd));
    const ctx = await platformActor();
    const { data, error } = await (await createSupabaseServerClient()).from("ai_credit_settings").update({ ...pricingToRow(p), updated_by: ctx.user.id }).eq("id", 1).select("id");
    if (error) dbFail(error, "ai_credit_settings_update");
    if (!data?.length) throw new AppError("CONFLICT", { fieldErrors: { _form: [PENDING] } });
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "credits_economy.pricing_saved", entityType: "ai_credit_settings", entityId: "1", metadata: { ...p } });
  });
  if (result.ok) revalidatePath(PATH);
  return result;
}

export async function saveActionCostAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.creditsEconomy.actionCost.save", async () => {
    const input = parseInput(actionCostSchema, formToObject(fd));
    const ctx = await platformActor();
    const { error } = await (await createSupabaseServerClient()).from("ai_credit_action_costs").upsert({ kind: input.kind, label: input.label, credits: input.credits, minutes_saved: input.minutesSaved, updated_by: ctx.user.id }, { onConflict: "kind" });
    if (error) dbFail(error, "ai_credit_action_cost_save");
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "credits_economy.action_cost_saved", entityType: "ai_credit_action_cost", entityId: input.kind, metadata: { credits: input.credits, minutesSaved: input.minutesSaved } });
  });
  if (result.ok) revalidatePath(PATH);
  return result;
}

/** Create or update a pack by code (`mode=create` refuses an existing code). */
export async function savePackAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.creditsEconomy.pack.save", async () => {
    const raw = formToObject(fd);
    const input = parseInput(packSchema, raw);
    const ctx = await platformActor();
    const supabase = await createSupabaseServerClient();
    const row = { code: input.code, label: input.label, credits: input.credits, price: Number(toDecimalString(input.price)), active: input.active, sort_order: input.sortOrder, updated_by: ctx.user.id };
    const { error } = raw.mode === "create" ? await supabase.from("ai_credit_packs").insert(row) : await supabase.from("ai_credit_packs").update(row).eq("code", input.code);
    if (error) dbFail(error, "ai_credit_pack_save", "A pack with this code already exists.");
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: raw.mode === "create" ? "credits_economy.pack_created" : "credits_economy.pack_updated", entityType: "ai_credit_pack", entityId: input.code, metadata: { credits: input.credits, priceMinor: input.price, active: input.active } });
  });
  if (result.ok) revalidatePath(PATH);
  return result;
}

export async function deletePackAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.creditsEconomy.pack.delete", async () => {
    const input = parseInput(packCodeSchema, formToObject(fd));
    const ctx = await platformActor();
    const { error } = await (await createSupabaseServerClient()).from("ai_credit_packs").delete().eq("code", input.code);
    if (error) dbFail(error, "ai_credit_pack_delete");
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "credits_economy.pack_deleted", entityType: "ai_credit_pack", entityId: input.code });
  });
  if (result.ok) revalidatePath(PATH);
  return result;
}

export async function createPromoAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.creditsEconomy.promo.create", async () => {
    const input = parseInput(promoSchema, formToObject(fd));
    const ctx = await platformActor();
    const { data, error } = await (await createSupabaseServerClient())
      .from("ai_credit_promos")
      .insert({ code: input.code, bonus_pct: input.bonusPct, starts_at: input.startsAt ?? null, ends_at: input.endsAt ?? null, max_uses: input.maxUses ?? null, created_by: ctx.user.id })
      .select("id")
      .single();
    if (error) dbFail(error, "ai_credit_promo_create", "A promo with this code already exists.");
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "credits_economy.promo_created", entityType: "ai_credit_promo", entityId: data.id, metadata: { code: input.code, bonusPct: input.bonusPct, maxUses: input.maxUses ?? null } });
  });
  if (result.ok) revalidatePath(PATH);
  return result;
}

export async function setPromoActiveAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.creditsEconomy.promo.toggle", async () => {
    const input = parseInput(promoToggleSchema, formToObject(fd));
    const ctx = await platformActor();
    const { data, error } = await (await createSupabaseServerClient()).from("ai_credit_promos").update({ active: input.active }).eq("id", input.id).select("code");
    if (error) dbFail(error, "ai_credit_promo_toggle");
    if (!data?.length) throw new AppError("NOT_FOUND");
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: input.active ? "credits_economy.promo_enabled" : "credits_economy.promo_disabled", entityType: "ai_credit_promo", entityId: input.id, metadata: { code: data[0]?.code } });
  });
  if (result.ok) revalidatePath(PATH);
  return result;
}

/** Manual grant / removal through the existing grant_ai_credits RPC (ledgered, locks the balance). */
export async function grantCreditsEconomyAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.creditsEconomy.grant", async () => {
    const input = parseInput(creditAdjustmentSchema, formToObject(fd));
    const ctx = await platformActor();
    const { error } = await (await createSupabaseServerClient()).rpc("grant_ai_credits", { p_tenant: input.tenantId, p_credits: input.credits, p_note: input.note });
    if (error) {
      if (isMissingSchemaError(error)) throw new AppError("CONFLICT", { fieldErrors: { _form: ["AI credits need migration 20261019003400_ai_credits.sql."] } });
      throw new AppError("CONFLICT", { fieldErrors: { _form: [error.message.includes("negative") ? "This adjustment would make the balance negative." : "The credit adjustment could not be saved."] }, context: { code: error.code } });
    }
    await audit({ tenantId: input.tenantId, actorUserId: ctx.user.id, actorType: "platform", action: "ai_credits.adjusted", entityType: "ai_credit_account", entityId: input.tenantId, metadata: { credits: input.credits, note: input.note } });
  });
  if (result.ok) {
    revalidatePath(PATH);
    revalidatePath("/admin/ai-credits");
  }
  return result;
}
