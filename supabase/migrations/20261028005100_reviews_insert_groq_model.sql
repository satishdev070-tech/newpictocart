-- =============================================================================
-- 5100 REVIEWS STAFF INSERT + GROQ MODEL BACKFILL
-- 1) Staff with reviews.moderate can INSERT pending/import reviews (AI Reviews).
--    Previously only SELECT/UPDATE/DELETE existed → RLS 42501 on generate.
-- 2) Replace retired Groq id llama-3.3-70b-versatile with openai/gpt-oss-120b on
--    ai_feature_routes (and keep Admin overrides that already use another model).
--
-- Down:
--   drop policy if exists reviews_staff_insert on public.reviews;
--   update public.ai_feature_routes
--     set primary_model = 'llama-3.3-70b-versatile'
--     where primary_provider = 'groq' and primary_model = 'openai/gpt-oss-120b';
--   update public.ai_feature_routes
--     set fallback_model = 'llama-3.3-70b-versatile'
--     where fallback_provider = 'groq' and fallback_model = 'openai/gpt-oss-120b';
-- =============================================================================

create policy reviews_staff_insert on public.reviews
  for insert to authenticated
  with check (app.has_tenant_permission(tenant_id, 'reviews.moderate'));

update public.ai_feature_routes
set primary_model = 'openai/gpt-oss-120b', updated_at = now()
where primary_provider = 'groq'
  and primary_model = 'llama-3.3-70b-versatile';

update public.ai_feature_routes
set fallback_model = 'openai/gpt-oss-120b', updated_at = now()
where fallback_provider = 'groq'
  and fallback_model = 'llama-3.3-70b-versatile';
