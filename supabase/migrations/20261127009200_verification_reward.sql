-- =============================================================================
-- 9200 VERIFICATION REWARD: WhatsApp phone verification for merchants and a one-time
-- 250 AI credit bonus when both the email (auth.users.email_confirmed_at) and the
-- WhatsApp number (profiles.phone_verified_at) are verified.
-- Additive. Requires 3400 (ai_credits) and 4500 (ledger kind check incl. otc_redeem).
--
-- Security model:
--   * profiles.phone_verified_at can only be set by SECURITY DEFINER code (a trigger
--     resets it for API roles; changing the phone clears it).
--   * Codes: only a SHA-256 hash is stored. svc_start_phone_verification is service_role
--     only (the app server calls it after verifying the user, then sends the code on
--     WhatsApp) so nobody can obtain a code without receiving the message.
--   * verify_phone_code: the signed-in user only, 10-minute codes, 5 attempts.
--   * claim_verification_bonus: the store owner only; once per person (verification_rewards
--     primary key), once per WhatsApp number (unique), once per store (ledger index).
--
-- Down (manual):
--   drop function if exists public.claim_verification_bonus(uuid);
--   drop function if exists public.verify_phone_code(text, text);
--   drop function if exists public.svc_start_phone_verification(uuid, text);
--   drop table if exists public.verification_rewards;
--   drop table if exists public.phone_verifications;
--   drop trigger if exists trg_profiles_phone_verified on public.profiles;
--   drop function if exists app.guard_profile_phone_verified();
--   alter table public.profiles drop column if exists phone_verified_at;
--   -- restore ai_credit_ledger_kind_check from 20261028004500 (without verification_bonus)
-- =============================================================================

-- 1. Verified phone on the profile --------------------------------------------------------
alter table public.profiles add column if not exists phone_verified_at timestamptz;

