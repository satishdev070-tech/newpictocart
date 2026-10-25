import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { isMissingSchemaError } from "@/features/platform/schemas";
import { rankPartners, type LeaderboardInput, type RankBy } from "@/features/platform-finance/calc";
import { matchesSearch, numericToMinor, type AgencyTab } from "./schemas";

/**
 * Super Admin partner reads (migration 3800). Everything runs as the signed-in platform user:
 * RLS lets only platform.partners.manage / platform.finance.read read these tables, and the
 * aggregate functions re-check the permission. Callers must call requirePlatform(permission)
 * first. Each read returns `available: false` instead of throwing while the migration is not
 * applied, so pages show a pending-migration notice. Full bank account numbers never leave here.
 */

type PgError = { code?: string; message?: string; hint?: string; details?: string } | null;
const LIMIT = 500;

function fail(error: PgError, context: string): never {
  throw mapDbError(error, { query: context });
}

export type Available<T> = { available: true; data: T } | { available: false };
const pending = { available: false } as const;

// ---- Partner list / organisations -------------------------------------------------------

export type PartnerOrgRow = {
  id: string;
  name: string;
  companyName: string | null;
  email: string;
  code: string;
  type: string;
  tier: string;
  status: string;
  parentId: string | null;
  parentName: string | null;
  teamCount: number;
  licensesTotal: number;
  licensesRedeemed: number;
  amountPaidMinor: number;
  creditMinor: number;
  createdAt: string;
};

export async function listPartnerOrgs(type: AgencyTab = "all", q?: string): Promise<Available<PartnerOrgRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("platform_partner_orgs", { p_type: type });
  if (error) {
    if (isMissingSchemaError(error)) return pending;
    fail(error, "platform_partner_orgs");
  }
  const rows = (data ?? []).map(
    (r): PartnerOrgRow => ({
      id: r.partner_id,
      name: r.name,
      companyName: r.company_name ?? null,
      email: r.email,
      code: r.partner_code,
      type: r.partner_type,
      tier: r.tier,
      status: r.status,
      parentId: r.parent_id ?? null,
      parentName: r.parent_name ?? null,
      teamCount: Number(r.team_count ?? 0),
      licensesTotal: Number(r.licenses_total ?? 0),
      licensesRedeemed: Number(r.licenses_redeemed ?? 0),
      amountPaidMinor: numericToMinor(r.amount_paid),
      creditMinor: numericToMinor(r.credit_balance),
      createdAt: r.created_at,
    }),
  );
  return { available: true, data: rows.filter((r) => matchesSearch(q, r.name, r.companyName, r.email, r.code, r.parentName)) };
}

export type PartnerOrgTotals = { count: number; licensesRedeemed: number; licensesTotal: number; amountPaidMinor: number; teamCount: number };

/** Totals across the listed organisations (each org's numbers already include its team). */
export function orgTotals(rows: readonly PartnerOrgRow[]): PartnerOrgTotals {
  return rows.reduce<PartnerOrgTotals>(
    (t, r) => ({ count: t.count + 1, licensesRedeemed: t.licensesRedeemed + r.licensesRedeemed, licensesTotal: t.licensesTotal + r.licensesTotal, amountPaidMinor: t.amountPaidMinor + r.amountPaidMinor, teamCount: t.teamCount + r.teamCount }),
    { count: 0, licensesRedeemed: 0, licensesTotal: 0, amountPaidMinor: 0, teamCount: 0 },
  );
}

export type PartnerOption = { id: string; name: string; code: string; type: string; tier: string; status: string };

export async function listPartnerOptions(): Promise<PartnerOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("partners").select("id, name, partner_code, partner_type, tier, status").order("name").limit(LIMIT);
  if (error) {
    if (isMissingSchemaError(error)) return [];
    fail(error, "partners.options");
  }
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, code: p.partner_code, type: p.partner_type, tier: p.tier, status: p.status }));
}

// ---- Partner detail -------------------------------------------------------------------------

export type PartnerDetail = {
  id: string;
  userId: string | null;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  type: string;
  tier: string;
  status: string;
  parentId: string | null;
  stateName: string | null;
  regionName: string | null;
  city: string | null;
  directBps: number;
  overrideBps: number;
  agencyPayoutBps: number | null;
  licensePriceMinor: number | null;
  payoutMethod: string | null;
  upiId: string | null;
  bankAccountHolder: string | null;
  bankLast4: string | null;
  bankIfsc: string | null;
  pan: string | null;
  gstin: string | null;
  creditMinor: number;
  notes: string | null;
  createdAt: string;
};

