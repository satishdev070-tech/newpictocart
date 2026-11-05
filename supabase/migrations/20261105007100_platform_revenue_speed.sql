-- =============================================================================
-- 7100 PLATFORM REVENUE SPEED: indexes for platform GMV/AI time scans + one
-- SECURITY DEFINER aggregate RPC for /admin/revenue (replaces full-table fetchAll
-- and dual lifetime scans of orders / ai_generations).
-- Permission gate matches platform_gmv_by_tenant (platform.finance.read).
-- =============================================================================

-- Platform GMV filters on placed_at (tenant-scoped indexes alone do not help).
create index if not exists orders_placed_at_idx on public.orders (placed_at);

-- Platform AI usage scans filter on created_at across all tenants.
create index if not exists ai_generations_created_at_idx on public.ai_generations (created_at);

/**
 * One round-trip for Revenue P&L aggregates.
 * - GMV 30d + lifetime: single orders scan with FILTER (no dual table walk).
 * - AI usage 30d + lifetime: single ai_generations scan with FILTER.
 * - Credit packs, tenant plan/status counts, theme adoption: SQL aggregates
 *   (no full-row pagination into the app).
 */
create or replace function public.platform_revenue_report(p_from timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_gmv_30 jsonb;
  v_gmv_all jsonb;
  v_ai_30 jsonb;
  v_ai_all jsonb;
  v_credits jsonb;
  v_tenants jsonb;
  v_themes jsonb;
begin
  if not app.has_platform_permission('platform.finance.read') then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  with gmv as (
    select o.tenant_id,
           coalesce(sum(app.order_commissionable_amount(
             o.payment_status, o.payment_method, o.fulfillment_status, o.grand_total, o.refunded_total
           )) filter (where p_from is null or o.placed_at >= p_from), 0)::numeric(14,2) as gmv_period,
           coalesce(sum(app.order_commissionable_amount(
             o.payment_status, o.payment_method, o.fulfillment_status, o.grand_total, o.refunded_total
           )), 0)::numeric(14,2) as gmv_lifetime
    from public.orders o
    group by o.tenant_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
                   'tenant_id', g.tenant_id,
                   'gmv', g.gmv_period,
                   'commission_bps', coalesce(p.commission_bps, 0))
                   order by g.tenant_id) filter (where g.gmv_period > 0), '[]'::jsonb),
         coalesce(jsonb_agg(jsonb_build_object(
                   'tenant_id', g.tenant_id,
                   'gmv', g.gmv_lifetime,
                   'commission_bps', coalesce(p.commission_bps, 0))
                   order by g.tenant_id) filter (where g.gmv_lifetime > 0), '[]'::jsonb)
    into v_gmv_30, v_gmv_all
  from gmv g
  join public.tenants t on t.id = g.tenant_id
  left join public.plans p on p.id = t.plan_id;
  v_gmv_30 := coalesce(v_gmv_30, '[]'::jsonb);
  v_gmv_all := coalesce(v_gmv_all, '[]'::jsonb);

  with usage as (
    select g.provider,
           coalesce(g.model, '') as model,
           count(*) filter (where p_from is null or g.created_at >= p_from)::int as calls_period,
           coalesce(sum(g.tokens) filter (where p_from is null or g.created_at >= p_from), 0)::bigint as tokens_period,
           count(*)::int as calls_lifetime,
           coalesce(sum(g.tokens), 0)::bigint as tokens_lifetime
    from public.ai_generations g
    group by g.provider, coalesce(g.model, '')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
                   'provider', u.provider, 'model', u.model, 'calls', u.calls_period, 'tokens', u.tokens_period)
                   order by u.provider, u.model) filter (where u.calls_period > 0), '[]'::jsonb),
         coalesce(jsonb_agg(jsonb_build_object(
                   'provider', u.provider, 'model', u.model, 'calls', u.calls_lifetime, 'tokens', u.tokens_lifetime)
                   order by u.provider, u.model), '[]'::jsonb)
    into v_ai_30, v_ai_all
  from usage u;
  v_ai_30 := coalesce(v_ai_30, '[]'::jsonb);
  v_ai_all := coalesce(v_ai_all, '[]'::jsonb);

  select jsonb_build_object(
           'lifetime', coalesce(sum(r.amount), 0)::numeric(14,2),
           'period', coalesce(sum(r.amount) filter (where p_from is null or r.decided_at >= p_from), 0)::numeric(14,2),
           'period_count', count(*) filter (where p_from is null or r.decided_at >= p_from)::int
         )
    into v_credits
  from public.ai_credit_purchase_requests r
  where r.status = 'approved';
  v_credits := coalesce(v_credits, jsonb_build_object('lifetime', 0, 'period', 0, 'period_count', 0));

  select coalesce(jsonb_agg(jsonb_build_object(
           'plan_id', t.plan_id, 'status', t.status, 'count', t.cnt) order by t.plan_id nulls last, t.status), '[]'::jsonb)
    into v_tenants
  from (
    select plan_id, status, count(*)::int as cnt
    from public.tenants
    group by plan_id, status
  ) t;
  v_tenants := coalesce(v_tenants, '[]'::jsonb);

  with published as (
    select tenant_id, theme_key, coalesce(nullif(trim(label), ''), theme_key) as label
    from public.theme_versions
    where status = 'published'
  ),
  stores as (
    select theme_key, count(distinct tenant_id)::int as stores
    from published
    group by theme_key
  ),
  labels as (
    select distinct on (theme_key) theme_key, label
    from (
      select theme_key, label, count(*)::int as n
      from published
      group by theme_key, label
    ) s
    order by theme_key, n desc, label
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'theme_key', s.theme_key, 'label', l.label, 'stores', s.stores)
           order by s.stores desc, l.label), '[]'::jsonb)
    into v_themes
  from stores s
  join labels l on l.theme_key = s.theme_key;
  v_themes := coalesce(v_themes, '[]'::jsonb);

  return jsonb_build_object(
    'gmv_period', v_gmv_30,
    'gmv_lifetime', v_gmv_all,
    'ai_period', v_ai_30,
    'ai_lifetime', v_ai_all,
    'credits', v_credits,
    'tenant_counts', v_tenants,
    'themes', v_themes
  );
end;
$$;

revoke all on function public.platform_revenue_report(timestamptz) from public, anon;
grant execute on function public.platform_revenue_report(timestamptz) to authenticated;

comment on function public.platform_revenue_report(timestamptz) is
  'Aggregated Revenue P&L inputs (GMV/AI windows, credit packs, tenant plan counts, theme adoption). platform.finance.read.';
