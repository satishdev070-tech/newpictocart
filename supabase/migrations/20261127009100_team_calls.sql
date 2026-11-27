-- =============================================================================
-- 9100 BOOK A FREE CALL WITH OUR TEAM: platform-run call slots and bookings.
-- Merchants book from the dashboard; visitors book from the marketing site (no account).
-- Super Admin (platform.users.manage) manages slots and bookings.
-- Additive. Requires 3800 (app.require_platform / app.platform_audit).
--
-- Security model:
--   * Slots: everyone may read active future slots (time + seats left, no personal data).
--   * Bookings: the person who booked (user_id) and platform staff may read them.
--   * No direct writes for anon/authenticated. Booking goes through book_team_call()
--     (locks the slot, checks seats, stamps auth.uid() and only a tenant the caller is an
--     active member of). Slot and booking management goes through platform_* functions
--     that check the platform permission and write the audit log.
--
-- Down (manual):
--   drop function if exists public.book_team_call(uuid, text, text, text, text, text, uuid);
--   drop function if exists public.cancel_my_team_call(uuid);
--   drop function if exists public.platform_save_team_call_slot(uuid, timestamptz, integer, integer, boolean, text);
--   drop function if exists public.platform_add_team_call_slots(date, time, time, integer, integer, integer, text);
--   drop function if exists public.platform_delete_team_call_slot(uuid);
--   drop function if exists public.platform_update_team_call_booking(uuid, text, text);
--   drop table if exists public.team_call_bookings;
--   drop table if exists public.team_call_slots;
-- =============================================================================

create table if not exists public.team_call_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 10 and 180),
  capacity integer not null default 1 check (capacity between 1 and 20),
  booked_count integer not null default 0 check (booked_count >= 0),
  active boolean not null default true,
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_call_slots_seats check (booked_count <= capacity)
);
create index if not exists team_call_slots_starts_idx on public.team_call_slots (starts_at) where active;

