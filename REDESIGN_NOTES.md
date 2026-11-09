# Marketing dark editorial redesign

Branch: `cursor/redesign-dark-editorial-c73e`

Inspiration-only restyle of the public marketing site (Sheryians-like dark editorial mood). Not a clone — Pictocart copy, logos, imagery, and URLs unchanged. Seller auth/onboarding, dashboard, and storefronts keep the light `.theme-brand` palette.

## What changed

1. **Tokens** — `.theme-marketing` remapped to near-black surfaces, off-white text, single mint accent `#24CFA6` (&lt;10% of screen). Utilities: `mk-container`, `mk-section`, fluid `mk-display-*` / `mk-label`. `.mk-light` islands keep theme mockups/screenshots on a light storefront palette.
2. **Typography** — Inter Tight (display) + JetBrains Mono (labels) via `@fontsource-variable` + `next/font/local` (ADR-019). Inter remains body.
3. **Primitives** — Button/CTA glow, Card + cursor glow, Pill, Marquee, Accordion (+/×), PricingToggle, CountUp, SplitReveal, MagneticButton. No GSAP/Lenis (LCP/GTmetrix budget); CSS + IntersectionObserver; `prefers-reduced-motion` respected.
4. **Chrome** — Sticky header (blur after scroll, hide on scroll-down), dark mega menu, full-screen mobile nav, footer with oversized faded `PICTOCART` wordmark.
5. **Homepage + pages** — Hero, marquees, bento features, sticky steps, themes, industries, pricing (Growth raised), testimonials, FAQ, final CTA; same system on `/pricing`, `/themes`, `/features`, `/how-it-works`, legal.

## New dependencies

- `@fontsource-variable/inter-tight`
- `@fontsource-variable/jetbrains-mono`

## Content inconsistency (flagged)

| Surface | Source | Value |
|---|---|---|
| Hero `{themes}` token | `ecommerceMarketplaceThemes().length` | **186** |
| Mega menu Theme Marketplace | `marketplaceThemeCount()` (same helper) | **186** |
| Full theme catalog (incl. informative) | catalog + informative | **196** (10 informative, discovery-hidden) |
| Home Themes grid | CMS `limit` | typically **8** |

Mega-menu body still says “5-page premium themes” (structure, not count). Confirm with product whether marketing should say `186`, `186+`, or something else.

## Open questions / intentional skips

- No Sheryians screenshots were attached; accent defaults to the brief’s `#24CFA6`. Re-sample if screenshots arrive.
- Custom cursor was skipped (behind a flag in the brief; not shipped).
- Pinned horizontal ScrollTrigger journey replaced by sticky vertical step cards (existing pattern, dark restyle).
- Auth/onboarding intentionally stay light indigo brand.

## Verify

- `pnpm check` green on this branch.
- Smoke: `/`, `/pricing`, `/themes`, `/features`, `/how-it-works`, `/privacy`, `/terms`.
