-- =============================================================================
-- Google Search Console verification (Super Admin → Branding & analytics).
--
-- One row per (domain, method):
--   * html_file — Google's `googleXXXXXXXXXXXXXXXX.html` file, served publicly at
--     `/<filename>` on that domain's apex/www hosts only (never store subdomains).
--   * dns_txt   — the `google-site-verification=…` TXT value the admin adds in
--     Cloudflare DNS by hand. We only look it up (DNS-over-HTTPS); never edit DNS.
--
-- Workers have no filesystem, so the file lives here. Staff manage rows with
-- platform.settings.manage (super_admin only). Anonymous visitors (Google's crawler)
-- read nothing from the table directly: public.gsc_verification_file() returns only
-- the content of an ACTIVE html_file row whose filename matches exactly.
--
-- Additive and idempotent. The app fails soft (feature shows "not set up") until applied.
-- =============================================================================

create table if not exists public.platform_search_console_verifications (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain in ('production', 'staging')),
  method text not null check (method in ('html_file', 'dns_txt')),
  filename text check (filename is null or filename ~ '^google[0-9a-f]{16}\.html$'),
  content text check (content is null or char_length(content) <= 10240),
  dns_value text check (dns_value is null or dns_value ~ '^google-site-verification=[A-Za-z0-9_-]{10,100}$'),
  active boolean not null default true,
  uploaded_by uuid references auth.users (id) on delete set null,
  last_delivery_check_at timestamptz,
  last_delivery_status text check (last_delivery_status is null or last_delivery_status in ('ok', 'failed')),
  last_delivery_error text check (last_delivery_error is null or char_length(last_delivery_error) <= 500),
  last_dns_check_at timestamptz,
  last_dns_status text check (last_dns_status is null or last_dns_status in ('found', 'not_found', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain, method),
  -- An html_file row always carries a valid file; a dns_txt row always carries a value.
  check (method <> 'html_file' or (filename is not null and content is not null and content = 'google-site-verification: ' || filename || case when right(content, 1) = E'\n' then E'\n' else '' end)),
  check (method <> 'dns_txt' or dns_value is not null)
);

drop trigger if exists trg_platform_search_console_verifications_updated_at on public.platform_search_console_verifications;
create trigger trg_platform_search_console_verifications_updated_at
  before update on public.platform_search_console_verifications
  for each row execute function app.set_updated_at();

alter table public.platform_search_console_verifications enable row level security;

drop policy if exists platform_search_console_verifications_platform_all on public.platform_search_console_verifications;
create policy platform_search_console_verifications_platform_all on public.platform_search_console_verifications
  for all to authenticated
  using (app.has_platform_permission('platform.settings.manage'))
  with check (app.has_platform_permission('platform.settings.manage'));

revoke all on public.platform_search_console_verifications from anon, authenticated;
grant select, insert, update, delete on public.platform_search_console_verifications to authenticated;
grant all on public.platform_search_console_verifications to service_role;

-- Public delivery: exact filename match on an active row of the given domain. The host →
-- domain decision is made by the app from the proxy-verified host, never by the caller here.
create or replace function public.gsc_verification_file(p_domain text, p_filename text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select v.content
  from public.platform_search_console_verifications v
  where v.domain = p_domain
    and v.method = 'html_file'
    and v.active
    and p_filename ~ '^google[0-9a-f]{16}\.html$'
    and v.filename = p_filename
  limit 1
$$;

revoke all on function public.gsc_verification_file(text, text) from public;
grant execute on function public.gsc_verification_file(text, text) to anon, authenticated, service_role;
