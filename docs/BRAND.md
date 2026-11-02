# Pictocart brand system

Applies to the public marketing site (`src/app/(marketing)`), seller and platform-staff sign-in
(`AuthSplit` merchant and console variants), and onboarding (`src/app/onboarding`). The seller
dashboard, post-login platform console (`.theme-panel`) and storefronts keep their own design systems.

## Logo

The official Pictocart logo (camera + cart mark, navy and orange lettering) is in
`public/brand/pictocart-logo.png` (transparent, trimmed, 583×192) and set as `PLATFORM_LOGO` in
`src/config/platform.ts`. The square mark is `public/brand/pictocart-icon.png` and
`src/app/favicon.ico`. On dark backgrounds (footer) the built-in logo sits on a white chip,
because its lettering is navy. A logo uploaded in **/admin/branding** overrides these files.

## Colour tokens

Defined in `src/app/globals.css` under `.theme-brand`, exposed to Tailwind as `brand-*`.

### Marketing landing (`.theme-brand.theme-marketing`)

Public marketing layout only (`src/app/(marketing)/layout.tsx`). **Black / White / Orange / Green**
with a 60-30-10 hierarchy:

| Role | Token / surface | Use |
|---|---|---|
| ~60% white | `--background`, `--brand-canvas` | Page canvas, cards, negative space |
| ~30% charcoal | `--brand-ink`, `--brand-primary`, `--brand-night` | Nav, headings, dark bands, chrome buttons |
| ~10% orange | `--brand-orange` / `--brand-cta` | Money CTAs (Start free, Create store), promo chips |
| Green (functional) | `--brand-success`, `--brand-mint` | Trust / success chips only — not primary CTAs |

Indigo/purple are not marketing accents; leftover CMS tones map to charcoal / orange / green.

### Landing Steps media (Super Admin)

`/admin/landing` → **5 steps** accepts JPG/PNG/WebP/**GIF**/**MP4** via `uploadLandingAssetAction` into the
`platform-branding` bucket (`landing/…`). GIF plays as an image; MP4 renders muted looping video with
optional poster. Built-in CSS illustrations remain when the media URL is empty.

### Feature detail pages (Super Admin)

`/admin/landing/features` edits the 28 `/features/{slug}` pages (key `public.marketing.feature_pages`).
Infographics reuse the same landing media upload (image/GIF/MP4). Mega-menu items link to these
pages; Theme Marketplace stays `/themes`.

### Auth + onboarding (`.theme-brand` only)

Shared indigo / peach / emerald tokens for seller login and onboarding — **unchanged** by the
marketing overlay:

| Token | Value | Use |
|---|---|---|
| `--brand-primary` | `#4f46e5` | Links, indigo buttons, active states, icons |
| `--brand-ink` | `#1b1d45` | Headings and body ink (logo navy) |
| `--brand-cta` | `#059669` | "Create store" / "Start free" buttons (emerald) |
| `--brand-orange` | `#ea580c` | Orange buttons (steps CTA) |
| `--brand-accent` | `#f97316` | Highlights, badges (logo orange) |
| `--brand-purple` | `#7c3aed` | Highlights and gradients |
| `--brand-night` | `#0f0c2e` | Hero background |

## Type, radius, shadow

- Display: Manrope (`font-brand`), already self-hosted for storefront themes. Body: Inter.
- Radius: `rounded-brand-sm` 8px, `-md` 12px, `-lg` 18px, `-xl` 28px. Buttons are pills.
- Shadows: `shadow-brand-card` (cards), `shadow-brand-float` (product visuals).
- Motion: colour/shadow transitions only; `prefers-reduced-motion` is honoured globally.

## Content rules

- No testimonials, customer logos, merchant counts or revenue claims.
- Product visuals that show sample values carry a "Demo data" badge.
- Capabilities are only described where the code supports them (see the header of
  `src/features/marketing-site/content.ts` for the source of each claim).
