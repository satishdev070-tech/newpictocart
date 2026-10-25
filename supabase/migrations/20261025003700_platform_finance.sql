-- =============================================================================
-- 3700 PLATFORM FINANCE: finance/partner permissions, per-plan GMV commission, commission
-- invoices, platform GMV + AI cost reads, and the all-accounts user directory.
-- Additive. Not applied by the application; the owner applies it (see docs/SUPER_ADMIN_PORT.md).
-- Money is numeric(12,2) here and integer paise in TypeScript (src/lib/money.ts).
-- =============================================================================

-- 1. New platform permission keys (mirrors src/lib/permissions/matrix.ts) -----------------
insert into public.platform_role_permissions (role, permission) values
  ('super_admin','platform.finance.read'),('super_admin','platform.finance.manage'),('super_admin','platform.partners.manage'),
  ('finance','platform.finance.read'),('finance','platform.finance.manage')
on conflict do nothing;

-- 2. GMV commission rate per plan, in basis points (1% = 100). Default 0: nothing is billed
--    until the owner sets a rate on Admin → Plans.
alter table public.plans add column if not exists commission_bps integer not null default 0;
do $$ begin
  alter table public.plans add constraint plans_commission_bps_check check (commission_bps between 0 and 10000);
exception when duplicate_object then null; end $$;

-- 3. Commissionable GMV: paid (or partially refunded) online orders and delivered COD orders,
--    net of refunds. One definition used by the revenue page and invoice generation.
create or replace function app.order_commissionable_amount(p_payment_status text, p_payment_method text, p_fulfillment text, p_grand numeric, p_refunded numeric)
returns numeric
language sql immutable set search_path = '' as $$
  select case
    when p_payment_status in ('paid', 'partially_refunded') then greatest(p_grand - coalesce(p_refunded, 0), 0)
    when p_payment_method = 'cod' and p_fulfillment = 'delivered' and p_payment_status not in ('refunded', 'failed', 'expired') then greatest(p_grand - coalesce(p_refunded, 0), 0)
    else 0
  end;
$$;

create or replace function public.platform_gmv_by_tenant(p_from timestamptz default null, p_to timestamptz default null)
returns table (tenant_id uuid, gmv numeric, orders integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.has_platform_permission('platform.finance.read') then raise exception 'not permitted' using errcode = '42501'; end if;
  return query
    select o.tenant_id,
           coalesce(sum(app.order_commissionable_amount(o.payment_status, o.payment_method, o.fulfillment_status, o.grand_total, o.refunded_total)), 0)::numeric(14,2),
           count(*) filter (where app.order_commissionable_amount(o.payment_status, o.payment_method, o.fulfillment_status, o.grand_total, o.refunded_total) > 0)::int
    from public.orders o
    where (p_from is null or o.placed_at >= p_from) and (p_to is null or o.placed_at < p_to)
    group by o.tenant_id;
end;
$$;

-- AI usage per provider+model (tokens and calls) for AI cost; prices live in migration 3900.
create or replace function public.platform_ai_usage(p_from timestamptz default null)
returns table (provider text, model text, calls integer, tokens bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.has_platform_permission('platform.finance.read') or app.has_platform_permission('platform.settings.manage')) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  return query
    select g.provider, coalesce(g.model, ''), count(*)::int, coalesce(sum(g.tokens), 0)::bigint
    from public.ai_generations g
    where p_from is null or g.created_at >= p_from
    group by g.provider, coalesce(g.model, '');
end;
$$;

-- 4. Commission invoices ---------------------------------------------------------------
create table if not exists public.commission_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  invoice_number text not null unique check (invoice_number ~ '^PC-[0-9]{6}-[0-9]{4,}$'),
  period_start date not null,
  period_end date not null check (period_end > period_start),
  gmv numeric(12,2) not null check (gmv >= 0),
  rate_bps integer not null check (rate_bps between 0 and 10000),
  commission numeric(12,2) not null check (commission >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'waived')),
  due_date date not null,
  paid_at timestamptz,
  paid_via text check (paid_via is null or paid_via in ('manual', 'razorpay', 'credits')),
  payment_reference text check (payment_reference is null or char_length(payment_reference) <= 160),
  waive_reason text check (waive_reason is null or char_length(waive_reason) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, period_start)
);
create index if not exists commission_invoices_period_idx on public.commission_invoices (period_start desc);
create index if not exists commission_invoices_status_idx on public.commission_invoices (status, due_date);
drop trigger if exists trg_commission_invoices_updated_at on public.commission_invoices;
create trigger trg_commission_invoices_updated_at before update on public.commission_invoices for each row execute function app.set_updated_at();

