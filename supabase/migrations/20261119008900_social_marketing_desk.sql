-- Social marketing desk (docs/social/SOCIAL_PLAN.md). Additive and idempotent.
-- 1. LinkedIn as a store connection (tenant_integrations) and a platform OAuth app.
-- 2. social_posts: where a post came from, per-network text, background AI state; one auto post
--    per product and one launch post per store.
-- 3. social_automation: per-store auto-post settings (RLS marketing.read / marketing.write).
-- 4. AI credit kind `social_post` and two narrow service-role-only credit functions for automation
--    (they work only while the store switched automation AI on).
--
-- Before this runs the app keeps working: the desk's settings read as defaults, automation is
-- skipped, LinkedIn connect fails with a save error, and AI posts cost 1 credit (unknown kind).
--
-- Down:
--   drop function if exists public.social_ai_credit_debit(uuid, uuid);
--   drop function if exists public.social_ai_credit_refund(uuid, text);
--   drop table if exists public.social_automation;
--   drop index if exists social_posts_auto_product_uidx; drop index if exists social_posts_auto_launch_uidx;
--   drop index if exists social_posts_ai_pending_idx;
--   alter table public.social_posts drop column source, drop column variants, drop column ai_state, drop column ai_note;
--   delete from public.ai_credit_action_costs where kind = 'social_post';
--   re-create the provider / kind checks without 'linkedin' / 'social_post'.

-- 1. LinkedIn ------------------------------------------------------------------------------
alter table public.tenant_integrations drop constraint if exists tenant_integrations_provider_check;
alter table public.tenant_integrations add constraint tenant_integrations_provider_check
  check (provider in ('razorpay', 'cashfree', 'payu', 'shiprocket', 'delhivery', 'ga4', 'google_ads', 'meta_pixel', 'facebook', 'instagram', 'pinterest', 'youtube', 'whatsapp', 'google_business', 'linkedin'));

alter table public.platform_app_credentials drop constraint if exists platform_app_credentials_provider_check;
alter table public.platform_app_credentials add constraint platform_app_credentials_provider_check
  check (provider in (
    'meta', 'pinterest', 'google', 'whatsapp', 'linkedin',
    'nvidia', 'gemini', 'groq', 'anthropic',
    'resend', 'unsplash',
    'razorpay', 'cashfree', 'payu'
  ));

-- 2. social_posts ---------------------------------------------------------------------------
alter table public.social_posts add column if not exists source text not null default 'manual';
alter table public.social_posts add column if not exists variants jsonb not null default '{}'::jsonb;
alter table public.social_posts add column if not exists ai_state text;
alter table public.social_posts add column if not exists ai_note text;
alter table public.social_posts drop constraint if exists social_posts_source_check;
alter table public.social_posts add constraint social_posts_source_check check (source in ('manual', 'ai', 'auto_launch', 'auto_product'));
alter table public.social_posts drop constraint if exists social_posts_ai_state_check;
alter table public.social_posts add constraint social_posts_ai_state_check check (ai_state is null or ai_state in ('pending', 'running', 'done', 'failed', 'skipped'));
alter table public.social_posts drop constraint if exists social_posts_ai_note_check;
alter table public.social_posts add constraint social_posts_ai_note_check check (ai_note is null or char_length(ai_note) <= 300);
alter table public.social_posts drop constraint if exists social_posts_variants_check;
alter table public.social_posts add constraint social_posts_variants_check check (jsonb_typeof(variants) = 'object' and pg_column_size(variants) <= 20000);

create unique index if not exists social_posts_auto_product_uidx on public.social_posts (tenant_id, product_id) where source = 'auto_product' and product_id is not null;
create unique index if not exists social_posts_auto_launch_uidx on public.social_posts (tenant_id) where source = 'auto_launch';
create index if not exists social_posts_ai_pending_idx on public.social_posts (created_at) where ai_state = 'pending';

