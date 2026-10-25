"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { toDecimalString } from "@/lib/money";
import { logger } from "@/lib/observability/logger";
import { getSessionUser } from "@/lib/auth/session";
import { assertPlatformPermission, getPlatformContext } from "@/lib/platform/access";
import { platformOrigin } from "@/lib/platform/urls";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { PLATFORM_NAME } from "@/config/platform";
import type { PlatformPermission } from "@/lib/permissions/matrix";
import { brandImageView, getPublicPlatformConfig } from "@/features/platform/server/public-config";
import { findUserIdByEmail } from "@/features/platform/server/queries";
import { renderPartnerInviteEmail } from "./email";
import {
  INVITE_TTL_DAYS,
  acceptInviteSchema,
  agencyPayoutSchema,
  attributeStoreSchema,
  codeIdSchema,
  createCodeSchema,
  createPartnerDirectSchema,
  creditAdjustSchema,
  decideLicenseRequestSchema,
  demoShopIdSchema,
  demoShopSchema,
  demoShopToggleSchema,
  directRateSchema,
  invitePartnerSchema,
  inviteErrorMessage,
  issueBatchSchema,
  numericToMinor,
  licenseRequestSchema,
  markBatchPaidSchema,
  parentSchema,
  partnerStatusSchema,
  payoutDetailsSchema,
  promotePartnerSchema,
  redeemCodeSchema,
  revokeLicenseSchema,
  runPayoutBatchSchema,
  settlePayoutSchema,
  updatePartnerProfileSchema,
} from "./schemas";

/**
 * Super Admin partner programme mutations. Order in each: validate → platform permission →
 * write (RLS or an audited SECURITY DEFINER function from migration 3800) → audit → revalidate.
 * Direct table writes are audited here; the SQL functions write their own audit rows.
 */

type DbError = { code?: string; message?: string; hint?: string } | null;

async function actor(permission: PlatformPermission) {
  const ctx = await getPlatformContext();
  if (!ctx) throw new AppError("FORBIDDEN");
  assertPlatformPermission(ctx, permission);
  return ctx;
}

function formError(message: string, field = "_form"): AppError {
  return new AppError("VALIDATION", { message, fieldErrors: { [field]: [message] } });
}

/** Turns a SQL error into a message the admin can act on; unknown errors stay generic. */
function dbFail(error: NonNullable<DbError>, fallback: string, known: [RegExp, string, string?][] = []): AppError {
  const text = `${error.message ?? ""} ${error.hint ?? ""}`;
  for (const [re, message, field] of known) if (re.test(text)) return formError(message, field);
  if (error.code === "42501") return new AppError("FORBIDDEN", { context: { db: error.message } });
  if (/schema cache|does not exist/.test(error.message ?? "")) return formError("The partner tables are not installed yet. Apply migration 20261025003800_partners.sql first.");
  logger.warn("partners.db_error", { code: error.code, message: error.message });
  return formError(fallback);
}

const minorToNumeric = (minor: number) => Number(toDecimalString(minor));

function refresh(...paths: string[]) {
  for (const p of new Set(["/admin/partners", ...paths])) revalidatePath(p);
}

const partnerPath = (id: string) => `/admin/partners/${id}`;

// ---- Create / invite ----------------------------------------------------------------------

export type InviteResult = { partnerId: string; link: string; emailStatus: string };

