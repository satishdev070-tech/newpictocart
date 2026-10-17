-- =============================================================================
-- 3000 IN-APP NOTIFICATIONS
-- The bell in the seller dashboard and the super admin console. One row per RECIPIENT (fan-out at
-- write time), so RLS is simply "my rows", read state is a column and Realtime can filter by user.
--
-- Producers are AFTER triggers on the tables where the events already happen (orders, returns,
-- inventory, reviews, customers, carts, domains, plan requests, AI usage, tenants, stores,
-- profiles). That catches every code path (storefront RPCs, payment webhooks, dashboard actions,
-- admin tools) without the secret-key client. Each producer is wrapped so a notification failure can
-- never roll back the business write. Time-based reminders (trial ending) and retention run from
-- public.notifications_run_reminders(), called by the notifications cron (service role only).
--
-- Recipients: tenant events go to active members whose role (system or custom) grants the event's
-- permission, platform events to active platform staff whose role grants the platform permission.
-- The user who caused the event (auth.uid()) is skipped, and users can mute types per user.
--
-- Down: drop function public.notifications_run_reminders(); drop function public.notify_platform_event(text, text, text, text, text, jsonb, text);
--       drop trigger ... (see section 4); drop function app.notify_tenant(...), app.notify_platform(...);
--       drop table public.notification_preferences; drop table public.notifications;
-- =============================================================================

-- 1. Tables --------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null check (scope in ('tenant', 'platform')),
  tenant_id uuid references public.tenants (id) on delete cascade,
  type text not null check (type ~ '^[a-z_]+\.[a-z_]+$' and char_length(type) <= 60),
  title text not null check (char_length(title) between 1 and 200),
  body text check (char_length(body) <= 500),
  -- In-app path only (no open redirects): /dashboard/... or /admin/...
  link text check (link is null or (char_length(link) <= 500 and link ~ '^/(dashboard|admin)(/|\?|$)')),
  data jsonb not null default '{}'::jsonb,
  dedupe_key text check (char_length(dedupe_key) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check ((scope = 'tenant') = (tenant_id is not null))
);
-- One row per recipient per event; producers insert with ON CONFLICT DO NOTHING.
create unique index if not exists notifications_user_dedupe on public.notifications (user_id, dedupe_key);
create index if not exists notifications_feed_idx on public.notifications (user_id, scope, tenant_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id, scope, tenant_id) where read_at is null;
create index if not exists notifications_tenant_idx on public.notifications (tenant_id, created_at desc) where tenant_id is not null;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Notification types this user does not want in the bell (e.g. 'customer.new').
  muted_types text[] not null default '{}' check (cardinality(muted_types) <= 100),
  updated_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

-- Own rows only, and only while the user still belongs to the store / platform staff.
drop policy if exists notifications_own_select on public.notifications;
create policy notifications_own_select on public.notifications for select to authenticated using (
  user_id = (select auth.uid())
  and case when tenant_id is null then app.is_platform_member() else app.is_tenant_member(tenant_id) end
);
drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Clients can read their rows and set read_at; nothing else. Inserts come from the producers below.
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
revoke all on public.notification_preferences from anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;

-- Realtime (Supabase only; the local test database has no publication). Realtime applies RLS.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$$;

