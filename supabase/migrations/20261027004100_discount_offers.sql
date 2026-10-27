-- Storefront "View offers": sellers choose which coupon codes are listed publicly at the cart,
-- checkout and on product pages. Off by default so existing private codes (influencer, staff,
-- win-back) never leak; the dashboard form defaults it on for new codes.
alter table public.discounts add column show_in_offers boolean not null default false;

create index discounts_offers_idx on public.discounts (tenant_id, starts_at) where show_in_offers and status = 'active' and code is not null;

-- save_discount: same as 20260924000951 plus `show_in_offers`.
create or replace function public.save_discount(p_tenant uuid, p_id uuid, p_discount jsonb, p_product_ids uuid[], p_collection_ids uuid[])
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not app.has_tenant_permission(p_tenant, 'marketing.write') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if coalesce(array_length(p_product_ids, 1), 0) > 500 or coalesce(array_length(p_collection_ids, 1), 0) > 500 then
    raise exception 'too many targets' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.discounts (tenant_id, code, title, type, value, applies_to, min_subtotal, max_discount, config, automatic,
                                  starts_at, ends_at, usage_limit, per_customer_limit, status, show_in_offers)
    values (p_tenant, p_discount ->> 'code', p_discount ->> 'title', p_discount ->> 'type', coalesce((p_discount ->> 'value')::numeric, 0),
            coalesce(p_discount ->> 'applies_to', 'all'), coalesce((p_discount ->> 'min_subtotal')::numeric, 0), (p_discount ->> 'max_discount')::numeric,
            coalesce(p_discount -> 'config', '{}'::jsonb), coalesce((p_discount ->> 'automatic')::boolean, false),
            coalesce((p_discount ->> 'starts_at')::timestamptz, now()), (p_discount ->> 'ends_at')::timestamptz,
            (p_discount ->> 'usage_limit')::int, (p_discount ->> 'per_customer_limit')::int, coalesce(p_discount ->> 'status', 'active'),
            coalesce((p_discount ->> 'show_in_offers')::boolean, false))
    returning id into v_id;
  else
    update public.discounts set
      code = p_discount ->> 'code',
      title = p_discount ->> 'title',
      type = p_discount ->> 'type',
      value = coalesce((p_discount ->> 'value')::numeric, 0),
      applies_to = coalesce(p_discount ->> 'applies_to', 'all'),
      min_subtotal = coalesce((p_discount ->> 'min_subtotal')::numeric, 0),
      max_discount = (p_discount ->> 'max_discount')::numeric,
      config = coalesce(p_discount -> 'config', '{}'::jsonb),
      automatic = coalesce((p_discount ->> 'automatic')::boolean, false),
      starts_at = coalesce((p_discount ->> 'starts_at')::timestamptz, starts_at),
      ends_at = (p_discount ->> 'ends_at')::timestamptz,
      usage_limit = (p_discount ->> 'usage_limit')::int,
      per_customer_limit = (p_discount ->> 'per_customer_limit')::int,
      status = coalesce(p_discount ->> 'status', status),
      show_in_offers = coalesce((p_discount ->> 'show_in_offers')::boolean, show_in_offers)
    where id = p_id and tenant_id = p_tenant
    returning id into v_id;
    if v_id is null then
      raise exception 'discount not found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.discount_products where discount_id = v_id;
  delete from public.discount_collections where discount_id = v_id;
  insert into public.discount_products (tenant_id, discount_id, product_id)
    select distinct p_tenant, v_id, x from unnest(coalesce(p_product_ids, '{}'::uuid[])) as x;
  insert into public.discount_collections (tenant_id, discount_id, collection_id)
    select distinct p_tenant, v_id, x from unnest(coalesce(p_collection_ids, '{}'::uuid[])) as x;
  return v_id;
end;
$$;