export async function invitePartnerAction(_prev: ActionResult<InviteResult> | null, fd: FormData): Promise<ActionResult<InviteResult>> {
  const result = await runAction("platform.partners.invite", async () => {
    const input = parseInput(invitePartnerSchema, formToObject(fd));
    const ctx = await actor("platform.partners.manage");
    const supabase = await createSupabaseServerClient();
    const { data: partner, error } = await supabase
      .from("partners")
      .insert({ name: input.name, email: input.email, phone: input.phone ?? null, company_name: input.companyName ?? null, partner_type: input.partnerType, tier: input.tier, city: input.city ?? null, notes: input.notes ?? null, status: "pending", created_by: ctx.user.id })
      .select("id, partner_code")
      .single();
    if (error || !partner) throw error ? dbFail(error, "The partner could not be created.", [[/partners_email_key|duplicate key/, "A partner with this email already exists.", "email"]]) : new AppError("INTERNAL");

    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString();
    const { error: invErr } = await supabase.from("partner_invites").insert({ partner_id: partner.id, email: input.email, token_hash: sha256Hex(token), expires_at: expiresAt, created_by: ctx.user.id });
    if (invErr) throw dbFail(invErr, "The invite could not be created.");

    const link = `${platformOrigin()}/partner/accept/${token}`;
    const logo = brandImageView((await getPublicPlatformConfig()).headerLogo);
    const mail = renderPartnerInviteEmail({ brand: { storeName: PLATFORM_NAME, logoUrl: logo?.src ?? null, storeUrl: platformOrigin(), accent: null, supportEmail: null }, partnerName: input.name, partnerCode: partner.partner_code, acceptUrl: link, expiresInDays: INVITE_TTL_DAYS });
    const sent = await sendEmail({ tenantId: null, kind: "platform_partner_invite", to: input.email, ...mail, fromName: PLATFORM_NAME, idempotencyKey: `partner-invite:${partner.id}:${sha256Hex(token).slice(0, 16)}` });
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "partner.invited", entityType: "partner", entityId: partner.id, metadata: { type: input.partnerType, tier: input.tier, email_status: sent.status } });
    return { partnerId: partner.id, link, emailStatus: sent.status };
  });
  if (result.ok) refresh("/admin/agencies");
  return result;
}

export async function createPartnerDirectAction(_prev: ActionResult<{ partnerId: string }> | null, fd: FormData): Promise<ActionResult<{ partnerId: string }>> {
  const result = await runAction("platform.partners.createDirect", async () => {
    const input = parseInput(createPartnerDirectSchema, formToObject(fd));
    const ctx = await actor("platform.partners.manage");
    if (await findUserIdByEmail(input.email)) throw formError("An account with this email already exists. Use “Invite partner” so they can link it themselves.", "email");
    const supabase = await createSupabaseServerClient();
    const { data: clash } = await supabase.from("partners").select("id").eq("email", input.email).maybeSingle();
    if (clash) throw formError("A partner with this email already exists.", "email");

    // ADR-006: platform op after an explicit platform.partners.manage check.
    const admin = createSupabaseAdminClient();
    const { data: created, error: authErr } = await admin.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true, user_metadata: { display_name: input.name, created_by_platform: true, partner: true } });
    if (authErr || !created.user) {
      logger.warn("partners.create_user_failed", { error: authErr?.message });
      throw formError(authErr?.message?.includes("already") ? "An account with this email already exists." : "The partner's account could not be created.", "email");
    }
    const userId = created.user.id;
    await admin.from("profiles").update({ display_name: input.name }).eq("id", userId);

    const { data: partner, error } = await supabase
      .from("partners")
      .insert({ user_id: userId, name: input.name, email: input.email, phone: input.phone ?? null, company_name: input.companyName ?? null, partner_type: input.partnerType, tier: input.tier, city: input.city ?? null, notes: input.notes ?? null, status: "active", created_by: ctx.user.id })
      .select("id")
      .single();
    if (error || !partner) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined); // don't leave an orphan account
      throw error ? dbFail(error, "The partner could not be created.", [[/duplicate key/, "A partner with this email already exists.", "email"]]) : new AppError("INTERNAL");
    }
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "partner.created", entityType: "partner", entityId: partner.id, metadata: { type: input.partnerType, tier: input.tier, account_created: true } });
    return { partnerId: partner.id };
  });
  if (result.ok) refresh("/admin/agencies");
  return result;
}

// ---- Profile, status, hierarchy -----------------------------------------------------------