-- 2. Fan-out helpers (app schema: not callable through PostgREST) ---------------
create or replace function app.notify_tenant(
  p_tenant uuid, p_perm text, p_type text, p_title text, p_body text, p_link text, p_data jsonb, p_dedupe text
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_count int;
begin
  insert into public.notifications (user_id, scope, tenant_id, type, title, body, link, data, dedupe_key)
  select m.user_id, 'tenant', p_tenant, p_type, left(p_title, 200), left(p_body, 500), p_link, coalesce(p_data, '{}'::jsonb), p_dedupe
  from public.tenant_memberships m
  where m.tenant_id = p_tenant
    and m.status = 'active'
    and m.user_id is distinct from (select auth.uid())
    and (
      (m.custom_role_id is null and exists (select 1 from public.role_permissions rp where rp.role = m.role and rp.permission = p_perm))
      or (m.custom_role_id is not null and exists (select 1 from public.tenant_custom_roles cr where cr.id = m.custom_role_id and p_perm = any (cr.permissions)))
    )
    and not exists (select 1 from public.notification_preferences np where np.user_id = m.user_id and p_type = any (np.muted_types))
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function app.notify_platform(
  p_perm text, p_type text, p_title text, p_body text, p_link text, p_data jsonb, p_dedupe text
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_count int;
begin
  insert into public.notifications (user_id, scope, tenant_id, type, title, body, link, data, dedupe_key)
  select pm.user_id, 'platform', null, p_type, left(p_title, 200), left(p_body, 500), p_link, coalesce(p_data, '{}'::jsonb), p_dedupe
  from public.platform_memberships pm
  where pm.status = 'active'
    and pm.user_id is distinct from (select auth.uid())
    and exists (select 1 from public.platform_role_permissions prp where prp.role = pm.role and prp.permission = p_perm)
    and not exists (select 1 from public.notification_preferences np where np.user_id = pm.user_id and p_type = any (np.muted_types))
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function app.notify_tenant(uuid, text, text, text, text, text, jsonb, text), app.notify_platform(text, text, text, text, text, jsonb, text) from public;

-- "₹1,234" / "₹1,234.50" (Indian grouping is done in the UI; this is a short body string).
create or replace function app.notify_money(p numeric)
returns text
language sql
immutable
set search_path = ''
as $$ select '₹' || replace(to_char(coalesce(p, 0), 'FM999999999990.00'), '.00', '') $$;

-- 3. Producers -------------------------------------------------------------------

-- Orders: new (COD at insert, online once paid), payment received/failed, cancelled, returned/RTO.
create or replace function app.notify_on_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text;
  v_link text := '/dashboard/orders/' || new.id;
  v_data jsonb := jsonb_build_object('orderId', new.id, 'orderNumber', new.order_number, 'amountMinor', (new.grand_total * 100)::bigint);
begin
  begin
    select coalesce(s.order_prefix, '#') || new.order_number into v_label from public.stores s where s.tenant_id = new.tenant_id;
    v_label := coalesce(v_label, '#' || new.order_number);

    if tg_op = 'INSERT' then
      if new.payment_method = 'cod' then
        perform app.notify_tenant(new.tenant_id, 'orders.read', 'order.new', 'New order ' || v_label,
          app.notify_money(new.grand_total) || ' · Cash on delivery', v_link, v_data, 'order:' || new.id || ':new');
      end if;
      return new;
    end if;

    if new.payment_status is distinct from old.payment_status then
      if new.payment_status = 'paid' and new.payment_method = 'online' and old.payment_status = 'pending' then
        perform app.notify_tenant(new.tenant_id, 'orders.read', 'order.new', 'New order ' || v_label,
          app.notify_money(new.grand_total) || ' · Paid online', v_link, v_data, 'order:' || new.id || ':new');
      elsif new.payment_status = 'paid' then
        perform app.notify_tenant(new.tenant_id, 'orders.read', 'payment.received', 'Payment received for ' || v_label,
          app.notify_money(new.grand_total) || case when old.payment_status = 'cod_pending' then ' collected on delivery' else ' received' end,
          v_link, v_data, 'order:' || new.id || ':paid');
      elsif new.payment_status = 'failed' then
        perform app.notify_tenant(new.tenant_id, 'orders.read', 'payment.failed', 'Payment failed for ' || v_label,
          'The shopper''s online payment of ' || app.notify_money(new.grand_total) || ' did not go through.', v_link, v_data, 'order:' || new.id || ':payment_failed');
      end if;
    end if;

    if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
      perform app.notify_tenant(new.tenant_id, 'orders.read', 'order.cancelled', 'Order ' || v_label || ' cancelled',
        coalesce(nullif(left(new.cancel_reason, 160), ''), app.notify_money(new.grand_total) || ' order was cancelled.'), v_link, v_data, 'order:' || new.id || ':cancelled');
    end if;

    if new.fulfillment_status in ('returned', 'rto') and old.fulfillment_status is distinct from new.fulfillment_status then
      perform app.notify_tenant(new.tenant_id, 'orders.read', 'order.returned',
        case when new.fulfillment_status = 'rto' then 'Order ' || v_label || ' returned to origin' else 'Order ' || v_label || ' returned' end,
        'The parcel is on its way back to you.', v_link, v_data, 'order:' || new.id || ':' || new.fulfillment_status);
    end if;
  exception when others then
    raise warning 'notify_on_order failed: %', sqlerrm;
  end;
  return new;
end;
$$;

-- Returns: a shopper (or staff) opened a return request.
create or replace function app.notify_on_return()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_number bigint;
begin
  begin
    select order_number into v_number from public.orders where id = new.order_id;
    perform app.notify_tenant(new.tenant_id, 'orders.read', 'order.return_requested', 'Return requested for order #' || coalesce(v_number::text, ''),
      left(new.reason, 160), '/dashboard/returns', jsonb_build_object('returnId', new.id, 'orderId', new.order_id), 'return:' || new.id || ':requested');
  exception when others then
    raise warning 'notify_on_return failed: %', sqlerrm;
  end;
  return new;
end;
$$;

-- Stock: a tracked variant crosses its low-stock threshold or sells out (once per variant per day each).
create or replace function app.notify_on_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_threshold int;
  v_track boolean;
  v_title text;
  v_variant text;
  v_product uuid;
  v_day text := to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD');
begin
  begin
    if new.available >= old.available then return new; end if;
    select coalesce(v.low_stock_threshold, s.low_stock_default, 5), v.track_inventory, p.title, v.title, p.id
      into v_threshold, v_track, v_title, v_variant, v_product
    from public.product_variants v
    join public.products p on p.id = v.product_id
    left join public.stores s on s.tenant_id = v.tenant_id
    where v.id = new.variant_id;
    if not found or not v_track then return new; end if;
    v_title := v_title || case when v_variant is null or v_variant = 'Default' then '' else ' · ' || v_variant end;

    if new.available <= 0 and old.available > 0 then
      perform app.notify_tenant(new.tenant_id, 'inventory.read', 'stock.out', 'Sold out: ' || v_title, 'This item can''t be bought until you restock it.',
        '/dashboard/products/' || v_product, jsonb_build_object('variantId', new.variant_id, 'productId', v_product, 'available', new.available),
        'stock:' || new.variant_id || ':out:' || v_day);
    elsif new.available <= v_threshold and old.available > v_threshold then
      perform app.notify_tenant(new.tenant_id, 'inventory.read', 'stock.low', 'Low stock: ' || v_title, new.available || ' left in stock.',
        '/dashboard/products/' || v_product, jsonb_build_object('variantId', new.variant_id, 'productId', v_product, 'available', new.available),
        'stock:' || new.variant_id || ':low:' || v_day);
    end if;
  exception when others then
    raise warning 'notify_on_stock failed: %', sqlerrm;
  end;
  return new;
end;
$$;

create or replace function app.notify_on_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_product text;
begin
  begin
    select title into v_product from public.products where id = new.product_id;
    perform app.notify_tenant(new.tenant_id, 'reviews.moderate', 'review.new',
      'New ' || new.rating || '★ review' || coalesce(' on ' || v_product, ''),
      coalesce(nullif(left(coalesce(new.title, new.body), 160), ''), 'By ' || new.author_name) || case when new.status = 'pending' then ' · awaiting approval' else '' end,
      '/dashboard/reviews', jsonb_build_object('reviewId', new.id, 'productId', new.product_id, 'rating', new.rating), 'review:' || new.id || ':new');
  exception when others then
    raise warning 'notify_on_review failed: %', sqlerrm;
  end;
  return new;
end;
$$;

create or replace function app.notify_on_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform app.notify_tenant(new.tenant_id, 'customers.read', 'customer.new', 'New customer',
      coalesce(nullif(trim(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '')), ''), 'A shopper') || ' joined your store.',
      '/dashboard/customers/' || new.id, jsonb_build_object('customerId', new.id), 'customer:' || new.id || ':new');
  exception when others then
    raise warning 'notify_on_customer failed: %', sqlerrm;
  end;
  return new;
end;
$$;

-- Cart converted after an abandoned-cart reminder (email or WhatsApp) went out = recovered sale.
create or replace function app.notify_on_cart()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_order uuid;
begin
  begin
    if new.status <> 'converted' or old.status = 'converted' then return new; end if;
    if not exists (select 1 from public.email_log e where e.tenant_id = new.tenant_id and e.status in ('sent', 'logged')
                     and e.idempotency_key like new.tenant_id || ':cart:' || new.id || ':abandoned%')
       and not exists (select 1 from public.notification_jobs j where j.tenant_id = new.tenant_id and j.cart_id = new.id
                     and j.event = 'abandoned_cart' and j.status in ('sent', 'delivered', 'read')) then
      return new;
    end if;
    select id into v_order from public.orders where tenant_id = new.tenant_id and cart_id = new.id order by created_at desc limit 1;
    perform app.notify_tenant(new.tenant_id, 'orders.read', 'cart.recovered', 'Abandoned cart recovered',
      'A shopper came back after your reminder and placed an order.',
      case when v_order is null then '/dashboard/orders' else '/dashboard/orders/' || v_order end,
      jsonb_build_object('cartId', new.id, 'orderId', v_order), 'cart:' || new.id || ':recovered');
  exception when others then
    raise warning 'notify_on_cart failed: %', sqlerrm;
  end;
  return new;
end;
$$;

-- Custom domains: verification and SSL outcomes.
create or replace function app.notify_on_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_day text := to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD');
begin
  begin
    if new.type <> 'custom' then return new; end if;
    if new.status is distinct from old.status and new.status in ('verified', 'failed') then
      perform app.notify_tenant(new.tenant_id, 'domains.manage', 'domain.status',
        case when new.status = 'verified' then new.hostname || ' is connected' else new.hostname || ' could not be verified' end,
        case when new.status = 'verified' then 'Your custom domain now points to your store.' else coalesce(left(new.last_error, 160), 'Check the DNS records and try again.') end,
        '/dashboard/settings/domains', jsonb_build_object('domainId', new.id, 'status', new.status), 'domain:' || new.id || ':' || new.status || ':' || v_day);
    end if;
    if new.ssl_status is distinct from old.ssl_status and new.ssl_status in ('active', 'failed') then
      perform app.notify_tenant(new.tenant_id, 'domains.manage', 'domain.ssl',
        case when new.ssl_status = 'active' then 'SSL is active on ' || new.hostname else 'SSL failed on ' || new.hostname end,
        case when new.ssl_status = 'active' then 'Shoppers now see the padlock on your domain.' else coalesce(left(new.last_error, 160), 'We''ll keep retrying. Check the DNS records.') end,
        '/dashboard/settings/domains', jsonb_build_object('domainId', new.id, 'sslStatus', new.ssl_status), 'domain:' || new.id || ':ssl_' || new.ssl_status || ':' || v_day);
    end if;
  exception when others then
    raise warning 'notify_on_domain failed: %', sqlerrm;
  end;
  return new;
end;
$$;

-- AI writing usage. Must match DAILY_GENERATION_LIMIT in src/features/neural-pulse/schemas.ts (unit-tested).
create or replace function app.notify_on_ai_generation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit constant int := 30;
  v_used int;
  v_day text := to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD');
begin
  begin
    select count(*) into v_used from public.ai_generations where tenant_id = new.tenant_id and created_at > now() - interval '24 hours';
    if v_used = v_limit then
      perform app.notify_tenant(new.tenant_id, 'marketing.write', 'ai.credits_exhausted', 'AI credits used up for today',
        'Your store has used all ' || v_limit || ' AI generations for the last 24 hours. They refill automatically.',
        '/dashboard/marketing', jsonb_build_object('used', v_used, 'limit', v_limit), 'ai:' || new.tenant_id || ':exhausted:' || v_day);
    elsif v_used = ceil(v_limit * 0.8) then
      perform app.notify_tenant(new.tenant_id, 'marketing.write', 'ai.credits_low', 'AI credits running low',
        v_used || ' of ' || v_limit || ' daily AI generations used.',
        '/dashboard/marketing', jsonb_build_object('used', v_used, 'limit', v_limit), 'ai:' || new.tenant_id || ':low:' || v_day);
    end if;
  exception when others then
    raise warning 'notify_on_ai_generation failed: %', sqlerrm;
  end;
  return new;
end;
$$;

-- Plan requests: platform staff hear about new ones, the store owner hears the decision.
create or replace function app.notify_on_plan_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_plan text; v_store text;
begin
  begin
    select name into v_plan from public.plans where id = new.plan_id;
    select name into v_store from public.tenants where id = new.tenant_id;
    if tg_op = 'INSERT' then
      perform app.notify_platform('platform.tenants.manage', 'platform.plan_request', 'Plan request from ' || coalesce(v_store, 'a store'),
        coalesce(v_plan, 'A plan') || ' · ' || new.billing_cycle || coalesce(' · ' || left(new.note, 120), ''),
        '/admin/plan-requests', jsonb_build_object('requestId', new.id, 'tenantId', new.tenant_id), 'plan_request:' || new.id || ':new');
    elsif new.status is distinct from old.status and new.status in ('approved', 'declined') then
      perform app.notify_tenant(new.tenant_id, 'billing.manage', 'plan.request_decided',
        case when new.status = 'approved' then 'Your ' || coalesce(v_plan, '') || ' plan is active' else 'Plan request declined' end,
        coalesce(left(new.decision_note, 160), case when new.status = 'approved' then 'Thanks! Your store is on the new plan.' else 'Contact support if you have questions.' end),
        '/dashboard/settings/plan', jsonb_build_object('requestId', new.id, 'status', new.status), 'plan_request:' || new.id || ':' || new.status);
    end if;
  exception when others then
    raise warning 'notify_on_plan_request failed: %', sqlerrm;
  end;
  return new;
end;
$$;

-- Platform: sign-ups, new stores, stores going live.
create or replace function app.notify_on_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform app.notify_platform('platform.users.manage', 'platform.signup', 'New sign-up',
      coalesce(nullif(new.display_name, ''), 'A new user') || ' created an account.', '/admin/users',
      jsonb_build_object('userId', new.id), 'signup:' || new.id);
  exception when others then
    raise warning 'notify_on_profile failed: %', sqlerrm;
  end;
  return new;
end;
$$;

create or replace function app.notify_on_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform app.notify_platform('platform.tenants.read', 'platform.store_created', 'New store: ' || new.name,
      new.slug || ' · ' || new.status, '/admin/tenants/' || new.id, jsonb_build_object('tenantId', new.id), 'tenant:' || new.id || ':created');
  exception when others then
    raise warning 'notify_on_tenant failed: %', sqlerrm;
  end;
  return new;
end;
$$;

create or replace function app.notify_on_store_launch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if new.launch_status = 'live' and old.launch_status = 'draft' then
      perform app.notify_platform('platform.tenants.read', 'platform.store_published', new.name || ' is live',
        'The store was published and is open to shoppers.', '/admin/tenants/' || new.tenant_id,
        jsonb_build_object('tenantId', new.tenant_id), 'tenant:' || new.tenant_id || ':published');
    end if;
  exception when others then
    raise warning 'notify_on_store_launch failed: %', sqlerrm;
  end;
  return new;
end;
$$;

-- 4. Triggers ---------------------------------------------------------------------
drop trigger if exists trg_orders_notify on public.orders;
create trigger trg_orders_notify after insert or update of payment_status, status, fulfillment_status on public.orders
  for each row execute function app.notify_on_order();
drop trigger if exists trg_returns_notify on public.returns;
create trigger trg_returns_notify after insert on public.returns for each row execute function app.notify_on_return();
drop trigger if exists trg_inventory_levels_notify on public.inventory_levels;
create trigger trg_inventory_levels_notify after update of available on public.inventory_levels for each row execute function app.notify_on_stock();
drop trigger if exists trg_reviews_notify on public.reviews;
create trigger trg_reviews_notify after insert on public.reviews for each row execute function app.notify_on_review();
drop trigger if exists trg_customers_notify on public.customers;
create trigger trg_customers_notify after insert on public.customers for each row execute function app.notify_on_customer();
drop trigger if exists trg_carts_notify on public.carts;
create trigger trg_carts_notify after update of status on public.carts for each row execute function app.notify_on_cart();
drop trigger if exists trg_domains_notify on public.domains;
create trigger trg_domains_notify after update of status, ssl_status on public.domains for each row execute function app.notify_on_domain();
drop trigger if exists trg_ai_generations_notify on public.ai_generations;
create trigger trg_ai_generations_notify after insert on public.ai_generations for each row execute function app.notify_on_ai_generation();
drop trigger if exists trg_plan_requests_notify on public.plan_requests;
create trigger trg_plan_requests_notify after insert or update of status on public.plan_requests for each row execute function app.notify_on_plan_request();
drop trigger if exists trg_profiles_notify on public.profiles;
create trigger trg_profiles_notify after insert on public.profiles for each row execute function app.notify_on_profile();
drop trigger if exists trg_tenants_notify on public.tenants;
create trigger trg_tenants_notify after insert on public.tenants for each row execute function app.notify_on_tenant();
drop trigger if exists trg_stores_launch_notify on public.stores;
create trigger trg_stores_launch_notify after update of launch_status on public.stores for each row execute function app.notify_on_store_launch();

-- 5. Server entry points (service role only) -------------------------------------

-- For platform events that have no table yet (APK requests, disputes, payout failures): server code
-- that verified the event (webhook signature, platform permission) calls this with the secret key.
create or replace function public.notify_platform_event(p_perm text, p_type text, p_title text, p_body text, p_link text, p_data jsonb, p_dedupe text)
returns int
language sql
security definer
set search_path = ''
as $$ select app.notify_platform(p_perm, p_type, p_title, p_body, p_link, p_data, p_dedupe) $$;

-- Cron: trial-ending reminders (3 days and 1 day before) and retention (read > 90 days, any > 180 days).
create or replace function public.notifications_run_reminders()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  v_days int;
  v_sent int := 0;
  v_deleted int;
begin
  for t in
    select tn.id, tn.trial_ends_at, p.name as plan from public.tenants tn left join public.plans p on p.id = tn.plan_id
    where tn.status = 'trial' and tn.trial_ends_at > now() and tn.trial_ends_at <= now() + interval '3 days'
  loop
    v_days := greatest(1, ceil(extract(epoch from (t.trial_ends_at - now())) / 86400)::int);
    v_sent := v_sent + app.notify_tenant(t.id, 'billing.manage', 'plan.trial_expiring',
      'Your free trial ends in ' || v_days || ' day' || case when v_days = 1 then '' else 's' end,
      'Choose a plan' || coalesce(' (you''re trying ' || t.plan || ')', '') || ' to keep your store open.',
      '/dashboard/settings/plan', jsonb_build_object('trialEndsAt', t.trial_ends_at, 'daysLeft', v_days),
      'trial:' || t.id || ':' || to_char(t.trial_ends_at, 'YYYY-MM-DD') || ':' || case when v_days <= 1 then '1' else '3' end);
  end loop;
  delete from public.notifications where (read_at is not null and created_at < now() - interval '90 days') or created_at < now() - interval '180 days';
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('trialReminders', v_sent, 'deleted', v_deleted);
end;
$$;

revoke all on function public.notify_platform_event(text, text, text, text, text, jsonb, text), public.notifications_run_reminders() from public, anon, authenticated;
grant execute on function public.notify_platform_event(text, text, text, text, text, jsonb, text), public.notifications_run_reminders() to service_role;
