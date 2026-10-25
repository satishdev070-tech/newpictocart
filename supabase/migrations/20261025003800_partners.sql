-- =============================================================================
-- 3800 PARTNERS: partner organisations (agency / freelancer / intern / agent), tiers and uplines,
-- invites, licence requests → batches → licence keys, store attribution, monthly direct and
-- override commissions, payout batches, demo shops and one-time credit codes.
-- Additive. Not applied by the application; the owner applies it (see docs/SUPER_ADMIN_PORT.md).
-- Simple records are written under RLS (platform.partners.manage); anything that moves money,
-- licences or several rows at once goes through the audited SECURITY DEFINER functions below.
-- =============================================================================

create sequence if not exists public.partner_code_seq start 1001;

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  partner_code text not null unique default ('PCC' || nextval('public.partner_code_seq')::text) check (partner_code ~ '^PCC[0-9A-Z]{3,12}$'),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  company_name text check (char_length(company_name) <= 160),
  partner_type text not null default 'freelancer' check (partner_type in ('agency', 'freelancer', 'intern', 'agent')),
  tier text not null default 'partner' check (tier in ('partner', 'state_head', 'regional_head')),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  parent_partner_id uuid references public.partners (id) on delete set null,
  state_name text check (char_length(state_name) <= 80),
  region_name text check (char_length(region_name) <= 80),
  city text check (char_length(city) <= 80),
  direct_bps integer not null default 2000 check (direct_bps between 0 and 10000),
  override_bps integer not null default 0 check (override_bps between 0 and 10000),
  -- Agencies: the direct rate their agents and interns receive (synced on change).
  agency_payout_bps integer check (agency_payout_bps is null or agency_payout_bps between 0 and 10000),
  license_price numeric(10,2) check (license_price is null or license_price >= 0),
  payout_method text check (payout_method is null or payout_method in ('upi', 'bank')),
  upi_id text check (upi_id is null or upi_id ~ '^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,64}$'),
  bank_account_holder text check (char_length(bank_account_holder) <= 120),
  bank_account_number text check (bank_account_number is null or bank_account_number ~ '^[0-9]{6,20}$'),
  bank_ifsc text check (bank_ifsc is null or bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  pan text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  credit_balance numeric(12,2) not null default 0 check (credit_balance >= 0),
  notes text check (char_length(notes) <= 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_partner_id is null or parent_partner_id <> id)
);
create unique index if not exists partners_email_key on public.partners (email);
create index if not exists partners_parent_idx on public.partners (parent_partner_id);
create index if not exists partners_type_idx on public.partners (partner_type, status);
drop trigger if exists trg_partners_updated_at on public.partners;
create trigger trg_partners_updated_at before update on public.partners for each row execute function app.set_updated_at();

-- No upline cycles; agents and interns sit under an agency or a head; credit_balance is
-- only changed by the credit functions (they set app.partner_credit = 'on').
create or replace function app.guard_partner()
returns trigger language plpgsql set search_path = '' as $$
declare v_cursor uuid := new.parent_partner_id; v_depth int := 0;
begin
  while v_cursor is not null loop
    if v_cursor = new.id then raise exception 'partner upline cannot form a cycle' using errcode = '23514'; end if;
    v_depth := v_depth + 1;
    if v_depth > 20 then raise exception 'partner upline is too deep' using errcode = '23514'; end if;
    select parent_partner_id into v_cursor from public.partners where id = v_cursor;
  end loop;
  if tg_op = 'UPDATE' and new.credit_balance is distinct from old.credit_balance and coalesce(current_setting('app.partner_credit', true), '') <> 'on' then
    raise exception 'credit balance changes go through the credit functions' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and new.credit_balance <> 0 and coalesce(current_setting('app.partner_credit', true), '') <> 'on' then
    raise exception 'credit balance changes go through the credit functions' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_partners_guard on public.partners;
create trigger trg_partners_guard before insert or update on public.partners for each row execute function app.guard_partner();