export type BatchRow = { id: string; number: string; type: string; qty: number; unitPriceMinor: number; subtotalMinor: number; creditAppliedMinor: number; totalMinor: number; paymentStatus: string; reference: string | null; paidAt: string | null; createdAt: string };
export type LicenseRow = { id: string; key: string; type: string; status: string; partnerId: string; partnerName: string | null; tenantId: string | null; storeName: string | null; consumedAt: string | null; createdAt: string };
export type StoreRef = { tenantId: string; name: string; slug: string; status: string; source: string; url: string; createdAt: string };
export type CommissionRow = { id: string; month: string; kind: string; storeName: string | null; baseMinor: number; rateBps: number; amountMinor: number; status: string };
export type PayoutRow = { id: string; partnerId: string; partnerName: string | null; partnerCode: string | null; cutoff: string; method: string; status: string; utr: string | null; amountMinor: number; directMinor: number; overrideMinor: number; count: number; notes: string | null; paidAt: string | null; createdAt: string };
export type LedgerRow = { id: string; deltaMinor: number; balanceMinor: number; kind: string; note: string | null; createdAt: string };
export type InviteRow = { id: string; email: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null; createdAt: string };

export type PartnerDetailData = {
  partner: PartnerDetail;
  org: PartnerOrgRow | null;
  parent: PartnerOption | null;
  team: PartnerOrgRow[];
  parentOptions: PartnerOption[];
  batches: BatchRow[];
  licenses: LicenseRow[];
  stores: StoreRef[];
  commissions: CommissionRow[];
  payouts: PayoutRow[];
  ledger: LedgerRow[];
  invites: InviteRow[];
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** Primary storefront host per tenant (falls back to the platform subdomain). */
async function storeUrls(tenants: readonly { id: string; slug: string }[]): Promise<Map<string, string>> {
  const out = new Map(tenants.map((t) => [t.id, storeOrigin(storeSubdomain(t.slug))]));
  if (!tenants.length) return out;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("domains").select("tenant_id, hostname").eq("is_primary", true).eq("status", "verified").in("tenant_id", tenants.map((t) => t.id));
  for (const d of data ?? []) out.set(d.tenant_id, storeOrigin(d.hostname));
  return out;
}

const batchRow = (b: { id: string; batch_number: string; license_type: string; qty: number; unit_price: number; subtotal: number; credit_applied: number; total: number; payment_status: string; payment_reference: string | null; paid_at: string | null; created_at: string }): BatchRow => ({
  id: b.id,
  number: b.batch_number,
  type: b.license_type,
  qty: b.qty,
  unitPriceMinor: numericToMinor(b.unit_price),
  subtotalMinor: numericToMinor(b.subtotal),
  creditAppliedMinor: numericToMinor(b.credit_applied),
  totalMinor: numericToMinor(b.total),
  paymentStatus: b.payment_status,
  reference: b.payment_reference,
  paidAt: b.paid_at,
  createdAt: b.created_at,
});

type PayoutDb = { id: string; partner_id: string; period_cutoff: string; method: string; status: string; utr: string | null; amount: number; direct_amount: number; override_amount: number; commission_count: number; notes: string | null; paid_at: string | null; created_at: string; partners?: { name: string; partner_code: string } | { name: string; partner_code: string }[] | null };
const payoutRow = (p: PayoutDb): PayoutRow => {
  const partner = one(p.partners);
  return {
    id: p.id,
    partnerId: p.partner_id,
    partnerName: partner?.name ?? null,
    partnerCode: partner?.partner_code ?? null,
    cutoff: p.period_cutoff,
    method: p.method,
    status: p.status,
    utr: p.utr,
    amountMinor: numericToMinor(p.amount),
    directMinor: numericToMinor(p.direct_amount),
    overrideMinor: numericToMinor(p.override_amount),
    count: p.commission_count,
    notes: p.notes,
    paidAt: p.paid_at,
    createdAt: p.created_at,
  };
};

export async function getPartnerDetail(id: string): Promise<Available<PartnerDetailData | null>> {
  const supabase = await createSupabaseServerClient();
  const { data: p, error } = await supabase.from("partners").select("*").eq("id", id).maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return pending;
    fail(error, "partners.detail");
  }
  if (!p) return { available: true, data: null };

  const [orgs, options, batches, licenses, referrals, commissions, payouts, ledger, invites] = await Promise.all([
    listPartnerOrgs("all"),
    listPartnerOptions(),
    supabase.from("partner_license_batches").select("*").eq("partner_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("partner_licenses").select("id, license_key, license_type, status, partner_id, tenant_id, consumed_at, created_at, tenants(name)").eq("partner_id", id).order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("partner_referrals").select("tenant_id, source, created_at, tenants(name, slug, status)").eq("partner_id", id).order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("partner_commissions").select("id, period_month, kind, base_amount, rate_bps, amount, status, tenants(name)").eq("partner_id", id).order("period_month", { ascending: false }).limit(LIMIT),
    supabase.from("partner_payouts").select("*").eq("partner_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("partner_credit_ledger").select("id, delta, balance_after, kind, note, created_at").eq("partner_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("partner_invites").select("id, email, expires_at, accepted_at, revoked_at, created_at").eq("partner_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  for (const [name, r] of [["batches", batches], ["licenses", licenses], ["referrals", referrals], ["commissions", commissions], ["payouts", payouts], ["ledger", ledger], ["invites", invites]] as const) {
    if (r.error) fail(r.error, `partners.detail.${name}`);
  }

  const orgRows = orgs.available ? orgs.data : [];
  const refTenants = (referrals.data ?? []).flatMap((r) => {
    const t = one(r.tenants);
    return t ? [{ id: r.tenant_id, slug: t.slug }] : [];
  });
  const urls = await storeUrls(refTenants);

  // Descendants can't become the parent (the SQL trigger refuses cycles; hide them up front).
  const childrenOf = new Map<string, string[]>();
  for (const o of orgRows) if (o.parentId) childrenOf.set(o.parentId, [...(childrenOf.get(o.parentId) ?? []), o.id]);
  const blocked = new Set([id]);
  const stack = [id];
  while (stack.length) {
    for (const c of childrenOf.get(stack.pop()!) ?? []) {
      if (blocked.has(c)) continue;
      blocked.add(c);
      stack.push(c);
    }
  }

  const partner: PartnerDetail = {
    id: p.id,
    userId: p.user_id,
    code: p.partner_code,
    name: p.name,
    email: p.email,
    phone: p.phone,
    companyName: p.company_name,
    type: p.partner_type,
    tier: p.tier,
    status: p.status,
    parentId: p.parent_partner_id,
    stateName: p.state_name,
    regionName: p.region_name,
    city: p.city,
    directBps: p.direct_bps,
    overrideBps: p.override_bps,
    agencyPayoutBps: p.agency_payout_bps,
    licensePriceMinor: p.license_price === null ? null : numericToMinor(p.license_price),
    payoutMethod: p.payout_method,
    upiId: p.upi_id,
    bankAccountHolder: p.bank_account_holder,
    bankLast4: p.bank_account_number ? p.bank_account_number.slice(-4) : null,
    bankIfsc: p.bank_ifsc,
    pan: p.pan,
    gstin: p.gstin,
    creditMinor: numericToMinor(p.credit_balance),
    notes: p.notes,
    createdAt: p.created_at,
  };

  return {
    available: true,
    data: {
      partner,
      org: orgRows.find((o) => o.id === id) ?? null,
      parent: options.find((o) => o.id === p.parent_partner_id) ?? null,
      team: orgRows.filter((o) => o.parentId === id),
      parentOptions: options.filter((o) => !blocked.has(o.id)),
      batches: (batches.data ?? []).map(batchRow),
      licenses: (licenses.data ?? []).map((l) => ({ id: l.id, key: l.license_key, type: l.license_type, status: l.status, partnerId: l.partner_id, partnerName: p.name, tenantId: l.tenant_id, storeName: one(l.tenants)?.name ?? null, consumedAt: l.consumed_at, createdAt: l.created_at })),
      stores: (referrals.data ?? []).flatMap((r) => {
        const t = one(r.tenants);
        return t ? [{ tenantId: r.tenant_id, name: t.name, slug: t.slug, status: t.status, source: r.source, url: urls.get(r.tenant_id) ?? storeOrigin(storeSubdomain(t.slug)), createdAt: r.created_at }] : [];
      }),
      commissions: (commissions.data ?? []).map((c) => ({ id: c.id, month: c.period_month, kind: c.kind, storeName: one(c.tenants)?.name ?? null, baseMinor: numericToMinor(c.base_amount), rateBps: c.rate_bps, amountMinor: numericToMinor(c.amount), status: c.status })),
      payouts: (payouts.data ?? []).map((x) => payoutRow(x)),
      ledger: (ledger.data ?? []).map((l) => ({ id: l.id, deltaMinor: numericToMinor(l.delta), balanceMinor: numericToMinor(l.balance_after), kind: l.kind, note: l.note, createdAt: l.created_at })),
      invites: (invites.data ?? []).map((i) => ({ id: i.id, email: i.email, expiresAt: i.expires_at, acceptedAt: i.accepted_at, revokedAt: i.revoked_at, createdAt: i.created_at })),
    },
  };
}

// ---- Licence requests and licences --------------------------------------------------------

export type LicenseRequestRow = { id: string; partnerId: string; partnerName: string | null; partnerCode: string | null; licensePriceMinor: number | null; qty: number; type: string; status: string; notes: string | null; decisionNote: string | null; batchId: string | null; createdAt: string; reviewedAt: string | null };

export async function listLicenseRequests(): Promise<Available<LicenseRequestRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("partner_license_requests")
    .select("id, partner_id, qty, license_type, status, notes, decision_note, batch_id, created_at, reviewed_at, partners(name, partner_code, license_price)")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) {
    if (isMissingSchemaError(error)) return pending;
    fail(error, "partner_license_requests");
  }
  const rows = (data ?? []).map((r): LicenseRequestRow => {
    const partner = one(r.partners);
    return {
      id: r.id,
      partnerId: r.partner_id,
      partnerName: partner?.name ?? null,
      partnerCode: partner?.partner_code ?? null,
      licensePriceMinor: partner?.license_price === null || partner?.license_price === undefined ? null : numericToMinor(partner.license_price),
      qty: r.qty,
      type: r.license_type,
      status: r.status,
      notes: r.notes,
      decisionNote: r.decision_note,
      batchId: r.batch_id,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
    };
  });
  // Pending first (oldest first, like a queue), then decided (newest first).
  const pendingRows = rows.filter((r) => r.status === "pending").reverse();
  return { available: true, data: [...pendingRows, ...rows.filter((r) => r.status !== "pending")] };
}

export async function listLicenses(f: { status?: string; q?: string }): Promise<Available<LicenseRow[]>> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("partner_licenses").select("id, license_key, license_type, status, partner_id, tenant_id, consumed_at, created_at, partners(name, partner_code), tenants(name)").order("created_at", { ascending: false }).limit(2000);
  if (f.status) query = query.eq("status", f.status);
  const { data, error } = await query;
  if (error) {
    if (isMissingSchemaError(error)) return pending;
    fail(error, "partner_licenses");
  }
  const rows = (data ?? []).map((l): LicenseRow & { partnerCode: string | null } => {
    const partner = one(l.partners);
    return { id: l.id, key: l.license_key, type: l.license_type, status: l.status, partnerId: l.partner_id, partnerName: partner?.name ?? null, partnerCode: partner?.partner_code ?? null, tenantId: l.tenant_id, storeName: one(l.tenants)?.name ?? null, consumedAt: l.consumed_at, createdAt: l.created_at };
  });
  return { available: true, data: rows.filter((r) => matchesSearch(f.q, r.key, r.partnerName, r.partnerCode, r.storeName)) };
}

export type LicenseStatusCounts = Record<"available" | "consumed" | "revoked", number>;
export function licenseCounts(rows: readonly { status: string }[]): LicenseStatusCounts {
  const c: LicenseStatusCounts = { available: 0, consumed: 0, revoked: 0 };
  for (const r of rows) if (r.status in c) c[r.status as keyof LicenseStatusCounts] += 1;
  return c;
}

// ---- Demo shops ---------------------------------------------------------------------------

export type DemoShopRow = { id: string; tenantId: string; name: string; slug: string; storeType: string; category: string; note: string | null; active: boolean; position: number; url: string };
export type DemoStoreOption = { id: string; name: string; slug: string };

export async function listDemoShops(): Promise<Available<{ shops: DemoShopRow[]; candidates: DemoStoreOption[] }>> {
  const supabase = await createSupabaseServerClient();
  const [shops, demos] = await Promise.all([
    supabase.from("partner_demo_shops").select("id, tenant_id, category, note, active, position, tenants(name, slug, store_type)").order("position").order("created_at").limit(LIMIT),
    supabase.from("tenants").select("id, name, slug").eq("store_type", "demo").order("name").limit(LIMIT),
  ]);
  if (shops.error) {
    if (isMissingSchemaError(shops.error)) return pending;
    fail(shops.error, "partner_demo_shops");
  }
  if (demos.error && !isMissingSchemaError(demos.error)) fail(demos.error, "tenants.demo");
  const listed = (shops.data ?? []).flatMap((s) => {
    const t = one(s.tenants);
    return t ? [{ s, t }] : [];
  });
  const urls = await storeUrls(listed.map(({ s, t }) => ({ id: s.tenant_id, slug: t.slug })));
  const used = new Set(listed.map(({ s }) => s.tenant_id));
  return {
    available: true,
    data: {
      shops: listed.map(({ s, t }) => ({ id: s.id, tenantId: s.tenant_id, name: t.name, slug: t.slug, storeType: t.store_type, category: s.category, note: s.note, active: s.active, position: s.position, url: urls.get(s.tenant_id) ?? storeOrigin(storeSubdomain(t.slug)) })),
      candidates: (demos.data ?? []).filter((t) => !used.has(t.id)).map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
    },
  };
}

// ---- One-time codes -----------------------------------------------------------------------

export type CodeRow = { id: string; hint: string; valueMinor: number; status: string; expiresAt: string | null; usedBy: string | null; usedById: string | null; usedAt: string | null; note: string | null; createdAt: string };

export async function listCodes(): Promise<Available<CodeRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("partner_one_time_codes")
    .select("id, code_hint, value, status, expires_at, used_by_partner_id, used_at, note, created_at, partners(name)")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) {
    if (isMissingSchemaError(error)) return pending;
    fail(error, "partner_one_time_codes");
  }
  return {
    available: true,
    data: (data ?? []).map((c) => ({ id: c.id, hint: c.code_hint, valueMinor: numericToMinor(c.value), status: c.status, expiresAt: c.expires_at, usedBy: one(c.partners)?.name ?? null, usedById: c.used_by_partner_id, usedAt: c.used_at, note: c.note, createdAt: c.created_at })),
  };
}

