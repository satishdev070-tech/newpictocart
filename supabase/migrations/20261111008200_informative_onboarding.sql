-- Informative Website M4 onboarding (docs/informative/PLAN.md). Additive: two new functions.
--
-- 1. store_slug_available(slug): the live address check used by onboarding Step 1 (Q10). It only
--    reveals whether a slug is taken, which is already public (taken subdomains resolve). Format and
--    reserved-word checks happen in TypeScript (isValidStoreSlug) and in the tenants.slug constraint.
--
-- 2. complete_informative_onboarding(...): one transaction that creates the Informative Website:
--      tenant (type INFORMATIVE) via the existing create_tenant (no copy of store logic; it creates
--      the stores profile, platform subdomain and owner membership, and skips the store-only
--      inventory location for INFORMATIVE), then site_mode = 'informative' + launch_status = 'draft'
--      on the profile (so every existing commerce guard applies), info_sites (DRAFT),
--      info_site_private (notification email), the default pages and the starter/sample services.
--    It creates no store-only records (no inventory, shipping, payment, COD, products, categories).
--    Idempotent: when the caller already owns an INFORMATIVE tenant with that slug it returns it and
--    writes nothing. Any error rolls back everything.
--    It is callable by any signed-in user through PostgREST, so it trusts nothing but the session:
--    it writes only into the caller's brand-new tenant, caps array sizes, and table constraints
--    validate every field.
--
-- DOWN (manual): drop function if exists public.complete_informative_onboarding(text, text, text, jsonb, jsonb, jsonb);
--                drop function if exists public.store_slug_available(text);

create or replace function public.store_slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.tenants where slug = lower(trim(coalesce(p_slug, ''))));
$$;

revoke all on function public.store_slug_available(text) from public;
grant execute on function public.store_slug_available(text) to anon, authenticated, service_role;

create or replace function public.complete_informative_onboarding(
  p_name text,
  p_slug text,
  p_root_domain text,
  p_site jsonb,
  p_pages jsonb,
  p_services jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_tenant uuid;
  v_page jsonb;
  v_svc jsonb;
  v_i int;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_site) is distinct from 'object' or jsonb_typeof(p_pages) is distinct from 'array' or jsonb_typeof(p_services) is distinct from 'array' then
    raise exception 'invalid payload' using errcode = '22023';
  end if;
  if jsonb_array_length(p_pages) > 10 or jsonb_array_length(p_services) > 6 or pg_column_size(p_pages) > 200000 then
    raise exception 'payload too large' using errcode = '22023';
  end if;

  -- Idempotent: a double submit (or a retry after a lost response) returns the same site.
  select t.id into v_tenant
  from public.tenants t
  join public.tenant_memberships m on m.tenant_id = t.id and m.user_id = v_user and m.role = 'owner'
  where t.slug = v_slug and t.website_type = 'INFORMATIVE';
  if v_tenant is not null then
    return v_tenant;
  end if;

  v_tenant := public.create_tenant(p_name, v_slug, p_root_domain, 'INFORMATIVE');

  update public.stores set site_mode = 'informative', launch_status = 'draft' where tenant_id = v_tenant;

  insert into public.info_sites (tenant_id, theme_id, business_name, tagline, category, contact, status)
  values (
    v_tenant,
    coalesce(nullif(p_site ->> 'theme_id', ''), 'nexus-core'),
    trim(p_name),
    nullif(trim(coalesce(p_site ->> 'tagline', '')), ''),
    coalesce(nullif(p_site ->> 'category', ''), 'other'),
    coalesce(p_site -> 'contact', '{}'::jsonb),
    'DRAFT'
  );

  insert into public.info_site_private (tenant_id, notify_email)
  values (v_tenant, nullif(trim(coalesce(p_site -> 'contact' ->> 'email', '')), ''));

  v_i := 0;
  for v_page in select * from jsonb_array_elements(p_pages) loop
    insert into public.info_pages (tenant_id, type, title, slug, sections, sort_order)
    values (v_tenant, v_page ->> 'type', v_page ->> 'title', v_page ->> 'slug', coalesce(v_page -> 'sections', '[]'::jsonb), v_i);
    v_i := v_i + 1;
  end loop;

  v_i := 0;
  for v_svc in select * from jsonb_array_elements(p_services) loop
    insert into public.info_services (tenant_id, name, slug, short_description, price_type, price, duration_minutes, category, is_sample, sort_order)
    values (
      v_tenant,
      v_svc ->> 'name',
      v_svc ->> 'slug',
      nullif(v_svc ->> 'short_description', ''),
      coalesce(nullif(v_svc ->> 'price_type', ''), 'ON_REQUEST'),
      (v_svc ->> 'price')::numeric(12,2),
      (v_svc ->> 'duration_minutes')::int,
      nullif(v_svc ->> 'category', ''),
      coalesce((v_svc ->> 'is_sample')::boolean, false),
      v_i
    );
    v_i := v_i + 1;
  end loop;

  perform app.audit(v_tenant, 'informative.onboarding_completed', 'tenant', v_tenant::text,
    jsonb_build_object('theme', p_site ->> 'theme_id', 'pages', jsonb_array_length(p_pages), 'services', jsonb_array_length(p_services)));
  return v_tenant;
end;
$$;

revoke all on function public.complete_informative_onboarding(text, text, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.complete_informative_onboarding(text, text, text, jsonb, jsonb, jsonb) to authenticated;