-- 3. social_automation ----------------------------------------------------------------------
create table if not exists public.social_automation (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  launch_enabled boolean not null default true,
  product_enabled boolean not null default false,
  -- review = create a draft for the seller; auto = schedule it delay_minutes ahead (cancellable).
  mode text not null default 'review' check (mode in ('review', 'auto')),
  platforms text[] not null default '{}' check (platforms <@ array['facebook', 'instagram', 'pinterest', 'google', 'linkedin', 'whatsapp', 'x', 'threads', 'youtube']::text[]),
  use_ai boolean not null default false,
  delay_minutes int not null default 15 check (delay_minutes between 5 and 1440),
  -- Products published before this moment never get automatic posts.
  product_enabled_at timestamptz,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_social_automation_updated_at on public.social_automation;
create trigger trg_social_automation_updated_at before update on public.social_automation for each row execute function app.set_updated_at();
alter table public.social_automation enable row level security;
drop policy if exists social_automation_read on public.social_automation;
create policy social_automation_read on public.social_automation for select to authenticated using (app.has_tenant_permission(tenant_id, 'marketing.read'));
drop policy if exists social_automation_write on public.social_automation;
create policy social_automation_write on public.social_automation for all to authenticated
  using (app.has_tenant_permission(tenant_id, 'marketing.write')) with check (app.has_tenant_permission(tenant_id, 'marketing.write'));
grant select, insert, update, delete on public.social_automation to authenticated;
grant all on public.social_automation to service_role;

-- 4. Credits --------------------------------------------------------------------------------
insert into public.ai_credit_action_costs (kind, label, credits, minutes_saved) values
  ('social_post', 'Social post written by AI', 1, 10)
on conflict (kind) do nothing;

alter table public.ai_generations drop constraint if exists ai_generations_kind_check;
alter table public.ai_generations
  add constraint ai_generations_kind_check check (kind in (
    'caption', 'hashtags', 'ideas', 'plan', 'review_reply', 'message_reply', 'profile',
    'section', 'onboarding_seed',
    'generate_product', 'generate_blog', 'contact_reply', 'business_coach',
    'store_agent', 'store_setup', 'generate_reviews', 'generate_faq',
    'informative_assistant', 'informative_site_build',
    'social_post'
  ));

-- Automation AI runs without a member session (after the response / cron). These debit and
-- refund only `social_post` usage, only for a post of that store, and only while the store has
-- automation AI switched on. service_role only.
create or replace function public.social_ai_credit_debit(p_tenant uuid, p_post uuid)
returns table (ledger_id uuid, balance integer)
language plpgsql security definer set search_path = '' as $$
declare v_balance integer; v_id uuid; v_cost integer;
begin
  if not exists (select 1 from public.social_automation a where a.tenant_id = p_tenant and a.use_ai) then
    raise exception 'automation AI is off' using errcode = '42501';
  end if;
  if not exists (select 1 from public.social_posts p where p.tenant_id = p_tenant and p.id = p_post) then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
  v_cost := coalesce((select credits from public.ai_credit_action_costs where kind = 'social_post'), 1);
  insert into public.ai_credit_accounts(tenant_id, balance) values (p_tenant, 0) on conflict (tenant_id) do nothing;
  select a.balance into v_balance from public.ai_credit_accounts a where a.tenant_id = p_tenant for update;
  if coalesce(v_balance, 0) < v_cost then
    raise exception 'AI credits exhausted' using errcode = 'P0001', hint = 'AI_CREDITS_EXHAUSTED';
  end if;
  v_balance := v_balance - v_cost;
  update public.ai_credit_accounts set balance = v_balance where tenant_id = p_tenant;
  insert into public.ai_credit_ledger(tenant_id, delta, balance_after, kind, reference_id, note, metadata, created_by)
  values (p_tenant, -v_cost, v_balance, 'usage', p_post, 'social_post', jsonb_build_object('kind', 'social_post', 'credits', v_cost, 'automation', true), null)
  returning id into v_id;
  return query select v_id, v_balance;
end;
$$;

create or replace function public.social_ai_credit_refund(p_ledger uuid, p_note text default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_usage public.ai_credit_ledger%rowtype; v_balance integer;
begin
  select * into v_usage from public.ai_credit_ledger where id = p_ledger for update;
  if not found then raise exception 'credit usage not found' using errcode = 'P0002'; end if;
  if v_usage.kind <> 'usage' or v_usage.note is distinct from 'social_post' or v_usage.created_by is not null then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if exists (select 1 from public.ai_credit_ledger where kind = 'usage_refund' and reference_id = p_ledger) then
    select balance into v_balance from public.ai_credit_accounts where tenant_id = v_usage.tenant_id;
    return coalesce(v_balance, 0);
  end if;
  select balance into v_balance from public.ai_credit_accounts where tenant_id = v_usage.tenant_id for update;
  v_balance := coalesce(v_balance, 0) - v_usage.delta;
  update public.ai_credit_accounts set balance = v_balance where tenant_id = v_usage.tenant_id;
  insert into public.ai_credit_ledger(tenant_id, delta, balance_after, kind, reference_id, note, metadata, created_by)
  values (v_usage.tenant_id, -v_usage.delta, v_balance, 'usage_refund', p_ledger, left(coalesce(p_note, 'AI generation failed'), 500), jsonb_build_object('usageLedgerId', p_ledger), null);
  return v_balance;
end;
$$;

revoke all on function public.social_ai_credit_debit(uuid, uuid), public.social_ai_credit_refund(uuid, text) from public, anon, authenticated;
grant execute on function public.social_ai_credit_debit(uuid, uuid), public.social_ai_credit_refund(uuid, text) to service_role;
