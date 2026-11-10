-- =============================================================================
-- 5000 SELLER AI ROUTE FALLBACKS: repair product-from-image when Admin left it on
-- Gemini-only (Gemini keys that return HTTP 403 hard-fail with no other try), and
-- give generate_reviews a Groq fallback when none is set. Code also appends the
-- rest of the platform provider order after the Admin route (see routeProviders).
--
-- Down:
--   -- no automatic reverse (would re-break Gemini-only product routes)
-- =============================================================================

update public.ai_feature_routes
set
  primary_provider = 'nvidia',
  primary_model = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  fallback_provider = 'groq',
  fallback_model = 'llama-3.3-70b-versatile',
  updated_at = now()
where feature_key = 'generate_product'
  and primary_provider = 'gemini'
  and fallback_provider is null;

update public.ai_feature_routes
set
  fallback_provider = 'groq',
  fallback_model = 'llama-3.3-70b-versatile',
  updated_at = now()
where feature_key = 'generate_reviews'
  and fallback_provider is null;

-- Prefer NVIDIA + Groq when product still has NVIDIA primary but no fallback
-- (04900 may have set Gemini; leave an existing non-null fallback alone).
update public.ai_feature_routes
set
  fallback_provider = 'groq',
  fallback_model = 'llama-3.3-70b-versatile',
  updated_at = now()
where feature_key = 'generate_product'
  and primary_provider = 'nvidia'
  and fallback_provider is null;
