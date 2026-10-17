-- Custom marketplace themes made in Super Admin → Themes (AI "create from URL + screenshot",
-- duplicates of built-in themes, manual edits). They live in public.themes (migration 1500), which
-- was reserved for platform-published themes: `config` holds the theme document (preset, Unsplash
-- images with credits, reference + generation metadata) and `active` means published (sellers can
-- pick it). Drafts (`active = false`) are visible to platform staff with platform.settings.manage
-- only (existing RLS). Built-in themes stay in code (src/features/theme/marketplace/catalog.ts).

alter table public.themes
  add column if not exists style text check (style is null or style ~ '^[a-z-]{2,30}$'),
  add column if not exists source text not null default 'manual' check (source in ('manual', 'ai', 'duplicate')),
  add column if not exists source_url text check (source_url is null or (char_length(source_url) <= 500 and source_url ~ '^https://')),
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists published_at timestamptz;

-- Theme documents are small (tokens + page composition + image credits); cap them like store theme configs.
alter table public.themes drop constraint if exists themes_config_size;
alter table public.themes add constraint themes_config_size check (octet_length(config::text) <= 262144);

create index if not exists themes_active_category_idx on public.themes (active, category, position);

comment on column public.themes.active is 'Published in the theme marketplace (sellers can pick it). false = draft, platform staff only.';
comment on column public.themes.source is 'manual | ai (created from a reference URL/screenshot) | duplicate (copied from another theme).';