export async function setPartnerStatusAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.status", async () => {
    const input = parseInput(partnerStatusSchema, formToObject(fd));
    const ctx = await actor("platform.partners.manage");
    const supabase = await createSupabaseServerClient();
    const { data: before } = await supabase.from("partners").select("status").eq("id", input.partnerId).maybeSingle();
    if (!before) throw new AppError("NOT_FOUND");
    if (before.status === input.status) return;
    const { error } = await supabase.from("partners").update({ status: input.status }).eq("id", input.partnerId);
    if (error) throw dbFail(error, "The status could not be changed.");
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "partner.status_changed", entityType: "partner", entityId: input.partnerId, metadata: { from: before.status, to: input.status } });
  });
  if (result.ok) refresh(partnerPath(String(fd.get("partnerId"))), "/admin/agencies");
  return result;
}

export async function updatePartnerProfileAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.profile", async () => {
    const input = parseInput(updatePartnerProfileSchema, formToObject(fd));
    const ctx = await actor("platform.partners.manage");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("partners")
      .update({ name: input.name, email: input.email, phone: input.phone ?? null, company_name: input.companyName ?? null, partner_type: input.partnerType, city: input.city ?? null, notes: input.notes ?? null, license_price: input.licensePrice === undefined ? null : minorToNumeric(input.licensePrice) })
      .eq("id", input.partnerId)
      .select("id");
    if (error) throw dbFail(error, "The profile could not be saved.", [[/duplicate key/, "Another partner already uses this email.", "email"]]);
    if (!data?.length) throw new AppError("NOT_FOUND");
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "partner.profile_updated", entityType: "partner", entityId: input.partnerId, metadata: { type: input.partnerType } });
  });
  if (result.ok) refresh(partnerPath(String(fd.get("partnerId"))), "/admin/agencies");
  return result;
}

export async function savePayoutDetailsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.payoutDetails", async () => {
    const input = parseInput(payoutDetailsSchema, formToObject(fd));
    const ctx = await actor("platform.partners.manage");
    const supabase = await createSupabaseServerClient();
    const { data: before } = await supabase.from("partners").select("bank_account_number").eq("id", input.partnerId).maybeSingle();
    if (!before) throw new AppError("NOT_FOUND");
    if (input.payoutMethod === "bank" && !input.bankAccountNumber && !before.bank_account_number) throw formError("Enter the account number", "bankAccountNumber");
    const { error } = await supabase
      .from("partners")
      .update({
        payout_method: input.payoutMethod,
        upi_id: input.upiId ?? null,
        bank_account_holder: input.bankAccountHolder ?? null,
        ...(input.bankAccountNumber ? { bank_account_number: input.bankAccountNumber } : {}),
        bank_ifsc: input.bankIfsc ?? null,
        pan: input.pan ?? null,
        gstin: input.gstin ?? null,
      })
      .eq("id", input.partnerId);
    if (error) throw dbFail(error, "The payout details could not be saved.");
    // Never log account numbers, UPI IDs or tax ids.
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "partner.payout_details_updated", entityType: "partner", entityId: input.partnerId, metadata: { method: input.payoutMethod, account_changed: Boolean(input.bankAccountNumber) } });
  });
  if (result.ok) refresh(partnerPath(String(fd.get("partnerId"))));
  return result;
}

export async function promotePartnerAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.promote", async () => {
    const input = parseInput(promotePartnerSchema, formToObject(fd));
    const ctx = await actor("platform.partners.manage");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("partners").update({ tier: input.tier, override_bps: input.overridePercent, state_name: input.stateName ?? null, region_name: input.regionName ?? null }).eq("id", input.partnerId).select("id");
    if (error) throw dbFail(error, "The tier could not be saved.");
    if (!data?.length) throw new AppError("NOT_FOUND");
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "partner.promoted", entityType: "partner", entityId: input.partnerId, metadata: { tier: input.tier, override_bps: input.overridePercent, state: input.stateName ?? null, region: input.regionName ?? null } });
  });
  if (result.ok) refresh(partnerPath(String(fd.get("partnerId"))), "/admin/agencies");
  return result;
}

