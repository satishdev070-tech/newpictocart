-- =============================================================================
-- 4900 GENERATE_PRODUCT GEMINI FALLBACK: backfill Admin → AI Health so product
-- from image prefers NVIDIA with Gemini fallback when the seed from 04700 still
-- has a null fallback (already-applied hosts). Does not overwrite an admin who
-- already set a fallback. Groq stays available via the platform order when the
-- route is disabled or neither NVIDIA nor Gemini is configured.
--
-- Down:
--   update public.ai_feature_routes
--   set fallback_provider = null, fallback_model = null
--   where feature_key = 'generate_product'
--     and primary_provider = 'nvidia'
--     and fallback_provider = 'gemini'
--     and fallback_model = 'gemini-3.8-flash';
-- =============================================================================

update public.ai_feature_routes
set
  fallback_provider = 'gemini',
  fallback_model = 'gemini-3.8-flash'
where feature_key = 'generate_product'
  and primary_provider = 'nvidia'
  and fallback_provider is null;