alter table public.commission_invoices enable row level security;
drop policy if exists commission_invoices_select on public.commission_invoices;
create policy commission_invoices_select on public.commission_invoices for select to authenticated using (
  app.has_platform_permission('platform.finance.read') or app.has_tenant_permission(tenant_id, 'billing.manage')
);
revoke all on public.commission_invoices from anon, authenticated;
grant select on public.commission_invoices to authenticated;
grant all on public.commission_invoices to service_role;

/**
 * Generates one invoice per store for the calendar month starting p_period_start, using the
 * store's current plan rate. Idempotent: a store that already has an invoice for the month is
 * skipped. Rounding matches calc.ts applyBps (half up to the paisa).
 */
create or replace function public.platform_generate_commission_invoices(p_period_start date)
returns table (created integer, total_commission numeric)
language plpgsql security definer set search_path = '' as $$
declare
  v_end date;
  v_seq integer;
  v_created integer := 0;
  v_total numeric(14,2) := 0;
  r record;
  v_commission numeric(12,2);
begin
  if not app.has_platform_permission('platform.finance.manage') then raise exception 'not permitted' using errcode = '42501'; end if;
  if p_period_start is null or p_period_start <> date_trunc('month', p_period_start)::date then
    raise exception 'period must start on the first of a month' using errcode = '22023';
  end if;
  v_end := (p_period_start + interval '1 month')::date;
  if v_end > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'the month has not ended yet' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('commission_invoices:' || p_period_start::text));
  select count(*) into v_seq from public.commission_invoices where period_start = p_period_start;
  for r in
    select t.id as tenant_id, p.commission_bps as rate_bps,
           round(sum(app.order_commissionable_amount(o.payment_status, o.payment_method, o.fulfillment_status, o.grand_total, o.refunded_total)) * 100)::bigint as gmv_paise
    from public.tenants t
    join public.plans p on p.id = t.plan_id
    join public.orders o on o.tenant_id = t.id
    where p.commission_bps > 0
      and o.placed_at >= (p_period_start::timestamp at time zone 'Asia/Kolkata')
      and o.placed_at < (v_end::timestamp at time zone 'Asia/Kolkata')
      and not exists (select 1 from public.commission_invoices ci where ci.tenant_id = t.id and ci.period_start = p_period_start)
    group by t.id, p.commission_bps
    order by t.id
  loop
    continue when r.gmv_paise <= 0;
    v_commission := ((r.gmv_paise * r.rate_bps + 5000) / 10000)::numeric / 100;
    continue when v_commission <= 0;
    v_seq := v_seq + 1;
    insert into public.commission_invoices (tenant_id, invoice_number, period_start, period_end, gmv, rate_bps, commission, due_date, created_by)
    values (r.tenant_id, 'PC-' || to_char(p_period_start, 'YYYYMM') || '-' || lpad(v_seq::text, 4, '0'), p_period_start, v_end,
            r.gmv_paise::numeric / 100, r.rate_bps, v_commission, v_end + 15, auth.uid());
    v_created := v_created + 1;
    v_total := v_total + v_commission;
  end loop;
  insert into public.audit_logs (tenant_id, actor_user_id, actor_type, action, entity_type, entity_id, metadata)
  values (null, auth.uid(), 'platform', 'commission.invoices_generated', 'commission_period', p_period_start::text, jsonb_build_object('created', v_created, 'total', v_total));
  return query select v_created, v_total;
end;
$$;

