-- Business coach (Seller AI Phase 3): action cost + durable generation kind.

insert into public.ai_credit_action_costs (kind, label, credits, minutes_saved) values
  ('business_coach', 'Business coach tip', 1, 10)
on conflict (kind) do nothing;

alter table public.ai_generations drop constraint if exists ai_generations_kind_check;
alter table public.ai_generations
  add constraint ai_generations_kind_check
  check (kind in (
    'caption', 'hashtags', 'ideas', 'plan', 'review_reply', 'message_reply', 'profile', 'section',
    'business_coach'
  ));
