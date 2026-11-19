-- Tara (AI assistant) actions: credits follow the work.
-- Each executed data step (stock, price, publish/unpublish/archive, informative service price)
-- spends `tara_action` credits; questions/plans stay `store_agent`, blog posts `generate_blog`.
-- Super Admin can change the cost in AI economy. Until this runs, ai_credit_debit charges 1 for
-- an unknown kind, which is the same default.
insert into public.ai_credit_action_costs (kind, label, credits, minutes_saved) values
  ('tara_action', 'Tara action (stock, price, status)', 1, 5)
on conflict (kind) do nothing;
