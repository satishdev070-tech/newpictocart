-- =============================================================================
-- 9000 CATEGORY / COLLECTION FROM PHOTO: credit costs and generation-log kinds for
-- "Create with AI from photo" (features/seller-ai generateCatalogGroupFromImageAction).
-- Additive. Requires 4200 (seller AI suite) and 8900 (latest ai_generations kinds).
-- Before this runs the app still works: unknown kinds cost 1 credit and the
-- generation log insert is skipped with a warning.
--
-- Down (manual):
--   delete from public.ai_credit_action_costs where kind in ('generate_category', 'generate_collection');
--   -- restore ai_generations_kind_check from 20261119008900_social_marketing_desk.sql
-- =============================================================================

insert into public.ai_credit_action_costs (kind, label, credits, minutes_saved) values
  ('generate_category', 'Category from photo', 2, 6),
  ('generate_collection', 'Collection from photo', 2, 6)
on conflict (kind) do nothing;

alter table public.ai_generations drop constraint if exists ai_generations_kind_check;
alter table public.ai_generations
  add constraint ai_generations_kind_check check (kind in (
    'caption', 'hashtags', 'ideas', 'plan', 'review_reply', 'message_reply', 'profile',
    'section', 'onboarding_seed',
    'generate_product', 'generate_blog', 'contact_reply', 'business_coach',
    'store_agent', 'store_setup', 'generate_reviews', 'generate_faq',
    'informative_assistant', 'informative_site_build',
    'social_post',
    'generate_category', 'generate_collection'
  ));
