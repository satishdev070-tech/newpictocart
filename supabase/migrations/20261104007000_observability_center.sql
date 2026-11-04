-- =============================================================================
-- Observability center (MVP): request events, endpoint metrics, error groups,
-- alert rules/events, incidents, settings.
--
-- App reads/writes via the Supabase admin (service_role) client after
-- requirePlatform(platform.observability.read|manage). RLS is enabled with NO
-- policies for anon/authenticated (deny all); service_role bypasses RLS.
-- Spans live as jsonb on request_events for MVP (no child span table).
-- =============================================================================

-- 1. Platform permissions (mirrors src/lib/permissions/matrix.ts) --------------
insert into public.platform_role_permissions (role, permission) values
  ('super_admin','platform.observability.read'),
  ('super_admin','platform.observability.manage')
on conflict do nothing;

-- 2. Request events ------------------------------------------------------------
create table public.observability_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null check (char_length(request_id) between 1 and 128),
  trace_id text not null check (char_length(trace_id) between 1 and 128),
  timestamp timestamptz not null default now(),
  environment text not null default 'production' check (char_length(environment) between 1 and 40),
  service text not null default 'web' check (char_length(service) between 1 and 40),
  route_template text not null check (char_length(route_template) between 1 and 300),
  method text not null default 'GET' check (char_length(method) between 1 and 16),
  status integer not null check (status between 100 and 599),
  duration_ms integer not null check (duration_ms >= 0),
  tenant_id uuid references public.tenants (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  error_fingerprint text check (error_fingerprint is null or char_length(error_fingerprint) <= 128),
  error_message text check (error_message is null or char_length(error_message) <= 500),
  spans jsonb not null default '[]'::jsonb check (jsonb_typeof(spans) = 'array'),
  attrs jsonb not null default '{}'::jsonb check (jsonb_typeof(attrs) = 'object')
);

create index observability_request_events_timestamp_idx
  on public.observability_request_events (timestamp desc);
create index observability_request_events_route_timestamp_idx
  on public.observability_request_events (route_template, timestamp desc);
create index observability_request_events_error_fingerprint_idx
  on public.observability_request_events (error_fingerprint)
  where error_fingerprint is not null;

comment on table public.observability_request_events is
  'Sampled HTTP/request telemetry. App reads via admin client after requirePlatform(platform.observability.read). RLS deny-all for anon/authenticated; service_role bypasses.';

-- 3. Endpoint metrics (1-minute buckets) ---------------------------------------
-- latency_bucket_counts aligns with TS LATENCY_BUCKET_MS
-- (50,100,200,300,500,800,1000,2000,5000,10000,+Inf) — 11 entries.
create table public.observability_endpoint_metrics (
  id uuid primary key default gen_random_uuid(),
  time_bucket timestamptz not null,
  environment text not null check (char_length(environment) between 1 and 40),
  service text not null check (char_length(service) between 1 and 40),
  route_template text not null check (char_length(route_template) between 1 and 300),
  method text not null check (char_length(method) between 1 and 16),
  request_count bigint not null default 0 check (request_count >= 0),
  error_count bigint not null default 0 check (error_count >= 0),
  slow_count bigint not null default 0 check (slow_count >= 0),
  latency_sum_ms bigint not null default 0 check (latency_sum_ms >= 0),
  latency_bucket_counts bigint[] not null
    check (cardinality(latency_bucket_counts) = 11),
  updated_at timestamptz not null default now(),
  unique (time_bucket, environment, service, route_template, method)
);

create index observability_endpoint_metrics_bucket_idx
  on public.observability_endpoint_metrics (time_bucket desc);
create index observability_endpoint_metrics_route_bucket_idx
  on public.observability_endpoint_metrics (route_template, time_bucket desc);

comment on table public.observability_endpoint_metrics is
  'Per-route latency/error rollups. App reads via admin client after requirePlatform. RLS deny-all for anon/authenticated.';

-- Merge helper: element-wise sum of two bigint[] of equal length.
create or replace function app.observability_add_buckets(a bigint[], b bigint[])
returns bigint[]
language sql
immutable
set search_path = ''
as $$
  select case
    when a is null then b
    when b is null then a
    else (
      select array_agg(coalesce(x.val, 0) + coalesce(y.val, 0) order by coalesce(x.ord, y.ord))
      from unnest(a) with ordinality as x(val, ord)
      full outer join unnest(b) with ordinality as y(val, ord) using (ord)
    )
  end;
$$;

