-- =============================================================================
-- 4500 AI CREDIT ONE-TIME CODES: platform-generated OTC-XXXXXXXXXXXX codes that
-- sellers redeem for AI credits. Only a SHA-256 hash and the last four characters
-- are stored (plaintext shown once on create). Ledger kind `otc_redeem`.
-- Additive. Requires 3400 (ai_credits). Optional: 3800 (app.require_platform /
-- app.platform_audit already exist when partners is applied; this migration uses
-- the same permission helpers as grant_ai_credits).
--
-- Down (manual):
--   drop function if exists public.redeem_ai_credit_code(uuid, text);
--   drop function if exists public.platform_revoke_ai_credit_code(uuid);
--   drop function if exists public.platform_list_ai_credit_codes();
--   drop function if exists public.platform_create_ai_credit_code(integer, text);
--   drop table if exists public.ai_credit_one_time_codes;
--   -- restore ai_credit_ledger_kind_check without otc_redeem if rolling back alone
-- =============================================================================

-- Widen ledger kinds to include OTC redemption.
alter table public.ai_credit_ledger drop constraint if exists ai_credit_ledger_kind_check;
alter table public.ai_credit_ledger
  add constraint ai_credit_ledger_kind_check
  check (kind in (
    'signup_bonus', 'usage', 'usage_refund', 'purchase',
    'manual_grant', 'manual_adjustment', 'otc_redeem'
  ));

create table if not exists public.ai_credit_one_time_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  code_hint text not null check (char_length(code_hint) = 4),
  credits integer not null check (credits > 0 and credits <= 1000000),
  status text not null default 'unused' check (status in ('unused', 'redeemed', 'revoked')),
  redeemed_tenant_id uuid references public.tenants (id) on delete set null,
  redeemed_by_user_id uuid references auth.users (id) on delete set null,
  redeemed_at timestamptz,
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_credit_one_time_codes_created_idx
  on public.ai_credit_one_time_codes (created_at desc);
create index if not exists ai_credit_one_time_codes_status_idx
  on public.ai_credit_one_time_codes (status, created_at desc);

alter table public.ai_credit_one_time_codes enable row level security;

drop policy if exists ai_credit_one_time_codes_platform_select on public.ai_credit_one_time_codes;
create policy ai_credit_one_time_codes_platform_select on public.ai_credit_one_time_codes
  for select to authenticated
  using (app.has_platform_permission('platform.settings.manage'));

revoke all on public.ai_credit_one_time_codes from anon, authenticated;
grant select on public.ai_credit_one_time_codes to authenticated;
grant all on public.ai_credit_one_time_codes to service_role;

