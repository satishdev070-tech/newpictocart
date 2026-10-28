-- =============================================================================
-- 4600 PLATFORM AI PAYMENT GATEWAYS: Super Admin stores Razorpay + Cashfree keys
-- for AI credit wallet recharge (platform money, not store checkout). Widens
-- platform_app_credentials; adds provider / provider_order_id on purchase requests;
-- service-role-only complete RPC for webhook auto-approve (same ledger effect as
-- decide_ai_credit_purchase approve). Additive and idempotent.
--
-- Down:
--   delete from public.platform_app_credentials where provider in ('razorpay', 'cashfree');
--   drop function if exists public.complete_ai_credit_purchase_payment(uuid, text);
--   alter table public.ai_credit_purchase_requests drop column if exists provider;
--   alter table public.ai_credit_purchase_requests drop column if exists provider_order_id;
--   then re-create platform_app_credentials_provider_check with the 4300 list.
-- =============================================================================

-- 1. Platform credentials may name Razorpay / Cashfree (AI wallet only) --------------
alter table public.platform_app_credentials drop constraint if exists platform_app_credentials_provider_check;
alter table public.platform_app_credentials add constraint platform_app_credentials_provider_check
  check (provider in (
    'meta', 'pinterest', 'google', 'whatsapp',
    'nvidia', 'gemini', 'groq', 'anthropic',
    'resend', 'unsplash',
    'razorpay', 'cashfree'
  ));

-- 2. Purchase requests remember which platform gateway order was created -------------
alter table public.ai_credit_purchase_requests
  add column if not exists provider text;

alter table public.ai_credit_purchase_requests
  add column if not exists provider_order_id text;

alter table public.ai_credit_purchase_requests drop constraint if exists ai_credit_purchase_requests_provider_check;
alter table public.ai_credit_purchase_requests
  add constraint ai_credit_purchase_requests_provider_check
  check (provider is null or provider in ('razorpay', 'cashfree'));

alter table public.ai_credit_purchase_requests drop constraint if exists ai_credit_purchase_requests_provider_pair_check;
alter table public.ai_credit_purchase_requests
  add constraint ai_credit_purchase_requests_provider_pair_check
  check (
    (provider is null and provider_order_id is null)
    or (provider is not null and provider_order_id is not null and char_length(provider_order_id) between 6 and 80)
  );

create unique index if not exists ai_credit_purchase_requests_provider_order_uidx
  on public.ai_credit_purchase_requests (provider, provider_order_id)
  where provider is not null and provider_order_id is not null;

-- 3. Webhook / system approve (service_role only; mirrors decide_ai_credit_purchase) -
create or replace function public.complete_ai_credit_purchase_payment(
  p_request uuid,
  p_payment_reference text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.ai_credit_purchase_requests%rowtype;
  v_balance integer;
  v_ref text := left(nullif(trim(coalesce(p_payment_reference, '')), ''), 160);
begin
  select * into v_request from public.ai_credit_purchase_requests where id = p_request for update;
  if not found then
    raise exception 'purchase request not found' using errcode = 'P0002';
  end if;
  if v_request.status = 'approved' then
    -- Idempotent: already credited (duplicate webhook).
    select balance into v_balance from public.ai_credit_accounts where tenant_id = v_request.tenant_id;
    return coalesce(v_balance, 0);
  end if;
  if v_request.status <> 'pending' then
    raise exception 'purchase request already decided' using errcode = 'P0001', hint = 'AI_CREDIT_PURCHASE_DECIDED';
  end if;

  update public.ai_credit_purchase_requests
  set
    status = 'approved',
    decided_at = now(),
    decision_note = coalesce(decision_note, 'Auto-approved via payment gateway'),
    payment_reference = coalesce(v_ref, payment_reference)
  where id = p_request;

  insert into public.ai_credit_accounts(tenant_id, balance)
  values (v_request.tenant_id, 0)
  on conflict (tenant_id) do nothing;

  select balance into v_balance from public.ai_credit_accounts where tenant_id = v_request.tenant_id for update;
  v_balance := coalesce(v_balance, 0) + v_request.credits;
  update public.ai_credit_accounts set balance = v_balance where tenant_id = v_request.tenant_id;

  insert into public.ai_credit_ledger(tenant_id, delta, balance_after, kind, reference_id, note, metadata)
  values (
    v_request.tenant_id,
    v_request.credits,
    v_balance,
    'purchase',
    v_request.id,
    left(coalesce('Credit purchase via ' || coalesce(v_request.provider, 'gateway'), 'Credit purchase'), 500),
    jsonb_build_object(
      'pack', v_request.pack,
      'method', v_request.method,
      'amount', v_request.amount,
      'provider', v_request.provider,
      'provider_order_id', v_request.provider_order_id,
      'payment_reference', v_ref
    )
  );
  return v_balance;
end;
$$;

revoke all on function public.complete_ai_credit_purchase_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_ai_credit_purchase_payment(uuid, text) to service_role;

comment on function public.complete_ai_credit_purchase_payment(uuid, text) is
  'Service-role only: approve a pending AI credit purchase after a verified platform Razorpay/Cashfree webhook (same ledger effect as decide_ai_credit_purchase approve).';

comment on column public.ai_credit_purchase_requests.provider is
  'Platform AI-wallet gateway (razorpay|cashfree); null for offline / manual review purchases.';
comment on column public.ai_credit_purchase_requests.provider_order_id is
  'Gateway order id created with platform credentials; used by /api/webhooks/platform/*.';
