-- Platform: transfer a store's ownership to another existing account (Admin → Stores → store).
--
-- The new owner must already have an account (same rule as platform_create_tenant). Their
-- membership becomes an active owner (new, or replacing a staff role). The previous
-- owner(s) are removed (p_remove_previous, the default) or kept as managers. A tenant is never
-- left without an active owner. Audited as tenant.owner_transferred (actor_type 'platform').
--
-- Down:
--   drop function if exists public.platform_transfer_tenant_owner(uuid, uuid, boolean, text);

create or replace function public.platform_transfer_tenant_owner(
  p_tenant uuid, p_new_owner uuid, p_remove_previous boolean default true, p_reason text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous uuid[];
begin
  if not app.has_platform_permission('platform.tenants.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant) then
    raise exception 'store not found' using errcode = 'P0002', hint = 'TENANT_NOT_FOUND';
  end if;
  if not exists (select 1 from auth.users where id = p_new_owner) then
    raise exception 'user not found' using errcode = 'P0002', hint = 'USER_NOT_FOUND';
  end if;

  select coalesce(array_agg(user_id), '{}') into v_previous
  from public.tenant_memberships
  where tenant_id = p_tenant and role = 'owner' and user_id <> p_new_owner;

  if exists (select 1 from public.tenant_memberships where tenant_id = p_tenant and user_id = p_new_owner and role = 'owner' and status = 'active')
     and cardinality(v_previous) = 0 then
    raise exception 'already the owner' using errcode = '22023', hint = 'ALREADY_OWNER';
  end if;

  -- Role changes are written as delete + insert: app.guard_membership_role (BEFORE UPDATE) only lets
  -- a caller assign roles they hold in the store, and platform staff aren't store members. The
  -- platform permission was checked above; nothing references membership rows by foreign key.
  delete from public.tenant_memberships where tenant_id = p_tenant and user_id = p_new_owner;
  insert into public.tenant_memberships (tenant_id, user_id, role, status, invited_by)
  values (p_tenant, p_new_owner, 'owner', 'active', (select auth.uid()));

  delete from public.tenant_memberships where tenant_id = p_tenant and user_id = any (v_previous);
  if not p_remove_previous then
    insert into public.tenant_memberships (tenant_id, user_id, role, status, invited_by)
    select p_tenant, u, 'manager', 'active', (select auth.uid()) from unnest(v_previous) as u;
  end if;

  perform app.audit(p_tenant, 'tenant.owner_transferred', 'tenant', p_tenant::text,
    jsonb_build_object(
      'new_owner', p_new_owner,
      'previous_owners', to_jsonb(v_previous),
      'previous', case when p_remove_previous then 'removed' else 'kept_as_manager' end,
      'reason', left(coalesce(p_reason, ''), 500)
    ), 'platform');
end;
$$;

revoke all on function public.platform_transfer_tenant_owner(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.platform_transfer_tenant_owner(uuid, uuid, boolean, text) to authenticated;
