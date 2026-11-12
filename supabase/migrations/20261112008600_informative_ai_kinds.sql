-- Informative Website M9: AI credit kinds for the website assistant and "Build my website with AI".
-- Additive and idempotent. No ai_feature_routes rows: these features use the platform's default
-- provider order (Admin → AI) until a route is configured. Before this migration the app still
-- works: an unknown kind costs 1 credit and the generation log insert is skipped with a warning.
--
-- Down:
--   delete from public.ai_credit_action_costs where kind in ('informative_assistant', 'informative_site_build');
--   delete from public.ai_generations where kind in ('informative_assistant', 'informative_site_build');
--   then re-create ai_generations_kind_check as in 20261029005400_generate_faq.sql.

alter table public.ai_generations drop constraint if exists ai_generations_kind_check;
alter table public.ai_generations
  add constraint ai_generations_kind_check check (kind in (
    'caption', 'hashtags', 'ideas', 'plan', 'review_reply', 'message_reply', 'profile',
    'section', 'onboarding_seed',
    'generate_product', 'generate_blog', 'contact_reply', 'business_coach',
    'store_agent', 'store_setup', 'generate_reviews', 'generate_faq',
    'informative_assistant', 'informative_site_build'
  ));

insert into public.ai_credit_action_costs (kind, label, credits, minutes_saved) values
  ('informative_assistant', 'Website assistant', 2, 10),
  ('informative_site_build', 'Build my website with AI', 10, 60)
on conflict (kind) do nothing;
