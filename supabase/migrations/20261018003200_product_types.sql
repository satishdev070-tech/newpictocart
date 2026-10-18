-- Product types for every industry (not just fashion).
--
-- 1. products.product_type was limited by a CHECK to 14 fashion keys (migration 0300). It becomes
--    any lowercase key; the catalogue lives in code (src/features/catalog/product-types.ts) plus:
-- 2. public.product_types: Super Admin overrides/additions to the code catalogue (rename, assign
--    to industries, attribute template, disable). A row overrides the code default with the same
--    key; keys not in code are new types. Readable by everyone (labels on storefronts), written
--    only by platform staff with platform.settings.manage.
-- 3. public.tenant_product_types: store-only types a seller creates from the product form.
-- 4. Data fix: before this migration the app saved new type keys as product_type 'other' with the
--    real key in attributes._type; move those back into product_type.
--
-- Idempotent: safe to run more than once.

-- 1 ----------------------------------------------------------------------------------------
alter table public.products drop constraint if exists products_product_type_check;
alter table public.products drop constraint if exists products_product_type_format;
alter table public.products add constraint products_product_type_format
  check (product_type ~ '^[a-z0-9][a-z0-9_]{0,39}$');

-- 2 ----------------------------------------------------------------------------------------
create table if not exists public.product_types (
  key text primary key check (key ~ '^[a-z0-9][a-z0-9_]{0,39}$'),
  label text not null check (char_length(label) between 1 and 60),
  plural_label text check (plural_label is null or char_length(plural_label) between 1 and 60),
  industries text[] not null default '{}' check (cardinality(industries) <= 40),
  -- {"fashion": bool, "sizes": bool, "specs": ["Material", ...], "care": "Care & usage"}; {} = code default
  template jsonb not null default '{}'::jsonb check (jsonb_typeof(template) = 'object' and octet_length(template::text) <= 4096),
  position int not null default 0,
  status text not null default 'active' check (status in ('active', 'disabled')),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_product_types_updated_at on public.product_types;
create trigger trg_product_types_updated_at before update on public.product_types
  for each row execute function app.set_updated_at();

alter table public.product_types enable row level security;

drop policy if exists product_types_select on public.product_types;
create policy product_types_select on public.product_types for select to anon, authenticated using (true);

drop policy if exists product_types_platform_insert on public.product_types;
create policy product_types_platform_insert on public.product_types for insert to authenticated
  with check (app.has_platform_permission('platform.settings.manage'));

drop policy if exists product_types_platform_update on public.product_types;
create policy product_types_platform_update on public.product_types for update to authenticated
  using (app.has_platform_permission('platform.settings.manage'))
  with check (app.has_platform_permission('platform.settings.manage'));

drop policy if exists product_types_platform_delete on public.product_types;
create policy product_types_platform_delete on public.product_types for delete to authenticated
  using (app.has_platform_permission('platform.settings.manage'));

-- 3 ----------------------------------------------------------------------------------------
create table if not exists public.tenant_product_types (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9][a-z0-9_]{0,39}$'),
  label text not null check (char_length(label) between 1 and 60),
  template jsonb not null default '{}'::jsonb check (jsonb_typeof(template) = 'object' and octet_length(template::text) <= 4096),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

drop trigger if exists trg_tenant_product_types_updated_at on public.tenant_product_types;
create trigger trg_tenant_product_types_updated_at before update on public.tenant_product_types
  for each row execute function app.set_updated_at();
drop trigger if exists trg_tenant_product_types_freeze_tenant on public.tenant_product_types;
create trigger trg_tenant_product_types_freeze_tenant before update of tenant_id on public.tenant_product_types
  for each row execute function app.freeze_tenant_id();

alter table public.tenant_product_types enable row level security;

drop policy if exists tenant_product_types_select on public.tenant_product_types;
create policy tenant_product_types_select on public.tenant_product_types for select to authenticated
  using (app.has_tenant_permission(tenant_id, 'catalog.read') or app.has_platform_permission('platform.tenants.read'));

drop policy if exists tenant_product_types_insert on public.tenant_product_types;
create policy tenant_product_types_insert on public.tenant_product_types for insert to authenticated
  with check (app.has_tenant_permission(tenant_id, 'catalog.write'));

drop policy if exists tenant_product_types_update on public.tenant_product_types;
create policy tenant_product_types_update on public.tenant_product_types for update to authenticated
  using (app.has_tenant_permission(tenant_id, 'catalog.write'))
  with check (app.has_tenant_permission(tenant_id, 'catalog.write'));

drop policy if exists tenant_product_types_delete on public.tenant_product_types;
create policy tenant_product_types_delete on public.tenant_product_types for delete to authenticated
  using (app.has_tenant_permission(tenant_id, 'catalog.delete'));

-- 4 ----------------------------------------------------------------------------------------
update public.products
   set product_type = attributes ->> '_type',
       attributes = attributes - '_type'
 where product_type = 'other'
   and attributes ? '_type'
   and (attributes ->> '_type') ~ '^[a-z0-9][a-z0-9_]{0,39}$';

comment on table public.product_types is 'Super Admin overrides/additions to the code product-type catalogue (src/features/catalog/product-types.ts).';
comment on table public.tenant_product_types is 'Store-only product types created by sellers from the product form.';
