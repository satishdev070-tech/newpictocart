-- =============================================================================
-- Seller AI suite: product / blog / contact reply / business coach credit costs,
-- ai_generations kind expansion, and debit/refund permissions for catalog + content.
-- Additive. Requires 3400 (ai_credits) and 3900 (ai_economy).
-- =============================================================================

-- 1. Allow new generation kinds in the log -------------------------------------------------
alter table public.ai_generations drop constraint if exists ai_generations_kind_check;
alter table public.ai_generations
  add constraint ai_generations_kind_check check (kind in (
    'caption', 'hashtags', 'ideas', 'plan', 'review_reply', 'message_reply', 'profile',
    'section', 'onboarding_seed',
    'generate_product', 'generate_blog', 'contact_reply', 'business_coach'
  ));

-- 2. Per-action credit costs (defaults align with the old Pictocart suite) -----------------
insert into public.ai_credit_action_costs (kind, label, credits, minutes_saved) values
  ('generate_product', 'Product from image', 8, 25),
  ('generate_blog', 'Blog AI Write', 5, 30),
  ('contact_reply', 'Contact reply draft', 2, 8),
  ('business_coach', 'Business coach', 3, 15)
on conflict (kind) do nothing;

-- 3. Debit / refund: catalog and content writers may spend credits for their AI tools ------
create or replace function public.ai_credit_debit(p_tenant uuid, p_kind text, p_reference uuid default null)
returns table (ledger_id uuid, balance integer)
language plpgsql security definer set search_path = '' as $$
declare v_balance integer; v_id uuid; v_cost integer;
begin
  if not (
    app.has_tenant_permission(p_tenant, 'marketing.write')
    or app.has_tenant_permission(p_tenant, 'catalog.write')
    or app.has_tenant_permission(p_tenant, 'content.write')
    or app.has_tenant_permission(p_tenant, 'analytics.read')
  ) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if p_kind !~ '^[a-z_]{2,60}$' then raise exception 'invalid AI generation kind' using errcode = '22023'; end if;
  v_cost := coalesce((select credits from public.ai_credit_action_costs where kind = p_kind), 1);
  insert into public.ai_credit_accounts(tenant_id, balance) values (p_tenant, 0) on conflict (tenant_id) do nothing;
  select a.balance into v_balance from public.ai_credit_accounts a where a.tenant_id = p_tenant for update;
  if coalesce(v_balance, 0) < v_cost then
    raise exception 'AI credits exhausted' using errcode = 'P0001', hint = 'AI_CREDITS_EXHAUSTED';
  end if;
  v_balance := v_balance - v_cost;
  update public.ai_credit_accounts set balance = v_balance where tenant_id = p_tenant;
  insert into public.ai_credit_ledger(tenant_id, delta, balance_after, kind, reference_id, note, metadata, created_by)
  values (p_tenant, -v_cost, v_balance, 'usage', p_reference, p_kind, jsonb_build_object('kind', p_kind, 'credits', v_cost), auth.uid()) returning id into v_id;
  return query select v_id, v_balance;
end;
$$;

create or replace function public.ai_credit_refund(p_ledger uuid, p_note text default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_usage public.ai_credit_ledger%rowtype; v_balance integer;
begin
  select * into v_usage from public.ai_credit_ledger where id = p_ledger for update;
  if not found then raise exception 'credit usage not found' using errcode = 'P0002'; end if;
  if v_usage.kind <> 'usage' or v_usage.created_by is distinct from auth.uid() or not (
    app.has_tenant_permission(v_usage.tenant_id, 'marketing.write')
    or app.has_tenant_permission(v_usage.tenant_id, 'catalog.write')
    or app.has_tenant_permission(v_usage.tenant_id, 'content.write')
    or app.has_tenant_permission(v_usage.tenant_id, 'analytics.read')
  ) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if exists (select 1 from public.ai_credit_ledger where kind = 'usage_refund' and reference_id = p_ledger) then
    select balance into v_balance from public.ai_credit_accounts where tenant_id = v_usage.tenant_id;
    return coalesce(v_balance, 0);
  end if;
  select balance into v_balance from public.ai_credit_accounts where tenant_id = v_usage.tenant_id for update;
  v_balance := coalesce(v_balance, 0) - v_usage.delta; -- delta is negative: refund the full cost
  update public.ai_credit_accounts set balance = v_balance where tenant_id = v_usage.tenant_id;
  insert into public.ai_credit_ledger(tenant_id, delta, balance_after, kind, reference_id, note, metadata, created_by)
  values (v_usage.tenant_id, -v_usage.delta, v_balance, 'usage_refund', p_ledger, left(coalesce(p_note, 'AI generation failed'), 500), jsonb_build_object('usageLedgerId', p_ledger), auth.uid());
  return v_balance;
end;
$$;

revoke all on function public.ai_credit_debit(uuid, text, uuid), public.ai_credit_refund(uuid, text) from public, anon;
grant execute on function public.ai_credit_debit(uuid, text, uuid), public.ai_credit_refund(uuid, text) to authenticated;
grant execute on function public.ai_credit_debit(uuid, text, uuid), public.ai_credit_refund(uuid, text) to service_role;
