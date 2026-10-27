-- Seller AI Phase 2: blog AI write + contact reply drafts.
-- Seeds credit costs and widens ai_generations.kind for durable logs.
-- Additive. Requires 3900 (ai_economy) and 2000 (ai_generations).

insert into public.ai_credit_action_costs (kind, label, credits, minutes_saved) values
  ('generate_blog', 'Blog AI write', 2, 30),
  ('draft_contact_reply', 'Contact reply draft', 1, 5)
on conflict (kind) do nothing;

alter table public.ai_generations drop constraint if exists ai_generations_kind_check;
alter table public.ai_generations
  add constraint ai_generations_kind_check
  check (kind in (
    'caption', 'hashtags', 'ideas', 'plan', 'review_reply', 'message_reply', 'profile',
    'generate_blog', 'draft_contact_reply'
  ));
