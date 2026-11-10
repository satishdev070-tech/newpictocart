-- =============================================================================
-- PRODUCT COUNTRY OF ORIGIN
-- =============================================================================
-- Legal/commerce disclosure for storefront PDP. Required by app validation when
-- status = active; optional on draft. save_product reads product.country_of_origin.
-- Additive. Existing products keep NULL until edited.
-- =============================================================================

alter table public.products
  add column if not exists country_of_origin text
  check (country_of_origin is null or char_length(country_of_origin) between 1 and 80);

-- Payload product{} gains country_of_origin (text | null). Same body as 20260924000800
-- save_product with insert/update including the new column.

create or replace function public.save_product(p_tenant uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_p jsonb := coalesce(p_payload -> 'product', '{}'::jsonb);
  v_opts jsonb := coalesce(p_payload -> 'options', '[]'::jsonb);
  v_vars jsonb := coalesce(p_payload -> 'variants', '[]'::jsonb);
  v_expected timestamptz := nullif(p_payload ->> 'expected_updated_at', '')::timestamptz;
  v_nopts int;
  v_nvars int;
  v_current timestamptz;
  v_opt jsonb;
  v_opt_id uuid;
  v_var jsonb;
  v_vid uuid;
  v_target uuid;
  v_targets uuid[];
  v_claimed uuid[] := '{}';
  v_o text[];
  v_pos int;
  v_stock int;
  v_can_stock boolean;
  v_has_location boolean;
begin
  if p_tenant is null or not app.has_tenant_permission(p_tenant, 'catalog.write') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(v_opts) <> 'array' or jsonb_typeof(v_vars) <> 'array' or jsonb_typeof(v_p) <> 'object' then
    raise exception 'invalid payload' using errcode = '22023';
  end if;
  v_nopts := jsonb_array_length(v_opts);
  v_nvars := jsonb_array_length(v_vars);
  if v_nopts > 3 then raise exception 'at most 3 options' using errcode = '22023', hint = 'TOO_MANY_OPTIONS'; end if;
  if v_nvars < 1 or v_nvars > 250 then raise exception 'between 1 and 250 variants' using errcode = '22023', hint = 'VARIANT_COUNT'; end if;
  if v_nopts = 0 and v_nvars <> 1 then raise exception 'a product without options has exactly one variant' using errcode = '22023', hint = 'VARIANT_COUNT'; end if;

  -- 1. product row ------------------------------------------------------------
  if v_id is null then
    insert into public.products (
      tenant_id, title, slug, description, short_description, product_type, brand, category_id, size_chart_id,
      status, featured, tags, attributes, care_instructions, shipping_info, return_info, hsn_code, country_of_origin, seo
    ) values (
      p_tenant, v_p ->> 'title', v_p ->> 'slug', v_p ->> 'description', v_p ->> 'short_description',
      coalesce(v_p ->> 'product_type', 'other'), v_p ->> 'brand',
      nullif(v_p ->> 'category_id', '')::uuid, nullif(v_p ->> 'size_chart_id', '')::uuid,
      coalesce(v_p ->> 'status', 'draft'), coalesce((v_p ->> 'featured')::boolean, false),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_p -> 'tags', '[]'::jsonb))), '{}'),
      coalesce(v_p -> 'attributes', '{}'::jsonb), v_p ->> 'care_instructions', v_p ->> 'shipping_info',
      v_p ->> 'return_info', v_p ->> 'hsn_code', nullif(btrim(v_p ->> 'country_of_origin'), ''), coalesce(v_p -> 'seo', '{}'::jsonb)
    ) returning id into v_id;
  else
    select updated_at into v_current from public.products where id = v_id and tenant_id = p_tenant for update;
    if not found then raise exception 'product not found' using errcode = 'P0002'; end if;
    if v_expected is not null and v_current <> v_expected then
      raise exception 'product was changed by someone else' using errcode = 'P0001', hint = 'STALE_PRODUCT';
    end if;
    update public.products set
      title = v_p ->> 'title',
      slug = v_p ->> 'slug',
      description = v_p ->> 'description',
      short_description = v_p ->> 'short_description',
      product_type = coalesce(v_p ->> 'product_type', 'other'),
      brand = v_p ->> 'brand',
      category_id = nullif(v_p ->> 'category_id', '')::uuid,
      size_chart_id = nullif(v_p ->> 'size_chart_id', '')::uuid,
      status = coalesce(v_p ->> 'status', 'draft'),
      featured = coalesce((v_p ->> 'featured')::boolean, false),
      tags = coalesce(array(select jsonb_array_elements_text(coalesce(v_p -> 'tags', '[]'::jsonb))), '{}'),
      attributes = coalesce(v_p -> 'attributes', '{}'::jsonb),
      care_instructions = v_p ->> 'care_instructions',
      shipping_info = v_p ->> 'shipping_info',
      return_info = v_p ->> 'return_info',
      hsn_code = v_p ->> 'hsn_code',
      country_of_origin = nullif(btrim(v_p ->> 'country_of_origin'), ''),
      seo = coalesce(v_p -> 'seo', '{}'::jsonb),
      updated_at = now()
    where id = v_id and tenant_id = p_tenant;
  end if;

  -- 2. options + values (replaced wholesale; variants reference values by text) --
  delete from public.product_options where product_id = v_id and tenant_id = p_tenant;
  for i in 0 .. v_nopts - 1 loop
    v_opt := v_opts -> i;
    if jsonb_typeof(v_opt -> 'values') is distinct from 'array' or jsonb_array_length(v_opt -> 'values') = 0 then
      raise exception 'option % has no values', i + 1 using errcode = '22023', hint = 'OPTION_VALUES';
    end if;
    insert into public.product_options (tenant_id, product_id, position, name)
    values (p_tenant, v_id, i + 1, btrim(v_opt ->> 'name'))
    returning id into v_opt_id;
    insert into public.product_option_values (tenant_id, option_id, value, swatch, position)
    select p_tenant, v_opt_id, btrim(x ->> 'value'), nullif(x ->> 'swatch', ''), (t.ord - 1)::int
    from jsonb_array_elements(v_opt -> 'values') with ordinality as t(x, ord);
  end loop;

  -- 3. validate variant option values against the options ---------------------
  for k in 0 .. v_nvars - 1 loop
    v_var := v_vars -> k;
    v_o := array[nullif(btrim(v_var ->> 'option1'), ''), nullif(btrim(v_var ->> 'option2'), ''), nullif(btrim(v_var ->> 'option3'), '')];
    for v_pos in 1 .. 3 loop
      if v_pos <= v_nopts then
        if v_o[v_pos] is null or not exists (
          select 1 from public.product_option_values pov
          join public.product_options po on po.id = pov.option_id
          where po.product_id = v_id and po.position = v_pos and pov.value = v_o[v_pos]
        ) then
          raise exception 'variant % has an invalid value for option %', k + 1, v_pos using errcode = '22023', hint = 'VARIANT_OPTIONS';
        end if;
      elsif v_o[v_pos] is not null then
        raise exception 'variant % sets option % which does not exist', k + 1, v_pos using errcode = '22023', hint = 'VARIANT_OPTIONS';
      end if;
    end loop;
  end loop;
  if (select count(distinct (nullif(btrim(x ->> 'option1'), ''), nullif(btrim(x ->> 'option2'), ''), nullif(btrim(x ->> 'option3'), '')))
      from jsonb_array_elements(v_vars) x) <> v_nvars then
    raise exception 'duplicate variant combination' using errcode = '22023', hint = 'DUPLICATE_VARIANT';
  end if;

  -- 4. resolve which existing row each payload variant updates ------------------
  v_targets := array_fill(null::uuid, array[v_nvars]);
  -- 4a. explicit ids
  for k in 0 .. v_nvars - 1 loop
    v_vid := nullif(v_vars -> k ->> 'id', '')::uuid;
    if v_vid is not null then
      if not exists (select 1 from public.product_variants where id = v_vid and product_id = v_id and tenant_id = p_tenant) then
        raise exception 'variant not found' using errcode = 'P0002';
      end if;
      if v_vid = any (v_claimed) then raise exception 'variant listed twice' using errcode = '22023', hint = 'DUPLICATE_VARIANT'; end if;
      v_claimed := v_claimed || v_vid;
      v_targets[k + 1] := v_vid;
    end if;
  end loop;
  -- 4b. by option combination (revives removed/archived combinations)
  for k in 0 .. v_nvars - 1 loop
    if v_targets[k + 1] is null then
      v_var := v_vars -> k;
      select id into v_target from public.product_variants
      where product_id = v_id and tenant_id = p_tenant and id <> all (v_claimed)
        and option1 is not distinct from nullif(btrim(v_var ->> 'option1'), '')
        and option2 is not distinct from nullif(btrim(v_var ->> 'option2'), '')
        and option3 is not distinct from nullif(btrim(v_var ->> 'option3'), '')
      limit 1;
      if v_target is not null then
        v_claimed := v_claimed || v_target;
        v_targets[k + 1] := v_target;
      end if;
    end if;
  end loop;

  -- 5. variants no longer in the payload -------------------------------------
  -- delete unless sold; sold ones are archived (orders keep their own snapshot either way).
  -- A sold variant whose combination is being reused by another row must go, too.
  delete from public.product_variants r
  where r.product_id = v_id and r.tenant_id = p_tenant and r.id <> all (v_claimed)
    and (
      not exists (select 1 from public.order_items oi where oi.variant_id = r.id)
      or exists (
        select 1 from jsonb_array_elements(v_vars) x
        where nullif(btrim(x ->> 'option1'), '') is not distinct from r.option1
          and nullif(btrim(x ->> 'option2'), '') is not distinct from r.option2
          and nullif(btrim(x ->> 'option3'), '') is not distinct from r.option3
      )
    );
  update public.product_variants r set
    status = 'archived',
    sku = case when r.sku in (select x ->> 'sku' from jsonb_array_elements(v_vars) x where x ->> 'sku' is not null) then null else r.sku end
  where r.product_id = v_id and r.tenant_id = p_tenant and r.id <> all (v_claimed);

  -- 6. free unique keys on kept rows so values can be swapped between rows ------
  update public.product_variants set option1 = '~' || id::text, option2 = null, option3 = null, sku = null
  where id = any (v_claimed);

  -- 7. write variants ----------------------------------------------------------
  v_can_stock := app.has_tenant_permission(p_tenant, 'inventory.write');
  v_has_location := exists (select 1 from public.inventory_locations where tenant_id = p_tenant and is_default);
  for k in 0 .. v_nvars - 1 loop
    v_var := v_vars -> k;
    v_o := array[nullif(btrim(v_var ->> 'option1'), ''), nullif(btrim(v_var ->> 'option2'), ''), nullif(btrim(v_var ->> 'option3'), '')];
    if v_targets[k + 1] is not null then
      update public.product_variants set
        option1 = v_o[1], option2 = v_o[2], option3 = v_o[3],
        title = coalesce(nullif(array_to_string(v_o, ' / '), ''), 'Default'),
        sku = nullif(btrim(v_var ->> 'sku'), ''),
        barcode = nullif(btrim(v_var ->> 'barcode'), ''),
        price = (v_var ->> 'price')::numeric,
        compare_at_price = nullif(v_var ->> 'compare_at_price', '')::numeric,
        cost_price = nullif(v_var ->> 'cost_price', '')::numeric,
        weight_grams = coalesce((v_var ->> 'weight_grams')::int, 500),
        track_inventory = coalesce((v_var ->> 'track_inventory')::boolean, true),
        allow_backorder = coalesce((v_var ->> 'allow_backorder')::boolean, false),
        low_stock_threshold = nullif(v_var ->> 'low_stock_threshold', '')::int,
        status = coalesce(v_var ->> 'status', 'active'),
        position = k
      where id = v_targets[k + 1];
    else
      insert into public.product_variants (
        tenant_id, product_id, option1, option2, option3, title, sku, barcode, price, compare_at_price, cost_price,
        weight_grams, track_inventory, allow_backorder, low_stock_threshold, status, position
      ) values (
        p_tenant, v_id, v_o[1], v_o[2], v_o[3], coalesce(nullif(array_to_string(v_o, ' / '), ''), 'Default'),
        nullif(btrim(v_var ->> 'sku'), ''), nullif(btrim(v_var ->> 'barcode'), ''),
        (v_var ->> 'price')::numeric, nullif(v_var ->> 'compare_at_price', '')::numeric, nullif(v_var ->> 'cost_price', '')::numeric,
        coalesce((v_var ->> 'weight_grams')::int, 500), coalesce((v_var ->> 'track_inventory')::boolean, true),
        coalesce((v_var ->> 'allow_backorder')::boolean, false), nullif(v_var ->> 'low_stock_threshold', '')::int,
        coalesce(v_var ->> 'status', 'active'), k
      ) returning id into v_vid;
      v_stock := coalesce(nullif(v_var ->> 'initial_stock', '')::int, 0);
      if v_stock < 0 or v_stock > 1000000 then raise exception 'invalid quantity' using errcode = '22023'; end if;
      if v_stock > 0 and v_can_stock and v_has_location then
        perform app.apply_stock_delta(p_tenant, v_vid, null, v_stock, 'initial', 'manual', null, 'Opening stock');
      end if;
    end if;
  end loop;

  if coalesce(v_p ->> 'status', 'draft') = 'active'
     and not exists (select 1 from public.product_variants where product_id = v_id and status = 'active') then
    raise exception 'an active product needs at least one active variant' using errcode = '22023', hint = 'NO_ACTIVE_VARIANT';
  end if;

  return v_id;
end;
$$;

revoke all on function public.save_product(uuid, jsonb) from public, anon;
grant execute on function public.save_product(uuid, jsonb) to authenticated;
