-- =============================================================================
-- 3900 AI ECONOMY: editable credit pricing, per-action credit costs, credit packs and promo
-- codes (read by the existing credit RPCs from migration 3400), plus the AI feature → model
-- registry (primary + fallback) and per-model prices used for AI cost.
-- Additive. Requires 3400 (ai_credits) and 3700. Not applied by the application.
-- =============================================================================

-- 1. Pricing (single row) ----------------------------------------------------------------
create table if not exists public.ai_credit_settings (
  id smallint primary key default 1 check (id = 1),
  base_cost_per_credit numeric(10,4) not null default 0.03 check (base_cost_per_credit > 0),
  margin_multiplier numeric(6,2) not null default 3 check (margin_multiplier >= 1 and margin_multiplier <= 100),
  custom_credits_per_rupee integer not null default 11 check (custom_credits_per_rupee between 1 and 10000),
  custom_min numeric(12,2) not null default 99 check (custom_min > 0),
  custom_max numeric(12,2) not null default 50000 check (custom_max >= custom_min),
  welcome_credits integer not null default 100 check (welcome_credits between 0 and 100000),
  low_balance integer not null default 20 check (low_balance >= 0),
  critical_balance integer not null default 5 check (critical_balance >= 0 and critical_balance <= low_balance),
  freelancer_hourly numeric(10,2) not null default 600 check (freelancer_hourly >= 0),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.ai_credit_settings (id) values (1) on conflict (id) do nothing;

-- 2. Credits per AI action (kind = ai_credit_debit p_kind) ------------------------------
create table if not exists public.ai_credit_action_costs (
  kind text primary key check (kind ~ '^[a-z_]{2,60}$'),
  label text not null check (char_length(label) between 2 and 80),
  credits integer not null default 1 check (credits between 1 and 1000),
  minutes_saved integer not null default 5 check (minutes_saved between 0 and 6000),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.ai_credit_action_costs (kind, label, credits, minutes_saved) values
  ('caption', 'Social caption', 1, 10), ('hashtags', 'Hashtags', 1, 5), ('ideas', 'Post ideas', 1, 15),
  ('plan', 'Content plan', 1, 30), ('review_reply', 'Review reply', 1, 5), ('message_reply', 'Message reply', 1, 5),
  ('profile', 'Brand profile', 1, 20), ('section', 'Site builder section', 1, 20), ('onboarding_seed', 'Store starter content', 1, 60)
on conflict (kind) do nothing;

-- 3. Packs (replace the hard-coded CASE in request_ai_credit_purchase) ----------------------
create table if not exists public.ai_credit_packs (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$' and code <> 'custom'),
  label text not null check (char_length(label) between 2 and 60),
  credits integer not null check (credits between 1 and 1000000),
  price numeric(12,2) not null check (price > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.ai_credit_packs (code, label, credits, price, sort_order) values
  ('starter', 'Starter', 100, 99, 1), ('growth', 'Growth', 500, 399, 2), ('pro', 'Pro', 1500, 999, 3)
on conflict (code) do nothing;

-- 4. Promo codes: bonus credits as a percentage of the pack ---------------------------------
create table if not exists public.ai_credit_promos (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,30}$'),
  bonus_pct integer not null check (bonus_pct between 1 and 500),
  starts_at date,
  ends_at date,
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

alter table public.ai_credit_purchase_requests drop constraint if exists ai_credit_purchase_requests_pack_check;
do $$ begin
  alter table public.ai_credit_purchase_requests add constraint ai_credit_purchase_requests_pack_check check (pack ~ '^[a-z][a-z0-9_]{1,30}$');
exception when duplicate_object then null; end $$;
alter table public.ai_credit_purchase_requests add column if not exists promo_code text check (promo_code is null or promo_code ~ '^[A-Z0-9_-]{3,30}$');
alter table public.ai_credit_purchase_requests add column if not exists bonus_credits integer not null default 0 check (bonus_credits >= 0);

-- 5. AI registry: which provider/model each feature uses, and model prices -----------------
create table if not exists public.ai_feature_routes (
  feature_key text primary key check (feature_key ~ '^[a-z_]{2,60}$'),
  primary_provider text not null check (primary_provider in ('gemini', 'groq', 'anthropic')),
  primary_model text check (primary_model is null or primary_model ~ '^[a-zA-Z0-9][a-zA-Z0-9._/:-]{1,99}$'),
  fallback_provider text check (fallback_provider is null or fallback_provider in ('gemini', 'groq', 'anthropic')),
  fallback_model text check (fallback_model is null or fallback_model ~ '^[a-zA-Z0-9][a-zA-Z0-9._/:-]{1,99}$'),
  enabled boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (fallback_provider is null or fallback_provider <> primary_provider or coalesce(fallback_model, '') <> coalesce(primary_model, ''))
);

create table if not exists public.ai_model_prices (
  provider text not null check (provider in ('gemini', 'groq', 'anthropic', 'sarvam')),
  model text not null check (model ~ '^[a-zA-Z0-9][a-zA-Z0-9._/:-]{1,99}$'),
  -- Blended ₹ per 1M tokens (ai_generations stores total tokens only).
  price_per_million numeric(10,2) not null check (price_per_million >= 0),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (provider, model)
);

-- RLS: platform settings staff write; signed-in sellers may read packs, costs and feature routes.
alter table public.ai_credit_settings enable row level security;
alter table public.ai_credit_action_costs enable row level security;
alter table public.ai_credit_packs enable row level security;
alter table public.ai_credit_promos enable row level security;
alter table public.ai_feature_routes enable row level security;
alter table public.ai_model_prices enable row level security;

drop policy if exists ai_credit_settings_read on public.ai_credit_settings;
create policy ai_credit_settings_read on public.ai_credit_settings for select to authenticated using (true);
drop policy if exists ai_credit_action_costs_read on public.ai_credit_action_costs;
create policy ai_credit_action_costs_read on public.ai_credit_action_costs for select to authenticated using (true);
drop policy if exists ai_credit_packs_read on public.ai_credit_packs;
create policy ai_credit_packs_read on public.ai_credit_packs for select to authenticated using (active or app.has_platform_permission('platform.settings.manage'));
drop policy if exists ai_credit_promos_read on public.ai_credit_promos;
create policy ai_credit_promos_read on public.ai_credit_promos for select to authenticated using (app.has_platform_permission('platform.settings.manage'));
drop policy if exists ai_feature_routes_read on public.ai_feature_routes;
-- Routes hold provider and model names only (no keys): runGeneration reads them with the signed-in
-- seller's own client, so every authenticated user may read them (no secret-key client needed).
create policy ai_feature_routes_read on public.ai_feature_routes for select to authenticated using (true);
drop policy if exists ai_model_prices_read on public.ai_model_prices;
create policy ai_model_prices_read on public.ai_model_prices for select to authenticated using (app.has_platform_permission('platform.settings.manage') or app.has_platform_permission('platform.finance.read'));

do $$
declare t text;
begin
  foreach t in array array['ai_credit_settings','ai_credit_action_costs','ai_credit_packs','ai_credit_promos','ai_feature_routes','ai_model_prices'] loop
    execute format('drop policy if exists %1$s_platform_write on public.%1$s', t);
    execute format('create policy %1$s_platform_write on public.%1$s for all to authenticated using (app.has_platform_permission(''platform.settings.manage'')) with check (app.has_platform_permission(''platform.settings.manage''))', t);
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s', t);
  end loop;
end $$;
create trigger trg_ai_credit_settings_updated_at before update on public.ai_credit_settings for each row execute function app.set_updated_at();
create trigger trg_ai_credit_action_costs_updated_at before update on public.ai_credit_action_costs for each row execute function app.set_updated_at();
create trigger trg_ai_credit_packs_updated_at before update on public.ai_credit_packs for each row execute function app.set_updated_at();
create trigger trg_ai_feature_routes_updated_at before update on public.ai_feature_routes for each row execute function app.set_updated_at();
create trigger trg_ai_model_prices_updated_at before update on public.ai_model_prices for each row execute function app.set_updated_at();

revoke all on public.ai_credit_settings, public.ai_credit_action_costs, public.ai_credit_packs, public.ai_credit_promos, public.ai_feature_routes, public.ai_model_prices from anon, authenticated;
grant select on public.ai_credit_settings, public.ai_credit_action_costs, public.ai_credit_packs, public.ai_credit_promos, public.ai_feature_routes, public.ai_model_prices to authenticated;
grant insert, update, delete on public.ai_credit_action_costs, public.ai_credit_packs, public.ai_credit_promos, public.ai_feature_routes, public.ai_model_prices to authenticated;
grant update on public.ai_credit_settings to authenticated;
grant all on public.ai_credit_settings, public.ai_credit_action_costs, public.ai_credit_packs, public.ai_credit_promos, public.ai_feature_routes, public.ai_model_prices to service_role;

-- 6. Credit RPCs now read the tables -------------------------------------------------------
create or replace function app.grant_signup_ai_credits()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_credits integer := coalesce((select welcome_credits from public.ai_credit_settings where id = 1), 100);
begin
  insert into public.ai_credit_accounts(tenant_id, balance) values (new.id, v_credits)
  on conflict (tenant_id) do nothing;
  if v_credits > 0 then
    insert into public.ai_credit_ledger(tenant_id, delta, balance_after, kind, note)
    values (new.id, v_credits, v_credits, 'signup_bonus', 'Welcome bonus')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.ai_credit_debit(p_tenant uuid, p_kind text, p_reference uuid default null)
returns table (ledger_id uuid, balance integer)
language plpgsql security definer set search_path = '' as $$
declare v_balance integer; v_id uuid; v_cost integer;
begin
  if not app.has_tenant_permission(p_tenant, 'marketing.write') then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if p_kind !~ '^[a-z_]{2,60}$' then raise exception 'invalid AI generation kind' using errcode = '22023'; end if;
  v_cost := coalesce((select credits from public.ai_credit_action_costs where kind = p_kind), 1);
  insert into public.ai_credit_accounts(tenant_id, balance) values (p_tenant, 0) on conflict (tenant_id) do nothing;
  select a.balance into v_balance from public.ai_credit_accounts a where a.tenant_id = p_tenant for update;
  if coalesce(v_balance, 0) < v_cost then
    raise exception 'AI credits exhausted' using errcode = 'P0001', hint = 'AI_CREDITS_EXHAUSTED';
  end if;
  v_balance := v_balance - v_cost;
  update public.ai_credit_accounts set balance = v_balance where tenant_id = p_tenant;
  insert into public.ai_credit_ledger(tenant_id, delta, balance_after, kind, reference_id, note, metadata, created_by)
  values (p_tenant, -v_cost, v_balance, 'usage', p_reference, p_kind, jsonb_build_object('kind', p_kind, 'credits', v_cost), auth.uid()) returning id into v_id;
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
  v_balance := coalesce(v_balance, 0) - v_usage.delta; -- delta is negative: refund the full cost
  update public.ai_credit_accounts set balance = v_balance where tenant_id = v_usage.tenant_id;
  insert into public.ai_credit_ledger(tenant_id, delta, balance_after, kind, reference_id, note, metadata, created_by)
  values (v_usage.tenant_id, -v_usage.delta, v_balance, 'usage_refund', p_ledger, left(coalesce(p_note, 'AI generation failed'), 500), jsonb_build_object('usageLedgerId', p_ledger), auth.uid());
  return v_balance;
end;
$$;

-- Pack or custom amount, with an optional promo code (bonus credits). One pending request per store.
drop function if exists public.request_ai_credit_purchase(uuid, text, text);
create or replace function public.request_ai_credit_purchase(p_tenant uuid, p_pack text, p_method text, p_promo text default null, p_amount numeric default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_credits integer; v_amount numeric(12,2); v_id uuid; v_bonus integer := 0;
  v_settings public.ai_credit_settings%rowtype; v_promo public.ai_credit_promos%rowtype; v_code text;
begin
  if not app.has_tenant_permission(p_tenant, 'billing.manage') then raise exception 'not permitted' using errcode = '42501'; end if;
  if p_method not in ('online', 'offline') then raise exception 'unknown payment method' using errcode = '22023'; end if;
  if p_pack = 'custom' then
    select * into v_settings from public.ai_credit_settings where id = 1;
    if p_amount is null or p_amount < v_settings.custom_min or p_amount > v_settings.custom_max then
      raise exception 'Custom amount must be between % and %', v_settings.custom_min, v_settings.custom_max using errcode = '22023', hint = 'AI_CREDIT_CUSTOM_RANGE';
    end if;
    v_amount := round(p_amount, 2);
    v_credits := floor(v_amount * v_settings.custom_credits_per_rupee)::int;
  else
    select credits, price into v_credits, v_amount from public.ai_credit_packs where code = p_pack and active;
    if not found then raise exception 'unknown pack' using errcode = '22023'; end if;
  end if;
  v_code := nullif(upper(trim(coalesce(p_promo, ''))), '');
  if v_code is not null then
    select * into v_promo from public.ai_credit_promos where code = v_code for update;
    if not found or not v_promo.active
       or (v_promo.starts_at is not null and v_promo.starts_at > (now() at time zone 'Asia/Kolkata')::date)
       or (v_promo.ends_at is not null and v_promo.ends_at < (now() at time zone 'Asia/Kolkata')::date)
       or (v_promo.max_uses is not null and v_promo.uses >= v_promo.max_uses) then
      raise exception 'This promo code is not valid.' using errcode = 'P0001', hint = 'AI_CREDIT_PROMO_INVALID';
    end if;
    v_bonus := floor(v_credits * v_promo.bonus_pct / 100.0)::int;
  end if;
  if exists (select 1 from public.ai_credit_purchase_requests where tenant_id = p_tenant and status = 'pending') then
    raise exception 'A credit purchase is already pending' using errcode = 'P0001', hint = 'AI_CREDIT_PURCHASE_PENDING';
  end if;
  insert into public.ai_credit_purchase_requests(tenant_id, pack, credits, amount, method, requested_by, promo_code, bonus_credits)
  values (p_tenant, p_pack, v_credits + v_bonus, v_amount, p_method, auth.uid(), v_code, v_bonus) returning id into v_id;
  if v_code is not null then update public.ai_credit_promos set uses = uses + 1 where id = v_promo.id; end if;
  return v_id;
end;
$$;

-- Economy insights (platform). Savings = minutes saved per action × freelancer hourly rate.
create or replace function public.platform_ai_credit_insights()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not app.has_platform_permission('platform.settings.manage') then raise exception 'not permitted' using errcode = '42501'; end if;
  select jsonb_build_object(
    'accounts', (select count(*) from public.ai_credit_accounts),
    'balance', (select coalesce(sum(balance), 0) from public.ai_credit_accounts),
    'granted', (select coalesce(sum(delta), 0) from public.ai_credit_ledger where kind in ('signup_bonus', 'manual_grant')),
    'purchased', (select coalesce(sum(delta), 0) from public.ai_credit_ledger where kind = 'purchase'),
    'used', (select coalesce(-sum(delta), 0) from public.ai_credit_ledger where kind = 'usage') - (select coalesce(sum(delta), 0) from public.ai_credit_ledger where kind = 'usage_refund'),
    'revenue', (select coalesce(sum(amount), 0) from public.ai_credit_purchase_requests where status = 'approved'),
    'lowBalance', (select count(*) from public.ai_credit_accounts a, public.ai_credit_settings s where s.id = 1 and a.balance <= s.low_balance and a.balance > s.critical_balance),
    'criticalBalance', (select count(*) from public.ai_credit_accounts a, public.ai_credit_settings s where s.id = 1 and a.balance <= s.critical_balance),
    'byKind', coalesce((select jsonb_agg(jsonb_build_object('kind', k.kind, 'uses', k.uses, 'credits', k.credits, 'minutesSaved', k.uses * coalesce(c.minutes_saved, 0)) order by k.credits desc)
               from (select l.metadata ->> 'kind' as kind, count(*) as uses, -sum(l.delta) as credits
                     from public.ai_credit_ledger l where l.kind = 'usage' group by 1) k
               left join public.ai_credit_action_costs c on c.kind = k.kind), '[]'::jsonb),
    'topStores', coalesce((select jsonb_agg(x) from (
               select jsonb_build_object('tenantId', l.tenant_id, 'name', t.name, 'credits', -sum(l.delta)) as x
               from public.ai_credit_ledger l join public.tenants t on t.id = l.tenant_id
               where l.kind = 'usage' group by l.tenant_id, t.name order by -sum(l.delta) desc limit 10) s), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

revoke all on function public.request_ai_credit_purchase(uuid, text, text, text, numeric), public.platform_ai_credit_insights() from public, anon;
grant execute on function public.request_ai_credit_purchase(uuid, text, text, text, numeric), public.platform_ai_credit_insights() to authenticated;

comment on table public.ai_credit_settings is 'Single-row AI credit pricing and thresholds (Admin → Credits economy).';
comment on table public.ai_feature_routes is 'Per AI feature: primary and fallback provider/model used by runGeneration.';
