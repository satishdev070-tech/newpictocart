-- =============================================================================
-- 4300 NVIDIA PROVIDER + STORE AGENT: lets the super admin save an NVIDIA NIM (Nemotron) API key
-- in Admin → Social apps and pick NVIDIA models per feature in Admin → AI Health, and logs/prices
-- the two new seller AI actions (store agent chat, store setup from a prompt).
-- Additive and idempotent: only widens CHECK constraints and inserts two cost rows. No data change.
-- The app works before this is applied: NVIDIA_API_KEY (env) still configures NVIDIA, a route or
-- price row for 'nvidia' is refused with a validation error, new actions cost 1 credit and their
-- ai_generations log row is skipped (logged as a warning).
--
-- Down:
--   delete from public.ai_feature_routes where primary_provider = 'nvidia' or fallback_provider = 'nvidia';
--   delete from public.ai_model_prices where provider = 'nvidia';
--   delete from public.platform_app_credentials where provider = 'nvidia';
--   delete from public.ai_credit_action_costs where kind in ('store_agent', 'store_setup');
--   delete from public.ai_generations where kind in ('store_agent', 'store_setup');
--   then re-create the four constraints with the 4000 / 3900 / 4200 lists.
-- =============================================================================

-- 1. Platform credential for NVIDIA (same table, encryption and RLS as the other AI keys) -------
alter table public.platform_app_credentials drop constraint if exists platform_app_credentials_provider_check;
alter table public.platform_app_credentials add constraint platform_app_credentials_provider_check
  check (provider in ('meta', 'pinterest', 'google', 'whatsapp', 'nvidia', 'gemini', 'groq', 'anthropic', 'resend', 'unsplash'));

-- 2. Per-feature routes and model prices may name NVIDIA ------------------------------------
alter table public.ai_feature_routes drop constraint if exists ai_feature_routes_primary_provider_check;
alter table public.ai_feature_routes add constraint ai_feature_routes_primary_provider_check
  check (primary_provider in ('nvidia', 'gemini', 'groq', 'anthropic'));
alter table public.ai_feature_routes drop constraint if exists ai_feature_routes_fallback_provider_check;
alter table public.ai_feature_routes add constraint ai_feature_routes_fallback_provider_check
  check (fallback_provider is null or fallback_provider in ('nvidia', 'gemini', 'groq', 'anthropic'));

alter table public.ai_model_prices drop constraint if exists ai_model_prices_provider_check;
alter table public.ai_model_prices add constraint ai_model_prices_provider_check
  check (provider in ('nvidia', 'gemini', 'groq', 'anthropic', 'sarvam'));

-- 3. New seller AI generation kinds ---------------------------------------------------------
alter table public.ai_generations drop constraint if exists ai_generations_kind_check;
alter table public.ai_generations
  add constraint ai_generations_kind_check check (kind in (
    'caption', 'hashtags', 'ideas', 'plan', 'review_reply', 'message_reply', 'profile',
    'section', 'onboarding_seed',
    'generate_product', 'generate_blog', 'contact_reply', 'business_coach',
    'store_agent', 'store_setup'
  ));

insert into public.ai_credit_action_costs (kind, label, credits, minutes_saved) values
  ('store_agent', 'Store assistant chat', 1, 5),
  ('store_setup', 'Store setup from a prompt', 10, 60)
on conflict (kind) do nothing;
