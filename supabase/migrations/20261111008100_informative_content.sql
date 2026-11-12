-- Informative Website M2 data layer (docs/informative/PLAN.md). New tables only, all keyed by
-- tenant_id (the plan's "storeId"; ADR-012). Nothing existing changes shape.
--
-- Conventions: composite (tenant_id, id) uniqueness (ADR-013), created_at/updated_at with the
-- standard triggers, soft delete (deleted_at), an index leading with tenant_id, money as
-- numeric(12,2) (paise in TypeScript, ADR-008). Rows can only be written for INFORMATIVE tenants.
--
-- Access (RLS + explicit grants):
--   * public (anon/authenticated) reads only published, active/visible, non-deleted rows of a
--     PUBLISHED site whose tenant is open;
--   * members read with store.read; content is written with content.write; the site profile
--     with settings.write / theme.edit / theme.publish (the service layer checks the exact key);
--   * enquiries: read customers.read, update status/notes/deleted_at only with customers.write;
--     nobody inserts directly (public submission is a SECURITY DEFINER function in M7);
--   * no DELETE grants for clients: removal is a soft delete.
--
-- DOWN (manual): drop the tables in reverse order (info_enquiries, info_faqs, info_testimonials,
-- info_team_members, info_gallery_items, info_pages, info_services, info_site_private,
-- info_sites), then drop function app.info_site_is_public(uuid), app.is_informative_tenant(uuid).

-- Helpers ------------------------------------------------------------------------------------

create or replace function app.is_informative_tenant(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.tenants where id = p_tenant and website_type = 'INFORMATIVE');
$$;

-- Site profile -------------------------------------------------------------------------------

create table public.info_sites (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  theme_id text not null default 'nexus-core' check (theme_id ~ '^[a-z0-9-]{2,40}$'),
  business_name text not null check (char_length(business_name) between 2 and 80),
  tagline text check (tagline is null or char_length(tagline) <= 120),
  category text not null default 'other' check (category in (
    'consultancy', 'clinic_healthcare', 'salon_beauty', 'gym_fitness', 'dance_academy_coaching',
    'events_community', 'interior_design', 'personal_brand', 'other')),
  about text check (about is null or char_length(about) <= 5000),
  logo_path text,
  favicon_path text,
  hero_image_path text,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color text check (secondary_color is null or secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  font_pair text check (font_pair is null or font_pair ~ '^[a-z0-9-]{2,40}$'),
  -- {phone, whatsapp, email, city, address, mapUrl}
  contact jsonb not null default '{}'::jsonb check (jsonb_typeof(contact) = 'object'),
  -- [{day: 0-6, open: "09:00", close: "18:00", closed: bool}]
  hours jsonb not null default '[]'::jsonb check (jsonb_typeof(hours) = 'array'),
  social_links jsonb not null default '{}'::jsonb check (jsonb_typeof(social_links) = 'object'),
  -- {title, description, ogImagePath}
  seo jsonb not null default '{}'::jsonb check (jsonb_typeof(seo) = 'object'),
  -- public site options: {enquirySuccessMessage, showPreferredDateTime, privacyText}
  options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
select app.add_standard_triggers('public.info_sites');

-- Owner-only settings that must never be public (enquiry notification targets).
create table public.info_site_private (
  tenant_id uuid primary key references public.info_sites (tenant_id) on delete cascade,
  notify_email text check (notify_email is null or (char_length(notify_email) <= 254 and notify_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  notify_email_enabled boolean not null default true,
  notify_whatsapp_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.add_standard_triggers('public.info_site_private');

create or replace function app.info_site_is_public(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.info_sites s
    where s.tenant_id = p_tenant and s.status = 'PUBLISHED' and s.deleted_at is null
  ) and app.tenant_is_open(p_tenant);
$$;

-- Content ------------------------------------------------------------------------------------

create table public.info_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.info_sites (tenant_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  short_description text check (short_description is null or char_length(short_description) <= 300),
  description text check (description is null or char_length(description) <= 10000),
  image_path text,
  price_type text not null default 'ON_REQUEST' check (price_type in ('FIXED', 'STARTING_FROM', 'ON_REQUEST', 'HIDDEN')),
  price numeric(12,2) check (price is null or price >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  duration_minutes int check (duration_minutes is null or duration_minutes between 1 and 1440),
  category text check (category is null or char_length(category) <= 60),
  is_featured boolean not null default false,
  is_active boolean not null default true,
  is_sample boolean not null default false,
  sort_order int not null default 0,
  seo jsonb not null default '{}'::jsonb check (jsonb_typeof(seo) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id),
  check (price_type not in ('FIXED', 'STARTING_FROM') or price is not null)
);
select app.add_standard_triggers('public.info_services');
create unique index info_services_slug_uq on public.info_services (tenant_id, slug) where deleted_at is null;
create index info_services_tenant_order_idx on public.info_services (tenant_id, sort_order);

create table public.info_pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.info_sites (tenant_id) on delete cascade,
  type text not null check (type in ('HOME', 'ABOUT', 'SERVICES', 'CONTACT', 'CUSTOM')),
  title text not null check (char_length(title) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  -- [{id, type, props, order, visible}] validated by zod on save and on render
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  is_published boolean not null default true,
  sort_order int not null default 0,
  seo jsonb not null default '{}'::jsonb check (jsonb_typeof(seo) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
select app.add_standard_triggers('public.info_pages');
create unique index info_pages_slug_uq on public.info_pages (tenant_id, slug) where deleted_at is null;
-- One Home/About/Services/Contact page per site; any number of CUSTOM pages.
create unique index info_pages_system_type_uq on public.info_pages (tenant_id, type) where deleted_at is null and type <> 'CUSTOM';
create index info_pages_tenant_order_idx on public.info_pages (tenant_id, sort_order);

create table public.info_gallery_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.info_sites (tenant_id) on delete cascade,
  image_path text not null check (char_length(image_path) <= 500),
  caption text check (caption is null or char_length(caption) <= 200),
  alt text check (alt is null or char_length(alt) <= 200),
  album text check (album is null or char_length(album) <= 60),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
select app.add_standard_triggers('public.info_gallery_items');
create index info_gallery_items_tenant_order_idx on public.info_gallery_items (tenant_id, sort_order);

create table public.info_team_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.info_sites (tenant_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  role text check (role is null or char_length(role) <= 80),
  bio text check (bio is null or char_length(bio) <= 1000),
  photo_path text,
  is_visible boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
select app.add_standard_triggers('public.info_team_members');
create index info_team_members_tenant_order_idx on public.info_team_members (tenant_id, sort_order);

create table public.info_testimonials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.info_sites (tenant_id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  author_photo_path text,
  rating int not null default 5 check (rating between 1 and 5),
  text text not null check (char_length(text) between 1 and 1000),
  is_visible boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
select app.add_standard_triggers('public.info_testimonials');
create index info_testimonials_tenant_order_idx on public.info_testimonials (tenant_id, sort_order);

create table public.info_faqs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.info_sites (tenant_id) on delete cascade,
  question text not null check (char_length(question) between 1 and 300),
  answer text not null check (char_length(answer) between 1 and 3000),
  is_visible boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
select app.add_standard_triggers('public.info_faqs');
create index info_faqs_tenant_order_idx on public.info_faqs (tenant_id, sort_order);

-- Leads --------------------------------------------------------------------------------------

create table public.info_enquiries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.info_sites (tenant_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  phone text not null check (char_length(phone) between 6 and 20),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  message text check (message is null or char_length(message) <= 5000),
  service_id uuid,
  preferred_date date,
  preferred_time text check (preferred_time is null or char_length(preferred_time) <= 20),
  source text not null default 'CONTACT_FORM' check (source in ('CONTACT_FORM', 'SERVICE_PAGE', 'WHATSAPP_CLICK')),
  status text not null default 'NEW' check (status in ('NEW', 'CONTACTED', 'CONVERTED', 'CLOSED')),
  notes text check (notes is null or char_length(notes) <= 5000),
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id),
  -- A lead can only reference a service of the same site; a hard-deleted service clears the link only.
  foreign key (tenant_id, service_id) references public.info_services (tenant_id, id) on delete set null (service_id)
);
select app.add_standard_triggers('public.info_enquiries');
create index info_enquiries_tenant_created_idx on public.info_enquiries (tenant_id, created_at desc);
create index info_enquiries_tenant_status_idx on public.info_enquiries (tenant_id, status);

-- Only INFORMATIVE tenants can own informative rows (defence in depth beside RLS).
create or replace function app.assert_informative_tenant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not app.is_informative_tenant(new.tenant_id) then
    raise exception 'not an informative website' using errcode = '22023', hint = 'NOT_INFORMATIVE';
  end if;
  return new;
end;
$$;
create trigger trg_info_sites_informative before insert on public.info_sites for each row execute function app.assert_informative_tenant();

-- RLS ----------------------------------------------------------------------------------------

alter table public.info_sites enable row level security;
alter table public.info_site_private enable row level security;
alter table public.info_services enable row level security;
alter table public.info_pages enable row level security;
alter table public.info_gallery_items enable row level security;
alter table public.info_team_members enable row level security;
alter table public.info_testimonials enable row level security;
alter table public.info_faqs enable row level security;
alter table public.info_enquiries enable row level security;

create policy info_sites_public on public.info_sites for select to anon, authenticated
  using (status = 'PUBLISHED' and deleted_at is null and app.tenant_is_open(tenant_id));
create policy info_sites_staff_read on public.info_sites for select to authenticated
  using (app.has_tenant_permission(tenant_id, 'store.read'));
create policy info_sites_staff_insert on public.info_sites for insert to authenticated
  with check (app.has_tenant_permission(tenant_id, 'settings.write'));
create policy info_sites_staff_update on public.info_sites for update to authenticated
  using (app.has_tenant_permission(tenant_id, 'settings.write') or app.has_tenant_permission(tenant_id, 'theme.edit') or app.has_tenant_permission(tenant_id, 'theme.publish'))
  with check (app.has_tenant_permission(tenant_id, 'settings.write') or app.has_tenant_permission(tenant_id, 'theme.edit') or app.has_tenant_permission(tenant_id, 'theme.publish'));

create policy info_site_private_staff_read on public.info_site_private for select to authenticated
  using (app.has_tenant_permission(tenant_id, 'settings.write'));
create policy info_site_private_staff_write on public.info_site_private for all to authenticated
  using (app.has_tenant_permission(tenant_id, 'settings.write'))
  with check (app.has_tenant_permission(tenant_id, 'settings.write'));

create policy info_services_public on public.info_services for select to anon, authenticated
  using (is_active and deleted_at is null and app.info_site_is_public(tenant_id));
create policy info_pages_public on public.info_pages for select to anon, authenticated
  using (is_published and deleted_at is null and app.info_site_is_public(tenant_id));
create policy info_gallery_items_public on public.info_gallery_items for select to anon, authenticated
  using (deleted_at is null and app.info_site_is_public(tenant_id));
create policy info_team_members_public on public.info_team_members for select to anon, authenticated
  using (is_visible and deleted_at is null and app.info_site_is_public(tenant_id));
create policy info_testimonials_public on public.info_testimonials for select to anon, authenticated
  using (is_visible and deleted_at is null and app.info_site_is_public(tenant_id));
create policy info_faqs_public on public.info_faqs for select to anon, authenticated
  using (is_visible and deleted_at is null and app.info_site_is_public(tenant_id));

do $$
declare t text;
begin
  foreach t in array array['info_services', 'info_pages', 'info_gallery_items', 'info_team_members', 'info_testimonials', 'info_faqs'] loop
    execute format('create policy %I on public.%I for select to authenticated using (app.has_tenant_permission(tenant_id, %L))', t || '_staff_read', t, 'store.read');
    execute format('create policy %I on public.%I for insert to authenticated with check (app.has_tenant_permission(tenant_id, %L))', t || '_staff_insert', t, 'content.write');
    execute format('create policy %I on public.%I for update to authenticated using (app.has_tenant_permission(tenant_id, %L)) with check (app.has_tenant_permission(tenant_id, %L))', t || '_staff_update', t, 'content.write', 'content.write');
  end loop;
end;
$$;

create policy info_enquiries_staff_read on public.info_enquiries for select to authenticated
  using (app.has_tenant_permission(tenant_id, 'customers.read'));
create policy info_enquiries_staff_update on public.info_enquiries for update to authenticated
  using (app.has_tenant_permission(tenant_id, 'customers.write'))
  with check (app.has_tenant_permission(tenant_id, 'customers.write'));

-- Grants (explicit; no client DELETE anywhere: soft delete only) -----------------------------

revoke all on public.info_sites, public.info_site_private, public.info_services, public.info_pages,
  public.info_gallery_items, public.info_team_members, public.info_testimonials, public.info_faqs,
  public.info_enquiries from public, anon, authenticated;

grant select on public.info_sites, public.info_services, public.info_pages, public.info_gallery_items,
  public.info_team_members, public.info_testimonials, public.info_faqs to anon;
grant select, insert, update on public.info_sites, public.info_site_private, public.info_services,
  public.info_pages, public.info_gallery_items, public.info_team_members, public.info_testimonials,
  public.info_faqs to authenticated;
grant select on public.info_enquiries to authenticated;
grant update (status, notes, deleted_at) on public.info_enquiries to authenticated;
grant all on public.info_sites, public.info_site_private, public.info_services, public.info_pages,
  public.info_gallery_items, public.info_team_members, public.info_testimonials, public.info_faqs,
  public.info_enquiries to service_role;

revoke all on function app.is_informative_tenant(uuid), app.info_site_is_public(uuid), app.assert_informative_tenant() from public;
grant execute on function app.is_informative_tenant(uuid), app.info_site_is_public(uuid) to anon, authenticated, service_role;