export async function setPartnerParentAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.parent", async () => {
    const input = parseInput(parentSchema, formToObject(fd));
    const ctx = await actor("platform.partners.manage");
    if (input.parentId === input.partnerId) throw formError("A partner can't report to themselves.", "parentId");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("partners").update({ parent_partner_id: input.parentId ?? null }).eq("id", input.partnerId).select("id");
    if (error) throw dbFail(error, "The parent could not be saved.", [[/cycle/, "That would put the partner under their own team.", "parentId"], [/too deep/, "The upline is too deep.", "parentId"]]);
    if (!data?.length) throw new AppError("NOT_FOUND");
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "partner.parent_set", entityType: "partner", entityId: input.partnerId, metadata: { parentId: input.parentId ?? null } });
  });
  if (result.ok) refresh(partnerPath(String(fd.get("partnerId"))), "/admin/agencies");
  return result;
}

export async function setDirectRateAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.directRate", async () => {
    const input = parseInput(directRateSchema, formToObject(fd));
    const ctx = await actor("platform.partners.manage");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("partners").update({ direct_bps: input.directPercent }).eq("id", input.partnerId).select("id");
    if (error) throw dbFail(error, "The direct rate could not be saved.");
    if (!data?.length) throw new AppError("NOT_FOUND");
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "partner.direct_rate_set", entityType: "partner", entityId: input.partnerId, metadata: { direct_bps: input.directPercent } });
  });
  if (result.ok) refresh(partnerPath(String(fd.get("partnerId"))));
  return result;
}

export async function setAgencyPayoutAction(_prev: ActionResult<{ synced: number }> | null, fd: FormData): Promise<ActionResult<{ synced: number }>> {
  const result = await runAction("platform.partners.agencyPayout", async () => {
    const input = parseInput(agencyPayoutSchema, formToObject(fd));
    await actor("platform.partners.manage");
    const { data, error } = await (await createSupabaseServerClient()).rpc("platform_set_agency_payout", { p_agency: input.partnerId, p_bps: input.agencyPercent });
    if (error) throw dbFail(error, "The agency payout rate could not be saved.", [[/agency not found/, "Only agencies have an agency payout rate. Change the partner type to Agency first."]]);
    return { synced: Number(data ?? 0) };
  });
  if (result.ok) refresh(partnerPath(String(fd.get("partnerId"))), "/admin/agencies");
  return result;
}

// ---- Credit ---------------------------------------------------------------------------------

export async function adjustPartnerCreditAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.credit", async () => {
    const input = parseInput(creditAdjustSchema, formToObject(fd));
    await actor("platform.partners.manage");
    const { error } = await (await createSupabaseServerClient()).rpc("platform_adjust_partner_credit", { p_partner: input.partnerId, p_delta: minorToNumeric(input.amount), p_kind: input.kind, p_note: input.note });
    if (error) throw dbFail(error, "The credit could not be adjusted.", [[/negative/, "This would make the credit balance negative.", "amount"]]);
  });
  if (result.ok) refresh(partnerPath(String(fd.get("partnerId"))));
  return result;
}

export async function redeemCodeForPartnerAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.redeemCode", async () => {
    const input = parseInput(redeemCodeSchema, formToObject(fd));
    await actor("platform.partners.manage");
    const { error } = await (await createSupabaseServerClient()).rpc("platform_redeem_partner_code", { p_code: input.code, p_partner: input.partnerId });
    if (error) throw dbFail(error, "The code could not be redeemed.", [[/CODE_INVALID|not valid/, "This code is not valid, has expired or was already used.", "code"]]);
  });
  if (result.ok) refresh(partnerPath(String(fd.get("partnerId"))));
  return result;
}

// ---- Licences -------------------------------------------------------------------------------

