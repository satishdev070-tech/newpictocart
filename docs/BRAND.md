# Pictocart brand system

Applies to the public marketing site (`src/app/(marketing)`), seller sign-in / sign-up
(`AuthSplit variant="merchant"`) and onboarding (`src/app/onboarding`). The seller dashboard,
platform console and storefronts keep their own design systems.

## Logo

The official Pictocart logo (camera + cart mark, navy and orange lettering) is in
`public/brand/pictocart-logo.png` (transparent, trimmed, 583×192) and set as `PLATFORM_LOGO` in
`src/config/platform.ts`. The square mark is `public/brand/pictocart-icon.png` and
`src/app/favicon.ico`. On dark backgrounds (footer) the built-in logo sits on a white chip,
because its lettering is navy. A logo uploaded in **/admin/branding** overrides these files.

## Colour tokens

Defined once in `src/app/globals.css` under `.theme-brand`, exposed to Tailwind as `brand-*`.
Sampled from the logo and the earlier pictocart.in site.

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