-- Platform: create (returns plaintext once) -------------------------------------------------
create or replace function public.platform_create_ai_credit_code(p_credits integer, p_note text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not app.has_platform_permission('platform.settings.manage') then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if p_credits is null or p_credits <= 0 or p_credits > 1000000 then
    raise exception 'invalid credits' using errcode = '22023';
  end if;
  v_code := 'OTC-' || upper(encode(extensions.gen_random_bytes(6), 'hex'));
  insert into public.ai_credit_one_time_codes (code_hash, code_hint, credits, note, created_by)
  values (
    encode(extensions.digest(v_code, 'sha256'), 'hex'),
    right(v_code, 4),
    p_credits,
    left(nullif(trim(coalesce(p_note, '')), ''), 200),
    auth.uid()
  );
  return v_code;
end;
$$;

-- Platform: list ----------------------------------------------------------------------------
create or replace function public.platform_list_ai_credit_codes()
returns table (
  id uuid,
  code_hint text,
  credits integer,
  status text,
  redeemed_tenant_id uuid,
  redeemed_by_user_id uuid,
  redeemed_at timestamptz,
  note text,
  created_by uuid,
  created_at timestamptz,
  tenant_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.has_platform_permission('platform.settings.manage') then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  return query
    select
      c.id,
      c.code_hint,
      c.credits,
      c.status,
      c.redeemed_tenant_id,
      c.redeemed_by_user_id,
      c.redeemed_at,
      c.note,
      c.created_by,
      c.created_at,
      t.name
    from public.ai_credit_one_time_codes c
    left join public.tenants t on t.id = c.redeemed_tenant_id
    order by c.created_at desc
    limit 200;
end;
$$;

-- Platform: revoke --------------------------------------------------------------------------
create or replace function public.platform_revoke_ai_credit_code(p_code uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.has_platform_permission('platform.settings.manage') then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  update public.ai_credit_one_time_codes
    set status = 'revoked'
    where id = p_code and status = 'unused';
  if not found then
    raise exception 'code is not unused' using errcode = 'P0001';
  end if;
end;
$$;

-- Seller: redeem under billing.manage -------------------------------------------------------
create or replace function public.redeem_ai_credit_code(p_tenant uuid, p_code text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.ai_credit_one_time_codes%rowtype;
  v_balance integer;
  v_norm text;
begin
  if not app.has_tenant_permission(p_tenant, 'billing.manage') then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  v_norm := upper(trim(coalesce(p_code, '')));
  select * into v
  from public.ai_credit_one_time_codes
  where code_hash = encode(extensions.digest(v_norm, 'sha256'), 'hex')
  for update;
  if not found or v.status <> 'unused' then
    raise exception 'This code is not valid or was already used.'
      using errcode = 'P0001', hint = 'CODE_INVALID';
  end if;

  update public.ai_credit_one_time_codes
    set status = 'redeemed',
        redeemed_tenant_id = p_tenant,
        redeemed_by_user_id = auth.uid(),
        redeemed_at = now()
    where id = v.id;

  insert into public.ai_credit_accounts (tenant_id, balance)
  values (p_tenant, 0)
  on conflict (tenant_id) do nothing;

  select balance into v_balance
  from public.ai_credit_accounts
  where tenant_id = p_tenant
  for update;

  v_balance := coalesce(v_balance, 0) + v.credits;
  update public.ai_credit_accounts set balance = v_balance where tenant_id = p_tenant;

  insert into public.ai_credit_ledger (
    tenant_id, delta, balance_after, kind, reference_id, note, metadata, created_by
  ) values (
    p_tenant,
    v.credits,
    v_balance,
    'otc_redeem',
    v.id,
    left('One-time code …' || v.code_hint, 500),
    jsonb_build_object('codeHint', v.code_hint, 'credits', v.credits),
    auth.uid()
  );

  return v_balance;
end;
$$;

revoke all on function public.platform_create_ai_credit_code(integer, text) from public, anon;
revoke all on function public.platform_list_ai_credit_codes() from public, anon;
revoke all on function public.platform_revoke_ai_credit_code(uuid) from public, anon;
revoke all on function public.redeem_ai_credit_code(uuid, text) from public, anon;

grant execute on function public.platform_create_ai_credit_code(integer, text) to authenticated;
grant execute on function public.platform_list_ai_credit_codes() to authenticated;
grant execute on function public.platform_revoke_ai_credit_code(uuid) to authenticated;
grant execute on function public.redeem_ai_credit_code(uuid, text) to authenticated;
grant execute on function public.platform_create_ai_credit_code(integer, text) to service_role;
grant execute on function public.platform_list_ai_credit_codes() to service_role;
grant execute on function public.platform_revoke_ai_credit_code(uuid) to service_role;
grant execute on function public.redeem_ai_credit_code(uuid, text) to service_role;

comment on table public.ai_credit_one_time_codes is
  'Platform AI-credit one-time codes. Only SHA-256 hash + last4 stored; plaintext returned once on create.';
comment on function public.platform_create_ai_credit_code(integer, text) is
  'Platform staff: generate OTC-… code; returns plaintext once.';
comment on function public.redeem_ai_credit_code(uuid, text) is
  'Seller billing.manage: redeem OTC into tenant AI credit balance (ledger kind otc_redeem).';