const BATCH_ERRORS: [RegExp, string, string?][] = [
  [/not active/, "The partner must be active before licences can be issued."],
  [/set a unit price/, "Enter a unit price (the partner has no default licence price).", "unitPrice"],
  [/already decided/, "This request was already decided."],
];

export async function issueLicenseBatchAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.issueBatch", async () => {
    const input = parseInput(issueBatchSchema, formToObject(fd));
    await actor("platform.partners.manage");
    const { error } = await (await createSupabaseServerClient()).rpc("platform_issue_license_batch", {
      p_partner: input.partnerId,
      p_type: input.licenseType,
      p_qty: input.qty,
      p_unit_price: minorToNumeric(input.unitPrice),
      p_paid: input.paid,
      ...(input.reference ? { p_reference: input.reference } : {}),
    });
    if (error) throw dbFail(error, "The licences could not be issued.", BATCH_ERRORS);
  });
  if (result.ok) refresh(partnerPath(String(fd.get("partnerId"))), "/admin/agencies");
  return result;
}

export async function markBatchPaidAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.batchPaid", async () => {
    const input = parseInput(markBatchPaidSchema, formToObject(fd));
    await actor("platform.partners.manage");
    const { error } = await (await createSupabaseServerClient()).rpc("platform_mark_license_batch_paid", { p_batch: input.batchId, p_reference: input.reference });
    if (error) throw dbFail(error, "The batch could not be marked paid.", [[/already paid/, "This batch is already paid."]]);
  });
  if (result.ok) refresh(partnerPath(String(fd.get("partnerId"))), "/admin/agencies");
  return result;
}

export async function revokeLicenseAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.revokeLicense", async () => {
    const input = parseInput(revokeLicenseSchema, formToObject(fd));
    await actor("platform.partners.manage");
    const { error } = await (await createSupabaseServerClient()).rpc("platform_revoke_partner_license", { p_license: input.licenseId });
    if (error) throw dbFail(error, "The licence could not be revoked.", [[/only unused/, "Only unused licences can be revoked."]]);
  });
  if (result.ok) {
    const partnerId = fd.get("partnerId");
    refresh(...(typeof partnerId === "string" && partnerId ? [partnerPath(partnerId)] : []));
  }
  return result;
}

export async function createLicenseRequestAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.licenseRequest", async () => {
    const input = parseInput(licenseRequestSchema, formToObject(fd));
    const ctx = await actor("platform.partners.manage");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("partner_license_requests").insert({ partner_id: input.partnerId, qty: input.qty, license_type: input.licenseType, notes: input.notes ?? null, created_by: ctx.user.id }).select("id").single();
    if (error || !data) throw error ? dbFail(error, "The request could not be created.", [[/foreign key/, "Choose a partner.", "partnerId"]]) : new AppError("INTERNAL");
    await audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action: "partner.license_requested", entityType: "partner_license_request", entityId: data.id, metadata: { partnerId: input.partnerId, qty: input.qty, type: input.licenseType, on_behalf: true } });
  });
  if (result.ok) refresh();
  return result;
}

export async function decideLicenseRequestAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.decideRequest", async () => {
    const input = parseInput(decideLicenseRequestSchema, formToObject(fd));
    await actor("platform.partners.manage");
    const approve = input.decision === "approve";
    const { error } = await (await createSupabaseServerClient()).rpc("platform_decide_license_request", {
      p_request: input.requestId,
      p_approve: approve,
      ...(approve && input.unitPrice !== undefined ? { p_unit_price: minorToNumeric(input.unitPrice) } : {}),
      p_paid: approve && input.paid,
      ...(input.reference ? { p_reference: input.reference } : {}),
      ...(input.note ? { p_note: input.note } : {}),
    });
    if (error) throw dbFail(error, "The request could not be decided.", BATCH_ERRORS);
  });
  if (result.ok) refresh();
  return result;
}

