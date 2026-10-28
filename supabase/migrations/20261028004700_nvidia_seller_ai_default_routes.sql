-- =============================================================================
-- 4700 NVIDIA SELLER AI DEFAULT ROUTES: seed Admin → AI Health routes for the
-- in-process seller AI features when unset, so they use NVIDIA Nemotron Omni
-- (text default in neural-pulse/server/llm.ts). Does not overwrite an admin's
-- existing primary/fallback. Requires 4300 (nvidia in provider CHECKs).
--
-- Down:
--   delete from public.ai_feature_routes where feature_key in
--     ('generate_product','generate_blog','store_agent','contact_reply','business_coach')
--     and primary_provider = 'nvidia'
--     and primary_model = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'
--     and fallback_provider is null;
-- =============================================================================

insert into public.ai_feature_routes (feature_key, primary_provider, primary_model, fallback_provider, fallback_model, enabled)
values
  ('generate_product', 'nvidia', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', null, null, true),
  ('generate_blog', 'nvidia', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', null, null, true),
  ('store_agent', 'nvidia', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', null, null, true),
  ('contact_reply', 'nvidia', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', null, null, true),
  ('business_coach', 'nvidia', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', null, null, true)
on conflict (feature_key) do nothing;
