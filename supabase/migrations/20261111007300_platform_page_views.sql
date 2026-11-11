-- =============================================================================
-- First-party visitor analytics for the platform's own pages (Super Admin → Analytics).
--
-- Each row is one page view on a platform host (marketing site, seller sign-in, /start).
-- No IP address, user id, cookie or query string is stored: a visitor is a random
-- per-tab session id generated in the browser (sessionStorage), so "visitors" means unique
-- sessions. Merchant storefronts and admin pages never send views.
--
-- Writes: only through record_platform_page_view() (validated, security definer), called by
-- the app's /api/analytics/pageview endpoint (rate-limited per IP). Reads: platform staff with
-- platform.settings.manage, via RLS or platform_traffic_report().
--
-- Additive and idempotent. The admin page fails soft until this is applied.
-- =============================================================================

create table if not exists public.platform_page_views (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  day date not null default ((now() at time zone 'Asia/Kolkata')::date),
  session_id uuid not null,
  path text not null check (char_length(path) between 1 and 300 and left(path, 1) = '/'),
  referrer text check (referrer is null or char_length(referrer) <= 300),
  host text not null check (char_length(host) between 1 and 253)
);

create index if not exists platform_page_views_day_idx on public.platform_page_views (day);
create index if not exists platform_page_views_created_at_idx on public.platform_page_views (created_at desc);

alter table public.platform_page_views enable row level security;

drop policy if exists platform_page_views_platform_select on public.platform_page_views;
create policy platform_page_views_platform_select on public.platform_page_views
  for select to authenticated
  using (app.has_platform_permission('platform.settings.manage'));

revoke all on public.platform_page_views from anon, authenticated;
grant select on public.platform_page_views to authenticated;
grant all on public.platform_page_views to service_role;

-- Ingest one view. Inputs are re-validated here; invalid input is ignored (returns false)
-- rather than raising, so a bad beacon never produces noisy errors.
create or replace function public.record_platform_page_view(p_session uuid, p_path text, p_referrer text, p_host text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_path text := nullif(btrim(coalesce(p_path, '')), '');
  v_ref text := nullif(btrim(coalesce(p_referrer, '')), '');
  v_host text := lower(nullif(btrim(coalesce(p_host, '')), ''));
begin
  if p_session is null or v_path is null or v_host is null then return false; end if;
  if left(v_path, 1) <> '/' or char_length(v_path) > 300 or v_path ~ '[\s?#]' then return false; end if;
  if v_host !~ '^[a-z0-9.-]{1,253}$' then return false; end if;
  if v_ref is not null and (char_length(v_ref) > 300 or v_ref !~ '^(https?://|android-app://)') then v_ref := null; end if;
  insert into public.platform_page_views (session_id, path, referrer, host) values (p_session, v_path, v_ref, v_host);
  return true;
end;
$$;

revoke all on function public.record_platform_page_view(uuid, text, text, text) from public;
grant execute on function public.record_platform_page_view(uuid, text, text, text) to anon, authenticated, service_role;

-- Report for one IST date range (inclusive, max 367 days). Runs as the caller, so RLS applies
-- too; the explicit check gives a clear 42501 instead of an empty report for non-staff.
create or replace function public.platform_traffic_report(p_from date, p_to date, p_limit integer default 20)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_result jsonb;
begin
  if not app.has_platform_permission('platform.settings.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid range' using errcode = '22023';
  end if;

  with v as (
    select session_id, path, coalesce(referrer, '(direct)') as referrer, day
    from public.platform_page_views
    where day between p_from and p_to
  )
  select jsonb_build_object(
    'visitors', (select count(distinct session_id) from v),
    'views', (select count(*) from v),
    'visitors_today', (select count(distinct session_id) from public.platform_page_views where day = v_today),
    'views_today', (select count(*) from public.platform_page_views where day = v_today),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'visitors', d.visitors, 'views', d.views) order by d.day)
      from (select day, count(distinct session_id) as visitors, count(*) as views from v group by day) d
    ), '[]'::jsonb),
    'top_pages', coalesce((
      select jsonb_agg(jsonb_build_object('path', t.path, 'views', t.views, 'visitors', t.visitors) order by t.views desc, t.path)
      from (select path, count(*) as views, count(distinct session_id) as visitors from v group by path order by count(*) desc, path limit v_limit) t
    ), '[]'::jsonb),
    'top_referrers', coalesce((
      select jsonb_agg(jsonb_build_object('referrer', t.referrer, 'views', t.views, 'visitors', t.visitors) order by t.views desc, t.referrer)
      from (select referrer, count(*) as views, count(distinct session_id) as visitors from v group by referrer order by count(*) desc, referrer limit v_limit) t
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.platform_traffic_report(date, date, integer) from public;
grant execute on function public.platform_traffic_report(date, date, integer) to authenticated, service_role;