-- Upsert batch from the Node ingest path (jsonb array of metric rows).
create or replace function public.observability_upsert_endpoint_metrics(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  n integer := 0;
  buckets bigint[];
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return 0;
  end if;
  for r in select value from jsonb_array_elements(p_rows)
  loop
    buckets := array(select jsonb_array_elements_text(coalesce(r->'latency_bucket_counts', '[]'::jsonb))::bigint);
    if cardinality(buckets) <> 11 then
      -- pad / trim to 11 so the check constraint passes
      buckets := (
        select array_agg(coalesce(buckets[i], 0) order by i)
        from generate_series(1, 11) as g(i)
      );
    end if;
    insert into public.observability_endpoint_metrics as m (
      time_bucket, environment, service, route_template, method,
      request_count, error_count, slow_count, latency_sum_ms, latency_bucket_counts, updated_at
    ) values (
      (r->>'time_bucket')::timestamptz,
      coalesce(r->>'environment', 'production'),
      coalesce(r->>'service', 'web'),
      r->>'route_template',
      coalesce(r->>'method', 'GET'),
      coalesce((r->>'request_count')::bigint, 0),
      coalesce((r->>'error_count')::bigint, 0),
      coalesce((r->>'slow_count')::bigint, 0),
      coalesce((r->>'latency_sum_ms')::bigint, 0),
      buckets,
      now()
    )
    on conflict (time_bucket, environment, service, route_template, method) do update set
      request_count = m.request_count + excluded.request_count,
      error_count = m.error_count + excluded.error_count,
      slow_count = m.slow_count + excluded.slow_count,
      latency_sum_ms = m.latency_sum_ms + excluded.latency_sum_ms,
      latency_bucket_counts = app.observability_add_buckets(m.latency_bucket_counts, excluded.latency_bucket_counts),
      updated_at = now();
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.observability_upsert_endpoint_metrics(jsonb) from public, anon, authenticated;
grant execute on function public.observability_upsert_endpoint_metrics(jsonb) to service_role;

-- 4. Error groups --------------------------------------------------------------
create table public.observability_error_groups (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique check (char_length(fingerprint) between 1 and 128),
  route_template text check (route_template is null or char_length(route_template) <= 300),
  status integer check (status is null or status between 100 and 599),
  message_sample text check (message_sample is null or char_length(message_sample) <= 500),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count bigint not null default 1 check (occurrence_count >= 0),
  attrs jsonb not null default '{}'::jsonb check (jsonb_typeof(attrs) = 'object')
);

create index observability_error_groups_last_seen_idx
  on public.observability_error_groups (last_seen_at desc);

-- 5. Alerts + incidents --------------------------------------------------------
create table public.observability_alert_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  enabled boolean not null default true,
  rule_type text not null check (char_length(rule_type) between 1 and 60),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.observability_incidents (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  title text not null check (char_length(title) between 1 and 200),
  summary text check (summary is null or char_length(summary) <= 1000),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);

create table public.observability_alert_events (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references public.observability_alert_rules (id) on delete set null,
  incident_id uuid references public.observability_incidents (id) on delete set null,
  fired_at timestamptz not null default now(),
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  summary text not null check (char_length(summary) between 1 and 500),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);

create index observability_alert_events_fired_idx
  on public.observability_alert_events (fired_at desc);

-- 6. Settings (key/value) ------------------------------------------------------
create table public.observability_settings (
  key text primary key check (char_length(key) between 1 and 120),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.observability_settings (key, value) values
  ('retention_days', '14'::jsonb),
  ('metrics_retention_days', '90'::jsonb),
  ('sample_rate', '0.1'::jsonb),
  ('slow_ms', '800'::jsonb)
on conflict do nothing;

-- 7. Retention cleanup ---------------------------------------------------------
create or replace function public.observability_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_days integer := 14;
  metrics_days integer := 90;
  deleted_events bigint := 0;
  deleted_metrics bigint := 0;
  v jsonb;
begin
  select s.value into v from public.observability_settings s where s.key = 'retention_days';
  if v is not null and jsonb_typeof(v) = 'number' then event_days := greatest((v::text)::integer, 1); end if;
  select s.value into v from public.observability_settings s where s.key = 'metrics_retention_days';
  if v is not null and jsonb_typeof(v) = 'number' then metrics_days := greatest((v::text)::integer, 1); end if;

  delete from public.observability_request_events
    where timestamp < now() - make_interval(days => event_days);
  get diagnostics deleted_events = row_count;

  delete from public.observability_endpoint_metrics
    where time_bucket < now() - make_interval(days => metrics_days);
  get diagnostics deleted_metrics = row_count;

  -- Drop alert events older than event retention as well.
  delete from public.observability_alert_events
    where fired_at < now() - make_interval(days => event_days);

  return jsonb_build_object(
    'deleted_events', deleted_events,
    'deleted_metrics', deleted_metrics,
    'event_days', event_days,
    'metrics_days', metrics_days
  );
end;
$$;

revoke all on function public.observability_cleanup() from public, anon, authenticated;
grant execute on function public.observability_cleanup() to service_role;

-- 8. RLS: enable, no anon/authenticated policies (deny all) --------------------
alter table public.observability_request_events enable row level security;
alter table public.observability_endpoint_metrics enable row level security;
alter table public.observability_error_groups enable row level security;
alter table public.observability_alert_rules enable row level security;
alter table public.observability_alert_events enable row level security;
alter table public.observability_incidents enable row level security;
alter table public.observability_settings enable row level security;

revoke all on public.observability_request_events from anon, authenticated;
revoke all on public.observability_endpoint_metrics from anon, authenticated;
revoke all on public.observability_error_groups from anon, authenticated;
revoke all on public.observability_alert_rules from anon, authenticated;
revoke all on public.observability_alert_events from anon, authenticated;
revoke all on public.observability_incidents from anon, authenticated;
revoke all on public.observability_settings from anon, authenticated;

grant all on public.observability_request_events to service_role;
grant all on public.observability_endpoint_metrics to service_role;
grant all on public.observability_error_groups to service_role;
grant all on public.observability_alert_rules to service_role;
grant all on public.observability_alert_events to service_role;
grant all on public.observability_incidents to service_role;
grant all on public.observability_settings to service_role;
