# Marketing dark editorial redesign

Branches: `cursor/redesign-dark-editorial-c73e` (initial), `cursor/marketing-orange-sheryians-c73e` (orange + closer Sheryians pass).

Inspiration-only restyle of the public marketing site (Sheryians-like dark editorial mood). Not a clone — Pictocart copy, logos, imagery, and URLs unchanged. Seller auth/onboarding, dashboard, and storefronts keep the light `.theme-brand` palette.

## What changed

1. **Tokens** — `.theme-marketing` near-black surfaces, off-white text, single **Pictocart orange** accent `#ea580c` / hover `#c2410c` (white ink on filled CTAs). Utilities: `mk-container`, `mk-section`, fluid `mk-display-*` / `mk-label`. `.mk-light` islands keep theme mockups on a light storefront palette.
2. **Typography** — **Manrope** (display, Sheryians-like) + JetBrains Mono (labels) via `@fontsource-variable` + `next/font/local` (ADR-019). Inter remains body.
3. **Primitives** — Button/CTA glow, Card + cursor glow, Pill, Marquee, Accordion (+/×), PricingToggle, CountUp, SplitReveal, MagneticButton. No GSAP/Lenis; CSS + IntersectionObserver; `prefers-reduced-motion` respected.
4. **Chrome** — Sticky header (blur after scroll, hide on scroll-down), dark mega menu, full-screen mobile nav, footer with oversized faded `PICTOCART` wordmark; Start Free orange pill.
5. **Homepage + pages** — Hero (sparse stack, orange rotating word, large stat strip), marquees, features, sticky steps, themes, industries, pricing, testimonials, FAQ, final CTA; same system on `/pricing`, `/themes`, `/features`, `/how-it-works`, legal.

## Follow-up (2026-11-09)

Mint `#24CFA6` replaced with brand orange after live review; Inter Tight replaced with Manrope; hero/section density tightened toward Sheryians editorial feel while keeping CMS content.

## Type scale polish (2026-11-09)

Hero `mk-display-xl` was up to `8rem` and dwarfed body/nav. Retuned:

| Token | Size |
|---|---|
| `mk-display-xl` | `clamp(2.5rem, 5.2vw, 4.25rem)` |
| `mk-display-lg` | `clamp(1.875rem, 3.2vw, 3rem)` |
| `mk-h3` | `clamp(1.25rem, 1.4vw, 1.5rem)` |

Hero body bumped to `text-lg`/`xl`; stats/step numbers dialed down; labels use `mk-label` instead of `10px`.

## New dependencies

- `@fontsource-variable/jetbrains-mono`
- Manrope already present via `@fontsource-variable/manrope` (also used by storefront themes)

## Content inconsistency (flagged)

| Surface | Source | Value |
|---|---|---|
| Hero `{themes}` token | `ecommerceMarketplaceThemes().length` | **186** |
| Mega menu Theme Marketplace | `marketplaceThemeCount()` (same helper) | **186** |
| Full theme catalog (incl. informative) | catalog + informative | **196** (10 informative, discovery-hidden) |
| Home Themes grid | CMS `limit` | typically **8** |

## Intentional skips

- No cloning of Sheryians copy, courses, campus blocks, or assets.
- Custom cursor skipped; no GSAP/Lenis.
- Auth/onboarding stay light indigo brand.

## Verify

- `pnpm check` green.
- Smoke: `/`, `/pricing`, `/themes`, `/features`, `/how-it-works`, `/privacy`, `/terms` — CTAs/highlights orange.
