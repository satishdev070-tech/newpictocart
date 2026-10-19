-- Durable, tenant-scoped AI credits. Credits are integer units (not currency); money is
-- stored as numeric and converted to paise in TypeScript at the application boundary.
-- This migration is additive and intentionally is not applied by the application.

create table if not exists public.ai_credit_accounts (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  delta integer not null check (delta <> 0 and abs(delta) <= 1000000),
  balance_after integer not null check (balance_after >= 0),
  kind text not null check (kind in ('signup_bonus', 'usage', 'usage_refund', 'purchase', 'manual_grant', 'manual_adjustment')),
  reference_id uuid,
  note text check (note is null or char_length(note) <= 500),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 4096),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ai_credit_ledger_tenant_created_idx on public.ai_credit_ledger(tenant_id, created_at desc);
create unique index if not exists ai_credit_ledger_signup_bonus_once on public.ai_credit_ledger(tenant_id) where kind = 'signup_bonus';

create table if not exists public.ai_credit_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  pack text not null check (pack in ('starter', 'growth', 'pro')),
  credits integer not null check (credits > 0 and credits <= 1000000),
  amount numeric(12,2) not null check (amount >= 0),
  method text not null check (method in ('online', 'offline')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  requested_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  payment_reference text check (payment_reference is null or char_length(payment_reference) <= 160),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists ai_credit_purchase_requests_tenant_created_idx on public.ai_credit_purchase_requests(tenant_id, created_at desc);
create index if not exists ai_credit_purchase_requests_status_created_idx on public.ai_credit_purchase_requests(status, created_at asc);
create unique index if not exists ai_credit_purchase_requests_one_pending on public.ai_credit_purchase_requests(tenant_id) where status = 'pending';

drop trigger if exists trg_ai_credit_accounts_updated_at on public.ai_credit_accounts;
create trigger trg_ai_credit_accounts_updated_at before update on public.ai_credit_accounts
for each row execute function app.set_updated_at();

alter table public.ai_credit_accounts enable row level security;
alter table public.ai_credit_ledger enable row level security;
alter table public.ai_credit_purchase_requests enable row level security;

drop policy if exists ai_credit_accounts_select on public.ai_credit_accounts;
create policy ai_credit_accounts_select on public.ai_credit_accounts for select to authenticated using (
  app.has_tenant_permission(tenant_id, 'marketing.read') or app.has_platform_permission('platform.usage.read')
);
drop policy if exists ai_credit_ledger_select on public.ai_credit_ledger;
create policy ai_credit_ledger_select on public.ai_credit_ledger for select to authenticated using (
  app.has_tenant_permission(tenant_id, 'marketing.read') or app.has_platform_permission('platform.usage.read')
);
drop policy if exists ai_credit_purchase_requests_select on public.ai_credit_purchase_requests;
create policy ai_credit_purchase_requests_select on public.ai_credit_purchase_requests for select to authenticated using (
  app.has_tenant_permission(tenant_id, 'billing.manage') or app.has_platform_permission('platform.usage.read')
);

-- All writes go through the audited, locking functions below. The service role is available
-- for migrations/jobs but application code uses an authenticated server client and the RPCs.
revoke all on public.ai_credit_accounts, public.ai_credit_ledger, public.ai_credit_purchase_requests from anon, authenticated;
grant select on public.ai_credit_accounts, public.ai_credit_ledger, public.ai_credit_purchase_requests to authenticated;
grant all on public.ai_credit_accounts, public.ai_credit_ledger, public.ai_credit_purchase_requests to service_role;

-- New tenants always receive their 100 free credits, regardless of which onboarding/admin path
-- created the tenant. Existing tenants receive the same one-time grant below.
create or replace function app.grant_signup_ai_credits()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.ai_credit_accounts(tenant_id, balance) values (new.id, 100)
  on conflict (tenant_id) do nothing;
  insert into public.ai_credit_ledger(tenant_id, delta, balance_after, kind, note)
  values (new.id, 100, 100, 'signup_bonus', 'Welcome bonus')
  on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists trg_tenants_ai_signup_credits on public.tenants;
create trigger trg_tenants_ai_signup_credits after insert on public.tenants
for each row execute function app.grant_signup_ai_credits();

-- Backfill exactly once. The partial unique index makes a re-run safe.
insert into public.ai_credit_accounts(tenant_id, balance)
select id, 100 from public.tenants on conflict (tenant_id) do nothing;
insert into public.ai_credit_ledger(tenant_id, delta, balance_after, kind, note)
select a.tenant_id, 100, a.balance, 'signup_bonus', 'Welcome bonus'
from public.ai_credit_accounts a
where not exists (select 1 from public.ai_credit_ledger l where l.tenant_id = a.tenant_id and l.kind = 'signup_bonus');

create or replace function public.ai_credit_debit(p_tenant uuid, p_kind text, p_reference uuid default null)
returns table (ledger_id uuid, balance integer)
language plpgsql security definer set search_path = '' as $$
declare v_balance integer; v_id uuid;
begin
  if not app.has_tenant_permission(p_tenant, 'marketing.write') then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if p_kind !~ '^[a-z_]{2,60}$' then raise exception 'invalid AI generation kind' using errcode = '22023'; end if;
  insert into public.ai_credit_accounts(tenant_id, balance) values (p_tenant, 0) on conflict (tenant_id) do nothing;
  select balance into v_balance from public.ai_credit_accounts where tenant_id = p_tenant for update;
  if coalesce(v_balance, 0) < 1 then
    raise exception 'AI credits exhausted' using errcode = 'P0001', hint = 'AI_CREDITS_EXHAUSTED';
  end if;
  v_balance := v_balance - 1;
  update public.ai_credit_accounts set balance = v_balance where tenant_id = p_tenant;
  insert into public.ai_credit_ledger(tenant_id, delta, balance_after, kind, reference_id, note, metadata, created_by)
  values (p_tenant, -1, v_balance, 'usage', p_reference, p_kind, jsonb_build_object('kind', p_kind), auth.uid()) returning id into v_id;
  return query select v_id, v_balance;
end;
$$;

create or replace function public.ai_credit_refund(p_ledger uuid, p_note text default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_usage public.ai_credit_ledger%rowtype; v_balance integer;
begin
  select * into v_usage from public.ai_credit_ledger where id = p_ledger for update;
  if not found then raise exception 'credit usage not found' using errcode = 'P0002'; end if;
  if v_usage.kind <> 'usage' or v_usage.created_by is distinct from auth.uid() or not app.has_tenant_permission(v_usage.tenant_id, 'marketing.write') then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if exists (select 1 from public.ai_credit_ledger where kind = 'usage_refund' and reference_id = p_ledger) then
    select balance into v_balance from public.ai_credit_accounts where tenant_id = v_usage.tenant_id;
    return coalesce(v_balance, 0);
  end if;
  select balance into v_balance from public.ai_credit_accounts where tenant_id = v_usage.tenant_id for update;
  v_balance := coalesce(v_balance, 0) + 1;
  update public.ai_credit_accounts set balance = v_balance where tenant_id = v_usage.tenant_id;
  insert into public.ai_credit_ledger(tenant_id, delta, balance_after, kind, reference_id, note, metadata, created_by)
  values (v_usage.tenant_id, 1, v_balance, 'usage_refund', p_ledger, left(coalesce(p_note, 'AI generation failed'), 500), jsonb_build_object('usageLedgerId', p_ledger), auth.uid());
  return v_balance;
end;
$$;

create or replace function public.request_ai_credit_purchase(p_tenant uuid, p_pack text, p_method text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_credits integer; v_amount numeric(12,2); v_id uuid;
begin
  if not app.has_tenant_permission(p_tenant, 'billing.manage') then raise exception 'not permitted' using errcode = '42501'; end if;
  case p_pack
    when 'starter' then v_credits := 100; v_amount := 99;
    when 'growth' then v_credits := 500; v_amount := 399;
    when 'pro' then v_credits := 1500; v_amount := 999;
    else raise exception 'unknown pack' using errcode = '22023';
  end case;
  if p_method not in ('online', 'offline') then raise exception 'unknown payment method' using errcode = '22023'; end if;
  if exists (select 1 from public.ai_credit_purchase_requests where tenant_id = p_tenant and status = 'pending') then
    raise exception 'A credit purchase is already pending' using errcode = 'P0001', hint = 'AI_CREDIT_PURCHASE_PENDING';
  end if;
  insert into public.ai_credit_purchase_requests(tenant_id, pack, credits, amount, method, requested_by)
  values (p_tenant, p_pack, v_credits, v_amount, p_method, auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.decide_ai_credit_purchase(p_request uuid, p_approve boolean, p_note text default null, p_payment_reference text default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_request public.ai_credit_purchase_requests%rowtype; v_balance integer;
begin
  if not app.has_platform_permission('platform.settings.manage') then raise exception 'not permitted' using errcode = '42501'; end if;
  select * into v_request from public.ai_credit_purchase_requests where id = p_request for update;
  if not found then raise exception 'purchase request not found' using errcode = 'P0002'; end if;
  if v_request.status <> 'pending' then raise exception 'purchase request already decided' using errcode = 'P0001'; end if;
  update public.ai_credit_purchase_requests set status = case when p_approve then 'approved' else 'declined' end, decided_by = auth.uid(), decided_at = now(), decision_note = left(nullif(p_note, ''), 500), payment_reference = left(nullif(p_payment_reference, ''), 160) where id = p_request;
  if not p_approve then return 0; end if;
  insert into public.ai_credit_accounts(tenant_id, balance) values (v_request.tenant_id, 0) on conflict (tenant_id) do nothing;
  select balance into v_balance from public.ai_credit_accounts where tenant_id = v_request.tenant_id for update;
  v_balance := coalesce(v_balance, 0) + v_request.credits;
  update public.ai_credit_accounts set balance = v_balance where tenant_id = v_request.tenant_id;
  insert into public.ai_credit_ledger(tenant_id, delta, balance_after, kind, reference_id, note, metadata, created_by)
  values (v_request.tenant_id, v_request.credits, v_balance, 'purchase', v_request.id, left(coalesce(p_note, 'Credit purchase'), 500), jsonb_build_object('pack', v_request.pack, 'method', v_request.method, 'amount', v_request.amount), auth.uid());
  return v_balance;
end;
$$;

create or replace function public.grant_ai_credits(p_tenant uuid, p_credits integer, p_note text)
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_balance integer;
begin
  if not app.has_platform_permission('platform.settings.manage') then raise exception 'not permitted' using errcode = '42501'; end if;
  if p_credits = 0 or abs(p_credits) > 1000000 or char_length(trim(coalesce(p_note, ''))) < 3 then raise exception 'invalid credit adjustment' using errcode = '22023'; end if;
  insert into public.ai_credit_accounts(tenant_id, balance) values (p_tenant, 0) on conflict (tenant_id) do nothing;
  select balance into v_balance from public.ai_credit_accounts where tenant_id = p_tenant for update;
  if v_balance + p_credits < 0 then raise exception 'balance cannot be negative' using errcode = 'P0001'; end if;
  v_balance := v_balance + p_credits;
  update public.ai_credit_accounts set balance = v_balance where tenant_id = p_tenant;
  insert into public.ai_credit_ledger(tenant_id, delta, balance_after, kind, note, created_by)
  values (p_tenant, p_credits, v_balance, case when p_credits > 0 then 'manual_grant' else 'manual_adjustment' end, left(trim(p_note), 500), auth.uid());
  return v_balance;
end;
$$;

revoke all on function public.ai_credit_debit(uuid, text, uuid), public.ai_credit_refund(uuid, text), public.request_ai_credit_purchase(uuid, text, text), public.decide_ai_credit_purchase(uuid, boolean, text, text), public.grant_ai_credits(uuid, integer, text) from public, anon;
grant execute on function public.ai_credit_debit(uuid, text, uuid), public.ai_credit_refund(uuid, text), public.request_ai_credit_purchase(uuid, text, text) to authenticated;
grant execute on function public.decide_ai_credit_purchase(uuid, boolean, text, text), public.grant_ai_credits(uuid, integer, text) to authenticated;

comment on table public.ai_credit_accounts is 'Current durable AI-credit balance per tenant. Mutated only by locking credit RPCs.';
comment on table public.ai_credit_ledger is 'Immutable ledger for signup grants, usage debits/refunds, purchases and manual adjustments.';
comment on table public.ai_credit_purchase_requests is 'Seller AI-credit purchase requests; platform staff verifies payment before approval.';
