-- =============================================================================
-- 4400 PRODUCTS LIST UPDATED_AT INDEX: speeds the default dashboard product list
-- sort (tenant_id, updated_at desc). Listing indexes already cover status/published_at,
-- category, type, and price; the seller Products page defaults to updated_desc.
-- Additive and idempotent. No data change.
--
-- Down:
--   drop index if exists public.products_tenant_updated_idx;
-- =============================================================================

create index if not exists products_tenant_updated_idx
  on public.products (tenant_id, updated_at desc);
