-- Store website mode. Existing stores retain the full ecommerce experience; a seller can
-- opt into an informative (brochure / services) site without losing any catalogue or order data.
-- This is intentionally additive and safe to apply more than once.

alter table public.stores
  add column if not exists site_mode text not null default 'ecommerce';

alter table public.stores
  drop constraint if exists stores_site_mode_check;

alter table public.stores
  add constraint stores_site_mode_check
  check (site_mode in ('ecommerce', 'informative'));

comment on column public.stores.site_mode is
  'ecommerce (default) or informative; informative suppresses shopping UI without deleting commerce data.';
