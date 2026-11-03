-- =============================================================================
-- Platform plan coupons (Super Admin): percent-off codes for paid plan checkout.
-- Staff manage via platform.plans.manage (same as /admin/plans). Checkout redeem
-- paths are separate (service role / future RPC); this migration only stores rows.
-- =============================================================================

create table if not exists public.platform_plan_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,30}$'),
  percent_off integer not null check (percent_off between 1 and 100),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  applies_to_plan_codes text[] not null default array['starter', 'growth']::text[],
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
  -- Format of each plan code is enforced in app schemas; CHECK cannot use subqueries.
  check (cardinality(applies_to_plan_codes) between 1 and 20)
);

create index if not exists platform_plan_coupons_active_idx
  on public.platform_plan_coupons (active)
  where active;

create index if not exists platform_plan_coupons_created_at_idx
  on public.platform_plan_coupons (created_at desc);

drop trigger if exists trg_platform_plan_coupons_updated_at on public.platform_plan_coupons;
create trigger trg_platform_plan_coupons_updated_at
  before update on public.platform_plan_coupons
  for each row execute function app.set_updated_at();

alter table public.platform_plan_coupons enable row level security;

drop policy if exists platform_plan_coupons_platform_all on public.platform_plan_coupons;
create policy platform_plan_coupons_platform_all on public.platform_plan_coupons
  for all to authenticated
  using (app.has_platform_permission('platform.plans.manage'))
  with check (app.has_platform_permission('platform.plans.manage'));

revoke all on public.platform_plan_coupons from anon, authenticated;
grant select, insert, update, delete on public.platform_plan_coupons to authenticated;
grant all on public.platform_plan_coupons to service_role;
