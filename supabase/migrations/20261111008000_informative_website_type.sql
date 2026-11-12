-- INFORMATIVE: branch point — see docs/informative/PLAN.md (M1 foundation)
--
-- Website type discriminator. Every tenant is an Online Store unless it was created as an
-- Informative Website. Additive: the column has a safe default, so every existing row is
-- backfilled to 'ONLINE_STORE' by the ALTER itself, and nothing else changes shape.
--
-- The type is fixed at creation (plan non-goal: no switching). A trigger rejects changes.
--
-- create_tenant gains an optional 4th parameter, p_website_type (default 'ONLINE_STORE').
-- The body is the same as 20261023003600_free_plan.sql except that it writes website_type and,
-- for INFORMATIVE, skips the store-only default inventory location. The 3-argument signature is
-- dropped and replaced (not overloaded): PostgREST cannot choose between two overloads that both
-- match three named arguments. Existing callers pass three arguments and behave exactly as before.
--
-- DOWN (manual, in order):
--   1. drop function if exists public.create_tenant(text, text, text, text);
--   2. re-run the create_tenant definition, revoke and grant from 20261023003600_free_plan.sql
--      (3-argument signature);
--   3. drop trigger if exists trg_tenants_website_type_frozen on public.tenants;
--      drop function if exists app.freeze_website_type();
--   4. alter table public.tenants drop column if exists website_type;
--   Informative content tables (M2+) must be dropped first if they exist.

alter table public.tenants
  add column if not exists website_type text not null default 'ONLINE_STORE';

alter table public.tenants
  drop constraint if exists tenants_website_type_check;

alter table public.tenants
  add constraint tenants_website_type_check
  check (website_type in ('ONLINE_STORE', 'INFORMATIVE'));

comment on column public.tenants.website_type is
  'ONLINE_STORE (default) or INFORMATIVE. Fixed at creation; see docs/informative/PLAN.md.';

create or replace function app.freeze_website_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.website_type is distinct from old.website_type then
    raise exception 'website type cannot be changed' using errcode = '22023', hint = 'WEBSITE_TYPE_FIXED';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tenants_website_type_frozen on public.tenants;
create trigger trg_tenants_website_type_frozen
  before update of website_type on public.tenants
  for each row execute function app.freeze_website_type();

drop function if exists public.create_tenant(text, text, text);

create or replace function public.create_tenant(
  p_name text,
  p_slug text,
  p_root_domain text,
  p_website_type text default 'ONLINE_STORE'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_tenant uuid;
  v_plan uuid;
  v_trial int;
  v_owned int;
  v_status text;
  v_ends timestamptz;
  v_type text := coalesce(p_website_type, 'ONLINE_STORE');
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_root_domain !~ '^[a-z0-9.-]+$' then
    raise exception 'invalid root domain' using errcode = '22023';
  end if;
  if v_type not in ('ONLINE_STORE', 'INFORMATIVE') then
    raise exception 'invalid website type' using errcode = '22023';
  end if;
  select count(*) into v_owned from public.tenant_memberships where user_id = v_user and role = 'owner';
  if v_owned >= 5 then
    raise exception 'store limit reached for this account' using errcode = '54000';
  end if;

  select id, trial_days into v_plan, v_trial from public.plans where active order by sort_order, price_monthly limit 1;
  if coalesce(v_trial, 0) > 0 then
    v_status := 'trial';
    v_ends := now() + make_interval(days => v_trial);
  else
    v_status := 'active';
    v_ends := null;
  end if;

  insert into public.tenants (name, slug, status, plan_id, trial_ends_at, created_by, website_type)
  values (trim(p_name), lower(trim(p_slug)), v_status, v_plan, v_ends, v_user, v_type)
  returning id into v_tenant;

  insert into public.stores (tenant_id, name) values (v_tenant, trim(p_name));
  insert into public.domains (tenant_id, hostname, type, status, verified_at, ssl_status, is_primary)
  values (v_tenant, lower(trim(p_slug)) || '.' || p_root_domain, 'platform_subdomain', 'verified', now(), 'not_applicable', true);
  insert into public.tenant_memberships (tenant_id, user_id, role) values (v_tenant, v_user, 'owner');
  -- Store-only seed: an Informative Website has no inventory.
  if v_type = 'ONLINE_STORE' then
    insert into public.inventory_locations (tenant_id, name, is_default) values (v_tenant, 'Main warehouse', true);
  end if;

  perform app.audit(v_tenant, 'tenant.created', 'tenant', v_tenant::text, jsonb_build_object('slug', lower(trim(p_slug))));
  return v_tenant;
end;
$$;

revoke all on function public.create_tenant(text, text, text, text) from public, anon;
grant execute on function public.create_tenant(text, text, text, text) to authenticated;