export async function attributeStoreAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.attributeStore", async () => {
    const input = parseInput(attributeStoreSchema, formToObject(fd));
    await actor("platform.partners.manage");
    const supabase = await createSupabaseServerClient();
    const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input.store);
    const { data: tenant, error: tErr } = await supabase.from("tenants").select("id").eq(isId ? "id" : "slug", input.store).maybeSingle();
    if (tErr) throw dbFail(tErr, "The store could not be looked up.");
    if (!tenant) throw formError("No store has this ID or slug.", "store");
    if (input.remove) {
      const { data: ref } = await supabase.from("partner_referrals").select("partner_id").eq("tenant_id", tenant.id).maybeSingle();
      if (ref?.partner_id !== input.partnerId) throw formError("This store isn't attributed to this partner.", "store");
    }
    // The generated type marks p_partner as required text; SQL accepts null to remove the attribution.
    const { error } = await supabase.rpc("platform_set_store_partner", { p_tenant: tenant.id, p_partner: (input.remove ? null : input.partnerId) as string });
    if (error) throw dbFail(error, "The store could not be attributed.");
  });
  if (result.ok) refresh(partnerPath(String(fd.get("partnerId"))), "/admin/agencies");
  return result;
}

// ---- Demo shops -----------------------------------------------------------------------------

export async function saveDemoShopAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.demoShop", async () => {
    const input = parseInput(demoShopSchema, formToObject(fd));
    const ctx = await actor("platform.partners.manage");
    const supabase = await createSupabaseServerClient();
    const { data: tenant } = await supabase.from("tenants").select("id, store_type").eq("id", input.tenantId).maybeSingle();
    if (!tenant) throw formError("Choose a demo store.", "tenantId");
    if (tenant.store_type !== "demo") throw formError("Only stores marked as Demo can be listed. Change the store type on the store page first.", "tenantId");
    const { data, error } = await supabase
      .from("partner_demo_shops")
      .upsert({ tenant_id: input.tenantId, category: input.category, note: input.note ?? null, position: input.position, active: input.active, created_by: ctx.user.id }, { onConflict: "tenant_id" })
      .select("id")
      .single();
    if (error || !data) throw error ? dbFail(error, "The demo shop could not be saved.") : new AppError("INTERNAL");
    await audit({ tenantId: input.tenantId, actorUserId: ctx.user.id, actorType: "platform", action: "partner.demo_shop_saved", entityType: "partner_demo_shop", entityId: data.id, metadata: { category: input.category, active: input.active } });
  });
  if (result.ok) refresh();
  return result;
}

export async function toggleDemoShopAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.demoShopToggle", async () => {
    const input = parseInput(demoShopToggleSchema, formToObject(fd));
    const ctx = await actor("platform.partners.manage");
    const { data, error } = await (await createSupabaseServerClient()).from("partner_demo_shops").update({ active: input.active }).eq("id", input.id).select("tenant_id");
    if (error) throw dbFail(error, "The demo shop could not be updated.");
    if (!data?.length) throw new AppError("NOT_FOUND");
    await audit({ tenantId: data[0]!.tenant_id, actorUserId: ctx.user.id, actorType: "platform", action: "partner.demo_shop_toggled", entityType: "partner_demo_shop", entityId: input.id, metadata: { active: input.active } });
  });
  if (result.ok) refresh();
  return result;
}

export async function removeDemoShopAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.demoShopRemove", async () => {
    const input = parseInput(demoShopIdSchema, formToObject(fd));
    const ctx = await actor("platform.partners.manage");
    const { data, error } = await (await createSupabaseServerClient()).from("partner_demo_shops").delete().eq("id", input.id).select("tenant_id");
    if (error) throw dbFail(error, "The demo shop could not be removed.");
    if (!data?.length) throw new AppError("NOT_FOUND");
    await audit({ tenantId: data[0]!.tenant_id, actorUserId: ctx.user.id, actorType: "platform", action: "partner.demo_shop_removed", entityType: "partner_demo_shop", entityId: input.id });
  });
  if (result.ok) refresh();
  return result;
}

