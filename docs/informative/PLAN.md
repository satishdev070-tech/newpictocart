# Pictocart — Informative Website (Service Industry) Implementation Plan

_Nov 11, 2026 · @Satish Dev_

> Source of truth: `Pictocart — Informative Website (Service Industry) Implementation Plan.docx`
> (the product owner's document), transcribed here verbatim; only the formatting was converted to Markdown.
> Names such as Store, stores and /seller are placeholders. [DISCOVERY.md](./DISCOVERY.md) maps
> them to this codebase, and [PROGRESS.md](./PROGRESS.md) records deviations.

## Overview and golden rules

Pictocart will offer a second product, the Informative Website for service businesses, next to the existing Online Store. Onboarding asks one new question (website type) and branches. The Online Store path, its seller panel, its storefront and its data must behave exactly as they do today.

### Goals

- Onboarding asks: What do you want to build? → 1. Online Store, 2. Informative Website.
- Online Store → the current flow, unchanged, step for step.
- Informative Website → collect basic business info → pick one of 11 service themes (live preview) → create account → land on an Informative dashboard.
- The Informative seller panel shows only informative features: business profile, services, pages, gallery, team, testimonials, FAQs, enquiries/leads, theme and branding, SEO, domain, settings.
- A published public website rendered with the chosen theme, with a working enquiry/contact form.

### Non-goals for v1

- No switching an existing store to Informative (or back). Website type is fixed at creation.
- No cart, checkout, payments, inventory, orders, shipping or coupons on Informative sites.
- No online appointment payments. Booking = an enquiry form with a preferred date/time field.
- No new billing plans unless the codebase already gates by plan (see Phase 0).

### Golden rules for the implementing agent (non-negotiable)

- **Additive only.** New files, new folders, new routes, new tables/collections, new columns with safe defaults. Do not rename, move or change the behaviour of existing store code.
- **Default = Online Store.** Every existing account and every code path that does not know about website type must resolve to ONLINE_STORE.
- **Isolate by folder.** All new code lives under an informative module (backend and frontend). Shared files get at most a small, clearly commented branch point.
- **Feature flag.** Everything new sits behind FEATURE_INFORMATIVE_WEBSITE. Flag off = the app behaves byte-for-byte as before.
- **Guard both directions.** Store APIs reject Informative accounts; Informative APIs reject Store accounts.
- **Prove no regression.** Existing test suite passes unchanged, and a manual Online Store smoke test (Section 8) passes before merge.
- **Follow existing conventions.** Same framework, state library, UI kit, folder style, naming, API style, auth and error handling as the current code. Do not introduce a new stack.

## Phase 0 — Codebase discovery (do this before writing code)

This plan is written without access to the Pictocart repo, so names below (Store, stores, /seller, etc.) are placeholders. The agent must map them to the real names first and write the findings to docs/informative/DISCOVERY.md.

- ☐ Identify the stack: backend framework, database + ORM/ODM, frontend framework, router, state management, UI/component library, styling system, auth method (JWT/session/OAuth), file/image upload service, hosting of public storefronts (subdomain, custom domain, path).
- ☐ Locate the onboarding flow: every step component, the step order/config, where step data is stored (local state, server draft, URL), and the final "create account/store" API call.
- ☐ Locate the account/tenant model: the User, Store/Shop/Tenant (or equivalent) entity, how a seller is linked to their store, and where the store slug/subdomain is set.
- ☐ Locate the seller panel shell: layout, sidebar/nav config, route definitions, route guards, dashboard home page.
- ☐ Locate the storefront renderer: how a theme is chosen and rendered, how existing store themes are registered, and how a public URL resolves to a store.
- ☐ Locate plans/billing/limits, if any, and note whether they are tied to store features.
- ☐ Locate migrations tooling and seed scripts.
- ☐ Run the full test suite and record the baseline (pass/fail counts). Record the Online Store onboarding flow with screenshots as the regression reference.
- ☐ List every file that must be touched outside the new informative folders. Target: 8 files or fewer, each change a small branch point. If more are needed, write why in DISCOVERY.md before continuing.

**Exit criteria:** DISCOVERY.md exists, maps every placeholder in this plan to a real file/symbol, and lists the shared touch points.

## Architecture and data model

One field, websiteType, on the existing store/tenant record decides everything. All informative content lives in new tables/collections keyed by that store's id, so no existing table changes shape except for this one column.

### The discriminator

- Add websiteType to the existing store/tenant entity: enum ONLINE_STORE | INFORMATIVE, NOT NULL, default ONLINE_STORE.
- Migration backfills every existing row to ONLINE_STORE. It must be reversible (down-migration drops the column).
- Expose websiteType in the auth/session payload (or the "current store" API) so the frontend can branch without an extra call.
- Create one shared constant/enum file, e.g. shared/constants/websiteType, and use it everywhere. No string literals.

### New entities (all new, all keyed by storeId)

| Entity | Key fields | Notes |
|---|---|---|
| InformativeSite | storeId (unique), themeId, businessName, tagline, category, about, logoUrl, faviconUrl, primaryColor, secondaryColor, fontPair, contact {phone, whatsapp, email, address, mapUrl}, hours[], socialLinks{}, seo {title, description, ogImage}, status (DRAFT/PUBLISHED), publishedAt | One per informative account. Holds theme + branding + profile. |
| InfoService | storeId, name, slug, shortDescription, description (rich text), imageUrl, priceType (FIXED/STARTING_FROM/ON_REQUEST/HIDDEN), price, currency, duration, category, isFeatured, isActive, sortOrder | Core content. Slug unique per store. |
| InfoPage | storeId, type (HOME/ABOUT/SERVICES/CONTACT/CUSTOM), title, slug, sections[] (JSON: {type, props, order, visible}), isPublished, sortOrder | Section-based pages so themes can render them. |
| InfoGalleryItem | storeId, imageUrl, caption, album, sortOrder | Portfolio/gallery. |
| InfoTeamMember | storeId, name, role, bio, photoUrl, sortOrder | Trainers, doctors, stylists, etc. |
| InfoTestimonial | storeId, authorName, authorPhotoUrl, rating (1–5), text, isVisible, sortOrder | Entered by the seller. Display only what the seller entered. |
| InfoFaq | storeId, question, answer, sortOrder | |
| InfoEnquiry | storeId, name, phone, email, message, serviceId (nullable), preferredDate, preferredTime, source (CONTACT_FORM/SERVICE_PAGE/WHATSAPP_CLICK), status (NEW/CONTACTED/CONVERTED/CLOSED), notes, createdAt | Leads from the public site. |

Rules:

- Timestamps (createdAt, updatedAt) and soft delete (deletedAt) on every entity, matching existing conventions.
- Index storeId on all; unique (storeId, slug) on services and pages.
- Use the existing image upload service and storage paths; put informative uploads under an informative/ prefix.
- Every query filters by the authenticated seller's storeId. No cross-tenant reads.

### Module layout

```
backend/
  modules/informative/
    routes/ controllers/ services/ models/ validators/ seed/ tests/
frontend/
  src/features/informative/
    onboarding/   panel/   themes/   api/   hooks/   types/
  src/shared/constants/websiteType.(ts|js)
```

Adapt to the real folder style found in Phase 0; the point is one folder per side that holds all new code.

## Onboarding flow

Onboarding gains one new first step, the website-type choice. Choosing Online Store hands control to the existing flow untouched; choosing Informative Website runs a new 4-step flow that lives entirely in features/informative/onboarding.

_Onboarding flow · 1 decision, 2 branches. The only new shared step is the website-type question; everything on the Informative branch is new code._

### Step 0 — Website type selector (new, shared entry)

- Inserted before the current first onboarding step (or right after signup if signup comes first; follow Phase 0 findings).
- Two large cards, single select, keyboard accessible:
  - **Online Store** — "Sell products online with cart, payments and orders."
  - **Informative Website** — "Showcase your services, get enquiries and bookings. Ideal for clinics, salons, gyms, consultancies, academies, interior designers."
- On continue: save websiteType in onboarding state (and in the server draft if one exists), then route:
  - ONLINE_STORE → the existing first step, same URL and same component as today.
  - INFORMATIVE → /onboarding/informative/basic-info.
- Back button on the first step of either branch returns to Step 0. Refresh keeps the choice.
- Flag off → Step 0 is skipped and users go straight to the existing flow.

### Informative Step 1 — Basic business info

| Field | Required | Validation |
|---|---|---|
| Business name | Yes | 2–80 chars |
| Business category | Yes | Dropdown: Consultancy, Clinic/Healthcare, Salon/Beauty, Gym/Fitness, Dance/Academy/Coaching, Events/Community, Interior Design, Personal Brand, Other |
| Tagline | No | max 120 chars |
| Phone | Yes | Reuse existing phone validator (country code) |
| WhatsApp number | No | "Same as phone" checkbox |
| Email | Yes | Email format |
| City / address | Yes (city), No (full address) | |
| Logo | No | Existing upload service; png/jpg/svg/webp, max 2 MB |
| Site slug / subdomain | Yes | Reuse the existing slug-availability check exactly as the store flow does |

### Informative Step 2 — Choose a theme

- Grid of the 11 theme cards (Section 5): thumbnail, name, one-line "best for" text, colour swatches.
- Recommended badge on 1–2 themes based on the category picked in Step 1 (mapping in Section 5). All 11 remain selectable.
- "Preview" opens a full-screen live preview rendered with the user's business name, logo and demo services, with desktop/mobile toggle.
- Selection required to continue.

### Informative Step 3 — Starter services (optional, skippable)

- Add up to 3 services quickly: name, short description, price type + price. "Skip, I'll add later" link.
- If skipped, seed 3 category-appropriate sample services marked as samples (isSample: true or a visible "Sample" label in the panel) so the site never looks empty.

### Informative Step 4 — Create account

- Reuse the existing account-creation form, auth API and password rules. If the account already exists at this point in the current flow, reuse that ordering instead.
- One new backend endpoint, e.g. POST /api/informative/onboarding/complete, which in a single DB transaction:
  - creates the store/tenant record with websiteType = INFORMATIVE (via the existing store-creation service, passing the type; no copy-paste of store logic);
  - creates InformativeSite with theme, branding and contact info;
  - creates default InfoPages (Home, About, Services, Contact) with the theme's default sections;
  - creates the starter or sample services;
  - leaves site status DRAFT.
- Must not create any store-only records (default categories, shipping zones, payment settings, product samples, etc.). Phase 0 lists which ones the store flow creates; skip them all for Informative.
- On success redirect to /informative/dashboard with a welcome checklist.
- Idempotent: a double submit cannot create two sites.

### Analytics events (if the app has analytics)

onboarding_type_selected {type}, informative_theme_previewed {themeId}, informative_theme_selected {themeId}, informative_onboarding_completed.

## The 11 service themes

All 11 themes share one section library and one data contract; a theme is a config of design tokens plus layout variants, not a separate codebase. This keeps 11 themes maintainable and lets a seller switch themes later without losing content.

### Theme system design

- **Location:** features/informative/themes/ with registry.(ts|js), sections/ (shared section components) and one folder per theme (nexus-core/, aura-one/, …) holding theme.config, thumbnail.webp and any variant overrides.
- **Theme config contract:** { id, name, bestFor, recommendedCategories[], tokens: { colors {primary, secondary, accent, background, surface, text, mutedText}, fonts {heading, body}, radius, shadow, spacing }, layout: { header, hero, servicesStyle, footer }, defaultSections[], motion }.
- Tokens are applied as CSS variables on the site root, so the seller's custom primary/secondary colours override the theme defaults cleanly.
- **Shared sections** (each takes typed props and reads tokens only): Header/Nav, Hero, About, ServicesGrid, ServicesList, ServiceDetail, WhyChooseUs/Highlights, Stats, Team, Gallery, Testimonials, Pricing, FAQ, CTA band, Contact + map, Enquiry form, Footer, Floating WhatsApp/Call button.
- Each theme picks variants (e.g. hero: 'split' | 'fullBleedImage' | 'carousel' | 'typographic') and default section order.
- Do not reuse or edit existing store themes. Informative themes are a separate registry.
- Every theme: mobile-first, responsive at 360 / 768 / 1280 px, WCAG AA contrast for text, lazy-loaded images, respects prefers-reduced-motion.
- Use the existing font loading approach; if fonts are self-hosted, add only the fonts these themes need.

### Theme specifications

Colours and fonts below are starting proposals for the designer/agent to refine; names and positioning come from the brief.

| # | Theme (id) | Best for | Palette direction | Fonts (heading / body) | Hero + layout signature | Recommended categories |
|---|---|---|---|---|---|---|
| 1 | Nexus Core (nexus-core) | Modern formal look; consultancies, CA/legal, agencies | Navy #0F2A44, slate #4A5B6C, white, teal accent #1FA2A6 | Inter / Inter | Split hero with headline + CTA; clean grid; credentials/stats strip | Consultancy, Other |
| 2 | Aura One (aura-one) | Firms targeting aspiring customers; dance academies, public speaking, community events | Warm violet #6C3FC5, coral #FF7A59, cream | Poppins / Nunito | Full-bleed image/video hero; events/batches cards; testimonial carousel | Dance/Academy/Coaching, Events/Community |
| 3 | Zenith Prime (zenith-prime) | Health and confidence; clinics | Clinical teal #0E9F8E, soft blue #3B82F6, white, mint surfaces | Manrope / Source Sans 3 | Calm split hero with "Book appointment" CTA; doctors team grid; timings block | Clinic/Healthcare |
| 4 | Prism Deck (prism-deck) | Ultra-modern vibe for a younger audience | Gradient indigo #4F46E5 → pink #EC4899, near-black surfaces | Space Grotesk / Inter | Bold gradient hero; card deck services with tilt hover; bento grid | Personal Brand, Events/Community, Other |
| 5 | Ascent Peak (ascent-peak) | Uphill mountain theme; gyms and fitness | Charcoal #1C1F24, energetic orange #FF6B00, mountain grey | Oswald / Roboto | Mountain-silhouette hero with "climb" progress motif; programs + trainers; membership pricing | Gym/Fitness |
| 6 | Vibe Shift (vibe-shift) | Rotating imagery and colour across environments; interior designers | Palette shifts per hero slide (sage, terracotta, sand, slate) over warm white | Playfair Display / Lato | Rotating full-screen carousel where accent colour changes with each environment; masonry portfolio | Interior Design |
| 7 | Neon Slate (neon-slate) | Ultra-modern vibe for a younger audience (darker sibling of Prism Deck) | Slate #0B0F14, neon green #39FF14, electric cyan #00E5FF | Sora / Inter | Dark hero with neon glow headline; glassmorphism service cards | Personal Brand, Gym/Fitness, Events/Community |
| 8 | Style Capital (style-capital) | Personal branding; business centred on the owner | Off-white #FAF7F2, ink #111111, accent burgundy #8C1C3A | DM Serif Display / DM Sans | Large owner portrait hero with signature-style name; "About me" first; media/features strip | Personal Brand, Consultancy |
| 9 | Pure Gold (pure-gold) | Golden/black classy palette | Black #0A0A0A, gold #C9A227, ivory text | Cormorant Garamond / Montserrat | Dark luxurious hero with gold rules; premium service menu; elegant testimonials | Salon/Beauty, Consultancy, Interior Design |
| 10 | Radiant Alpha (radiant-alpha) | Salons and beauty parlours | Blush #F8C8D0, rose gold #B76E79, soft white | Marcellus / Jost | Soft image hero; service menu with prices and durations; gallery before/after grid; stylists | Salon/Beauty |
| 11 | Smooth Wave (smooth-wave) | Ultra-soothing look | Seafoam #A8DADC, powder blue #CDE7F0, sand #F1E9DA | Quicksand / Nunito Sans | Wave-shaped section dividers; gentle fades; airy spacing | Clinic/Healthcare, Wellness, Other |

### Demo content per theme

Each theme ships demo content for its primary category (business name, 6 services, 3 testimonials, 4 FAQs, 6 gallery images from a licensed/royalty-free set) used only in onboarding previews and the theme switcher. Demo content is never saved to the seller's account except as clearly marked sample services (Step 3).

### Category → recommended theme map

Store this as config (recommendedCategories above). If no match, recommend Nexus Core and Smooth Wave.

## Informative seller panel

Informative accounts get their own panel under /informative/* that reuses the existing panel layout shell (header, profile menu, styling) but swaps in its own sidebar and pages. Store accounts never see it, and Informative accounts never see store pages.

### Routing and guards

- After login, a single redirect helper decides the home route: ONLINE_STORE → existing dashboard route (unchanged), INFORMATIVE → /informative/dashboard.
- InformativeRouteGuard: wraps all /informative/* routes; non-informative users are redirected to the store dashboard.
- StoreRouteGuard (or an extra check in the existing guard): informative users hitting any store-only route (products, orders, inventory, payments, shipping, coupons, customers) are redirected to /informative/dashboard. Implement as a wrapper, not by editing each store page.
- Sidebar: pick storeNavConfig (existing, untouched) or informativeNavConfig (new) by websiteType. This is one of the few shared branch points.
- Shared account pages (profile, password, subscription/billing if present, logout) stay shared and work for both types.

### Sidebar and modules

| Menu item | Route | What the seller can do |
|---|---|---|
| Dashboard | /informative/dashboard | Setup checklist (logo, 3+ services, contact info, theme, publish), new enquiries count, last 5 enquiries, site status, "View site" and "Publish" buttons |
| Services | /informative/services | List, search, filter by category, add/edit/delete, drag to reorder, toggle active/featured, image upload, price type, duration, duplicate |
| Pages | /informative/pages | Edit Home/About/Services/Contact sections: show/hide, reorder, edit text and images per section; add custom pages |
| Gallery | /informative/gallery | Multi-upload, captions, albums, reorder, delete |
| Team | /informative/team | CRUD team members with photo, role, bio |
| Testimonials | /informative/testimonials | CRUD, rating, show/hide |
| FAQs | /informative/faqs | CRUD, reorder |
| Enquiries | /informative/enquiries | Table of leads with filters (status, service, date), detail drawer, status change, private notes, click-to-call/WhatsApp/email, CSV export |
| Appearance | /informative/appearance | Switch theme (with preview, content kept), logo, favicon, primary/secondary colours, font pair, hero image |
| Business info | /informative/business | Name, tagline, category, contact, address + map link, opening hours per day, social links |
| SEO | /informative/seo | Site title, meta description, OG image; per-service and per-page SEO fields |
| Domain | /informative/domain | Reuse the existing subdomain/custom-domain feature if it exists; otherwise show the subdomain only |
| Settings | /informative/settings | Enquiry notification email/WhatsApp toggles, unpublish site, delete site (reuse existing account deletion) |

### Panel behaviour

- **Preview and publish:** "Preview" renders the draft in a new tab; "Publish" sets status PUBLISHED and publishedAt. Later edits go live immediately (v1), unless the store side already uses a draft/publish model, in which case mirror it.
- **Notifications:** on a new enquiry, send an email (existing mail service) and an in-app badge. WhatsApp/SMS only if the platform already has that integration.
- **Empty states:** every list has an empty state with a primary "Add" button and a one-line tip.
- **Validation:** same validation library and error-toast pattern as the store panel.
- **Permissions:** if the store panel has staff/roles, apply the same roles to informative routes.

## Public site rendering and APIs

The public URL resolver keeps working as it does today and gains one branch: if the resolved store is INFORMATIVE, render the informative theme renderer instead of the storefront. Nothing else in the storefront path changes.

### Public site

- Resolver branch point (one shared file): `store.websiteType === 'INFORMATIVE' ? <InformativeSiteRenderer/> : <existing storefront>`.
- Routes on the public site: / (Home), /about, /services, /services/:slug, /gallery, /contact, /:customPageSlug. Hide menu items whose content is empty.
- DRAFT sites show a "Coming soon" page to the public; the owner sees the draft when logged in or via a signed preview link.
- SEO: server-render or pre-render if the storefront already does; title/meta/OG from InformativeSite.seo and per-page fields; sitemap.xml and robots.txt per site; JSON-LD LocalBusiness (name, address, phone, hours) and Service entries.
- Contact affordances: click-to-call, WhatsApp deep link (`https://wa.me/<number>?text=...`), map link, sticky mobile CTA.
- Performance target: Lighthouse mobile ≥ 85 for performance, ≥ 95 for accessibility and SEO on a demo site per theme.

### Enquiry form

- Fields: name (required), phone (required), email, service (dropdown of active services, prefilled on a service page), preferred date/time (shown when the category is clinic, salon, gym or academy, or when the seller enables it), message.
- Spam protection: honeypot field + rate limit per IP and per site (e.g. 5 per 10 min). Use the existing captcha if the platform already has one.
- Success message configurable; on submit create InfoEnquiry and trigger notifications.
- Consent line with a link to the site's privacy text (generated default, editable).

### API surface (all under /api/informative)

| Method + path | Auth | Purpose |
|---|---|---|
| POST /onboarding/complete | New user / session | Create store (type INFORMATIVE) + site + pages + services in one transaction |
| GET /themes | Public | Theme registry metadata for onboarding and switcher |
| GET, PATCH /site | Seller (informative) | Profile, branding, theme, SEO, status |
| POST /site/publish, POST /site/unpublish | Seller | Publish controls |
| GET, POST /services; GET, PATCH, DELETE /services/:id; PATCH /services/reorder | Seller | Services CRUD |
| Same CRUD + reorder for /pages, /gallery, /team, /testimonials, /faqs | Seller | Content CRUD |
| GET /enquiries, GET, PATCH /enquiries/:id, GET /enquiries/export | Seller | Leads |
| GET /dashboard/summary | Seller | Checklist + counts |
| GET /public/:siteSlug (+ /services/:slug, /pages/:slug) | Public | Published site data |
| POST /public/:siteSlug/enquiries | Public, rate-limited | Submit enquiry |

API rules:

- One middleware requireWebsiteType('INFORMATIVE') on every seller route above; store routes get requireWebsiteType('ONLINE_STORE') added via a router-level wrapper, not per-handler edits. Accounts with no value are treated as ONLINE_STORE.
- Validate every body with the existing validation library; sanitize rich text (allow-list HTML).
- Public endpoints return only published, active, non-deleted content and never expose seller emails, notes or internal ids beyond what rendering needs.
- Pagination, sorting and error shapes follow existing API conventions.

## Isolation, testing, acceptance and rollout

The release is safe when the Online Store regression checklist passes with the flag both on and off, and every acceptance criterion below passes for Informative.

### Allowed shared touch points (expected list)

| Shared file (placeholder) | Allowed change |
|---|---|
| Store/tenant model + one migration | Add websiteType column, default ONLINE_STORE |
| Store-creation service | Accept an optional websiteType param (default ONLINE_STORE); skip store-only seeding when INFORMATIVE |
| Onboarding entry/router | Insert Step 0 behind the flag |
| Auth/session payload | Include websiteType |
| Post-login redirect | Branch by websiteType |
| Panel sidebar selector | Choose nav config by websiteType |
| Store route registration | Wrap with requireWebsiteType('ONLINE_STORE') and the frontend guard |
| Public site resolver | Branch to the informative renderer |

Each branch point carries a comment `// INFORMATIVE: branch point — see docs/informative/PLAN.md`. Anything outside this list needs a written reason in DISCOVERY.md.

### Feature flag

- FEATURE_INFORMATIVE_WEBSITE (env/config, using the existing flag mechanism if any). Off by default in production until sign-off.
- Flag off: Step 0 hidden, informative routes return 404, the public resolver ignores the branch. Existing informative accounts (if any) see a maintenance page instead of breaking.

### Tests

- **Unit:** enum defaults, validators, theme registry (all 11 themes load, every config passes the schema, every recommended category is valid), slug uniqueness, price display formatting.
- **API/integration:** onboarding-complete transaction (all-or-nothing, idempotent), tenant isolation (seller A cannot read/edit seller B), type guards in both directions, public endpoints hide drafts/inactive/deleted, enquiry rate limit and honeypot.
- **Frontend component:** Step 0 routing, each informative onboarding step's validation, theme picker + preview, each panel page's CRUD happy path.
- **E2E (existing E2E tool):**
  - Online Store onboarding end to end, flag on → identical result to baseline.
  - Online Store onboarding, flag off → identical to baseline, no Step 0.
  - Informative: signup → type → basic info → theme → skip services → account → dashboard → add a service → publish → visit public site → submit enquiry → enquiry visible in panel.
  - Informative user opens a store URL (e.g. products) → redirected to informative dashboard. Store user opens /informative/services → redirected to store dashboard.
  - Theme switch keeps all content.
- **Visual:** screenshot every theme at 360 / 768 / 1280 px with demo content.
- **Baseline:** the full pre-existing test suite passes with zero modified existing tests. If an existing test must change, stop and document why.

### Online Store regression checklist (manual, before merge)

- ☐ Existing seller logs in and lands on the same dashboard as before.
- ☐ New store onboarding completes with the same steps, same data created.
- ☐ Product create/edit, order flow, checkout, payments, storefront render unchanged.
- ☐ Existing storefront URLs and custom domains resolve as before.
- ☐ DB check: all pre-existing store rows have websiteType = ONLINE_STORE; no other column changed.

### Acceptance criteria (Informative)

- ☐ Onboarding offers both types; Informative path completes in under 3 minutes with required fields only.
- ☐ All 11 themes selectable, previewable with the user's name/logo, and rendered correctly on mobile and desktop.
- ☐ After account creation the user lands on the Informative dashboard; the sidebar shows only informative items.
- ☐ Seller can CRUD services, pages sections, gallery, team, testimonials, FAQs; change theme and branding; edit SEO; publish/unpublish.
- ☐ Public site shows published content only; enquiry form works and notifies the seller.
- ☐ No store-only API or page is reachable by an informative account, and vice versa.

### Rollout

- Merge behind the flag (off) → deploy → run migrations (backfill verified).
- Enable for internal/test accounts → run E2E on staging and production.
- Enable for all new signups → monitor errors, onboarding completion rate by type, enquiry submissions.
- Rollback = turn the flag off. The websiteType column stays (harmless default).

## Task breakdown and agent prompt

Build in nine milestones. Each one ends with a commit, a green test suite and a short note in docs/informative/PROGRESS.md. The agent should not start a milestone until the previous one is green.

- **M0 — Discovery:** produce DISCOVERY.md (Phase 0). Record the baseline test results.
- **M1 — Foundation:** websiteType enum + migration + backfill, feature flag, session payload, backend requireWebsiteType middleware, frontend guards, post-login redirect. Online Store regression check.
- **M2 — Data layer:** all new informative models, indexes, validators, CRUD services, tenant-isolation tests.
- **M3 — Theme system:** section library, registry, token-to-CSS-variable pipeline, 11 theme configs, demo content, thumbnails, visual snapshots.
- **M4 — Onboarding:** Step 0 selector, Informative steps 1–4, preview modal, POST /onboarding/complete transaction, sample services.
- **M5 — Seller panel:** sidebar config, dashboard + checklist, Services, Pages, Gallery, Team, Testimonials, FAQs, Business info, Appearance, SEO, Domain, Settings.
- **M6 — Public site:** resolver branch, renderer, routes, draft/coming-soon, SEO (meta, sitemap, JSON-LD), WhatsApp/call CTAs.
- **M7 — Enquiries:** public form, spam protection, notifications, panel inbox, CSV export.
- **M8 — Hardening:** E2E suite, accessibility and Lighthouse checks, Online Store regression checklist, rollout notes.

### Prompt to paste into the Claude agent

> You are implementing a new "Informative Website" product type in the Pictocart codebase. The full plan is in docs/informative/PLAN.md (this document). Follow it exactly.
>
> Hard rules:
> 1. Do NOT change the behaviour of the existing Online Store feature. Additive changes only.
> 2. All new code goes under backend modules/informative and frontend features/informative (adapt to the repo's real folder conventions).
> 3. Shared files may only get the small branch points listed in the plan's "Allowed shared touch points" table. Mark each with: // INFORMATIVE: branch point.
> 4. websiteType defaults to ONLINE_STORE everywhere. Existing rows are backfilled to ONLINE_STORE.
> 5. Everything is behind the FEATURE_INFORMATIVE_WEBSITE flag. Flag off = app identical to today.
> 6. Use the existing stack, libraries, UI kit, auth, upload service, validation and API conventions. Do not add a new framework.
> 7. Never modify existing tests to make them pass. If one fails, stop and report.
>
> Process:
> - Start with Milestone M0 (Phase 0 discovery). Write docs/informative/DISCOVERY.md and show it to me before writing feature code.
> - Then work milestone by milestone (M1..M8). After each: run the full test suite, run the Online Store regression checks, update docs/informative/PROGRESS.md, and commit.
> - If anything in the plan conflicts with the real codebase, choose the option that touches the existing store code least, and note the decision in PROGRESS.md.

## Open questions to settle with the product owner

- Should Informative sites be on a separate, cheaper subscription plan? (Plan assumes the same plans unless billing is feature-gated.)
- Custom domain for Informative sites in v1, or subdomain only?
- Is real appointment booking (calendar slots) needed later? v1 uses an enquiry with a preferred date/time.
- Who supplies theme imagery: licensed stock set, or a designer?
