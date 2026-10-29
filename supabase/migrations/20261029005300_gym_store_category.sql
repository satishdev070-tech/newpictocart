-- =============================================================================
-- 5300 GYM & FITNESSNESS STUDIO CATEGORY
-- Top-level industry for gym / boutique studio storefronts (mirrors
-- src/features/stores/industries.ts). Additive only.
-- Down: delete from public.store_categories where slug = 'gym';
--       (stores.category_id is ON DELETE SET NULL).
-- =============================================================================

insert into public.store_categories (slug, name, description, icon, position) values
  ('gym', 'Gym & Fitness Studio', 'Gym gear, class packs, studio merch and fitness equipment.', 'dumbbell', 37)
on conflict (slug) do nothing;

update public.store_categories set position = 99 where slug = 'general' and position < 99;
