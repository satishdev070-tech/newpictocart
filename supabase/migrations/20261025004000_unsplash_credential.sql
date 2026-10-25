-- =============================================================================
-- 4000 UNSPLASH CREDENTIAL: lets the super admin store the Unsplash Access Key in the console
-- (Admin → Media library) instead of only the UNSPLASH_ACCESS_KEY env var. Same table, encryption
-- and RLS (no policies; secret-key client only) as the AI and Resend keys. Additive, no data change.
-- Not applied by the application; the owner applies it.
--
-- Down:
--   delete from public.platform_app_credentials where provider = 'unsplash';
--   then re-create the constraint with the 2500 list.
-- =============================================================================

alter table public.platform_app_credentials drop constraint if exists platform_app_credentials_provider_check;
alter table public.platform_app_credentials add constraint platform_app_credentials_provider_check
  check (provider in ('meta', 'pinterest', 'google', 'whatsapp', 'gemini', 'groq', 'anthropic', 'resend', 'unsplash'));
