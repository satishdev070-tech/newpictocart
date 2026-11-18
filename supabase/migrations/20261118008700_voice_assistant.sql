-- Voice assistant (push-to-talk copilot) — docs/voice-assistant/PLAN.md.
--
-- Sessions, messages and action proposals of the seller voice assistant. Every row belongs to one
-- store (tenant_id) AND one member (user_id): a member only ever sees their own conversations, and
-- only while they are still a member of that store. Writes come from server actions running with
-- the member's own session (ADR-006: publishable key + RLS); the tenant id is always the server-
-- resolved membership, never a client or model value. No raw audio is stored anywhere.
--
-- Retention: app.purge_assistant_history(days) deletes sessions (cascading to messages/actions)
-- idle for longer than `days` (default 90). Audit-relevant facts of applied actions also go to
-- public.audit_logs, which keeps its own retention.

create table public.assistant_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  surface text not null default 'dashboard' check (surface in ('dashboard', 'onboarding')),
  locale text not null default 'en-IN' check (locale in ('en-IN', 'hi-IN', 'hinglish')),
  title text check (char_length(title) <= 120),
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assistant_sessions_owner_idx on public.assistant_sessions (tenant_id, user_id, last_active_at desc);
create index assistant_sessions_idle_idx on public.assistant_sessions (last_active_at);
select app.add_standard_triggers('public.assistant_sessions');

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assistant_sessions (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  locale text not null check (locale in ('en-IN', 'hi-IN', 'hinglish')),
  input_mode text check (input_mode in ('voice', 'text')),
  provider text check (char_length(provider) <= 40),
  model text check (char_length(model) <= 100),
  tokens integer check (tokens >= 0),
  created_at timestamptz not null default now()
);
create index assistant_messages_session_idx on public.assistant_messages (session_id, created_at);
create index assistant_messages_owner_idx on public.assistant_messages (tenant_id, user_id, created_at desc);

create table public.assistant_actions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assistant_sessions (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Allowlisted tools only; the server maps model intents onto these.
  tool text not null check (tool in ('propose_theme_patch')),
  status text not null default 'proposed' check (status in ('proposed', 'applied', 'undone', 'rejected', 'failed')),
  args jsonb not null default '{}'::jsonb check (pg_column_size(args) <= 8192),
  before_value jsonb check (pg_column_size(before_value) <= 8192),
  after_value jsonb check (pg_column_size(after_value) <= 8192),
  error text check (char_length(error) <= 300),
  applied_at timestamptz,
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assistant_actions_session_idx on public.assistant_actions (session_id, created_at);
create index assistant_actions_owner_idx on public.assistant_actions (tenant_id, user_id, created_at desc);
select app.add_standard_triggers('public.assistant_actions');

alter table public.assistant_sessions enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_actions enable row level security;

-- Own rows, in a store the member still belongs to.
create policy assistant_sessions_own_read on public.assistant_sessions for select to authenticated
  using (user_id = (select auth.uid()) and app.is_tenant_member(tenant_id));
create policy assistant_sessions_own_insert on public.assistant_sessions for insert to authenticated
  with check (user_id = (select auth.uid()) and app.is_tenant_member(tenant_id));
create policy assistant_sessions_own_update on public.assistant_sessions for update to authenticated
  using (user_id = (select auth.uid()) and app.is_tenant_member(tenant_id))
  with check (user_id = (select auth.uid()) and app.is_tenant_member(tenant_id));

create policy assistant_messages_own_read on public.assistant_messages for select to authenticated
  using (user_id = (select auth.uid()) and app.is_tenant_member(tenant_id));
-- A message must go into one of the member's own sessions of the same store.
create policy assistant_messages_own_insert on public.assistant_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and app.is_tenant_member(tenant_id)
    and exists (
      select 1 from public.assistant_sessions s
      where s.id = session_id and s.tenant_id = assistant_messages.tenant_id and s.user_id = (select auth.uid())
    )
  );

create policy assistant_actions_own_read on public.assistant_actions for select to authenticated
  using (user_id = (select auth.uid()) and app.is_tenant_member(tenant_id));
create policy assistant_actions_own_insert on public.assistant_actions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and app.is_tenant_member(tenant_id)
    and exists (
      select 1 from public.assistant_sessions s
      where s.id = session_id and s.tenant_id = assistant_actions.tenant_id and s.user_id = (select auth.uid())
    )
  );
-- Applying / undoing a theme patch needs theme.edit in that store, checked again here.
create policy assistant_actions_own_update on public.assistant_actions for update to authenticated
  using (user_id = (select auth.uid()) and app.has_tenant_permission(tenant_id, 'theme.edit'))
  with check (user_id = (select auth.uid()) and app.has_tenant_permission(tenant_id, 'theme.edit'));

-- Least privilege: messages are append-only; actions change status columns only.
revoke all on public.assistant_sessions, public.assistant_messages, public.assistant_actions from anon, authenticated;
grant select, insert on public.assistant_sessions to authenticated;
grant update (locale, title, last_active_at) on public.assistant_sessions to authenticated;
grant select, insert on public.assistant_messages to authenticated;
grant select, insert on public.assistant_actions to authenticated;
grant update (status, before_value, error, applied_at, undone_at) on public.assistant_actions to authenticated;
grant all on public.assistant_sessions, public.assistant_messages, public.assistant_actions to service_role;

-- Retention (run from the cron Worker / manually): delete idle conversations.
create or replace function app.purge_assistant_history(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  if p_days is null or p_days < 7 then
    raise exception 'retention must be at least 7 days';
  end if;
  delete from public.assistant_sessions where last_active_at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function app.purge_assistant_history(integer) from public, anon, authenticated;
grant execute on function app.purge_assistant_history(integer) to service_role;

-- Voice needs fast replies: its own AI route (Admin → AI health), Groq first, Gemini fallback,
-- instead of store_agent's NVIDIA reasoning model (12–30 s+). Default models come from the
-- provider credentials. Admins can re-route it like any other feature.
insert into public.ai_feature_routes (feature_key, primary_provider, primary_model, fallback_provider, fallback_model, enabled)
values ('voice_assistant', 'groq', null, 'gemini', null, true)
on conflict (feature_key) do nothing;
