-- =============================================================================
-- 20261128000100 ADMIN → STORES v2: site type (Online Store / Informative Website) per store,
-- a site-type filter, the owner's phone, and phone search on digits.
-- Additive: a new function name, so the app falls back to platform_list_stores (1800)
-- until this runs. Requires 1800 (store_type / categories), 8000 (tenants.website_type)
-- and profiles.phone.
--
-- Down (manual):
--   drop function if exists public.platform_list_stores_v2(text, text, uuid, timestamptz, timestamptz, text, int, int, text, uuid, text);
-- =============================================================================

create or replace function public.platform_list_stores_v2(
  p_q text default null, p_status text default null, p_plan uuid default null,
  p_from timestamptz default null, p_to timestamptz default null,
  p_sort text default 'newest', p_limit int default 25, p_offset int default 0,
  p_type text default null, p_category uuid default null, p_site_type text default null
)
returns table (
  tenant_id uuid, name text, slug text, status text, plan_name text, created_at timestamptz,
  owner_email text, owner_phone text, primary_domain text, products bigint, orders bigint, customers bigint,
  revenue numeric, last_activity timestamptz, total_count bigint,
  store_type text, category_name text, website_type text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  -- Digits only ("+91 98765-43210" → "919876543210"); phone search needs at least 4 digits.
  v_digits text := nullif(regexp_replace(coalesce(p_q, ''), '[^0-9]', '', 'g'), '');
begin
  if not app.has_platform_permission('platform.tenants.read') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_site_type is not null and p_site_type not in ('ONLINE_STORE', 'INFORMATIVE') then
    raise exception 'unknown site type' using errcode = '22023';
  end if;
  if v_digits is not null and length(v_digits) < 4 then v_digits := null; end if;
  return query
  with base as (
    select t.id, t.name, t.slug, t.status, p.name as plan_name, t.created_at, t.store_type,
      coalesce(t.website_type, 'ONLINE_STORE') as website_type,
      (select sc.name from public.stores st join public.store_categories sc on sc.id = st.category_id where st.tenant_id = t.id) as category_name,
      (select st.category_id from public.stores st where st.tenant_id = t.id) as category_id,
      o.email as owner_email,
      o.phone as owner_phone,
      regexp_replace(coalesce(o.phone, ''), '[^0-9]', '', 'g') as phone_digits,
      (select d.hostname from public.domains d where d.tenant_id = t.id and d.is_primary limit 1) as primary_domain
    from public.tenants t
    left join public.plans p on p.id = t.plan_id
    left join lateral (
      select u.email::text as email, coalesce(pr.phone, u.phone::text) as phone
      from public.tenant_memberships m
      join auth.users u on u.id = m.user_id
      left join public.profiles pr on pr.id = u.id
      where m.tenant_id = t.id and m.role = 'owner'
      order by m.created_at
      limit 1
    ) o on true
    where (p_status is null or t.status = p_status)
      and (p_plan is null or t.plan_id = p_plan)
      and (p_from is null or t.created_at >= p_from)
      and (p_to is null or t.created_at < p_to)
      and (p_type is null or t.store_type = p_type)
      and (p_site_type is null or coalesce(t.website_type, 'ONLINE_STORE') = p_site_type)
  ), filtered as (
    select b.* from base b
    where (p_category is null or b.category_id = p_category)
      and (v_q is null
       or b.name ilike '%' || v_q || '%' or b.slug ilike '%' || v_q || '%'
       or b.owner_email ilike '%' || v_q || '%' or b.primary_domain ilike '%' || v_q || '%'
       or b.id::text = lower(v_q)
       or (v_digits is not null and (b.phone_digits like '%' || v_digits || '%' or right(b.phone_digits, 10) = right(v_digits, 10)))
       or exists (select 1 from public.domains d where d.tenant_id = b.id and d.hostname ilike '%' || v_q || '%'))
  ), stats as (
    select f.*,
      (select count(*) from public.products x where x.tenant_id = f.id) as products,
      (select count(*) from public.orders o2 where o2.tenant_id = f.id and o2.status <> 'pending') as orders,
      (select count(*) from public.customers c where c.tenant_id = f.id) as customers,
      coalesce((select sum(o2.grand_total) from public.orders o2 where o2.tenant_id = f.id and o2.status <> 'cancelled'
                 and o2.payment_status in ('paid', 'partially_refunded', 'cod_pending')), 0) as revenue,
      greatest(
        (select max(o2.placed_at) from public.orders o2 where o2.tenant_id = f.id),
        (select max(a.created_at) from public.audit_logs a where a.tenant_id = f.id),
        f.created_at
      ) as last_activity
    from filtered f
  )
  select s.id, s.name, s.slug, s.status, s.plan_name, s.created_at, s.owner_email, s.owner_phone, s.primary_domain,
         s.products, s.orders, s.customers, s.revenue, s.last_activity, count(*) over () as total_count,
         s.store_type, s.category_name, s.website_type
  from stats s
  order by
    case when p_sort = 'oldest' then s.created_at end asc,
    case when p_sort = 'revenue' then s.revenue end desc,
    case when p_sort = 'orders' then s.orders end desc,
    case when p_sort = 'products' then s.products end desc,
    case when p_sort = 'activity' then s.last_activity end desc,
    s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100)) offset greatest(0, coalesce(p_offset, 0));
end;
$$;

revoke all on function public.platform_list_stores_v2(text, text, uuid, timestamptz, timestamptz, text, int, int, text, uuid, text) from public, anon;
grant execute on function public.platform_list_stores_v2(text, text, uuid, timestamptz, timestamptz, text, int, int, text, uuid, text) to authenticated;