/** Status shown for a code: an active code past its IST expiry date reads "expired". */
export function codeDisplayStatus(c: { status: string; expiresAt: string | null }, todayIst: string): string {
  return c.status === "active" && c.expiresAt && c.expiresAt < todayIst ? "expired" : c.status;
}

// ---- Analytics ------------------------------------------------------------------------------

export type LeaderboardRow = LeaderboardInput & { code: string; type: string };

export async function partnerLeaderboard(from: string, to: string, by: RankBy): Promise<Available<LeaderboardRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("platform_partner_leaderboard", { p_from: from, p_to: to });
  if (error) {
    if (isMissingSchemaError(error)) return pending;
    fail(error, "platform_partner_leaderboard");
  }
  const rows = (data ?? []).map((r): LeaderboardRow => ({ partnerId: r.partner_id, name: r.partner_name, code: r.partner_code, type: r.partner_type, tier: r.tier, state: r.state_name ?? null, licenses: Number(r.licenses ?? 0), gmvMinor: numericToMinor(r.gmv), commissionMinor: numericToMinor(r.commission) }));
  return { available: true, data: rankPartners(rows, by) as LeaderboardRow[] };
}

export function leaderboardTotals(rows: readonly LeaderboardInput[]): { gmvMinor: number; commissionMinor: number; licenses: number } {
  return rows.reduce((t, r) => ({ gmvMinor: t.gmvMinor + r.gmvMinor, commissionMinor: t.commissionMinor + r.commissionMinor, licenses: t.licenses + r.licenses }), { gmvMinor: 0, commissionMinor: 0, licenses: 0 });
}

