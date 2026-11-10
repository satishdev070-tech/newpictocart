# Theme marketplace

Route: **Dashboard → Theme marketplace** (`/dashboard/themes`, detail at `/dashboard/themes/{key}`).
Permission `theme.edit` to apply, `theme.publish` to publish. Feature flag `theme_marketplace`.

## Catalogue (multi-industry)

Themes are code presets grouped by **industry** (`src/features/stores/industries.ts`, 20 industries,
mirrored by the `store_categories` table from migration 1800) and **style** (minimal, modern,
luxury, editorial, bold, marketplace, premium, heritage, conversion). Registry:
`features/theme/marketplace/catalog.ts`, with one module per industry in `marketplace/themes/*.ts`.

| Industry | Themes | Demo (Live Preview) |
|---|---|---|
| Fashion | 12: 10 original ethnic presets (Heritage Kashmir, Jaipur Craft, Contemporary Ethnic, Color Pop, Contemporary Feminine, Occasion Luxury, Minimal D2C, Social Fashion, Luxury Indian, Jaipur Boutique) + Runway Editorial, Fashion Marketplace | each original on its own demo store; new ones on `kaya-studio` |
| Electronics | Premium Tech, Smart Living, Gadget Marketplace, Minimal Electronics, Tech Deals | `voltnest` |
| Beauty | Luxury Beauty, Clean Skincare, Modern Cosmetics, Organic Beauty, Editorial Beauty | `dewbloom` |
| Home & Furniture | Scandinavian Home, Luxury Interiors, Modern Living, Home Décor Market, Artisan Home | `kasa-living` |
| Grocery | Fresh Market, Organic Grocery, Supermarket, Gourmet Pantry, Daily Deals | `harvest-basket` |
| Handicrafts | Earth & Artisan | `mitti` |
| Jewellery | Gilded Luxe, Temple Heritage, Everyday Fine, Jewel Journal, Jewel Bazaar | `suvarna` |
| Footwear | Street Drop, Cobbler Atelier, Minimal Sole, Shoe Bazaar, Kolhapur Heritage | `kadam` |
| Health & Wellness | Ayurveda Heritage, Clinical Wellness, Studio Wellness, Spa Sanctuary, Wellness Deals | `aarogya` |
| Sports & Fitness | Arena Bold, Match Day Deals, Sports Megastore, Studio Fit, Pro Shop | `khel-studio` |
| Kids & Baby | Toybox Pop, Little Sprout, Playground Modern, Kids Bazaar, Tiny Deals | `nanhe` |

| Books & Stationery | Margin Notes, Blank Page, Old Library, Desk Studio, Stationery Bazaar | `pustak-ghar` |
| Pet Supplies | Wag Street, Velvet Paw, Clean Coat, Pet Superstore, Treat Drop | `pawdesh` |
| Automotive | Redline Garage, Spares Market, Pit Stop Deals, Grand Tourer, Clean Cabin | `gearbay` |
| Smart Home & Appliances | Modern Kitchen, Appliance Atelier, Appliance Bazaar, Calm Home, Appliance Deals | `griha-smart` |
| Bags & Travel | Trailhead, Saddle & Stitch, Carry Light, Luggage Bazaar, Travel Journal | `safarnama` |
| Watches & Accessories | Chrono Noir, Clean Dial, Wrist Journal, Time Bazaar, Tick-Tock Deals | `ghadi-co` |
| Organic & Natural | Mitti Roots, Field Almanac, Plastic Free, Sprout Pop, Mandi Co-op | `bhoomi-organics` |
| Bakery & Gourmet | Patisserie Noir, Hearth & Crust, Frosted Pop, Hamper Counter, Flour & White | `crumb-and-co` |
| General / Multi-category | Sabkuch Bazaar, Plain Shelf, Everyday Modern, Loud Aisle, Deal Dhamaka | `sabkuch` |

**103 themes in total, covering all 20 industries** (≥ 5 each; Handicrafts has 1). Themes in one
industry differ in structure, not only colour: header layout and menu style, hero size, section
order and composition, grid density, card style, typography and footer tone. A unit test enforces
that every industry except Handicrafts has ≥ 5 themes with distinct home compositions.

