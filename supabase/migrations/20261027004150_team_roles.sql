-- =============================================================================
-- 4150 TEAM ROLES (QA #2/#3): three standard roles instead of twelve.
--   owner (shown as "Store Admin (Owner)"), manager, sales_associate; custom roles stay.
--   Existing members/invitations are mapped to the nearest new role:
--     admin, manager, catalog/order/inventory/marketing/content manager -> manager
--     analyst, support agent, staff, viewer                             -> sales_associate
--   Platform support sessions keep their read-only set under the internal
--   role_permissions row 'support_viewer' (never assignable to a member).
-- role_permissions MUST match src/lib/permissions/matrix.ts (tests/unit/permissions-sql.test.ts).
-- =============================================================================

-- 1. Support sessions read 'support_viewer' (was 'viewer') ------------------------
create or replace function app.has_tenant_permission(p_tenant uuid, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships m
    where m.tenant_id = p_tenant
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (
        (m.custom_role_id is null and exists (select 1 from public.role_permissions rp where rp.role = m.role and rp.permission = p_perm))
        or (m.custom_role_id is not null and exists (select 1 from public.tenant_custom_roles cr where cr.id = m.custom_role_id and p_perm = any (cr.permissions)))
      )
  )
  or exists (
    select 1
    from public.support_sessions s
    join public.role_permissions rp on rp.role = 'support_viewer' and rp.permission = p_perm
    where s.tenant_id = p_tenant
      and s.platform_user_id = (select auth.uid())
      and s.ended_at is null
      and s.expires_at > now()
  );
$$;

-- 2. Map existing members and invitations onto the new roles -------------------------
alter table public.tenant_memberships drop constraint tenant_memberships_role_check;
alter table public.tenant_invitations drop constraint tenant_invitations_role_check;
alter table public.role_permissions drop constraint role_permissions_role_check;

-- Guards skip when auth.uid() is null (migrations), so these updates are not blocked.
update public.tenant_memberships set role = 'manager'
  where role in ('admin', 'catalog_manager', 'order_manager', 'inventory_manager', 'marketing_manager', 'content_manager');
update public.tenant_memberships set role = 'sales_associate'
  where role in ('analyst', 'support_agent', 'staff', 'viewer');
update public.tenant_invitations set role = 'manager'
  where role in ('admin', 'catalog_manager', 'order_manager', 'inventory_manager', 'marketing_manager', 'content_manager');
update public.tenant_invitations set role = 'sales_associate'
  where role in ('analyst', 'support_agent', 'staff', 'viewer');

-- 3. System role permissions -------------------------------------------------------
delete from public.role_permissions;
insert into public.role_permissions (role, permission) values
  -- owner
  ('owner','store.read'),('owner','catalog.read'),('owner','catalog.write'),('owner','catalog.delete'),('owner','catalog.publish'),('owner','inventory.read'),('owner','inventory.write'),('owner','orders.read'),('owner','orders.write'),('owner','orders.cancel'),('owner','orders.refund'),('owner','customers.read'),('owner','customers.write'),('owner','marketing.read'),('owner','marketing.write'),('owner','content.write'),('owner','theme.edit'),('owner','theme.publish'),('owner','reviews.moderate'),('owner','analytics.read'),('owner','settings.write'),('owner','payments.manage'),('owner','domains.manage'),('owner','members.read'),('owner','members.manage'),('owner','roles.manage'),('owner','billing.manage'),
  -- manager
  ('manager','store.read'),('manager','catalog.read'),('manager','catalog.write'),('manager','catalog.delete'),('manager','catalog.publish'),('manager','inventory.read'),('manager','inventory.write'),('manager','orders.read'),('manager','orders.write'),('manager','orders.cancel'),('manager','orders.refund'),('manager','customers.read'),('manager','customers.write'),('manager','marketing.read'),('manager','marketing.write'),('manager','content.write'),('manager','theme.edit'),('manager','theme.publish'),('manager','reviews.moderate'),('manager','analytics.read'),('manager','settings.write'),('manager','payments.manage'),('manager','domains.manage'),('manager','members.read'),('manager','members.manage'),('manager','roles.manage'),
  -- sales_associate
  ('sales_associate','store.read'),('sales_associate','catalog.read'),('sales_associate','catalog.write'),('sales_associate','inventory.read'),('sales_associate','inventory.write'),('sales_associate','orders.read'),('sales_associate','orders.write'),('sales_associate','orders.cancel'),('sales_associate','customers.read'),('sales_associate','customers.write'),
  -- support_viewer
  ('support_viewer','store.read'),('support_viewer','catalog.read'),('support_viewer','inventory.read'),('support_viewer','orders.read'),('support_viewer','customers.read'),('support_viewer','marketing.read'),('support_viewer','analytics.read')
on conflict do nothing;

alter table public.role_permissions add constraint role_permissions_role_check
  check (role in ('owner', 'manager', 'sales_associate', 'support_viewer'));
alter table public.tenant_memberships add constraint tenant_memberships_role_check
  check (role in ('owner', 'manager', 'sales_associate', 'custom'));
alter table public.tenant_invitations add constraint tenant_invitations_role_check
  check (role in ('manager', 'sales_associate', 'custom'));

-- 4. Team list order: owner, managers, sales associates, custom roles ----------------
create or replace function public.list_tenant_members(p_tenant uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  role text,
  custom_role_id uuid,
  custom_role_name text,
  status text,
  display_name text,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (app.has_tenant_permission(p_tenant, 'members.read') or app.has_tenant_permission(p_tenant, 'members.manage')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select m.id, m.user_id, m.role, m.custom_role_id, cr.name, m.status, p.display_name, u.email::text, m.created_at, u.last_sign_in_at
    from public.tenant_memberships m
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.id = m.user_id
    left join public.tenant_custom_roles cr on cr.id = m.custom_role_id
    where m.tenant_id = p_tenant
    order by case m.role when 'owner' then 0 when 'manager' then 1 when 'sales_associate' then 2 else 3 end, m.created_at;
end;
$$;