create table if not exists public.partner_invites (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  email text not null check (email = lower(email)),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists partner_invites_partner_idx on public.partner_invites (partner_id, created_at desc);

create table if not exists public.partner_license_batches (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  batch_number text not null unique check (batch_number ~ '^LB-[0-9]{6}-[0-9]{4,}$'),
  license_type text not null check (license_type in ('starter', 'growth')),
  qty integer not null check (qty between 1 and 10000),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  credit_applied numeric(12,2) not null default 0 check (credit_applied >= 0),
  total numeric(12,2) not null check (total >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  payment_reference text check (char_length(payment_reference) <= 160),
  paid_at timestamptz,
  request_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (total = subtotal - credit_applied)
);
create index if not exists partner_license_batches_partner_idx on public.partner_license_batches (partner_id, created_at desc);

create table if not exists public.partner_license_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  qty integer not null check (qty between 1 and 10000),
  license_type text not null default 'starter' check (license_type in ('starter', 'growth')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  notes text check (char_length(notes) <= 1000),
  decision_note text check (char_length(decision_note) <= 500),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  batch_id uuid references public.partner_license_batches (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists partner_license_requests_status_idx on public.partner_license_requests (status, created_at);

create table if not exists public.partner_licenses (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.partner_license_batches (id) on delete cascade,
  partner_id uuid not null references public.partners (id) on delete cascade,
  license_key text not null unique check (license_key ~ '^PCL-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$'),
  license_type text not null check (license_type in ('starter', 'growth')),
  status text not null default 'available' check (status in ('available', 'consumed', 'revoked')),
  tenant_id uuid references public.tenants (id) on delete set null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists partner_licenses_partner_idx on public.partner_licenses (partner_id, status);

-- Which partner brought a store (one partner per store).
create table if not exists public.partner_referrals (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  partner_id uuid not null references public.partners (id) on delete cascade,
  source text not null check (source in ('license', 'manual')),
  license_id uuid references public.partner_licenses (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists partner_referrals_partner_idx on public.partner_referrals (partner_id);

create table if not exists public.partner_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  period_cutoff date not null,
  amount numeric(12,2) not null check (amount > 0),
  direct_amount numeric(12,2) not null default 0 check (direct_amount >= 0),
  override_amount numeric(12,2) not null default 0 check (override_amount >= 0),
  commission_count integer not null default 0 check (commission_count >= 0),
  method text not null default 'upi' check (method in ('upi', 'bank', 'other')),
  status text not null default 'initiated' check (status in ('initiated', 'paid', 'failed')),
  utr text check (utr is null or utr ~ '^[A-Za-z0-9-]{6,40}$'),
  paid_at timestamptz,
  paid_by uuid references auth.users (id) on delete set null,
  notes text check (char_length(notes) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists partner_payouts_partner_idx on public.partner_payouts (partner_id, created_at desc);

create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete set null,
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  kind text not null check (kind in ('direct', 'override')),
  base_amount numeric(12,2) not null check (base_amount >= 0),
  rate_bps integer not null check (rate_bps between 0 and 10000),
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'batched', 'paid', 'void')),
  payout_id uuid references public.partner_payouts (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (partner_id, tenant_id, period_month, kind)
);
create index if not exists partner_commissions_partner_status_idx on public.partner_commissions (partner_id, status);

create table if not exists public.partner_demo_shops (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  category text not null check (char_length(category) between 2 and 60),
  note text check (char_length(note) <= 500),
  active boolean not null default true,
  position integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- One-time credit codes: only a SHA-256 hash and the last four characters are stored.
create table if not exists public.partner_one_time_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  code_hint text not null check (char_length(code_hint) = 4),
  value numeric(12,2) not null check (value > 0 and value <= 1000000),
  status text not null default 'active' check (status in ('active', 'used', 'revoked')),
  expires_at date,
  used_by_partner_id uuid references public.partners (id) on delete set null,
  used_at timestamptz,
  note text check (char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.partner_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  delta numeric(12,2) not null check (delta <> 0),
  balance_after numeric(12,2) not null check (balance_after >= 0),
  kind text not null check (kind in ('one_time_code', 'onboarding_credit', 'batch_applied', 'adjustment')),
  reference_id uuid,
  note text check (char_length(note) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists partner_credit_ledger_partner_idx on public.partner_credit_ledger (partner_id, created_at desc);

-- RLS ---------------------------------------------------------------------------------
alter table public.partners enable row level security;
alter table public.partner_invites enable row level security;
alter table public.partner_license_batches enable row level security;
alter table public.partner_license_requests enable row level security;
alter table public.partner_licenses enable row level security;
alter table public.partner_referrals enable row level security;
alter table public.partner_payouts enable row level security;
alter table public.partner_commissions enable row level security;
alter table public.partner_demo_shops enable row level security;
alter table public.partner_one_time_codes enable row level security;
alter table public.partner_credit_ledger enable row level security;

do $$
declare t text;
begin
  foreach t in array array['partners','partner_license_batches','partner_license_requests','partner_licenses','partner_referrals','partner_payouts','partner_commissions','partner_credit_ledger'] loop
    execute format('drop policy if exists %1$s_platform_select on public.%1$s', t);
    execute format('create policy %1$s_platform_select on public.%1$s for select to authenticated using (app.has_platform_permission(''platform.partners.manage'') or app.has_platform_permission(''platform.finance.read''))', t);
  end loop;
  foreach t in array array['partner_invites','partner_demo_shops','partner_one_time_codes'] loop
    execute format('drop policy if exists %1$s_platform_select on public.%1$s', t);
    execute format('create policy %1$s_platform_select on public.%1$s for select to authenticated using (app.has_platform_permission(''platform.partners.manage''))', t);
  end loop;
end $$;

-- A partner sees their own row (used by the invite accept page).
drop policy if exists partners_self_select on public.partners;
create policy partners_self_select on public.partners for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists partners_platform_write on public.partners;
create policy partners_platform_write on public.partners for all to authenticated
  using (app.has_platform_permission('platform.partners.manage')) with check (app.has_platform_permission('platform.partners.manage'));
drop policy if exists partner_invites_platform_write on public.partner_invites;
create policy partner_invites_platform_write on public.partner_invites for all to authenticated
  using (app.has_platform_permission('platform.partners.manage')) with check (app.has_platform_permission('platform.partners.manage'));
drop policy if exists partner_demo_shops_platform_write on public.partner_demo_shops;
create policy partner_demo_shops_platform_write on public.partner_demo_shops for all to authenticated
  using (app.has_platform_permission('platform.partners.manage')) with check (app.has_platform_permission('platform.partners.manage'));
drop policy if exists partner_license_requests_platform_insert on public.partner_license_requests;
create policy partner_license_requests_platform_insert on public.partner_license_requests for insert to authenticated
  with check (app.has_platform_permission('platform.partners.manage') and status = 'pending' and batch_id is null);

revoke all on public.partners, public.partner_invites, public.partner_license_batches, public.partner_license_requests, public.partner_licenses,
  public.partner_referrals, public.partner_payouts, public.partner_commissions, public.partner_demo_shops, public.partner_one_time_codes,
  public.partner_credit_ledger from anon, authenticated;
grant select on public.partners, public.partner_invites, public.partner_license_batches, public.partner_license_requests, public.partner_licenses,
  public.partner_referrals, public.partner_payouts, public.partner_commissions, public.partner_demo_shops, public.partner_one_time_codes,
  public.partner_credit_ledger to authenticated;
grant insert, update, delete on public.partners, public.partner_invites, public.partner_demo_shops to authenticated;
grant insert on public.partner_license_requests to authenticated;
grant all on public.partners, public.partner_invites, public.partner_license_batches, public.partner_license_requests, public.partner_licenses,
  public.partner_referrals, public.partner_payouts, public.partner_commissions, public.partner_demo_shops, public.partner_one_time_codes,
  public.partner_credit_ledger to service_role;
grant usage on sequence public.partner_code_seq to authenticated, service_role;

-- Helpers -------------------------------------------------------------------------------
create or replace function app.require_platform(p_perm text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.has_platform_permission(p_perm) then raise exception 'not permitted' using errcode = '42501'; end if;
end;
$$;

create or replace function app.platform_audit(p_action text, p_entity_type text, p_entity_id text, p_metadata jsonb default '{}'::jsonb, p_tenant uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (tenant_id, actor_user_id, actor_type, action, entity_type, entity_id, metadata)
  values (p_tenant, auth.uid(), 'platform', p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;

/** Moves a partner's credit balance and writes the ledger row. Raises if it would go negative. */
create or replace function app.partner_credit_move(p_partner uuid, p_delta numeric, p_kind text, p_reference uuid, p_note text)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_balance numeric(12,2);
begin
  select credit_balance into v_balance from public.partners where id = p_partner for update;
  if not found then raise exception 'partner not found' using errcode = 'P0002'; end if;
  if v_balance + p_delta < 0 then raise exception 'credit balance cannot go negative' using errcode = 'P0001'; end if;
  v_balance := v_balance + p_delta;
  perform set_config('app.partner_credit', 'on', true);
  update public.partners set credit_balance = v_balance where id = p_partner;
  perform set_config('app.partner_credit', 'off', true);
  insert into public.partner_credit_ledger (partner_id, delta, balance_after, kind, reference_id, note, created_by)
  values (p_partner, p_delta, v_balance, p_kind, p_reference, left(p_note, 500), auth.uid());
  return v_balance;
end;
$$;

create or replace function public.platform_adjust_partner_credit(p_partner uuid, p_delta numeric, p_kind text, p_note text)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v numeric;
begin
  perform app.require_platform('platform.partners.manage');
  if p_kind not in ('onboarding_credit', 'adjustment') then raise exception 'unknown credit kind' using errcode = '22023'; end if;
  if p_delta = 0 or abs(p_delta) > 1000000 or char_length(trim(coalesce(p_note, ''))) < 3 then raise exception 'invalid credit adjustment' using errcode = '22023'; end if;
  v := app.partner_credit_move(p_partner, round(p_delta, 2), p_kind, null, trim(p_note));
  perform app.platform_audit('partner.credit_adjusted', 'partner', p_partner::text, jsonb_build_object('delta', p_delta, 'kind', p_kind, 'note', left(p_note, 200)));
  return v;
end;
$$;

-- Licences ------------------------------------------------------------------------------
create or replace function app.new_license_key()
returns text language sql volatile set search_path = '' as $$
  select 'PCL-' || upper(substr(h, 1, 4)) || '-' || upper(substr(h, 5, 4)) || '-' || upper(substr(h, 9, 4))
  from (select encode(extensions.gen_random_bytes(6), 'hex') as h) x;
$$;

/**
 * Issues a batch of licence keys to a partner. The partner's credit balance is applied first
 * (up to the subtotal). Returns the batch id.
 */
create or replace function public.platform_issue_license_batch(p_partner uuid, p_type text, p_qty integer, p_unit_price numeric, p_paid boolean default false, p_reference text default null, p_request uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_partner public.partners%rowtype;
  v_subtotal numeric(12,2);
  v_credit numeric(12,2);
  v_id uuid;
  v_seq int;
  v_key text;
  i int;
begin
  perform app.require_platform('platform.partners.manage');
  select * into v_partner from public.partners where id = p_partner for update;
  if not found then raise exception 'partner not found' using errcode = 'P0002'; end if;
  if v_partner.status <> 'active' then raise exception 'partner is not active' using errcode = 'P0001'; end if;
  if p_type not in ('starter', 'growth') then raise exception 'unknown licence type' using errcode = '22023'; end if;
  if p_qty is null or p_qty < 1 or p_qty > 10000 then raise exception 'quantity must be 1-10000' using errcode = '22023'; end if;
  if p_unit_price is null or p_unit_price < 0 then raise exception 'invalid unit price' using errcode = '22023'; end if;
  v_subtotal := round(p_unit_price * p_qty, 2);
  v_credit := least(v_partner.credit_balance, v_subtotal);
  perform pg_advisory_xact_lock(hashtext('partner_license_batches'));
  select count(*) + 1 into v_seq from public.partner_license_batches where to_char(created_at, 'YYYYMM') = to_char(now(), 'YYYYMM');
  insert into public.partner_license_batches (partner_id, batch_number, license_type, qty, unit_price, subtotal, credit_applied, total, payment_status, payment_reference, paid_at, request_id, created_by)
  values (p_partner, 'LB-' || to_char(now(), 'YYYYMM') || '-' || lpad(v_seq::text, 4, '0'), p_type, p_qty, p_unit_price, v_subtotal, v_credit, v_subtotal - v_credit,
          case when p_paid or v_subtotal - v_credit = 0 then 'paid' else 'pending' end, left(nullif(trim(coalesce(p_reference, '')), ''), 160),
          case when p_paid or v_subtotal - v_credit = 0 then now() end, p_request, auth.uid())
  returning id into v_id;
  if v_credit > 0 then perform app.partner_credit_move(p_partner, -v_credit, 'batch_applied', v_id, 'Applied to licence batch'); end if;
  for i in 1..p_qty loop
    loop
      v_key := app.new_license_key();
      exit when not exists (select 1 from public.partner_licenses where license_key = v_key);
    end loop;
    insert into public.partner_licenses (batch_id, partner_id, license_key, license_type) values (v_id, p_partner, v_key, p_type);
  end loop;
  perform app.platform_audit('partner.licenses_issued', 'partner_license_batch', v_id::text, jsonb_build_object('partnerId', p_partner, 'qty', p_qty, 'type', p_type, 'subtotal', v_subtotal, 'creditApplied', v_credit));
  return v_id;
end;
$$;

create or replace function public.platform_decide_license_request(p_request uuid, p_approve boolean, p_unit_price numeric default null, p_paid boolean default false, p_reference text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v public.partner_license_requests%rowtype; v_batch uuid; v_price numeric;
begin
  perform app.require_platform('platform.partners.manage');
  select * into v from public.partner_license_requests where id = p_request for update;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
  if v.status <> 'pending' then raise exception 'request already decided' using errcode = 'P0001'; end if;
  if p_approve then
    v_price := coalesce(p_unit_price, (select license_price from public.partners where id = v.partner_id));
    if v_price is null then raise exception 'set a unit price' using errcode = '22023'; end if;
    v_batch := public.platform_issue_license_batch(v.partner_id, v.license_type, v.qty, v_price, p_paid, p_reference, v.id);
  end if;
  update public.partner_license_requests
     set status = case when p_approve then 'approved' else 'rejected' end, batch_id = v_batch, reviewed_by = auth.uid(), reviewed_at = now(),
         decision_note = left(nullif(trim(coalesce(p_note, '')), ''), 500)
   where id = p_request;
  perform app.platform_audit(case when p_approve then 'partner.license_request_approved' else 'partner.license_request_rejected' end, 'partner_license_request', p_request::text, jsonb_build_object('partnerId', v.partner_id, 'qty', v.qty));
  return v_batch;
end;
$$;

create or replace function public.platform_mark_license_batch_paid(p_batch uuid, p_reference text)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.partner_license_batches%rowtype;
begin
  perform app.require_platform('platform.partners.manage');
  select * into v from public.partner_license_batches where id = p_batch for update;
  if not found then raise exception 'batch not found' using errcode = 'P0002'; end if;
  if v.payment_status = 'paid' then raise exception 'batch already paid' using errcode = 'P0001'; end if;
  update public.partner_license_batches set payment_status = 'paid', paid_at = now(), payment_reference = left(nullif(trim(coalesce(p_reference, '')), ''), 160) where id = p_batch;
  perform app.platform_audit('partner.license_batch_paid', 'partner_license_batch', p_batch::text, jsonb_build_object('total', v.total));
end;
$$;

create or replace function public.platform_revoke_partner_license(p_license uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.partner_licenses%rowtype;
begin
  perform app.require_platform('platform.partners.manage');
  select * into v from public.partner_licenses where id = p_license for update;
  if not found then raise exception 'licence not found' using errcode = 'P0002'; end if;
  if v.status <> 'available' then raise exception 'only unused licences can be revoked' using errcode = 'P0001'; end if;
  update public.partner_licenses set status = 'revoked', revoked_at = now(), revoked_by = auth.uid() where id = p_license;
  perform app.platform_audit('partner.license_revoked', 'partner_license', v.license_key, jsonb_build_object('partnerId', v.partner_id));
end;
$$;

/**
 * Redeems a licence key for a store: the store moves to the licence's plan (active, no trial)
 * and is attributed to the partner. Callable by the store's billing manager or platform staff.
 */
create or replace function public.redeem_partner_license(p_tenant uuid, p_key text)
returns text language plpgsql security definer set search_path = '' as $$
declare v public.partner_licenses%rowtype; v_plan uuid; v_partner public.partners%rowtype;
begin
  if not (app.has_tenant_permission(p_tenant, 'billing.manage') or app.has_platform_permission('platform.partners.manage')) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  select * into v from public.partner_licenses where license_key = upper(trim(coalesce(p_key, ''))) for update;
  if not found or v.status <> 'available' then raise exception 'This licence key is not valid or was already used.' using errcode = 'P0001', hint = 'LICENSE_INVALID'; end if;
  select * into v_partner from public.partners where id = v.partner_id;
  if v_partner.status <> 'active' then raise exception 'This licence key is not valid or was already used.' using errcode = 'P0001', hint = 'LICENSE_INVALID'; end if;
  select id into v_plan from public.plans where code = v.license_type;
  if v_plan is null then raise exception 'licence plan is missing' using errcode = 'P0002'; end if;
  update public.partner_licenses set status = 'consumed', tenant_id = p_tenant, consumed_at = now() where id = v.id;
  update public.tenants set plan_id = v_plan, status = 'active', trial_ends_at = null where id = p_tenant and status in ('trial', 'active');
  if not found then raise exception 'store is not eligible' using errcode = 'P0001'; end if;
  insert into public.partner_referrals (tenant_id, partner_id, source, license_id, created_by)
  values (p_tenant, v.partner_id, 'license', v.id, auth.uid())
  on conflict (tenant_id) do nothing;
  insert into public.audit_logs (tenant_id, actor_user_id, actor_type, action, entity_type, entity_id, metadata)
  values (p_tenant, auth.uid(), case when app.has_tenant_permission(p_tenant, 'billing.manage') then 'user' else 'platform' end, 'partner.license_redeemed', 'partner_license', v.license_key,
          jsonb_build_object('partnerId', v.partner_id, 'plan', v.license_type));
  return v.license_type;
end;
$$;

create or replace function public.platform_set_store_partner(p_tenant uuid, p_partner uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_platform('platform.partners.manage');
  if p_partner is null then
    delete from public.partner_referrals where tenant_id = p_tenant;
  else
    insert into public.partner_referrals (tenant_id, partner_id, source, created_by) values (p_tenant, p_partner, 'manual', auth.uid())
    on conflict (tenant_id) do update set partner_id = excluded.partner_id, source = 'manual', created_by = excluded.created_by;
  end if;
  perform app.platform_audit('partner.store_attributed', 'tenant', p_tenant::text, jsonb_build_object('partnerId', p_partner), p_tenant);
end;
$$;

-- Agencies: set the payout rate for all agents and interns under an agency.
create or replace function public.platform_set_agency_payout(p_agency uuid, p_bps integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  perform app.require_platform('platform.partners.manage');
  if p_bps < 0 or p_bps > 10000 then raise exception 'rate must be 0-10000 bps' using errcode = '22023'; end if;
  update public.partners set agency_payout_bps = p_bps where id = p_agency and partner_type = 'agency';
  if not found then raise exception 'agency not found' using errcode = 'P0002'; end if;
  update public.partners set direct_bps = p_bps where parent_partner_id = p_agency and partner_type in ('agent', 'intern');
  get diagnostics v_count = row_count;
  perform app.platform_audit('partner.agency_payout_set', 'partner', p_agency::text, jsonb_build_object('bps', p_bps, 'synced', v_count));
  return v_count;
end;
$$;

-- One-time codes ----------------------------------------------------------------------------
create or replace function public.platform_create_partner_code(p_value numeric, p_expires date default null, p_note text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  perform app.require_platform('platform.partners.manage');
  if p_value is null or p_value <= 0 or p_value > 1000000 then raise exception 'invalid value' using errcode = '22023'; end if;
  v_code := 'OTC-' || upper(encode(extensions.gen_random_bytes(6), 'hex'));
  insert into public.partner_one_time_codes (code_hash, code_hint, value, expires_at, note, created_by)
  values (encode(extensions.digest(v_code, 'sha256'), 'hex'), right(v_code, 4), round(p_value, 2), p_expires, left(nullif(trim(coalesce(p_note, '')), ''), 200), auth.uid());
  perform app.platform_audit('partner.code_created', 'partner_code', right(v_code, 4), jsonb_build_object('value', p_value));
  return v_code;
end;
$$;

create or replace function public.platform_redeem_partner_code(p_code text, p_partner uuid)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v public.partner_one_time_codes%rowtype; v_balance numeric;
begin
  perform app.require_platform('platform.partners.manage');
  select * into v from public.partner_one_time_codes where code_hash = encode(extensions.digest(upper(trim(coalesce(p_code, ''))), 'sha256'), 'hex') for update;
  if not found or v.status <> 'active' or (v.expires_at is not null and v.expires_at < (now() at time zone 'Asia/Kolkata')::date) then
    raise exception 'This code is not valid, expired or already used.' using errcode = 'P0001', hint = 'CODE_INVALID';
  end if;
  update public.partner_one_time_codes set status = 'used', used_by_partner_id = p_partner, used_at = now() where id = v.id;
  v_balance := app.partner_credit_move(p_partner, v.value, 'one_time_code', v.id, 'One-time code …' || v.code_hint);
  perform app.platform_audit('partner.code_redeemed', 'partner_code', v.code_hint, jsonb_build_object('partnerId', p_partner, 'value', v.value));
  return v_balance;
end;
$$;

create or replace function public.platform_revoke_partner_code(p_code uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_platform('platform.partners.manage');
  update public.partner_one_time_codes set status = 'revoked' where id = p_code and status = 'active';
  if not found then raise exception 'code is not active' using errcode = 'P0001'; end if;
  perform app.platform_audit('partner.code_revoked', 'partner_code', p_code::text);
end;
$$;

-- Invites -----------------------------------------------------------------------------------
-- Called by the signed-in invitee on /partner/accept/{token}. The token's SHA-256 is looked up;
-- the account email must match the invite email.
create or replace function public.accept_partner_invite(p_token_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v public.partner_invites%rowtype; v_email text;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into v from public.partner_invites where token_hash = p_token_hash for update;
  if not found or v.accepted_at is not null or v.revoked_at is not null or v.expires_at < now() then
    raise exception 'This invite link is not valid any more.' using errcode = 'P0001', hint = 'INVITE_INVALID';
  end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is distinct from v.email then raise exception 'Sign in with the email address the invite was sent to.' using errcode = 'P0001', hint = 'INVITE_EMAIL_MISMATCH'; end if;
  if exists (select 1 from public.partners where user_id = auth.uid() and id <> v.partner_id) then
    raise exception 'This account is already linked to another partner.' using errcode = 'P0001', hint = 'INVITE_ACCOUNT_TAKEN';
  end if;
  update public.partners set user_id = auth.uid(), status = case when status = 'pending' then 'active' else status end where id = v.partner_id;
  update public.partner_invites set accepted_at = now(), accepted_by = auth.uid() where id = v.id;
  insert into public.audit_logs (tenant_id, actor_user_id, actor_type, action, entity_type, entity_id, metadata)
  values (null, auth.uid(), 'user', 'partner.invite_accepted', 'partner', v.partner_id::text, '{}'::jsonb);
  return v.partner_id;
end;
$$;

-- Commissions and payouts --------------------------------------------------------------------
/**
 * Accrues commissions for one ended month: each store attributed to an active partner and
 * active on a paid plan pays the partner direct_bps of the plan's monthly price, and the
 * partner's active parent override_bps. Idempotent per (partner, store, month, kind).
 */
create or replace function public.platform_accrue_partner_commissions(p_month date)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count int := 0; v_n int;
begin
  perform app.require_platform('platform.finance.manage');
  if p_month is null or p_month <> date_trunc('month', p_month)::date then raise exception 'month must be the first of a month' using errcode = '22023'; end if;
  if (p_month + interval '1 month')::date > (now() at time zone 'Asia/Kolkata')::date then raise exception 'the month has not ended yet' using errcode = '22023'; end if;
  insert into public.partner_commissions (partner_id, tenant_id, period_month, kind, base_amount, rate_bps, amount)
  select p.id, t.id, p_month, 'direct', pl.price_monthly, p.direct_bps, ((round(pl.price_monthly * 100)::bigint * p.direct_bps + 5000) / 10000)::numeric / 100
  from public.partner_referrals r
  join public.partners p on p.id = r.partner_id and p.status = 'active'
  join public.tenants t on t.id = r.tenant_id and t.status = 'active'
  join public.plans pl on pl.id = t.plan_id and pl.price_monthly > 0
  where r.created_at < (p_month + interval '1 month')
    and ((round(pl.price_monthly * 100)::bigint * p.direct_bps + 5000) / 10000) > 0
  on conflict do nothing;
  get diagnostics v_n = row_count; v_count := v_count + v_n;
  insert into public.partner_commissions (partner_id, tenant_id, period_month, kind, base_amount, rate_bps, amount)
  select up.id, t.id, p_month, 'override', pl.price_monthly, up.override_bps, ((round(pl.price_monthly * 100)::bigint * up.override_bps + 5000) / 10000)::numeric / 100
  from public.partner_referrals r
  join public.partners p on p.id = r.partner_id and p.status = 'active'
  join public.partners up on up.id = p.parent_partner_id and up.status = 'active'
  join public.tenants t on t.id = r.tenant_id and t.status = 'active'
  join public.plans pl on pl.id = t.plan_id and pl.price_monthly > 0
  where r.created_at < (p_month + interval '1 month')
    and ((round(pl.price_monthly * 100)::bigint * up.override_bps + 5000) / 10000) > 0
  on conflict do nothing;
  get diagnostics v_n = row_count; v_count := v_count + v_n;
  perform app.platform_audit('partner.commissions_accrued', 'commission_month', p_month::text, jsonb_build_object('rows', v_count));
  return v_count;
end;
$$;

create or replace function public.platform_pending_partner_payouts(p_cutoff date)
returns table (partner_id uuid, partner_name text, partner_code text, tier text, payout_method text, upi_id text, bank_account_holder text,
               bank_account_last4 text, bank_ifsc text, commission_count integer, direct_amount numeric, override_amount numeric, total_amount numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_platform('platform.finance.read');
  return query
    select p.id, p.name, p.partner_code, p.tier, p.payout_method, p.upi_id, p.bank_account_holder, right(p.bank_account_number, 4), p.bank_ifsc,
           count(c.id)::int,
           coalesce(sum(c.amount) filter (where c.kind = 'direct'), 0)::numeric(12,2),
           coalesce(sum(c.amount) filter (where c.kind = 'override'), 0)::numeric(12,2),
           coalesce(sum(c.amount), 0)::numeric(12,2)
    from public.partners p
    join public.partner_commissions c on c.partner_id = p.id
    where c.status = 'pending' and c.payout_id is null and c.period_month <= p_cutoff
    group by p.id
    having sum(c.amount) > 0
    order by sum(c.amount) desc;
end;
$$;

/**
 * Accrues the cutoff's month (when it has ended), then groups every pending commission earned up
 * to the cutoff into one payout per partner. Partners below the minimum roll over.
 */
create or replace function public.platform_run_partner_payout_batch(p_cutoff date, p_method text default 'upi', p_min_amount numeric default 0)
returns table (payouts_created integer, total_amount numeric, carried_over integer)
language plpgsql security definer set search_path = '' as $$
declare r record; v_payout uuid; v_created int := 0; v_total numeric(14,2) := 0; v_carried int := 0; v_month date;
begin
  perform app.require_platform('platform.finance.manage');
  if p_method not in ('upi', 'bank', 'other') then raise exception 'unknown method' using errcode = '22023'; end if;
  if p_cutoff is null or p_cutoff > (now() at time zone 'Asia/Kolkata')::date then raise exception 'cutoff must be today or earlier' using errcode = '22023'; end if;
  v_month := date_trunc('month', p_cutoff)::date;
  if (v_month + interval '1 month')::date <= (now() at time zone 'Asia/Kolkata')::date then perform public.platform_accrue_partner_commissions(v_month); end if;
  perform pg_advisory_xact_lock(hashtext('partner_payout_batch'));
  for r in
    select c.partner_id, sum(c.amount)::numeric(12,2) as amt, count(*)::int as cnt,
           coalesce(sum(c.amount) filter (where c.kind = 'direct'), 0)::numeric(12,2) as direct_amt,
           coalesce(sum(c.amount) filter (where c.kind = 'override'), 0)::numeric(12,2) as override_amt
    from public.partner_commissions c
    where c.status = 'pending' and c.payout_id is null and c.period_month <= p_cutoff
    group by c.partner_id
  loop
    if r.amt <= 0 or r.amt < coalesce(p_min_amount, 0) then v_carried := v_carried + 1; continue; end if;
    insert into public.partner_payouts (partner_id, period_cutoff, amount, direct_amount, override_amount, commission_count, method, created_by, notes)
    values (r.partner_id, p_cutoff, r.amt, r.direct_amt, r.override_amt, r.cnt, p_method, auth.uid(), 'Batch up to ' || p_cutoff::text)
    returning id into v_payout;
    update public.partner_commissions set status = 'batched', payout_id = v_payout
     where partner_id = r.partner_id and status = 'pending' and payout_id is null and period_month <= p_cutoff;
    v_created := v_created + 1; v_total := v_total + r.amt;
  end loop;
  perform app.platform_audit('partner.payout_batch_run', 'payout_cutoff', p_cutoff::text, jsonb_build_object('created', v_created, 'total', v_total, 'carriedOver', v_carried));
  return query select v_created, v_total, v_carried;
end;
$$;

create or replace function public.platform_settle_partner_payout(p_payout uuid, p_paid boolean, p_utr text default null, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.partner_payouts%rowtype;
begin
  perform app.require_platform('platform.finance.manage');
  select * into v from public.partner_payouts where id = p_payout for update;
  if not found then raise exception 'payout not found' using errcode = 'P0002'; end if;
  if v.status <> 'initiated' then raise exception 'payout already settled' using errcode = 'P0001'; end if;
  if p_paid and (p_utr is null or p_utr !~ '^[A-Za-z0-9-]{6,40}$') then raise exception 'enter the UTR / reference' using errcode = '22023'; end if;
  if p_paid then
    update public.partner_payouts set status = 'paid', utr = p_utr, paid_at = now(), paid_by = auth.uid(), notes = coalesce(left(nullif(trim(coalesce(p_note, '')), ''), 500), notes) where id = p_payout;
    update public.partner_commissions set status = 'paid' where payout_id = p_payout;
  else
    -- Failed transfer: release the commissions so the next batch picks them up again.
    update public.partner_payouts set status = 'failed', notes = coalesce(left(nullif(trim(coalesce(p_note, '')), ''), 500), notes) where id = p_payout;
    update public.partner_commissions set status = 'pending', payout_id = null where payout_id = p_payout;
  end if;
  perform app.platform_audit(case when p_paid then 'partner.payout_paid' else 'partner.payout_failed' end, 'partner_payout', p_payout::text, jsonb_build_object('partnerId', v.partner_id, 'amount', v.amount));
end;
$$;

-- Reads with server-side aggregates ------------------------------------------------------------
create or replace function public.platform_partner_leaderboard(p_from date, p_to date)
returns table (partner_id uuid, partner_name text, partner_code text, partner_type text, tier text, state_name text, licenses integer, gmv numeric, commission numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.has_platform_permission('platform.finance.read') or app.has_platform_permission('platform.partners.manage')) then raise exception 'not permitted' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_from > p_to then raise exception 'invalid range' using errcode = '22023'; end if;
  -- Each source is aggregated on its own (no join fan-out between batches and commissions).
  return query
  with b as (
    select lb.partner_id, sum(lb.qty)::int as qty, sum(lb.subtotal) as gmv
    from public.partner_license_batches lb
    where (lb.created_at at time zone 'Asia/Kolkata')::date between p_from and p_to
    group by lb.partner_id
  ), c as (
    select pc.partner_id, sum(pc.amount) as amt
    from public.partner_commissions pc
    where pc.status <> 'void' and pc.period_month between date_trunc('month', p_from)::date and p_to
    group by pc.partner_id
  )
  select p.id, p.name, p.partner_code, p.partner_type, p.tier, p.state_name,
         coalesce(b.qty, 0), coalesce(b.gmv, 0)::numeric(12,2), coalesce(c.amt, 0)::numeric(12,2)
  from public.partners p
  left join b on b.partner_id = p.id
  left join c on c.partner_id = p.id
  where coalesce(b.qty, 0) > 0 or coalesce(c.amt, 0) > 0;
end;
$$;

-- Partner list / agencies: agency totals include their agents and interns.
create or replace function public.platform_partner_orgs(p_type text default 'all')
returns table (partner_id uuid, name text, company_name text, email text, partner_code text, partner_type text, tier text, status text,
               parent_id uuid, parent_name text, team_count integer, licenses_total integer, licenses_redeemed integer, amount_paid numeric,
               credit_balance numeric, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.has_platform_permission('platform.partners.manage') or app.has_platform_permission('platform.finance.read')) then raise exception 'not permitted' using errcode = '42501'; end if;
  if p_type not in ('all', 'agency', 'freelancer', 'intern', 'agent') then raise exception 'unknown type' using errcode = '22023'; end if;
  return query
  with scope as (
    -- For an agency, its own id plus direct agents/interns; for others, only their own id.
    select p.id as owner_id, p.id as member_id from public.partners p
    union all
    select p.parent_partner_id, p.id from public.partners p
    join public.partners a on a.id = p.parent_partner_id and a.partner_type = 'agency'
    where p.partner_type in ('agent', 'intern')
  ), lic as (
    select s.owner_id, count(l.id)::int as total, count(l.id) filter (where l.status = 'consumed')::int as redeemed
    from scope s join public.partner_licenses l on l.partner_id = s.member_id
    group by s.owner_id
  ), paid as (
    select s.owner_id, sum(lb.total) as amt
    from scope s join public.partner_license_batches lb on lb.partner_id = s.member_id and lb.payment_status = 'paid'
    group by s.owner_id
  )
  select p.id, p.name, p.company_name, p.email, p.partner_code, p.partner_type, p.tier, p.status,
         p.parent_partner_id, par.name,
         (select count(*)::int from public.partners ch where ch.parent_partner_id = p.id),
         coalesce(lic.total, 0), coalesce(lic.redeemed, 0), coalesce(paid.amt, 0)::numeric(12,2), p.credit_balance, p.created_at
  from public.partners p
  left join public.partners par on par.id = p.parent_partner_id
  left join lic on lic.owner_id = p.id
  left join paid on paid.owner_id = p.id
  where p_type = 'all' or p.partner_type = p_type
  order by p.created_at desc;
end;
$$;

revoke all on function app.partner_credit_move(uuid, numeric, text, uuid, text), app.new_license_key() from public, anon, authenticated;
revoke all on function public.platform_adjust_partner_credit(uuid, numeric, text, text), public.platform_issue_license_batch(uuid, text, integer, numeric, boolean, text, uuid),
  public.platform_decide_license_request(uuid, boolean, numeric, boolean, text, text), public.platform_mark_license_batch_paid(uuid, text),
  public.platform_revoke_partner_license(uuid), public.redeem_partner_license(uuid, text), public.platform_set_store_partner(uuid, uuid),
  public.platform_set_agency_payout(uuid, integer), public.platform_create_partner_code(numeric, date, text), public.platform_redeem_partner_code(text, uuid),
  public.platform_revoke_partner_code(uuid), public.accept_partner_invite(text), public.platform_accrue_partner_commissions(date),
  public.platform_pending_partner_payouts(date), public.platform_run_partner_payout_batch(date, text, numeric), public.platform_settle_partner_payout(uuid, boolean, text, text),
  public.platform_partner_leaderboard(date, date), public.platform_partner_orgs(text) from public, anon;
grant execute on function public.platform_adjust_partner_credit(uuid, numeric, text, text), public.platform_issue_license_batch(uuid, text, integer, numeric, boolean, text, uuid),
  public.platform_decide_license_request(uuid, boolean, numeric, boolean, text, text), public.platform_mark_license_batch_paid(uuid, text),
  public.platform_revoke_partner_license(uuid), public.redeem_partner_license(uuid, text), public.platform_set_store_partner(uuid, uuid),
  public.platform_set_agency_payout(uuid, integer), public.platform_create_partner_code(numeric, date, text), public.platform_redeem_partner_code(text, uuid),
  public.platform_revoke_partner_code(uuid), public.accept_partner_invite(text), public.platform_accrue_partner_commissions(date),
  public.platform_pending_partner_payouts(date), public.platform_run_partner_payout_batch(date, text, numeric), public.platform_settle_partner_payout(uuid, boolean, text, text),
  public.platform_partner_leaderboard(date, date), public.platform_partner_orgs(text) to authenticated;

comment on table public.partners is 'Partner organisations and people (agency / freelancer / intern / agent) with tier, upline and payout details. Platform-only.';
comment on table public.partner_commissions is 'Monthly direct and override commissions per attributed store; batched into partner_payouts.';