create or replace function public.platform_set_commission_invoice_status(p_invoice uuid, p_status text, p_note text default null, p_reference text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare v public.commission_invoices%rowtype;
begin
  if not app.has_platform_permission('platform.finance.manage') then raise exception 'not permitted' using errcode = '42501'; end if;
  if p_status not in ('paid', 'waived') then raise exception 'unknown status' using errcode = '22023'; end if;
  select * into v from public.commission_invoices where id = p_invoice for update;
  if not found then raise exception 'invoice not found' using errcode = 'P0002'; end if;
  if v.status <> 'pending' then raise exception 'invoice already settled' using errcode = 'P0001'; end if;
  if p_status = 'waived' and char_length(trim(coalesce(p_note, ''))) < 3 then raise exception 'a reason is required' using errcode = '22023'; end if;
  update public.commission_invoices
     set status = p_status,
         paid_at = case when p_status = 'paid' then now() end,
         paid_via = case when p_status = 'paid' then 'manual' end,
         payment_reference = case when p_status = 'paid' then left(nullif(trim(coalesce(p_reference, '')), ''), 160) end,
         waive_reason = case when p_status = 'waived' then left(trim(p_note), 500) end
   where id = p_invoice;
  insert into public.audit_logs (tenant_id, actor_user_id, actor_type, action, entity_type, entity_id, metadata)
  values (v.tenant_id, auth.uid(), 'platform', 'commission.invoice_' || p_status, 'commission_invoice', v.invoice_number, jsonb_build_object('commission', v.commission, 'note', left(coalesce(p_note, ''), 500)));
end;
$$;

-- 5. All-accounts user directory -------------------------------------------------------
-- Types: platform (staff), seller (store membership), customer (shopper account), account (none yet).
create or replace function public.platform_user_directory(
  p_search text default null, p_type text default null, p_tenant uuid default null, p_limit integer default 50, p_offset integer default 0
)
returns table (
  user_id uuid, email text, phone text, display_name text, created_at timestamptz, last_sign_in_at timestamptz,
  email_confirmed boolean, platform_role text, stores jsonb, customer_stores integer, user_types text[], total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
declare v_q text := nullif(lower(trim(coalesce(p_search, ''))), '');
begin
  if not app.has_platform_permission('platform.users.manage') then raise exception 'not permitted' using errcode = '42501'; end if;
  if p_type is not null and p_type not in ('platform', 'seller', 'customer', 'account') then raise exception 'unknown type' using errcode = '22023'; end if;
  return query
  with base as (
    select u.id, u.email::text as email, coalesce(pr.phone, u.phone::text) as phone, pr.display_name, u.created_at, u.last_sign_in_at,
           u.email_confirmed_at is not null as confirmed, pm.role as prole,
           coalesce((
             select jsonb_agg(jsonb_build_object('tenantId', t.id, 'name', t.name, 'slug', t.slug, 'role', m.role, 'status', m.status,
                     'theme', (select tv.label from public.theme_versions tv where tv.tenant_id = t.id and tv.status = 'published' limit 1)) order by m.created_at)
             from public.tenant_memberships m join public.tenants t on t.id = m.tenant_id
             where m.user_id = u.id
           ), '[]'::jsonb) as stores,
           (select count(*)::int from public.customers c where c.auth_user_id = u.id) as cust
    from auth.users u
    left join public.profiles pr on pr.id = u.id
    left join public.platform_memberships pm on pm.user_id = u.id and pm.status = 'active'
  ), typed as (
    select b.*, array_remove(array[
             case when b.prole is not null then 'platform' end,
             case when jsonb_array_length(b.stores) > 0 then 'seller' end,
             case when b.cust > 0 then 'customer' end
           ], null) as types
    from base b
  ), filtered as (
    select * from typed t
    where (v_q is null
           or lower(coalesce(t.email, '')) like '%' || v_q || '%'
           or lower(coalesce(t.display_name, '')) like '%' || v_q || '%'
           or coalesce(t.phone, '') like '%' || v_q || '%'
           or t.id::text = v_q
           or exists (select 1 from jsonb_array_elements(t.stores) s
                      where lower(s ->> 'name') like '%' || v_q || '%' or lower(s ->> 'slug') like '%' || v_q || '%' or lower(coalesce(s ->> 'theme', '')) like '%' || v_q || '%'))
      and (p_type is null or (p_type = 'account' and cardinality(t.types) = 0) or p_type = any(t.types))
      and (p_tenant is null or exists (select 1 from jsonb_array_elements(t.stores) s where (s ->> 'tenantId')::uuid = p_tenant)
           or exists (select 1 from public.customers c where c.auth_user_id = t.id and c.tenant_id = p_tenant))
  )
  select f.id, f.email, f.phone, f.display_name, f.created_at, f.last_sign_in_at, f.confirmed, f.prole, f.stores, f.cust, f.types,
         count(*) over ()
  from filtered f
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.platform_user_stats()
returns table (total bigint, platform bigint, sellers bigint, customers bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.has_platform_permission('platform.users.manage') then raise exception 'not permitted' using errcode = '42501'; end if;
  return query select
    (select count(*) from auth.users),
    (select count(*) from public.platform_memberships where status = 'active'),
    (select count(distinct user_id) from public.tenant_memberships),
    (select count(distinct auth_user_id) from public.customers where auth_user_id is not null);
end;
$$;

-- One account: auth facts, stores, shopper records, sign-ins (when Supabase's auth audit table
-- exists) and the platform audit trail where the user is the actor or the subject.
create or replace function public.platform_user_detail(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb; v_signins jsonb := '[]'::jsonb;
begin
  if not app.has_platform_permission('platform.users.manage') then raise exception 'not permitted' using errcode = '42501'; end if;
  select jsonb_build_object(
    'userId', u.id, 'email', u.email, 'phone', coalesce(pr.phone, u.phone::text), 'displayName', pr.display_name,
    'profileStatus', pr.status, 'createdAt', u.created_at, 'lastSignInAt', u.last_sign_in_at,
    'emailConfirmedAt', u.email_confirmed_at, 'bannedUntil', u.banned_until,
    'providers', coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb),
    'platform', (select jsonb_build_object('role', pm.role, 'status', pm.status, 'since', pm.created_at) from public.platform_memberships pm where pm.user_id = u.id),
    'stores', coalesce((select jsonb_agg(jsonb_build_object('tenantId', t.id, 'name', t.name, 'slug', t.slug, 'role', m.role, 'status', m.status,
                 'tenantStatus', t.status, 'plan', p.name, 'since', m.created_at,
                 'theme', (select tv.label from public.theme_versions tv where tv.tenant_id = t.id and tv.status = 'published' limit 1)) order by m.created_at)
               from public.tenant_memberships m join public.tenants t on t.id = m.tenant_id left join public.plans p on p.id = t.plan_id
               where m.user_id = u.id), '[]'::jsonb),
    'customerOf', coalesce((select jsonb_agg(jsonb_build_object('tenantId', t.id, 'name', t.name, 'slug', t.slug, 'orders', c.orders_count,
                 'spent', c.total_spent, 'lastOrderAt', c.last_order_at, 'status', c.status) order by c.created_at)
               from public.customers c join public.tenants t on t.id = c.tenant_id where c.auth_user_id = u.id), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(a order by (a ->> 'createdAt') desc) from (
               select jsonb_build_object('id', l.id, 'createdAt', l.created_at, 'action', l.action, 'actorType', l.actor_type,
                      'tenantId', l.tenant_id, 'entityType', l.entity_type, 'entityId', l.entity_id,
                      'asActor', l.actor_user_id = u.id) as a
               from public.audit_logs l
               where l.actor_user_id = u.id or l.entity_id = u.id::text
               order by l.created_at desc limit 50) x), '[]'::jsonb)
  ) into v
  from auth.users u left join public.profiles pr on pr.id = u.id
  where u.id = p_user;
  if v is null then return null; end if;
  if to_regclass('auth.audit_log_entries') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('at', e.created_at, 'action', e.payload ->> 'action', 'ip', e.ip_address) order by e.created_at desc), '[]'::jsonb)
      from (select * from auth.audit_log_entries
            where payload ->> 'actor_id' = $1::text and payload ->> 'action' in ('login', 'logout', 'token_refreshed', 'user_signedup', 'user_recovery_requested')
            order by created_at desc limit 20) e
    $q$ into v_signins using p_user;
  end if;
  return v || jsonb_build_object('signIns', v_signins);
end;
$$;

revoke all on function public.platform_gmv_by_tenant(timestamptz, timestamptz), public.platform_ai_usage(timestamptz),
  public.platform_generate_commission_invoices(date), public.platform_set_commission_invoice_status(uuid, text, text, text),
  public.platform_user_directory(text, text, uuid, integer, integer), public.platform_user_stats(), public.platform_user_detail(uuid) from public, anon;
grant execute on function public.platform_gmv_by_tenant(timestamptz, timestamptz), public.platform_ai_usage(timestamptz),
  public.platform_generate_commission_invoices(date), public.platform_set_commission_invoice_status(uuid, text, text, text),
  public.platform_user_directory(text, text, uuid, integer, integer), public.platform_user_stats(), public.platform_user_detail(uuid) to authenticated;

comment on table public.commission_invoices is 'Monthly GMV commission invoices per store (plans.commission_bps). Written only by platform_* functions.';
