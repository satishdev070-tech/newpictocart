-- =============================================================================
-- 6300 PLATFORM PAYU + PLAN ONLINE CHECKOUT
-- Adds PayU to platform_app_credentials and AI purchase provider checks; extends
-- plan_requests with coupon + payment columns; service-role complete RPC so
-- verified /api/webhooks/platform/* can activate a paid plan (same entitlement
-- effect as platform_decide_plan_request approve). Additive and idempotent.
--
-- Down (sketch):
--   drop function if exists public.complete_plan_request_payment(uuid, text);
--   alter table public.plan_requests drop column if exists coupon_code, discount_percent,
--     amount_paise, provider, provider_order_id, paid_at;
--   then re-create provider checks without 'payu'.
-- =============================================================================

-- 1. Platform credentials may name PayU (AI wallet + plan upgrades) -----------------
alter table public.platform_app_credentials drop constraint if exists platform_app_credentials_provider_check;
alter table public.platform_app_credentials add constraint platform_app_credentials_provider_check
  check (provider in (
    'meta', 'pinterest', 'google', 'whatsapp',
    'nvidia', 'gemini', 'groq', 'anthropic',
    'resend', 'unsplash',
    'razorpay', 'cashfree', 'payu'
  ));

-- 2. AI credit purchase requests may use PayU --------------------------------------
alter table public.ai_credit_purchase_requests drop constraint if exists ai_credit_purchase_requests_provider_check;
alter table public.ai_credit_purchase_requests
  add constraint ai_credit_purchase_requests_provider_check
  check (provider is null or provider in ('razorpay', 'cashfree', 'payu'));

comment on column public.ai_credit_purchase_requests.provider is
  'Platform AI-wallet gateway (razorpay|cashfree|payu); null for offline / manual review purchases.';

-- 3. Plan requests: coupon + online payment fields ---------------------------------
alter table public.plan_requests
  add column if not exists coupon_code text;

alter table public.plan_requests
  add column if not exists discount_percent integer;

alter table public.plan_requests
  add column if not exists amount_paise integer;

alter table public.plan_requests
  add column if not exists provider text;

alter table public.plan_requests
  add column if not exists provider_order_id text;

alter table public.plan_requests
  add column if not exists paid_at timestamptz;

alter table public.plan_requests drop constraint if exists plan_requests_coupon_code_check;
alter table public.plan_requests
  add constraint plan_requests_coupon_code_check
  check (coupon_code is null or char_length(coupon_code) between 1 and 40);

alter table public.plan_requests drop constraint if exists plan_requests_discount_percent_check;
alter table public.plan_requests
  add constraint plan_requests_discount_percent_check
  check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100));

alter table public.plan_requests drop constraint if exists plan_requests_amount_paise_check;
alter table public.plan_requests
  add constraint plan_requests_amount_paise_check
  check (amount_paise is null or amount_paise >= 0);

alter table public.plan_requests drop constraint if exists plan_requests_provider_check;
alter table public.plan_requests
  add constraint plan_requests_provider_check
  check (provider is null or provider in ('razorpay', 'cashfree', 'payu'));

alter table public.plan_requests drop constraint if exists plan_requests_provider_pair_check;
alter table public.plan_requests
  add constraint plan_requests_provider_pair_check
  check (
    (provider is null and provider_order_id is null)
    or (provider is not null and provider_order_id is not null and char_length(provider_order_id) between 6 and 80)
  );

create unique index if not exists plan_requests_provider_order_uidx
  on public.plan_requests (provider, provider_order_id)
  where provider is not null and provider_order_id is not null;

comment on column public.plan_requests.coupon_code is
  'Seller-entered platform plan coupon (uppercase); null when none.';
comment on column public.plan_requests.discount_percent is
  'Whole-percent discount from the coupon at request time (0–100).';
comment on column public.plan_requests.amount_paise is
  'Charge amount in integer paise after coupon; null for legacy offline requests.';
comment on column public.plan_requests.provider is
  'Platform gateway for online plan upgrade (razorpay|cashfree|payu); null for offline / ops approve.';
comment on column public.plan_requests.provider_order_id is
  'Gateway order / txn id created with platform credentials; used by /api/webhooks/platform/*.';
comment on column public.plan_requests.paid_at is
  'When online payment was confirmed (webhook complete RPC); null until paid or for offline.';

-- 4. Webhook / system approve plan after verified platform payment -----------------
create or replace function public.complete_plan_request_payment(
  p_request uuid,
  p_payment_reference text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.plan_requests%rowtype;
  v_old_status text;
  v_old_plan uuid;
  v_ref text := left(nullif(trim(coalesce(p_payment_reference, '')), ''), 160);
begin
  select * into r from public.plan_requests where id = p_request for update;
  if not found then
    raise exception 'plan request not found' using errcode = 'P0002';
  end if;
  if r.status = 'approved' then
    -- Idempotent: already activated (duplicate webhook).
    return;
  end if;
  if r.status <> 'pending' then
    raise exception 'plan request already decided' using errcode = 'P0001', hint = 'NOT_PENDING';
  end if;

  update public.plan_requests
  set
    status = 'approved',
    decided_at = now(),
    updated_at = now(),
    paid_at = coalesce(paid_at, now()),
    decision_note = coalesce(
      nullif(trim(coalesce(decision_note, '')), ''),
      left(coalesce('Paid via ' || coalesce(r.provider, 'gateway') || case when v_ref is null then '' else (': ' || v_ref) end, 'Auto-approved via payment gateway'), 500)
    )
  where id = p_request;

  select status, plan_id into v_old_status, v_old_plan from public.tenants where id = r.tenant_id for update;
  update public.tenants
    set plan_id = r.plan_id,
        status = case when status in ('trial', 'suspended') then 'active' else status end,
        status_reason = case when status in ('trial', 'suspended') then null else status_reason end
    where id = r.tenant_id;

  perform app.audit(r.tenant_id, 'plan.request_approved', 'plan_request', p_request::text,
    jsonb_build_object(
      'plan', r.plan_id,
      'from_plan', v_old_plan,
      'from_status', v_old_status,
      'cycle', r.billing_cycle,
      'provider', r.provider,
      'provider_order_id', r.provider_order_id,
      'amount_paise', r.amount_paise,
      'coupon_code', r.coupon_code,
      'payment_reference', v_ref,
      'via', 'platform_gateway'
    ), 'system');
end;
$$;

revoke all on function public.complete_plan_request_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_plan_request_payment(uuid, text) to service_role;

comment on function public.complete_plan_request_payment(uuid, text) is
  'Service-role only: approve a pending plan request after a verified platform Razorpay/Cashfree/PayU webhook (same entitlement effect as platform_decide_plan_request approve).';
