-- =============================================================================
-- 4100 CATEGORY SIZE CHARTS
-- =============================================================================
-- A size chart can be the default for a whole category. Storefront resolution:
-- the product's own chart -> its category's chart (walking up parent categories)
-- -> none. A product opts out with attributes._size_chart = 'none' (see
-- src/features/catalog/size-chart.ts), so save_product needs no change.
-- Existing RLS on categories covers the new column.
-- =============================================================================

alter table public.categories add column size_chart_id uuid;

alter table public.categories
  add constraint categories_tenant_id_size_chart_id_fkey
  foreign key (tenant_id, size_chart_id) references public.size_charts (tenant_id, id) on delete set null (size_chart_id);

create index categories_size_chart_idx on public.categories (tenant_id, size_chart_id) where size_chart_id is not null;
