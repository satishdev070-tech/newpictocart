-- =============================================================================
-- 5400 GENERATE / APPLY AI STORE FAQs: credit cost + ai_generations kind +
-- NVIDIA default route for Pica2 confirm-Apply (Dashboard → Content → FAQs).
-- Additive and idempotent. App falls back to 1 credit / skips log before apply.
--
-- Down:
--   delete from public.ai_feature_routes where feature_key = 'generate_faq';
--   delete from public.ai_credit_action_costs where kind = 'generate_faq';
--   delete from public.ai_generations where kind = 'generate_faq';
--   then re-create ai_generations_kind_check without 'generate_faq'.
-- =============================================================================

alter table public.ai_generations drop constraint if exists ai_generations_kind_check;
alter table public.ai_generations
  add constraint ai_generations_kind_check check (kind in (
    'caption', 'hashtags', 'ideas', 'plan', 'review_reply', 'message_reply', 'profile',
    'section', 'onboarding_seed',
    'generate_product', 'generate_blog', 'contact_reply', 'business_coach',
    'store_agent', 'store_setup', 'generate_reviews', 'generate_faq'
  ));

insert into public.ai_credit_action_costs (kind, label, credits, minutes_saved) values
  ('generate_faq', 'Apply AI store FAQs', 5, 20)
on conflict (kind) do nothing;

insert into public.ai_feature_routes (feature_key, primary_provider, primary_model, fallback_provider, fallback_model, enabled)
values
  ('generate_faq', 'nvidia', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', null, null, true)
on conflict (feature_key) do nothing;
