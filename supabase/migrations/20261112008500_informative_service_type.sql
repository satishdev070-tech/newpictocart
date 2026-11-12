-- Informative Website M9: service types and a ready-made site at onboarding.
--
-- 1. info_sites.service_type: the specific service the seller picked ("Dentist", "Plumber") or typed
--    ("Yoga retreat"). Free text, ≤ 60 chars. `category` stays the theme family (check constraint
--    unchanged), so existing rows and code keep working; null = not chosen (sites before M9).
-- 2. complete_informative_onboarding: same signature; p_site may now also carry `service_type`,
--    `about` and `faqs` ([{question, answer}], ≤ 10). Everything else is unchanged, including
--    idempotency and the owner/auth checks.
--
-- Down:
--   re-run the function from 20261111008200_informative_onboarding.sql;
--   alter table public.info_sites drop column if exists service_type;

alter table public.info_sites
  add column service_type text check (service_type is null or char_length(service_type) between 1 and 60);

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
  v_faq jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_site) is distinct from 'object' or jsonb_typeof(p_pages) is distinct from 'array' or jsonb_typeof(p_services) is distinct from 'array' then
    raise exception 'invalid payload' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_site -> 'faqs', '[]'::jsonb)) is distinct from 'array' then
    raise exception 'invalid payload' using errcode = '22023';
  end if;
  if jsonb_array_length(p_pages) > 10 or jsonb_array_length(p_services) > 6 or jsonb_array_length(coalesce(p_site -> 'faqs', '[]'::jsonb)) > 10
     or pg_column_size(p_pages) > 200000 then
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

  insert into public.info_sites (tenant_id, theme_id, business_name, tagline, category, service_type, about, contact, status)
  values (
    v_tenant,
    coalesce(nullif(p_site ->> 'theme_id', ''), 'nexus-core'),
    trim(p_name),
    nullif(trim(coalesce(p_site ->> 'tagline', '')), ''),
    coalesce(nullif(p_site ->> 'category', ''), 'other'),
    nullif(left(trim(coalesce(p_site ->> 'service_type', '')), 60), ''),
    nullif(trim(coalesce(p_site ->> 'about', '')), ''),
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

  v_i := 0;
  for v_faq in select * from jsonb_array_elements(coalesce(p_site -> 'faqs', '[]'::jsonb)) loop
    insert into public.info_faqs (tenant_id, question, answer, sort_order)
    values (v_tenant, v_faq ->> 'question', v_faq ->> 'answer', v_i);
    v_i := v_i + 1;
  end loop;

  perform app.audit(v_tenant, 'informative.onboarding_completed', 'tenant', v_tenant::text,
    jsonb_build_object('theme', p_site ->> 'theme_id', 'service_type', p_site ->> 'service_type', 'pages', jsonb_array_length(p_pages), 'services', jsonb_array_length(p_services),
      'faqs', jsonb_array_length(coalesce(p_site -> 'faqs', '[]'::jsonb))));
  return v_tenant;
end;
$$;

revoke all on function public.complete_informative_onboarding(text, text, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.complete_informative_onboarding(text, text, text, jsonb, jsonb, jsonb) to authenticated;
