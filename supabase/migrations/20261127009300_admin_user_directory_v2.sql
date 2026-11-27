-- =============================================================================
-- 9300 ADMIN → USERS v2: phone search on digits, site type per store, site-type filter,
-- and "WhatsApp verified" per user.
-- Additive: a new function name, so the app falls back to platform_user_directory (3700)
-- until this runs. Requires 3700 (platform_finance), 8000 (tenants.website_type),
-- 9200 (profiles.phone_verified_at).
--
-- Down (manual):
--   drop function if exists public.platform_user_directory_v2(text, text, uuid, text, integer, integer);
-- =============================================================================

create or replace function public.platform_user_directory_v2(
  p_search text default null, p_type text default null, p_tenant uuid default null, p_site_type text default null,
  p_limit integer default 50, p_offset integer default 0
)
returns table (
  user_id uuid, email text, phone text, phone_verified boolean, display_name text, created_at timestamptz, last_sign_in_at timestamptz,
  email_confirmed boolean, platform_role text, stores jsonb, customer_stores integer, user_types text[], site_types text[], total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := nullif(lower(trim(coalesce(p_search, ''))), '');
  -- Digits only ("+91 98765-43210" → "919876543210"); phone search needs at least 4 digits.
  v_digits text := nullif(regexp_replace(coalesce(p_search, ''), '[^0-9]', '', 'g'), '');
begin
  if not app.has_platform_permission('platform.users.manage') then raise exception 'not permitted' using errcode = '42501'; end if;
  if p_type is not null and p_type not in ('platform', 'seller', 'customer', 'account') then raise exception 'unknown type' using errcode = '22023'; end if;
  if p_site_type is not null and p_site_type not in ('ONLINE_STORE', 'INFORMATIVE') then raise exception 'unknown site type' using errcode = '22023'; end if;
  if v_digits is not null and length(v_digits) < 4 then v_digits := null; end if;
  return query
  with base as (
    select u.id, u.email::text as email, coalesce(pr.phone, u.phone::text) as phone, pr.phone_verified_at is not null as phone_ok,
           pr.display_name, u.created_at, u.last_sign_in_at,
           u.email_confirmed_at is not null as confirmed, pm.role as prole,
           coalesce((
             select jsonb_agg(jsonb_build_object('tenantId', t.id, 'name', t.name, 'slug', t.slug, 'role', m.role, 'status', m.status,
                     'websiteType', coalesce(t.website_type, 'ONLINE_STORE'),
                     'theme', (select tv.label from public.theme_versions tv where tv.tenant_id = t.id and tv.status = 'published' limit 1)) order by m.created_at)
             from public.tenant_memberships m join public.tenants t on t.id = m.tenant_id
             where m.user_id = u.id
           ), '[]'::jsonb) as stores,
           (select count(*)::int from public.customers c where c.auth_user_id = u.id) as cust
    from auth.users u
    left join public.profiles pr on pr.id = u.id
    left join public.platform_memberships pm on pm.user_id = u.id and pm.status = 'active'
  ), typed as (
    select b.*,
           array_remove(array[
             case when b.prole is not null then 'platform' end,
             case when jsonb_array_length(b.stores) > 0 then 'seller' end,
             case when b.cust > 0 then 'customer' end
           ], null) as types,
           coalesce((select array_agg(distinct s ->> 'websiteType' order by s ->> 'websiteType') from jsonb_array_elements(b.stores) s), '{}'::text[]) as sites,
           regexp_replace(coalesce(b.phone, ''), '[^0-9]', '', 'g') as phone_digits
    from base b
  ), filtered as (
    select * from typed t
    where (v_q is null
           or lower(coalesce(t.email, '')) like '%' || v_q || '%'
           or lower(coalesce(t.display_name, '')) like '%' || v_q || '%'
           or coalesce(t.phone, '') like '%' || v_q || '%'
           or (v_digits is not null and (t.phone_digits like '%' || v_digits || '%' or right(t.phone_digits, 10) = right(v_digits, 10)))
           or t.id::text = v_q
           or exists (select 1 from jsonb_array_elements(t.stores) s
                      where lower(s ->> 'name') like '%' || v_q || '%' or lower(s ->> 'slug') like '%' || v_q || '%' or lower(coalesce(s ->> 'theme', '')) like '%' || v_q || '%'))
      and (p_type is null or (p_type = 'account' and cardinality(t.types) = 0) or p_type = any(t.types))
      and (p_site_type is null or p_site_type = any(t.sites))
      and (p_tenant is null or exists (select 1 from jsonb_array_elements(t.stores) s where (s ->> 'tenantId')::uuid = p_tenant)
           or exists (select 1 from public.customers c where c.auth_user_id = t.id and c.tenant_id = p_tenant))
  )
  select f.id, f.email, f.phone, f.phone_ok, f.display_name, f.created_at, f.last_sign_in_at, f.confirmed, f.prole, f.stores, f.cust, f.types, f.sites,
         count(*) over ()
  from filtered f
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.platform_user_directory_v2(text, text, uuid, text, integer, integer) from public, anon;
grant execute on function public.platform_user_directory_v2(text, text, uuid, text, integer, integer) to authenticated;