// ---- One-time codes -------------------------------------------------------------------------

export async function createPartnerCodeAction(_prev: ActionResult<{ code: string }> | null, fd: FormData): Promise<ActionResult<{ code: string }>> {
  const result = await runAction("platform.partners.createCode", async () => {
    const input = parseInput(createCodeSchema, formToObject(fd));
    await actor("platform.partners.manage");
    const { data, error } = await (await createSupabaseServerClient()).rpc("platform_create_partner_code", {
      p_value: minorToNumeric(input.value),
      ...(input.expiresAt ? { p_expires: input.expiresAt } : {}),
      ...(input.note ? { p_note: input.note } : {}),
    });
    if (error || !data) throw error ? dbFail(error, "The code could not be generated.") : new AppError("INTERNAL");
    return { code: data };
  });
  if (result.ok) refresh();
  return result;
}

export async function revokePartnerCodeAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.revokeCode", async () => {
    const input = parseInput(codeIdSchema, formToObject(fd));
    await actor("platform.partners.manage");
    const { error } = await (await createSupabaseServerClient()).rpc("platform_revoke_partner_code", { p_code: input.codeId });
    if (error) throw dbFail(error, "The code could not be revoked.", [[/not active/, "Only active codes can be revoked."]]);
  });
  if (result.ok) refresh();
  return result;
}

// ---- Payouts (platform.finance.manage) -------------------------------------------------------

export type PayoutBatchResult = { created: number; totalMinor: number; carriedOver: number };

export async function runPayoutBatchAction(_prev: ActionResult<PayoutBatchResult> | null, fd: FormData): Promise<ActionResult<PayoutBatchResult>> {
  const result = await runAction("platform.partners.payoutBatch", async () => {
    const input = parseInput(runPayoutBatchSchema, formToObject(fd));
    await actor("platform.finance.manage");
    const { data, error } = await (await createSupabaseServerClient()).rpc("platform_run_partner_payout_batch", { p_cutoff: input.cutoff, p_method: input.method, p_min_amount: minorToNumeric(input.minAmount) });
    if (error) throw dbFail(error, "The payout batch could not be run.", [[/cutoff must be today or earlier/, "The cutoff can't be in the future.", "cutoff"]]);
    const row = data?.[0];
    return { created: Number(row?.payouts_created ?? 0), totalMinor: numericToMinor(row?.total_amount), carriedOver: Number(row?.carried_over ?? 0) };
  });
  if (result.ok) revalidatePath("/admin/partner-payouts");
  return result;
}

export async function settlePayoutAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("platform.partners.settlePayout", async () => {
    const input = parseInput(settlePayoutSchema, formToObject(fd));
    await actor("platform.finance.manage");
    const paid = input.outcome === "paid";
    const { error } = await (await createSupabaseServerClient()).rpc("platform_settle_partner_payout", {
      p_payout: input.payoutId,
      p_paid: paid,
      ...(paid && input.utr ? { p_utr: input.utr } : {}),
      ...(input.note ? { p_note: input.note } : {}),
    });
    if (error) throw dbFail(error, "The payout could not be updated.", [[/already settled/, "This payout was already settled."], [/UTR/, "Enter the UTR / bank reference.", "utr"]]);
  });
  if (result.ok) revalidatePath("/admin/partner-payouts");
  return result;
}

// ---- Invite acceptance (the invitee, not platform staff) --------------------------------------

export async function acceptPartnerInviteAction(_prev: ActionResult<{ partnerId: string }> | null, fd: FormData): Promise<ActionResult<{ partnerId: string }>> {
  return runAction("partners.acceptInvite", async () => {
    const { token } = parseInput(acceptInviteSchema, formToObject(fd));
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { data, error } = await (await createSupabaseServerClient()).rpc("accept_partner_invite", { p_token_hash: sha256Hex(token) });
    if (error || !data) throw formError(inviteErrorMessage(error?.hint));
    return { partnerId: data };
  });
}