create table if not exists public.team_call_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.team_call_slots (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  tenant_id uuid references public.tenants (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  topic text check (topic is null or char_length(topic) <= 500),
  source text not null check (source in ('dashboard', 'landing')),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'completed', 'cancelled', 'no_show')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  decided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_call_bookings_slot_idx on public.team_call_bookings (slot_id);
create index if not exists team_call_bookings_user_idx on public.team_call_bookings (user_id, created_at desc);
create index if not exists team_call_bookings_status_idx on public.team_call_bookings (status, created_at desc);
-- One open booking per phone per slot.
create unique index if not exists team_call_bookings_open_once on public.team_call_bookings (slot_id, phone) where status in ('requested', 'confirmed');

drop trigger if exists trg_team_call_slots_updated_at on public.team_call_slots;
create trigger trg_team_call_slots_updated_at before update on public.team_call_slots for each row execute function app.set_updated_at();
drop trigger if exists trg_team_call_bookings_updated_at on public.team_call_bookings;
create trigger trg_team_call_bookings_updated_at before update on public.team_call_bookings for each row execute function app.set_updated_at();

alter table public.team_call_slots enable row level security;
alter table public.team_call_bookings enable row level security;

drop policy if exists team_call_slots_read on public.team_call_slots;
create policy team_call_slots_read on public.team_call_slots for select to anon, authenticated using (
  (active and starts_at > now()) or app.has_platform_permission('platform.users.manage')
);
drop policy if exists team_call_bookings_read on public.team_call_bookings;
create policy team_call_bookings_read on public.team_call_bookings for select to authenticated using (
  user_id = auth.uid() or app.has_platform_permission('platform.users.manage')
);

revoke all on public.team_call_slots, public.team_call_bookings from anon, authenticated;
grant select on public.team_call_slots to anon, authenticated;
grant select on public.team_call_bookings to authenticated;
grant all on public.team_call_slots, public.team_call_bookings to service_role;

-- Book a slot ---------------------------------------------------------------------------
create or replace function public.book_team_call(
  p_slot uuid, p_name text, p_email text, p_phone text, p_topic text, p_source text, p_tenant uuid default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_slot public.team_call_slots%rowtype;
  v_user uuid := auth.uid();
  v_tenant uuid;
  v_id uuid;
  v_name text := left(trim(coalesce(p_name, '')), 120);
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_topic text := nullif(left(trim(coalesce(p_topic, '')), 500), '');
begin
  if p_source not in ('dashboard', 'landing') then raise exception 'invalid source' using errcode = '22023'; end if;
  if p_source = 'dashboard' and v_user is null then raise exception 'sign in to book from the dashboard' using errcode = '42501'; end if;
  if v_name = '' then raise exception 'name required' using errcode = '22023'; end if;
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'invalid phone' using errcode = '22023'; end if;
  -- Only a store the caller really belongs to (never trust a tenant id from the request).
  if p_tenant is not null and v_user is not null and exists (
    select 1 from public.tenant_memberships m where m.tenant_id = p_tenant and m.user_id = v_user and m.status = 'active'
  ) then
    v_tenant := p_tenant;
  end if;
  -- A phone may hold at most 3 open future bookings.
  if (select count(*) from public.team_call_bookings b join public.team_call_slots s on s.id = b.slot_id
      where b.phone = p_phone and b.status in ('requested', 'confirmed') and s.starts_at > now()) >= 3 then
    raise exception 'too many open bookings' using errcode = 'P0001', hint = 'TEAM_CALL_LIMIT';
  end if;

  select * into v_slot from public.team_call_slots where id = p_slot for update;
  if not found or not v_slot.active or v_slot.starts_at <= now() + interval '30 minutes' then
    raise exception 'slot not available' using errcode = 'P0001', hint = 'TEAM_CALL_SLOT_GONE';
  end if;
  if v_slot.booked_count >= v_slot.capacity then
    raise exception 'slot full' using errcode = 'P0001', hint = 'TEAM_CALL_SLOT_FULL';
  end if;

  begin
    insert into public.team_call_bookings (slot_id, user_id, tenant_id, name, email, phone, topic, source)
    values (p_slot, v_user, v_tenant, v_name, v_email, p_phone, v_topic, p_source)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'already booked' using errcode = 'P0001', hint = 'TEAM_CALL_DUPLICATE';
  end;
  update public.team_call_slots set booked_count = booked_count + 1 where id = p_slot;
  return v_id;
end;
$$;

-- The booker cancels their own upcoming booking ----------------------------------------
create or replace function public.cancel_my_team_call(p_booking uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_b public.team_call_bookings%rowtype;
begin
  select * into v_b from public.team_call_bookings where id = p_booking for update;
  if not found or v_b.user_id is distinct from auth.uid() or auth.uid() is null then raise exception 'not permitted' using errcode = '42501'; end if;
  if v_b.status not in ('requested', 'confirmed') then return; end if;
  update public.team_call_bookings set status = 'cancelled' where id = p_booking;
  update public.team_call_slots set booked_count = greatest(booked_count - 1, 0) where id = v_b.slot_id;
end;
$$;

-- Platform: one slot (create when p_id is null, else update) ----------------------------
create or replace function public.platform_save_team_call_slot(
  p_id uuid, p_starts_at timestamptz, p_duration integer, p_capacity integer, p_active boolean, p_note text
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_booked integer;
begin
  perform app.require_platform('platform.users.manage');
  if p_id is null then
    insert into public.team_call_slots (starts_at, duration_minutes, capacity, active, note, created_by)
    values (p_starts_at, p_duration, p_capacity, coalesce(p_active, true), nullif(left(trim(coalesce(p_note, '')), 200), ''), auth.uid())
    returning id into v_id;
    perform app.platform_audit('team_call.slot_created', 'team_call_slot', v_id::text, jsonb_build_object('startsAt', p_starts_at));
  else
    select booked_count into v_booked from public.team_call_slots where id = p_id for update;
    if not found then raise exception 'slot not found' using errcode = 'P0002'; end if;
    if p_capacity < v_booked then raise exception 'capacity below bookings' using errcode = 'P0001', hint = 'TEAM_CALL_CAPACITY'; end if;
    update public.team_call_slots
       set starts_at = p_starts_at, duration_minutes = p_duration, capacity = p_capacity, active = coalesce(p_active, active),
           note = nullif(left(trim(coalesce(p_note, '')), 200), '')
     where id = p_id
    returning id into v_id;
    perform app.platform_audit('team_call.slot_updated', 'team_call_slot', v_id::text, jsonb_build_object('startsAt', p_starts_at, 'active', p_active));
  end if;
  return v_id;
end;
$$;

-- Platform: a day of slots, e.g. 10:00–18:00 every 30 min (times in p_tz) ---------------
create or replace function public.platform_add_team_call_slots(
  p_day date, p_from time, p_to time, p_every integer, p_duration integer, p_capacity integer, p_tz text default 'Asia/Kolkata'
)
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_at timestamp; v_end timestamp; v_count integer := 0;
begin
  perform app.require_platform('platform.users.manage');
  if p_every is null or p_every < 10 or p_every > 240 then raise exception 'invalid interval' using errcode = '22023'; end if;
  if p_to <= p_from then raise exception 'end before start' using errcode = '22023'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then raise exception 'unknown time zone' using errcode = '22023'; end if;
  v_at := p_day + p_from;
  v_end := p_day + p_to;
  while v_at + make_interval(mins => p_duration) <= v_end and v_count < 48 loop
    if (v_at at time zone p_tz) > now()
       and not exists (select 1 from public.team_call_slots s where s.starts_at = (v_at at time zone p_tz)) then
      insert into public.team_call_slots (starts_at, duration_minutes, capacity, created_by)
      values (v_at at time zone p_tz, p_duration, p_capacity, auth.uid());
      v_count := v_count + 1;
    end if;
    v_at := v_at + make_interval(mins => p_every);
  end loop;
  perform app.platform_audit('team_call.slots_added', 'team_call_slot', p_day::text, jsonb_build_object('count', v_count, 'from', p_from, 'to', p_to, 'every', p_every));
  return v_count;
end;
$$;

-- Platform: delete a slot with no bookings (otherwise switch it off) --------------------
create or replace function public.platform_delete_team_call_slot(p_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_platform('platform.users.manage');
  if exists (select 1 from public.team_call_bookings where slot_id = p_id) then
    update public.team_call_slots set active = false where id = p_id;
    perform app.platform_audit('team_call.slot_deactivated', 'team_call_slot', p_id::text);
    return 'deactivated';
  end if;
  delete from public.team_call_slots where id = p_id;
  perform app.platform_audit('team_call.slot_deleted', 'team_call_slot', p_id::text);
  return 'deleted';
end;
$$;

-- Platform: change a booking's status / note (keeps seat counts right) ------------------
create or replace function public.platform_update_team_call_booking(p_id uuid, p_status text, p_admin_note text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_b public.team_call_bookings%rowtype; v_open_before boolean; v_open_after boolean; v_slot public.team_call_slots%rowtype;
begin
  perform app.require_platform('platform.users.manage');
  if p_status not in ('requested', 'confirmed', 'completed', 'cancelled', 'no_show') then raise exception 'invalid status' using errcode = '22023'; end if;
  select * into v_b from public.team_call_bookings where id = p_id for update;
  if not found then raise exception 'booking not found' using errcode = 'P0002'; end if;
  select * into v_slot from public.team_call_slots where id = v_b.slot_id for update;
  -- A seat is held while requested/confirmed/completed/no_show; only cancelled frees it.
  v_open_before := v_b.status <> 'cancelled';
  v_open_after := p_status <> 'cancelled';
  if v_open_after and not v_open_before then
    if v_slot.booked_count >= v_slot.capacity then raise exception 'slot full' using errcode = 'P0001', hint = 'TEAM_CALL_SLOT_FULL'; end if;
    update public.team_call_slots set booked_count = booked_count + 1 where id = v_slot.id;
  elsif v_open_before and not v_open_after then
    update public.team_call_slots set booked_count = greatest(booked_count - 1, 0) where id = v_slot.id;
  end if;
  update public.team_call_bookings
     set status = p_status, admin_note = nullif(left(trim(coalesce(p_admin_note, '')), 1000), ''), decided_by = auth.uid()
   where id = p_id;
  perform app.platform_audit('team_call.booking_updated', 'team_call_booking', p_id::text, jsonb_build_object('from', v_b.status, 'to', p_status), v_b.tenant_id);
end;
$$;

revoke all on function public.book_team_call(uuid, text, text, text, text, text, uuid) from public;
revoke all on function public.cancel_my_team_call(uuid) from public, anon;
revoke all on function public.platform_save_team_call_slot(uuid, timestamptz, integer, integer, boolean, text) from public, anon;
revoke all on function public.platform_add_team_call_slots(date, time, time, integer, integer, integer, text) from public, anon;
revoke all on function public.platform_delete_team_call_slot(uuid) from public, anon;
revoke all on function public.platform_update_team_call_booking(uuid, text, text) from public, anon;
grant execute on function public.book_team_call(uuid, text, text, text, text, text, uuid) to anon, authenticated;
grant execute on function public.cancel_my_team_call(uuid) to authenticated;
grant execute on function public.platform_save_team_call_slot(uuid, timestamptz, integer, integer, boolean, text) to authenticated;
grant execute on function public.platform_add_team_call_slots(date, time, time, integer, integer, integer, text) to authenticated;
grant execute on function public.platform_delete_team_call_slot(uuid) to authenticated;
grant execute on function public.platform_update_team_call_booking(uuid, text, text) to authenticated;