### Content slots

A home/collection/product item can name a **slot**: `["ProductGrid", { columns: 5 }, "deals"]`.
When the store's config has a section with id `slot-deals`, that section's content fills the item
(grids and carousels are interchangeable). Otherwise the item falls back to matching by section
type (the original behaviour, which is what real stores use). Unused `slot-*` sections are kept
**hidden** in the config, so switching themes again still finds them. A test enforces that a slot
name maps to one section family per industry.

## Live Preview

- `https://{demo-store}/?sf_theme={key}` renders that demo store with the theme applied **in
  memory** (`getStorefrontTheme`, from the published config and `applyThemePreset`). Nothing is
  written.
- The proxy forwards the key as an internal header (clients can't inject it) and remembers it in a
  cookie for in-store navigation. `?sf_theme=exit` clears it.
- It is honoured only for showcase tenants (`SHOWCASE_STORES` allow-list) and never for ids in
  `PROTECTED_TENANT_IDS` (The Paliya). Any other store ignores the parameter.
- While a preview is active the page is `noindex`, tracking tags are off, and a banner says
  "Live preview … Nothing is saved".
- In the dashboard, **Live preview** opens a dialog with Desktop (1280 px, scaled) and Mobile
  (390 px) frames. It is shown only when the demo store exists and is open.

## Marketing site previews (pictocart.in)

- **Preview Theme** on the home page cards, `/themes` and `/themes/[key]` opens `/themes/[key]/preview`, which works for
  every theme: it frames a live demo store with the theme applied in memory when one is up, otherwise it renders a
  **sample store** server-side from the theme preset (colours, fonts, header layout, hero, product card, spacing, footer)
  with the industry's Unsplash photos (credited). Desktop / Phone switch; the phone frame is 390 px.
- The demo store for a theme is its own `demo`, else its industry's showcase store, else `sabkuch`, else any live showcase
  store (`previewDemoCandidates`): Live Preview applies any theme on any showcase tenant.
- Card images: captured screenshot (`public/theme-previews`, listed in `theme-previews.json`) first, then the category's
  Unsplash photo (`src/lib/unsplash.ts`), then the token mockup.
- **Why previews were not real (2026-10-16):** none of the showcase demo stores existed (the connected Supabase project and
  `*.pictocart.in` both 404 for `kaya-studio`, `dewbloom`, `sabkuch`, `chinar`), so no live preview URL was produced and the
  screenshot manifest stayed empty. The sample store now covers that case.
- **Regenerate screenshots / enable live previews:**
  1. Build the demo stores (writes only to those demo tenants):
     `pnpm exec tsx --env-file=.env.local scripts/dev/showcase/run.mts kaya-studio voltnest dewbloom … sabkuch`
     (original fashion demos: `scripts/dev/demo-stores/run.mts`).
  2. Capture: `pnpm themes:capture --root pictocart.in` (production), or `pnpm themes:capture --root localhost --port 3000`
     against a local `pnpm dev`; `--only key1,key2` for a subset. Or GitHub → Actions → "Capture theme previews".
  3. Commit `public/theme-previews/*.webp` and `src/features/marketing-site/theme-previews.json`.

## Marketplace UI

Industry chips with counts, style filter, search (name, tagline, style, best-for) and sort
(featured, with the seller's own industry first; newest; name). Cards load a lazy, scaled iframe
of the actual showcase store with that theme applied in memory—not a synthetic mockup—plus
industry and style badges, and a "Current theme" / "In draft" badge. A token-driven mockup is
used only when that theme's showcase demo has not been seeded yet.

## Showcase demo stores (`scripts/dev/showcase`)

One store per industry (19 new + the original fashion demos), built by `run.mts <slug …>`. Each has about 20 products with INR
prices, MRP, variants and category **specifications** (`attributes.specs`), categories,
collections, menus, policies, FAQs and an "Image credits" page. No reviews are seeded.

- **Photography:** real photographs found through Openverse. StockSnap CC0 comes first, then CC0,
  PDM or CC BY from rawpixel, Wikimedia or Flickr. Every pick is vetted by eye on contact sheets
  (`images.mts --sheet` / `--picks`): no brand logos, no retailer catalogues. Products are
  adapted to what real photos show. Credits are listed on each store's `/pages/image-credits`.
- **Safety:** only allow-listed slugs are accepted. An existing tenant is touched only if it is
  owned by `owner@<slug>.test` and isn't protected. Writes are scoped to that tenant, and runs are
  idempotent. `--retheme` and `--refresh-images` replace only that demo tenant's theme versions
  and media rows. Owner accounts get a random, unrecorded password; sign in by magic link.
- `shots.mts <slug> <dir>` screenshots every theme of the store (desktop and mobile) via Live
  Preview and flags horizontal overflow.

## Apply to store or save a draft → customise → publish → rollback

1. **Apply to draft** (`applyMarketplaceThemeAction`) runs `applyThemePreset(current, preset)`:
   - style (enum, number and boolean settings) comes from the preset;
   - content (text, images, links, menus, product/collection picks) is kept from the store's current draft, or the published theme if there's no draft, matched by section type;
   - new sections start from the section defaults;
   - the result is strictly validated and every asset path is checked to belong to the store.
   It is written as the store's **draft** (`theme_key` = the theme). The live store does not change.
2. Customise in the theme editor (live preview iframe).
3. Publish (`publish_theme` RPC). The previous version goes to history.
4. Roll back to any earlier version from the editor history.

Sellers with `theme.publish` can also choose **Apply to store**. It builds the same safe draft
and immediately publishes it, so the storefront changes without a separate editor step. The
previous live version remains available for rollback. **Save as draft** keeps the review-first
workflow available to every seller with `theme.edit`.

No store data (products, pages, menus, images) is modified or deleted by applying a theme.
Tests: `tests/unit/theme-marketplace.test.ts` applies every theme to a store config and checks
the config validates, the brand tokens switch, hero and announcement content survive, and no
foreign asset paths appear.

The `themes` table (migration 1500, extended by 3100) holds **custom themes** made in Super Admin → Themes (AI from a
reference URL/screenshot, or duplicates of any theme). `active` = published; RLS: readable when active, drafts and writes
need `platform.settings.manage`. Published custom themes join the seller catalogue through `marketplace/registry.ts`.

## Custom themes: AI "create from URL + screenshot" (Super Admin)

`/admin/themes/new` → `src/features/theme/builder`: SSRF-guarded fetch (https only, public addresses checked at connect
time, 3 redirects, 8 s / 1.5 MB) → design summary (colours, fonts mapped to our font keys, header shape, section order; no
page text, logos or image URLs) → AI (screenshots as image parts) → preset in the Variant API above → repair + strict zod
validation + "applies to a store config", one regeneration on failure → Unsplash photos for every image slot with credits →
draft → editor (`/admin/themes/{key}/edit`) → publish. Only the look is recreated; the UI says so and asks the admin to
confirm. See ADR-037.

## Sections and options added with Jaipur Boutique (available to every theme)

| Addition | Where | What the seller manages in the theme editor |
|---|---|---|
| **Scrolling text** (`Marquee`) | header, home, collection, product, footer | Up to 8 phrases, link, size, speed, separator, colour. Pauses on hover; static for reduced-motion users |
| **Shoppable videos** (`VideoShop`) | home, collection, product | Up to 12 videos (upload MP4 ≤ 10 MB with the new **Upload MP4** button, or a YouTube/Vimeo link), cover image, title, product to shop. Round stories or 9:16 cards; tap opens a player with the product and "Shop now" |
| **Page content** (`PageContent`) | collection, product templates | Marker: sections above it render before the product grid/details, sections below after it. Without it, pages behave as before |
| Trust strip layout | TrustBadges | Grid or **scrolling strip** |
| Announcement display | AnnouncementBar | All in a row, or **one at a time with arrows** (auto-advances, pauses on hover); up to 5 messages |
| Desktop menu | Header | Menu bar/mega menu, or **drawer on every screen** (hides the Mega menu section) |
| Section titles | Style → Section titles | Left or **centred** |
| Product cards | Style → Product cards | **Pill** badge style (green "% off" under the price), **offer badge** text on every card (e.g. "Buy 2 Get 1"), **size chips** (sold-out sizes struck through) |

Category tiles in portrait/square shape now fill the row (one column per tile, up to 6).

The Jaipur Boutique layout takes its structure from a common Dawn-based storefront pattern. No third-party code, images, logos or copy were used. Applying it keeps the store's own banners, products and text.
`scripts/dev/import-thepaliya/theme-boutique.mts` applies it to the-paliya and fills every section with that store's content.

## Layout variants and per-category layouts (2026-10-16)

Themes used to differ only in colours, fonts and section order, so every theme still rendered the same
skeleton (announcement → logo row → dark full-bleed hero → product grid). Each core section now has
several genuinely different layouts, every category has its own layout personality, and empty image
slots show relevant Unsplash photos.

### Variant API (how a theme declares its layout)

Variants are ordinary section settings, so they are saved in the theme document, editable in the
theme editor (as a grid of layout cards with a small diagram) and carried across a theme switch by
`applyThemePreset` (they are enum "style" settings). Vocabulary: `src/features/theme/sections/variants.ts`.
The FIRST value of each list is the default and renders exactly as before, so theme documents saved
earlier keep their look (zod defaults; tested in `tests/unit/theme-layouts.test.ts`).

| Section | Setting | Values |
|---|---|---|
| Hero | `variant` | `overlay` (old look), `split`, `collage`, `minimal`, `band`, `cards`, `framed`, `hero-fade`, `hero-slider`, `hero-kenburns` (fading slideshows, `HeroStage`); plus `mediaRatio`, `panelTone`, `slideNav` |
| ProductGrid | `variant` | `grid` (old), `masonry`, `lookbook`, `rail`, `bigtile`, `list`; plus `cardRatio`, `spacing` |
| Bestseller / NewArrivals | `layout` | `carousel`, `grid`, and every ProductGrid variant |
| ProductCarousel | `cardRatio`, `spacing` | |
| CategoryGrid | `variant` | `grid` (old, uses `shape`), `mosaic`, `rail`, `index`, `pills`, `cat-circles`, `cat-overlay`, `cat-bento`, `cat-banners` |
| PromoBanner | `variant` | `tiles` (old), `promo-fullwidth`, `promo-split`, `promo-mosaic`, `promo-overlap`, `promo-strip`, `promo-minimal`; plus `tone`, `align`, `badge` |
| FAQ | `variant` | `accordion` (old), `faq-split`, `faq-cards`, `faq-numbered`, `faq-chat`; plus contact `ctaLabel`/`ctaHref`, `spacing` |
| SocialProof | `layout` | `grid` (old), `mosaic`, `strip`, `ig-profile`, `ig-reels`, `ig-collage`; plus `source` (`posts` / `instagram` = connected account's latest posts), `bio` |
| CollectionGrid | `layout` | `grid` (old), `mosaic`, `rail` |
| BrandStory | `variant` | `split` (old), `centered`, `overlay`, `band`, `collage`; plus `imagePosition`, `tone` |
| EditorialImageText | `variant` | `split`, `fullbleed`, `journal`, `overlap` (new) |
| Testimonials | `variant` | `grid` (old), `spotlight`, `cards`, `marquee`, `wall`; plus `tone` |
| Newsletter | `variant` | `centered` (old), `split`, `banner`, `card`, `inline`; plus `imagePath` |
| TrustBadges (USP band) | `layout` | `grid`, `marquee`, `line`, `cards`, `badges` |
| Header | `style` | `classic` (old), `bordered`, `inverted`, `floating`, `minimal`, `editorial` |
| Footer | `layout` | `columns` (old), `centered`, `minimal`, `statement`, `footer-mega`, `footer-brand`, `footer-app`, `footer-illustrated`, `footer-tworow`; `decor` adds `illustration` (seller upload: `imagePath`, `imageAlt`) |
| most content sections | `spacing` | `default`, `compact`, `airy`, `flush` (SectionList sets `data-spacing`) |

In a marketplace preset a theme pins values in its items, e.g. `["Hero", { variant: "split" }, "hero"]`,
and the chrome with `preset.headerStyle` / `preset.footerLayout`. Anything left unset is filled by the
layout personality.

### Layout personalities (per category)

`src/features/theme/layouts/personalities.ts` defines one personality per layout family (the 16 photo
categories: fashion, food, jewellery, beauty, furniture, electronics, handicrafts, books, fitness, toys,
stationery, pets, organic, art, services, general; every store industry maps onto one via
`layoutFamily()`). A personality lists, in order of preference, the hero / product / category /
collection / story / editorial / testimonial / newsletter / USP variants, hero panel tones, header
styles, footer layouts and spacing that suit the category, plus a `signature` home page for a new store
(`signatureComposition(industry)`).

`withLayout(preset, industry, index)` (`layouts/apply-layout.ts`) gives the n-th theme of an industry the
n-th entry of every list (wrapping; the second grid on a page steps one further), never overriding a
value the preset sets. The catalogue applies it to every theme (`MARKETPLACE_THEMES`), so themes in one
category get different hero / products / header / footer combinations (tested: all themes of each
industry have distinct `layoutSummary()`s), and categories differ because their lists differ.
Banner/counter heroes and 5–6 column grids keep their classic layout. `preset.family` records the
family (used by the mockups for photos).

### Stock imagery (Unsplash)

- `src/lib/unsplash-stock.ts` (pure): a curated pool of real Unsplash photos with photographer credits,
  per category and slot (`hero`, `story`, `tiles`, `products`), picked from Unsplash search for
  `STOCK_QUERIES` (e.g. food: "bakery croissant", jewellery: "gold necklace", furniture: "sofa living room").
- `src/lib/unsplash.ts` (server): `getStockImages(category, slot)` / `getStockSet(category)` use the Search
  API when `UNSPLASH_ACCESS_KEY` is set (one cached request per slot per day), else the curated pool.
  Existing exports are unchanged; the pure category list moved to `src/lib/unsplash-categories.ts` and is
  re-exported.
- Theme token `imagery`: `auto` (default: the store's category; Live Preview uses the previewed theme's
  industry, showcase stores their industry), a category name, or `off`. Editable under Design in the editor.
- The storefront (`theme/server/imagery.ts` → `RenderContext.stock`) fills ONLY empty image slots: hero
  slides, category/collection tiles, promo tiles, brand story, editorial, newsletter photos. Product
  photo placeholders are filled only on showcase stores and in Live Preview (`ctx.stockProducts`), never on
  real stores. The protected live store (The Paliya) never gets stock photos.
- Large stock photos carry a visible "Photo: Name / Unsplash" credit (`PhotoCredit`).
- For the Media Library and previews: `themeUnsplashImages(theme)` (`layouts/imagery.ts`, pure, sync) and
  `getThemeUnsplashImages(themeKey)` (`theme/server/imagery.ts`, async, API-fresh) return the photos a theme
  uses, with slot, alt text and credit. Photos are rotated by **theme key** (`themeImagerySeed` /
  `themeStockSet`) so themes that share a layout family still get distinct heroes for marketplace cards,
  empty slots and onboarding thumbs (`themeCardImage` / `themeStockThumbUrl`).
- `ThemeMockup` (marketplace cards, onboarding, dashboard) draws the theme's hero variant, product
  layout, header style and footer layout with the category pool rotated by `themeKey`.

### Performance

All variants are server components: rails and card carousels use CSS scroll-snap, strips use CSS
animation, so no variant adds client JavaScript. Images go through `next/image` with `sizes`; the image
loader adds `w=` to images.unsplash.com URLs so Unsplash's CDN serves each width.
