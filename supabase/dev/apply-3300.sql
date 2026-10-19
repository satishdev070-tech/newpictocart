-- =============================================================================
-- 3300 SITE MODE
-- Adds stores.site_mode. Existing stores remain ecommerce; no commerce data is changed.
-- Down: alter table public.stores drop column if exists site_mode;
-- =============================================================================

alter table public.stores
  add column if not exists site_mode text not null default 'ecommerce';

alter table public.stores
  drop constraint if exists stores_site_mode_check;

alter table public.stores
  add constraint stores_site_mode_check
  check (site_mode in ('ecommerce', 'informative'));
