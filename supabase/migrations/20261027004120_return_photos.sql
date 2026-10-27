-- =============================================================================
-- Return photos (QA #10): a shopper can attach up to 5 photos to a return request
-- (required for "arrived damaged"). Files live in the PRIVATE `private-files` bucket at
--   tenant/{tenant_id}/returns/{order_id}/{uuid}.{jpg|png|webp}
-- Readable only by the order's own (active) customer and the store's staff with orders.read
-- (existing private_files_staff_read). The customer uploads with their own session (RLS), only
-- for their own delivered order; the paths are then stored on the return by svc_create_return,
-- which accepts nothing outside that order's folder.
--
-- Rollback:
--   drop policy private_files_return_photo_read / _insert / _delete on storage.objects;
--   drop function app.is_own_return_photo_path(text, boolean);
--   restore app.create_return / public.svc_create_return without p_photos (20260924000400);
--   alter table public.returns drop column photo_paths;
-- =============================================================================

alter table public.returns add column if not exists photo_paths text[] not null default '{}'
  constraint returns_photo_paths_max check (cardinality(photo_paths) <= 5);

-- Is this object path a return photo of an order owned by the signed-in customer?
-- p_for_upload additionally requires the order to be delivered (only then can a return be asked).
create or replace function app.is_own_return_photo_path(p_name text, p_for_upload boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_name ~ '^tenant/[0-9a-f-]{36}/returns/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    and exists (
      select 1 from public.orders o
      where o.tenant_id = app.storage_tenant(p_name)
        and o.id::text = split_part(p_name, '/', 4)
        and o.customer_id is not null
        and app.is_own_customer(o.tenant_id, o.customer_id)
        and (not p_for_upload or o.fulfillment_status = 'delivered')
    );
$$;
revoke all on function app.is_own_return_photo_path(text, boolean) from public;
grant execute on function app.is_own_return_photo_path(text, boolean) to authenticated, service_role;

drop policy if exists private_files_return_photo_read on storage.objects;
drop policy if exists private_files_return_photo_insert on storage.objects;
drop policy if exists private_files_return_photo_delete on storage.objects;
create policy private_files_return_photo_read on storage.objects for select to authenticated
  using (bucket_id = 'private-files' and app.is_own_return_photo_path(name, false));
create policy private_files_return_photo_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'private-files' and app.is_own_return_photo_path(name, true));
-- Clean-up of the shopper's own upload when the return request then fails.
create policy private_files_return_photo_delete on storage.objects for delete to authenticated
  using (bucket_id = 'private-files' and owner_id = (select auth.uid())::text and app.is_own_return_photo_path(name, true));

-- create_return gains p_photos (defaults to none, so existing callers keep working).
drop function if exists public.svc_create_return(uuid, uuid, uuid, text, text, jsonb);
drop function if exists app.create_return(uuid, uuid, uuid, text, text, jsonb);

create or replace function app.create_return(p_tenant uuid, p_order uuid, p_customer uuid, p_reason text, p_note text, p_items jsonb, p_photos text[] default '{}')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid; v_num bigint; i jsonb; oi public.order_items%rowtype; o public.orders%rowtype; p text;
begin
  select * into o from public.orders where id = p_order and tenant_id = p_tenant;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if p_customer is not null and o.customer_id is distinct from p_customer then raise exception 'not allowed' using errcode = '42501'; end if;
  if o.fulfillment_status <> 'delivered' then raise exception 'only delivered orders can be returned' using errcode = 'P0001', hint = 'NOT_RETURNABLE'; end if;
  if cardinality(coalesce(p_photos, '{}')) > 5 then raise exception 'too many photos' using errcode = '22023'; end if;
  foreach p in array coalesce(p_photos, '{}') loop
    if p !~ ('^tenant/' || p_tenant::text || '/returns/' || p_order::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then
      raise exception 'invalid photo path' using errcode = '22023';
    end if;
  end loop;
  v_num := app.next_counter(p_tenant, 'return');
  insert into public.returns (tenant_id, order_id, customer_id, return_number, reason, customer_note, photo_paths)
  values (p_tenant, p_order, o.customer_id, v_num, p_reason, p_note, coalesce(p_photos, '{}')) returning id into v_id;
  for i in select * from jsonb_array_elements(p_items) loop
    select * into oi from public.order_items where id = (i ->> 'order_item_id')::uuid and order_id = p_order for update;
    if not found or (i ->> 'quantity')::int < 1 or oi.returned_quantity + (i ->> 'quantity')::int > oi.quantity then
      raise exception 'invalid return quantity' using errcode = '22023';
    end if;
    insert into public.return_items (tenant_id, return_id, order_item_id, quantity, reason) values (p_tenant, v_id, oi.id, (i ->> 'quantity')::int, i ->> 'reason');
    update public.order_items set returned_quantity = returned_quantity + (i ->> 'quantity')::int where id = oi.id;
  end loop;
  insert into public.order_events (tenant_id, order_id, type, message, visible_to_customer) values (p_tenant, p_order, 'return_requested', 'Return requested', true);
  return v_id;
end;
$$;

create or replace function public.svc_create_return(p_tenant uuid, p_order uuid, p_customer uuid, p_reason text, p_note text, p_items jsonb, p_photos text[] default '{}') returns uuid
language sql security definer set search_path = '' as $$ select app.create_return(p_tenant, p_order, p_customer, p_reason, p_note, p_items, p_photos) $$;

revoke all on function app.create_return(uuid, uuid, uuid, text, text, jsonb, text[]) from public, anon, authenticated;
revoke all on function public.svc_create_return(uuid, uuid, uuid, text, text, jsonb, text[]) from public, anon, authenticated;
grant execute on function app.create_return(uuid, uuid, uuid, text, text, jsonb, text[]) to service_role;
grant execute on function public.svc_create_return(uuid, uuid, uuid, text, text, jsonb, text[]) to service_role;
