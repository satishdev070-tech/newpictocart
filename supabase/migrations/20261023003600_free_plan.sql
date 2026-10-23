-- =============================================================================
-- Free forever entry plan (10 products, no trial) + create_tenant respects
-- trial_days = 0 → status active, trial_ends_at null.
-- =============================================================================

insert into public.plans (code, name, description, price_monthly, price_yearly, limits, features, trial_days, sort_order, active)
values (
  'free',
  'Free',
  'Free forever for getting started — up to 10 products',
  0,
  0,
  '{"products": 10, "staff": 1, "storage_mb": 512, "custom_domains": 0}'::jsonb,
  '{"custom_domains": false, "blog": true}'::jsonb,
  0,
  0,
  true
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly,
  limits = excluded.limits,
  features = excluded.features,
  trial_days = excluded.trial_days,
  sort_order = excluded.sort_order,
  active = excluded.active;

-- Self-serve store create: free (trial_days 0) opens as active with no trial end.
create or replace function public.create_tenant(p_name text, p_slug text, p_root_domain text)
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
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_root_domain !~ '^[a-z0-9.-]+$' then
    raise exception 'invalid root domain' using errcode = '22023';
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

  insert into public.tenants (name, slug, status, plan_id, trial_ends_at, created_by)
  values (trim(p_name), lower(trim(p_slug)), v_status, v_plan, v_ends, v_user)
  returning id into v_tenant;

  insert into public.stores (tenant_id, name) values (v_tenant, trim(p_name));
  insert into public.domains (tenant_id, hostname, type, status, verified_at, ssl_status, is_primary)
  values (v_tenant, lower(trim(p_slug)) || '.' || p_root_domain, 'platform_subdomain', 'verified', now(), 'not_applicable', true);
  insert into public.tenant_memberships (tenant_id, user_id, role) values (v_tenant, v_user, 'owner');
  insert into public.inventory_locations (tenant_id, name, is_default) values (v_tenant, 'Main warehouse', true);

  perform app.audit(v_tenant, 'tenant.created', 'tenant', v_tenant::text, jsonb_build_object('slug', lower(trim(p_slug))));
  return v_tenant;
end;
$$;

revoke all on function public.create_tenant(text, text, text) from public, anon;
grant execute on function public.create_tenant(text, text, text) to authenticated;

-- Platform create: plans with trial_days 0 never open as a timed trial.
create or replace function public.platform_create_tenant(
  p_owner uuid, p_name text, p_slug text, p_root_domain text, p_plan uuid default null, p_status text default 'trial'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_plan uuid := p_plan;
  v_trial int;
  v_slug text := lower(trim(p_slug));
  v_status text;
  v_ends timestamptz;
begin
  if not app.has_platform_permission('platform.tenants.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_root_domain !~ '^[a-z0-9.-]+$' then
    raise exception 'invalid root domain' using errcode = '22023';
  end if;
  if p_status not in ('trial', 'active') then
    raise exception 'initial status must be trial or active' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_owner) then
    raise exception 'user not found' using errcode = 'P0002', hint = 'USER_NOT_FOUND';
  end if;
  if v_plan is null then
    select id, trial_days into v_plan, v_trial from public.plans where active order by sort_order, price_monthly limit 1;
  else
    select trial_days into v_trial from public.plans where id = v_plan;
    if not found then raise exception 'plan not found' using errcode = 'P0002', hint = 'PLAN_NOT_FOUND'; end if;
  end if;

  if coalesce(v_trial, 0) <= 0 then
    v_status := 'active';
    v_ends := null;
  else
    v_status := p_status;
    v_ends := case when p_status = 'trial' then now() + make_interval(days => v_trial) end;
  end if;

  insert into public.tenants (name, slug, status, plan_id, trial_ends_at, created_by)
  values (trim(p_name), v_slug, v_status, v_plan, v_ends, (select auth.uid()))
  returning id into v_tenant;

  insert into public.stores (tenant_id, name) values (v_tenant, trim(p_name));
  insert into public.domains (tenant_id, hostname, type, status, verified_at, ssl_status, is_primary)
  values (v_tenant, v_slug || '.' || p_root_domain, 'platform_subdomain', 'verified', now(), 'not_applicable', true);
  insert into public.tenant_memberships (tenant_id, user_id, role, invited_by) values (v_tenant, p_owner, 'owner', (select auth.uid()));
  insert into public.inventory_locations (tenant_id, name, is_default) values (v_tenant, 'Main warehouse', true);

  perform app.audit(v_tenant, 'tenant.created', 'tenant', v_tenant::text,
    jsonb_build_object('slug', v_slug, 'owner', p_owner, 'plan', v_plan, 'status', v_status, 'via', 'platform'), 'platform');
  return v_tenant;
end;
$$;

revoke all on function public.platform_create_tenant(uuid, text, text, text, uuid, text) from public, anon;
grant execute on function public.platform_create_tenant(uuid, text, text, text, uuid, text) to authenticated;