create or replace function app.guard_profile_phone_verified()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- API roles (the user's own session) can never mark a phone verified.
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.phone_verified_at := null;
    elsif new.phone is distinct from old.phone then
      new.phone_verified_at := null;
    else
      new.phone_verified_at := old.phone_verified_at;
    end if;
  elsif tg_op = 'UPDATE' and new.phone is distinct from old.phone and new.phone_verified_at is not distinct from old.phone_verified_at then
    -- Trusted code changed the number without verifying it: the old verification no longer applies.
    new.phone_verified_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_profiles_phone_verified on public.profiles;
create trigger trg_profiles_phone_verified before insert or update on public.profiles
for each row execute function app.guard_profile_phone_verified();

-- 2. One-time codes -------------------------------------------------------------------------
create table if not exists public.phone_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  attempts integer not null default 0 check (attempts between 0 and 10),
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists phone_verifications_user_idx on public.phone_verifications (user_id, created_at desc);
alter table public.phone_verifications enable row level security;
-- No policies: only the functions below (and service_role) touch this table.
revoke all on public.phone_verifications from anon, authenticated;
grant all on public.phone_verifications to service_role;

create or replace function public.svc_start_phone_verification(p_user uuid, p_phone text)
returns text
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid(); v_code text;
begin
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then raise exception 'unknown user' using errcode = '22023'; end if;
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'invalid phone' using errcode = '22023'; end if;
  if (select count(*) from public.phone_verifications where user_id = p_user and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too many codes' using errcode = 'P0001', hint = 'PHONE_CODE_LIMIT';
  end if;
  -- Older unused codes stop working.
  update public.phone_verifications set expires_at = least(expires_at, now())
   where user_id = p_user and verified_at is null and expires_at > now();
  v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  insert into public.phone_verifications (id, user_id, phone, code_hash, expires_at)
  values (v_id, p_user, p_phone, encode(extensions.digest(v_id::text || ':' || v_code, 'sha256'), 'hex'), now() + interval '10 minutes');
  return v_code;
end;
$$;

-- Returns 'verified' | 'wrong' | 'expired' | 'locked' | 'none' (never raises on a wrong
-- code, so the attempt counter is kept).
create or replace function public.verify_phone_code(p_phone text, p_code text)
returns text
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_row public.phone_verifications%rowtype;
begin
  if v_user is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into v_row from public.phone_verifications
   where user_id = v_user and phone = p_phone and verified_at is null
   order by created_at desc limit 1 for update;
  if not found then return 'none'; end if;
  if v_row.expires_at <= now() then return 'expired'; end if;
  if v_row.attempts >= 5 then return 'locked'; end if;
  if coalesce(p_code, '') !~ '^[0-9]{6}$'
     or encode(extensions.digest(v_row.id::text || ':' || p_code, 'sha256'), 'hex') <> v_row.code_hash then
    update public.phone_verifications set attempts = attempts + 1 where id = v_row.id;
    return case when v_row.attempts + 1 >= 5 then 'locked' else 'wrong' end;
  end if;
  update public.phone_verifications set verified_at = now() where id = v_row.id;
  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;
  update public.profiles set phone = p_phone, phone_verified_at = now() where id = v_user;
  return 'verified';
end;
$$;

-- 3. Reward ---------------------------------------------------------------------------------
alter table public.ai_credit_ledger drop constraint if exists ai_credit_ledger_kind_check;
alter table public.ai_credit_ledger
  add constraint ai_credit_ledger_kind_check
  check (kind in (
    'signup_bonus', 'usage', 'usage_refund', 'purchase',
    'manual_grant', 'manual_adjustment', 'otc_redeem', 'verification_bonus'
  ));
create unique index if not exists ai_credit_ledger_verification_bonus_once on public.ai_credit_ledger (tenant_id) where kind = 'verification_bonus';

create table if not exists public.verification_rewards (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete set null,
  phone text not null unique,
  credits integer not null check (credits > 0),
  ledger_id uuid references public.ai_credit_ledger (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.verification_rewards enable row level security;
drop policy if exists verification_rewards_read on public.verification_rewards;
create policy verification_rewards_read on public.verification_rewards for select to authenticated using (
  user_id = auth.uid() or app.has_platform_permission('platform.usage.read')
);
revoke all on public.verification_rewards from anon, authenticated;
grant select on public.verification_rewards to authenticated;
grant all on public.verification_rewards to service_role;

-- Returns status: 'claimed' | 'already_claimed' | 'email_missing' | 'phone_missing' |
-- 'both_missing' | 'phone_used' | 'not_owner', with the credits and new balance when claimed.
create or replace function public.claim_verification_bonus(p_tenant uuid)
returns table (status text, credits integer, balance integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_email_ok boolean;
  v_phone text;
  v_phone_ok boolean;
  v_balance integer;
  v_ledger uuid;
  c_credits constant integer := 250;
begin
  if v_user is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.tenant_memberships m where m.tenant_id = p_tenant and m.user_id = v_user and m.role = 'owner' and m.status = 'active'
  ) then
    return query select 'not_owner'::text, 0, null::integer; return;
  end if;
  if exists (select 1 from public.verification_rewards r where r.user_id = v_user) then
    return query select 'already_claimed'::text, 0, null::integer; return;
  end if;
  select u.email_confirmed_at is not null into v_email_ok from auth.users u where u.id = v_user;
  select p.phone, p.phone is not null and p.phone_verified_at is not null into v_phone, v_phone_ok from public.profiles p where p.id = v_user;
  v_email_ok := coalesce(v_email_ok, false);
  v_phone_ok := coalesce(v_phone_ok, false);
  if not v_email_ok and not v_phone_ok then return query select 'both_missing'::text, 0, null::integer; return; end if;
  if not v_email_ok then return query select 'email_missing'::text, 0, null::integer; return; end if;
  if not v_phone_ok then return query select 'phone_missing'::text, 0, null::integer; return; end if;
  if exists (select 1 from public.verification_rewards r where r.phone = v_phone) then
    return query select 'phone_used'::text, 0, null::integer; return;
  end if;
  if exists (select 1 from public.ai_credit_ledger l where l.tenant_id = p_tenant and l.kind = 'verification_bonus') then
    return query select 'already_claimed'::text, 0, null::integer; return;
  end if;

  insert into public.ai_credit_accounts (tenant_id, balance) values (p_tenant, 0) on conflict (tenant_id) do nothing;
  select a.balance into v_balance from public.ai_credit_accounts a where a.tenant_id = p_tenant for update;
  v_balance := coalesce(v_balance, 0) + c_credits;
  update public.ai_credit_accounts set balance = v_balance where tenant_id = p_tenant;
  insert into public.ai_credit_ledger (tenant_id, delta, balance_after, kind, note, metadata, created_by)
  values (p_tenant, c_credits, v_balance, 'verification_bonus', 'Verified email and WhatsApp', jsonb_build_object('userId', v_user), v_user)
  returning id into v_ledger;
  insert into public.verification_rewards (user_id, tenant_id, phone, credits, ledger_id)
  values (v_user, p_tenant, v_phone, c_credits, v_ledger);
  return query select 'claimed'::text, c_credits, v_balance;
exception when unique_violation then
  -- A concurrent claim won the race: nothing was credited twice.
  return query select 'already_claimed'::text, 0, null::integer;
end;
$$;

revoke all on function public.svc_start_phone_verification(uuid, text) from public, anon, authenticated;
grant execute on function public.svc_start_phone_verification(uuid, text) to service_role;
revoke all on function public.verify_phone_code(text, text) from public, anon;
grant execute on function public.verify_phone_code(text, text) to authenticated;
revoke all on function public.claim_verification_bonus(uuid) from public, anon;
grant execute on function public.claim_verification_bonus(uuid) to authenticated;