// ---- Payouts --------------------------------------------------------------------------------

export type PendingPayoutRow = { partnerId: string; name: string; code: string; tier: string; payoutMethod: string | null; upiId: string | null; bankAccountHolder: string | null; bankLast4: string | null; bankIfsc: string | null; count: number; directMinor: number; overrideMinor: number; totalMinor: number };

export async function pendingPayouts(cutoff: string): Promise<Available<PendingPayoutRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("platform_pending_partner_payouts", { p_cutoff: cutoff });
  if (error) {
    if (isMissingSchemaError(error)) return pending;
    fail(error, "platform_pending_partner_payouts");
  }
  return {
    available: true,
    data: (data ?? []).map((r) => ({
      partnerId: r.partner_id,
      name: r.partner_name,
      code: r.partner_code,
      tier: r.tier,
      payoutMethod: r.payout_method ?? null,
      upiId: r.upi_id ?? null,
      bankAccountHolder: r.bank_account_holder ?? null,
      bankLast4: r.bank_account_last4 ?? null,
      bankIfsc: r.bank_ifsc ?? null,
      count: Number(r.commission_count ?? 0),
      directMinor: numericToMinor(r.direct_amount),
      overrideMinor: numericToMinor(r.override_amount),
      totalMinor: numericToMinor(r.total_amount),
    })),
  };
}

export async function payoutHistory(): Promise<Available<PayoutRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("partner_payouts").select("*, partners(name, partner_code)").order("created_at", { ascending: false }).limit(LIMIT);
  if (error) {
    if (isMissingSchemaError(error)) return pending;
    fail(error, "partner_payouts");
  }
  return { available: true, data: (data ?? []).map((p) => payoutRow(p)) };
}
