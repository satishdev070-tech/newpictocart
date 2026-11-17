# Informative Website editor + 10 new themes (2026-11-17)

Branch `feature/informative-editor`. Owner ask: the Informative Website gets the same kind of editor as the online store's theme editor — sections listed on the left, live site on the right, edit every section, add sections, "Add with AI" — plus 10 more real themes with real images (Unsplash), for 21 total.

## Current state
- Themes are data (`src/features/informative/themes/*/theme.config.ts`: tokens + layout variants + default sections), rendered by one shared section library (`site/sections.tsx`, `site/renderer.tsx`, `site/chrome.tsx`). 11 themes.
- Pages store sections in `info_pages.sections` (`[{id,type,props,order,visible}]`, 15 types, `sections.ts`).
- Existing editing: Pages → section editor (`panel/section-editor.tsx`, basic), `/informative/customize` (design/colours/fonts/hero/home order, live preview iframe via `/informative/customize-preview`).
- Online store editor to match: `src/features/theme/editor/theme-editor.tsx` + `src/features/theme/builder`.

## Target UX — "Website editor" (`/informative/editor`)
- Full-screen editor (panel chrome hidden): top bar with page picker (Home, About, Services, Contact, custom pages), Desktop / Mobile toggle, Undo / Redo, "Saved / Unsaved", Save, Publish, Exit.
- **Left:** tabs **Sections** and **Theme**.
  - Sections: the page's section list (drag or ↑↓ to reorder, eye to show/hide, ⋯ duplicate / delete), "+ Add section" (library with a thumbnail and description per type) and "✦ Add with AI".
  - Clicking a section opens its **settings** (per-type fields: text, rich text, image with Unsplash/media picker, lists of items with add/remove/reorder, buttons/links, layout options, background), with a "✦ Rewrite with AI" action.
  - Theme tab: design, colours, fonts, logo/favicon (reuse the customizer controls).
- **Right:** live preview iframe of the real renderer, updates as you type (postMessage, debounced), hover outline + click a section in the preview to select it.
- Save writes the page's sections (validated by `sectionsSchema`) + site columns; Publish = existing publish. Permissions: `content.write` for sections, `theme.edit` for theme, `theme.publish` for publish.

## AI
- "Add with AI": seller describes what they want (or picks a type) → AI returns a section `{type, props}` filled with business-appropriate copy; "Rewrite with AI" rewrites a selected section's text. Uses the existing seller-AI provider routing + AI credits (not Sarvam-only), with clear errors when credits are out.

## Images (Unsplash)
- Image fields open a picker: tenant media library + Unsplash search (server-side with the configured Unsplash key — env `UNSPLASH_ACCESS_KEY` or Admin → Media library key), import into tenant media on select (attribution kept in alt/credit).

## Themes (+10 → 21)
- 10 new informative themes as data configs with distinct identities (tokens, fonts, layout variants, motifs, default sections), each recommended for real categories (clinics, salons, gyms, law/CA, coaching, interiors, events, photography, restaurants/cafés, personal brands), with category demo content using real curated photos that load (verified URLs), and preview thumbnails.

## Work split (parallel, disjoint files)
| Slice | Files |
|---|---|
| Editor UI + preview protocol | new `src/features/informative/editor/**`, new `src/app/informative/editor/**`, new preview route `src/app/informative/editor-preview/**`, `panel/nav.ts` link, field schema `src/features/informative/editor/fields.ts` |
| AI + image picker | new `src/features/informative/editor-ai/**` (actions/server/prompts), new `src/features/informative/media/**` (Unsplash search + import action, picker component) |
| Themes | new `themes/<id>/theme.config.ts` ×10, `themes/registry.ts`, `themes/fonts.ts` (+ font loading if new fonts), demo content/images, thumbnails in `public/informative/themes/` |
| Renderer support | lead integrates any new section props / variants in `site/sections.tsx` after the slices land |

Done: editor works for every section type on every page at 1280/375, AI add/rewrite works (or fails clearly), images load, 21 themes render; `pnpm check` green; PR; staging → production.
