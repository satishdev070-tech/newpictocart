# Informative Website — M0 Discovery

_Date: 2026-11-11 · Branch `claude/informative-website` (from `origin/main` @ `b64f13b`, #124) · Plan: [PLAN.md](./PLAN.md), transcribed from the owner's .docx, which is the source of truth_

**Status: awaiting product-owner review. No feature code has been written.** Section 7 lists the
decisions that block M1.

---

## 0. Headline finding

**The repo already ships a first version of "informative website".** It is a presentation mode of
an ordinary online store, not a separate product:

| Existing piece | Where | What it does |
|---|---|---|
| `stores.site_mode` (`'ecommerce' \| 'informative'`, default `ecommerce`) | `supabase/migrations/20261019003300_site_mode.sql` | Per-store mode. **Switchable** in Settings; no data is deleted |
| Pure mode rules | `src/features/stores/site-mode.ts` | `siteRouteAllowed` (cart/checkout/account 404), `effectiveHeader` (hides cart icons), `navForSiteMode` (hides commerce nav), `modeAfterThemeApply` |
| Server reads / guard | `src/features/stores/site-mode-server.ts` | `getStoreSiteMode` (cached per tenant), `requireEcommerceSite` (cart/checkout actions) |
| Flag | `src/features/stores/informative-flag.ts` → `NEXT_PUBLIC_INFORMATIVE_SITES_ENABLED` (off; `.env.example:96`) | Gates *creating* or *switching to* informative mode; legacy informative stores keep working |
| 10 brochure theme presets | `src/features/theme/marketplace/themes/informative.ts` (`siteType: "informative"`) | Global Vision, Urbanistic Studio, Pan Pizza, Medicare, Wedding Wonders, Archgenius, Easy Loans, Envoy Visa, Belle Curls, ShineX. They are store-theme presets on the shared section renderer, hidden from discovery by `ecommerceMarketplaceThemes()` (`catalog.ts:123`) |
| Onboarding hooks | `/start` quiz (`quiz-screen.tsx`, a site-type question when the flag is on), legacy `/onboarding` `site-type-picker.tsx`, `finalizeStartDraftAction` → `setSiteMode` | Choose informative mode inside the store journey |
| Enquiries | `contact_messages` + `submit_contact_message()` (SECURITY DEFINER), `features/notifications/email/contact-action.ts`, `features/storefront/actions.ts` (popup form: honeypot, 5/h rate limit, `sendContactFormEmail`) | Contact form → table + email; Dashboard → Contact Messages |

**How the plan relates.** The plan's INFORMATIVE type is a *separate product*: its own tables, panel,
public renderer and 11 themes, with a type that never changes. That is different from the existing
mode, which is still a store (a store row, inventory location, store theme config, and a switch back
to ecommerce).

**Proposal (D1).** Build the plan as a new type beside the existing mode and leave the existing
mode untouched. Rule 1 ("do not change Online Store behaviour") covers that mode too, since today it
is part of the store product. Section 3 shows how the new type reuses the old mode's guards for free.

---

## 1. Baseline

### 1.1 `pnpm check` on clean `origin/main` (`b64f13b`)

| Run | typecheck | lint (0 warnings) | vitest | build | Result |
|---|---|---|---|---|---|
| 1 | ✅ | ✅ | ❌ 1 failed / 2090 passed (195 files) | not reached | exit 1 |
| 1b: failing file alone | | | ✅ 3/3 in 3.7 s | | pass |
| 2 | ✅ | ✅ | ✅ **195 files / 2091 tests passed** | ✅ (229 routes) | **exit 0** in 5 min 35 s |

The failure in run 1 was `tests/unit/ci/validate-worker-secrets.test.ts › accepts a complete
wipe-safe secrets file`, which timed out at 5000 ms. The test spawns a `tsx` subprocess. Alone it
takes about 3.7 s, close to the default 5 s limit, so under a full parallel run it is **flaky**. It is
pre-existing and has nothing to do with this work. Per rule 7 I have **not** changed it. Recommended
follow-up, outside this project: give that `describe` a longer timeout.

### 1.2 Online Store onboarding at `/start` (flag off, recorded 2026-11-11)

I recorded this in the browser pane against the local dev server (`localhost:3000`, serving the main
checkout; `/start` code is identical to `origin/main` apart from a new `src/app/start/layout.tsx`
metadata file). I stopped at the account step and created nothing. The test draft was cleared from
localStorage afterwards.

| # | URL | Screen | Notes |
|---|---|---|---|
| 1 | `/start` → `/start/lang` | "Start Your Journey": English / हिन्दी | "Step 1 of 5 · 20%". Header: Sign in, "Voice on", language |
| 2 | `/start/path` | "How would you like to build your store?" | AI Voice Assistant ("Coming Soon"; `NEXT_PUBLIC_VOICE_ONBOARDING_ENABLED` off) / Quick Setup Quiz |
| 3 | `/start/quiz` | Quiz Q1–Q4 | Store name → category (Fashion, Beauty, Jewellery, Grocery, Handicrafts, Home Décor, More) → subcategory chips (+ Add) → city (Skip). **No site-type question** (flag off) |
| 4 | `/start/theme` | "Let's design your storefront" | AI-recommended theme ("Earth & Artisan · Recommended") + 4 alternatives, live mock previews with prices |
| 5 | `/start/account` | "Create Your Store" | Google or email (OTP). "Free forever for up to 10 products." |
| 6 | `/start/building` → `/start/done` | (not exercised) | `finalizeStartDraftAction`: `create_tenant` RPC → draft store → category/site_mode → shipping rates + COD → `seedReadyStore` (products + theme) |

The draft lives in localStorage `pictocart.start.draft.v1` plus cookie `pc_start_draft=1` (ADR-039).
These steps are the **Online Store regression script** for every milestone: the flow must stay the
same with the new flag off **and** on (after choosing "Online Store").

### 1.3 Regression checks to repeat after each milestone

0. The plan's manual Online Store regression checklist (PLAN.md, "Online Store regression checklist"): existing
   seller lands on the same dashboard; new store onboarding creates the same steps and data; products, orders,
   checkout, payments and storefront unchanged; storefront URLs and custom domains resolve; all pre-existing
   rows have `website_type = 'ONLINE_STORE'` and no other column changed.
1. `pnpm check` (allowing for the flaky test in §1.1).
2. The `/start` walk above, flag off, plus flag on with "Online Store" chosen.
3. `tests/unit/styles/css-layer-order.test.ts` and `scripts/ci/check-worker-css.mts` (storefront CSS layer order).
4. `tests/unit/next/root-metadata-imports.test.ts` (Worker graph stays light).
5. Existing site-mode tests (`tests/unit/stores/*`, `ecommerce-marketplace-themes.test.ts`, `theme-marketplace.test.ts`) unchanged and green.

---

## 2. Map: plan names → this codebase

| Plan placeholder | Real thing here |
|---|---|
| tenant / store record | `public.tenants` (account, status, plan, slug) + `public.stores` (1:1 profile, PK `tenant_id`) — ADR-012. **"Store id" = `tenant_id`.** |
| store-creation service | `public.create_tenant(name, slug, root_domain)` RPC (`20261023003600_free_plan.sql`). Creates tenants + stores + **domains** + **owner membership** + **`inventory_locations` "Main warehouse"** + audit. Called from `features/start/actions.ts` (`createOrResumeStore`) and legacy `features/onboarding` |
| session / current-store payload | `requireTenant()` → `TenantContext` (`src/lib/tenant/membership.ts`); memberships select `tenants!inner(id, name, slug, status)`; active tenant cookie `paliya_tenant` |
| post-login redirect | `src/lib/auth/role-routing.ts` (`SELLER_HOME="/dashboard"`, `ONBOARDING_HOME="/start"`, `landingFor`) — ADR-040 |
| sidebar / nav config | `DASHBOARD_NAV` (`src/components/dashboard/nav.ts`) filtered in `src/app/dashboard/layout.tsx` via `navForSiteMode`; shell `src/components/app-shell/*` |
| store route registration | `src/lib/tenant/routing.ts` `decideRoute` + `PLATFORM_ONLY_PREFIXES` (paths that 404 on store hosts) |
| public resolver | `resolveStorefrontTenant(host)` → `tenantDirectory.findByHost` (`src/lib/tenant/directory.ts`, admin client per ADR-006, cached) used by `src/app/store/[host]/layout.tsx` |
| onboarding entry | `src/app/start/page.tsx` (bare `/start` → `/start/lang`), `/start/[step]`, journey in `src/features/start/*` |
| feature flags | Two systems: (a) build-time `NEXT_PUBLIC_*` env (e.g. the informative and voice flags); (b) DB `feature_flags` + `tenant_feature_flags` + plan features → `tenant_entitlements()` (`src/features/platform/flags.ts`), **per tenant** |
| upload service | `uploadTenantImage(tenantId, area, file)` (`src/lib/storage/upload.ts`): path `tenant/{id}/{area}/{uuid}.{ext}`, 10 MB cap, sniffing, WebP variants. Storage RLS checks only the tenant prefix plus `catalog.write`/`content.write` (no per-area policy) |
| slug availability | `isValidStoreSlug` (`src/lib/tenant/host.ts`) + the `tenants.slug` unique constraint (`23505` → "address taken" in `createOrResumeStore`). No standalone "check availability" endpoint exists today |
| phone validator | `normalizeWhatsapp` (start actions), `features/settings` schemas (`whatsappNumberSchema`) — to confirm in M4 |
| email service | `sendEmail()` (`src/lib/email/send.ts`, Resend + `email_log` + idempotency); `sendContactFormEmail` |
| rate limit | `rateLimit(bucket, subject, limit, windowSeconds)` + `clientIpKey()` (`src/lib/rate-limit.ts`, Postgres `svc_rate_limit`, ADR-025) |
| analytics | No generic platform event sink. Marketing uses `data-analytics` attributes (`features/marketing-site/analytics.ts`); platform GA4 / Meta Pixel / first-party pageviews (`features/platform-analytics`, #123); storefront `trackStoreEvent` (per store) |
| domain feature | `src/features/domains/*` (custom domains, Cloudflare/Vercel, DNS verify) |
| permissions | `src/lib/permissions/matrix.ts` — 27 tenant keys incl. `content.write`, `theme.edit`, `theme.publish`, `settings.write`, `domains.manage`, `customers.read`, `store.read` |
| coming-soon | `stores.launch_status` (`draft`/`live`, migration 2400) via `isHiddenDraft` → `src/app/store/[host]/coming-soon.tsx` |
| fonts | `next/font/local` from `@fontsource*` (ADR-019) in `src/app/storefront-fonts.ts`, `preload: false` |
| E2E | **No Playwright test suite.** `@playwright/test` is used only by screenshot scripts (`scripts/dev/*shots.mts`, `scripts/dev/protect/visual-baseline.mts`, `scripts/themes/capture-previews.mts`). DB/RLS tests in `tests/rls` via `pnpm test:db` |

---

## 3. Proposed architecture (for review)

### D1 — Website type: new immutable column, kept apart from `site_mode`

- New migration: `alter table public.tenants add column website_type text not null default 'ONLINE_STORE' check (website_type in ('ONLINE_STORE','INFORMATIVE'))`.
  The default backfills every existing row. A trigger rejects `update` of `website_type`, which enforces
  "no switching". I chose text + check over a Postgres enum to match every other status column in the
  repo; the values are the plan's.
  **Down:** drop the trigger, drop the column.
- Shared constant `WEBSITE_TYPES` / `DEFAULT_WEBSITE_TYPE` / `parseWebsiteType` in
  `src/features/informative/website-type.ts`. Like `parseSiteMode`, unknown or missing values read
  as `ONLINE_STORE`.
- **Defence in depth at no cost:** INFORMATIVE tenants are also created with
  `stores.site_mode = 'informative'`. Every existing commerce guard (cart, checkout and account routes
  404; `requireEcommerceSite` in actions; header icons) then already applies to them, without touching
  store code.
- Existing `site_mode='informative'` stores stay `ONLINE_STORE` (legacy brochure mode). Nothing about them changes.

### D2 — Flag `FEATURE_INFORMATIVE_WEBSITE`

- A server-side env var, validated in `src/lib/env` with values `off` (default) | `internal` | `all`.
  This maps onto the plan's three rollout stages. `internal` means users with an active
  `platform_memberships` row. Rollback is `off`.
- The value is read on the server and passed to client components as a prop, so it is not baked in
  at build time (unlike `NEXT_PUBLIC_*`). This also lets the Worker flip it with a secret/var change
  and no rebuild.
- With the flag `off`: no selector, the `/informative` routes 404 for store accounts, no new
  INFORMATIVE tenant can be created, and onboarding is byte-identical to today.
- **Tenants already created as INFORMATIVE, when the flag is later turned off:** per the .docx they
  "see a maintenance page instead of breaking". Their panel shows a maintenance page, and their
  public site shows a maintenance / coming-soon page. They are never 404s, and they are never
  dropped into the store dashboard.
- "Using the existing flag mechanism if any": the repo has build-time `NEXT_PUBLIC_*` env flags and
  per-tenant DB `feature_flags`. The DB flags cannot gate onboarding, because no tenant exists yet,
  so I propose a server env var. An alternative to the `internal` stage is a DB `feature_flags`
  default toggled from Admin (Q2).

### D3 — Themes: a separate informative registry (no edits to marketplace themes)

- The 11 new themes live in `src/features/informative/themes/` as config objects (tokens + layout
  variants), rendered by one informative section library. Tokens become CSS variables in a scoped
  `<style>`, the same way `ThemeTokensStyle` works.
- They are **not** added to `MARKETPLACE_THEMES`. Marketplace counts (186), `ecommerceMarketplaceThemes`,
  marketing theme pages, `src/app/sitemap.ts` and their tests are therefore unaffected.
- **The 10 existing brochure presets stay as they are**, serving legacy `site_mode` stores. Choosing
  between "retire them" and "map them onto the new registry" is a later product decision; nothing in
  v1 depends on it.
- **Worker constraints:**
  - The registry is imported only from informative routes, never from the proxy, root layout,
    (marketing) layout or root sitemap.
  - Theme demo content stays as small static data.
  - Informative CSS is mostly Tailwind utilities plus CSS variables, kept small. Any CSS file starts
    with the full `@layer properties, theme, base, components, utilities;` statement.
  - Cost to note: new Tailwind classes in informative files are added to the shared utilities
    stylesheet. I will measure it with `check-worker-css`.
- **Fonts (needs a decision, Q3):**

| Font | Status |
|---|---|
| Inter, Poppins, Manrope, Space Grotesk, Playfair Display, DM Sans, Cormorant Garamond, Montserrat, Marcellus, Jost, Roboto | Already installed (`@fontsource*`) |
| Nunito, Source Sans 3, Oswald, Lato, Sora, DM Serif Display, Quicksand, Nunito Sans | **Missing** (8) |

  Adding the missing fonts means 8 new `@fontsource` dev dependencies plus entries in a new
  informative font file (`preload: false`, so a font downloads only when a theme uses it). Store
  fonts are not touched.

### D4 — Data layer

All new tables are keyed by `tenant_id` (the plan's "store id"). They follow ADR-013 (`unique (tenant_id, id)` and
composite FKs), have `created_at` / `updated_at` / `deleted_at`, an index on `(tenant_id, …)`, and
`app.add_standard_triggers`.

| Plan | Table | Notes |
|---|---|---|
| InformativeSite | `info_sites` (PK `tenant_id`) | `theme_key`, `branding` jsonb, `contact` jsonb, `hours` jsonb, `social` jsonb, `seo` jsonb, `category`, `status` `DRAFT`/`PUBLISHED`, `published_at` |
| InfoService | `info_services` | `slug` unique per tenant (where not deleted), `price_type`, `price_paise` **integer paise in TS / `numeric(12,2)` in DB (ADR-008)**, `duration_minutes`, `category`, `featured`, `active`, `sort_order`, `is_sample` |
| InfoPage | `info_pages` | `type` `HOME`/`ABOUT`/`SERVICES`/`CONTACT`/`CUSTOM`, `slug`, `sections` jsonb (zod-validated on save **and** render), `published` |
| InfoGalleryItem | `info_gallery_items` | `image_path`, `alt`, `caption`, `sort_order` |
| InfoTeamMember | `info_team_members` | `name`, `role`, `bio`, `photo_path`, `sort_order` |
| InfoTestimonial | `info_testimonials` | `rating` 1–5 check, `visible` |
| InfoFaq | `info_faqs` | `question`, `answer`, `sort_order`, `visible` |
| InfoEnquiry | `info_enquiries` | `source`, `status`, `notes`, `service_id`, `preferred_at`, `consent_at`; **no direct insert**: write path is a SECURITY DEFINER `submit_info_enquiry()` (pattern of `submit_contact_message`) |

- **RLS: reuse existing permission keys, no matrix change.**

| Data | Read | Write |
|---|---|---|
| Content (services, pages, gallery, team, testimonials, FAQs) | `content.write` | `content.write` |
| Site settings | `store.read` | `settings.write` (appearance: `theme.edit`; publish: `theme.publish`) |
| Enquiries | `customers.read` | `customers.write` |
| Domain | — | `domains.manage` |

  Public (anon) read is allowed only when the site is `PUBLISHED`, the row is active or visible,
  `deleted_at is null`, and `app.tenant_is_open`.
- **Uploads:** `tenant/{tenantId}/informative/{uuid}.{ext}`. This needs `"informative"` added to
  `UPLOAD_AREAS` in `src/lib/storage/upload.ts` (one line; reason in §4). The storage RLS policy
  already covers it. The logo's 2 MB cap is enforced in the informative layer before the call.
- RLS tests go in `tests/rls/informative.test.ts` (isolation, draft hiding, enquiry write path).

### D5 — Onboarding

- **Step 0 = one branch in `src/app/start/page.tsx`.** With the flag on, bare `/start` goes to a new
  static route, `/start/build`: two accessible cards (radio group). "Online Store" → `/start/lang`,
  the existing journey with no change. "Informative Website" → `/start/informative`, a new tree whose
  static segments take precedence over `[step]`. The choice is persisted in a small localStorage key,
  `pictocart.start.type.v1`.
  - "Back button on the first step of either branch returns to Step 0" (.docx): the informative flow's
    Back goes to `/start/build`. The store flow's first screen, lang, has **no Back today**
    (`backTarget("lang") = null` in `features/start/flow.ts`). Meeting the .docx needs a small
    branch inside the "onboarding entry/router" touch point: when the flag is on and a type was
    chosen, the lang screen shows Back → `/start/build`. With the flag off, the screen is unchanged
    (Q4).
  - The .docx's `/onboarding/informative/basic-info` maps to `/start/informative/basic-info`.
    Legacy `/onboarding` redirects to `/start`.
  - Refresh keeps the choice: the localStorage key below plus the URL.
  - Deep links to `/start/lang` (marketing CTAs, `ONBOARDING_HOME`) still go straight into the store
    flow. Only bare `/start` shows the selector.
- **Informative draft:** a separate localStorage key, `pictocart.start.informative.v1`, with its own
  zod schema. The store `StartDraft` schema is not touched.
- **Account step:** reuse the existing auth primitives (Google sign-in and the email OTP actions
  behind `account-screen.tsx`). I will check in M4 whether the screen itself can be reused with a
  `returnTo` prop or needs a thin informative wrapper.
- **Store-only records the store flow creates** (all skipped for Informative):

| Created by | Store-only records |
|---|---|
| `create_tenant` RPC | `inventory_locations` "Main warehouse" |
| `finalizeStartDraftAction` | `stores.category_id`, `cod_settings`, `shipping_rates` (2–3 rows), `integrations.seller_upi` |
| `seedReadyStore` | sample products, collections, store theme config/draft, seed images, audit `onboarding.ready_store_seeded` |

- **Completion, one transaction, reusing the creation service as the .docx asks ("passing the type;
  no copy-paste"):**
  1. Migration replaces `create_tenant(text, text, text)` with
     `create_tenant(p_name, p_slug, p_root_domain, p_website_type text default 'ONLINE_STORE')`. It is
     the same body plus two changes: it writes `website_type`, and it skips `inventory_locations` when
     the type is INFORMATIVE. The 3-argument version has to be dropped rather than overloaded,
     because PostgREST cannot choose between two overloads that both match 3 named arguments.
     Existing callers pass 3 arguments and get identical behaviour.
     **Down:** restore the 3-argument body from `20261023003600_free_plan.sql`.
  2. A new SECURITY DEFINER wrapper, `complete_informative_onboarding(p_name, p_slug, p_root_domain,
     p_site jsonb, p_services jsonb)`, runs in one transaction:
     1. calls `public.create_tenant(…, 'INFORMATIVE')`, with the same `auth.uid()`, plan/trial and
        5-store limit;
     2. sets `stores.site_mode='informative'` and `launch_status='draft'`;
     3. inserts `info_sites` (DRAFT), the four default pages and the services (or 3 samples with
        `is_sample`).
     Any error rolls back all of it.
  - **Idempotent:** if the caller already owns an INFORMATIVE tenant with that slug, the wrapper
    returns it and inserts nothing. On the client, the submit button disables itself and a
    per-user rate limit applies.
  - Server action: `completeInformativeOnboardingAction` (`runAction` + `parseInput`). It redirects
    to `/informative/dashboard`.
- **Step 1 field notes against the real code:**
  - **Slug "reuse the existing slug-availability check exactly as the store flow does":** the store
    flow has **no** availability check. It derives the slug from the name (`resolveSlug`) and
    retries with `-2` on a unique violation (`createOrResumeStore`). Anon and new users cannot read
    `tenants` under RLS. Options: (a) mirror the store flow exactly, with the slug derived and shown
    read-only plus a `-2` fallback; (b) add a small SECURITY DEFINER `store_slug_available(text)`
    for a live check (Q10).
  - **Logo:** the .docx allows png/jpg/**svg**/webp. `uploadTenantImage` accepts JPG, PNG, WebP, AVIF
    and GIF only, with no SVG, which is deliberate since SVG can carry script. I propose no SVG (Q11).
  - **Phone "existing validator (country code)":** existing validation is India-only
    (`normalizeWhatsapp`: 10 digits starting 6–9, or `91…`). I propose reusing it, with `+91` shown
    (Q11).
  - **Category list vs theme map:** Smooth Wave recommends "Wellness", which is not one of the 9
    Step 1 categories. I propose treating it as unused, since "Clinic/Healthcare" and "Other" already
    map to Smooth Wave.
- **Analytics events (Q5):** there is no generic event sink. Proposal: a tiny client helper,
  `trackOnboardingEvent(name, props)`, that pushes to `window.gtag` / `dataLayer` when platform GA4
  is loaded (`features/platform-analytics`) and is otherwise a no-op, plus a server `logger.info`
  on completion. No new table.

### D6 — Seller panel at `/informative/*`

- New route tree `src/app/informative/` with its own layout. It reuses `AppShell`, `SidebarLink`, the
  tenant switcher and sign-out from `src/components/app-shell`, with an `INFORMATIVE_NAV` config in
  the module. Every page checks `requireTenantPermission` (same keys as D4).
- Routes follow the .docx: `/informative/dashboard`, `/informative/services`, … `/informative/settings`.
  Bare `/informative` redirects to `/informative/dashboard`.
- **Guards (wrappers), both directions:**
  - **InformativeRouteGuard:** `requireInformativeTenant()` in `src/app/informative/layout.tsx` (and in
    every informative server action). An `ONLINE_STORE` tenant is redirected to `/dashboard`.
  - **StoreRouteGuard, pages:** one wrapper check in `src/app/dashboard/layout.tsx`. An `INFORMATIVE`
    tenant is redirected to `/informative/dashboard`. Because every `/dashboard/*` page sits under that
    layout, products, orders, inventory, payments, shipping, coupons and customers are all covered
    without editing any page.
  - **StoreRouteGuard, actions (store "APIs"):** store mutations are server actions, which can be
    called directly without the layout. The single choke point is `requireTenant()` in
    `src/lib/tenant/membership.ts`, which every store action and page uses. Proposal: when the
    active tenant is INFORMATIVE, `requireTenant()` throws `FORBIDDEN`, and the informative code uses
    its own `requireInformativeTenant()`. Shared account pages (`/dashboard/profile`, plan & billing,
    team) need a deliberate exception. M1 will inventory the `requireTenant` callers those pages use
    and either give them an "any type" variant or link the informative panel to informative-hosted
    copies (Q12).
- **Post-login redirect:** the .docx wants "a single redirect helper". `landingFor` /
  `defaultLanding` in `src/lib/auth/role-routing.ts` gain one branch: INFORMATIVE active tenant →
  `/informative/dashboard`. This needs the website type in `AccountAccess`, read from the memberships
  the helper already loads. The dashboard-layout guard stays as the backstop (Q6).
- **Sidebar selector:** the .docx proposes picking the nav config by type inside the shared shell. In
  this repo the nav is chosen per layout (`app/dashboard/layout.tsx` uses `DASHBOARD_NAV`), so the
  informative layout simply passes `INFORMATIVE_NAV` to the same `AppShell`. `DASHBOARD_NAV` stays
  untouched, and this touch point needs no shared edit.
- **API surface:** the .docx lists REST endpoints under `/api/informative/*`, but this repo's
  convention for seller and storefront mutations is **server actions** through `runAction` +
  `parseInput` (ARCHITECTURE §6). Route handlers are kept for webhooks, cron and file exports.
  Following "Follow existing conventions. Do not introduce a new stack", each .docx endpoint becomes
  a server action in `features/informative/actions/*`, with these exceptions:

| Endpoint | Becomes |
|---|---|
| `GET /enquiries/export` | A route handler (CSV), because a file download needs one |
| `GET /themes`, `GET /dashboard/summary`, `GET /public/*` | Server-component reads (no endpoint needed) |
| `POST /public/:siteSlug/enquiries` | A server action resolved from the verified host. Never a slug from the request ("Never trust a tenant id from the request") |

  `requireWebsiteType(...)` becomes the two guards above.
- **Settings → delete site:** reuse the existing "close store" (`features/stores/components/close-store.tsx`,
  `features/stores/actions.ts`).
- **Notifications:** an email through `sendEmail()` plus an in-app badge through the existing
  notification producers (ADR-036). An `AFTER INSERT` trigger on `info_enquiries` calls
  `app.notify_tenant`, so the bell works with no new UI.
- **Session payload:** add `website_type` to the memberships select and a `websiteType` field to
  `TenantContext` (`src/lib/tenant/membership.ts`). This is additive; existing consumers ignore it.
- **Route registration:** add `"/informative"` to `PLATFORM_ONLY_PREFIXES` (`src/lib/tenant/routing.ts`)
  so the panel 404s on store hosts, as `/dashboard` does. Consequence: a custom public page can never
  use the slug `informative`, so it is reserved.
- Domain page reuses `src/features/domains` components. A new enquiry sends an email to the site's
  contact email through `sendEmail()`, inside `after()`.

### D7 — Public site

- **The resolver branch:** `tenantDirectory.findByHost` also returns `websiteType`. It is already
  cached; the select just gains a column. `src/app/store/[host]/layout.tsx` gets one branch after the
  availability check: INFORMATIVE → `<InformativeSiteLayout>` from the module, instead of the store
  theme chrome. The DRAFT "coming soon" decision comes from `info_sites.status` (owner preview
  through the existing signed preview cookie).
- **Pages:**

| Route | Change |
|---|---|
| `/` (`page.tsx`) | One branch → informative home |
| `/contact` (`contact/page.tsx`) | One branch → informative contact page |
| `/[...rest]` | One branch → `/:customPageSlug` lookup before the store's redirects/404 |
| `sitemap.xml` / `robots.txt` routes | One branch each |
| `/about`, `/services`, `/services/[slug]`, `/gallery` | **New route files**. For `ONLINE_STORE` tenants they call the same `redirectOrNotFound(...)` as the catch-all, so a store's own URL redirect for e.g. `/services` keeps working exactly as today |

- The store layout statically imports `storefront.css` and `designs-a.css`. Those still load on
  informative sites, but they are scoped under `.sf-root` / section classes and harmless. Size will be
  checked in M8 against the Lighthouse targets. If they hurt, the next step is a route-group split,
  which is a bigger change and needs a decision then.
- JSON-LD `LocalBusiness` / `Service`, WhatsApp/call CTAs, and `next/image` lazy loading with
  `assetUrl` variants.

### D8 — Enquiries

- Form (server action): resolve the tenant from the verified host (`requireStoreTenant`), never from
  the request.
- Spam controls: zod; honeypot field; `rateLimit("info-enquiry", tenantId + ":" + clientIpKey(), 5, 600)`;
  a consent checkbox, stored as `consent_at`.
- Write: `submit_info_enquiry` RPC. It checks that the site is open and PUBLISHED and that
  `service_id` belongs to the tenant.
- Then an email via `sendEmail()` (idempotency key). The panel lists enquiries with status/source
  filters and notes, plus a CSV export (reusing `features/analytics/csv.ts`).
- A WhatsApp click is logged as source `WHATSAPP_CLICK` through a tiny beacon action (rate-limited)
  that creates no PII.
- **Rich text ("sanitize, allow-list HTML"):** the repo has **no HTML sanitizer library**. Store
  content uses structured rich-text blocks (`tests/unit/rich-text.test.ts`), not raw HTML. Proposal:
  service descriptions and section text use the same structured / plain-text approach, rendered as
  React elements, so no HTML is ever stored and nothing needs sanitizing. If raw HTML is ever
  required, a small allow-list sanitizer would be a new dependency (Q13).
- **Enquiry fields** follow the .docx: name and phone required, email optional; service; preferred
  date and time, shown for the clinic, salon, gym and academy categories or when the seller turns it
  on; message; consent line linking to a generated privacy text. These rules differ from
  `contact_messages`, where email is required, which is one more reason for a separate table.

---

## 4. Shared touch points

The plan allows 8. **Expected: 8 categories, ~13 files.** Every edit is a few lines marked
`// INFORMATIVE: branch point — see docs/informative/PLAN.md`.

| # | Plan touch point | File(s) | Change |
|---|---|---|---|
| 1 | tenant model + migration | new `supabase/migrations/2026111…_informative_website.sql`; `src/lib/supabase/database.types.ts` (generated) | add column + new tables + RPCs; regenerate types |
| 2 | store-creation service | `create_tenant` SQL function, inside #1's migration | optional `p_website_type` (default `ONLINE_STORE`); skip `inventory_locations` when INFORMATIVE |
| 3 | onboarding entry | `src/app/start/page.tsx`; `src/features/start/screens/lang-screen.tsx` (or `flow.ts` `backTarget`) | flag on → `/start/build`; Back on lang → `/start/build` only when flag on |
| 4 | session payload | `src/lib/tenant/membership.ts` | select `website_type`; `TenantContext.websiteType`; `requireTenant()` rejects INFORMATIVE (store action guard) |
| 5 | post-login redirect | `src/lib/auth/role-routing.ts` (+ `src/lib/auth/landing.ts` for the type) | INFORMATIVE → `/informative/dashboard` |
| 6 | sidebar selector / StoreRouteGuard | `src/app/dashboard/layout.tsx` | INFORMATIVE → redirect `/informative/dashboard`; `DASHBOARD_NAV` untouched |
| 7 | store route registration | `src/lib/tenant/routing.ts` | `"/informative"` in `PLATFORM_ONLY_PREFIXES` |
| 8 | public resolver | `src/lib/tenant/directory.ts` (+ its `ResolvedTenant` type); `src/app/store/[host]/layout.tsx`, `page.tsx`, `contact/page.tsx`, `[...rest]/page.tsx`, `sitemap.xml/route.ts`, `robots.txt/route.ts` | one `if (websiteType === "INFORMATIVE")` each |

**Outside the eight (written reasons):**

| File | Why |
|---|---|
| `src/lib/storage/upload.ts` (`UPLOAD_AREAS` += `"informative"`) | Plan requires an `informative/` upload prefix. The alternative, a copied uploader, would duplicate sniffing, variant and RLS logic |
| `src/lib/env/schema.ts` (+ `.env.example`) | Plan requires the `FEATURE_INFORMATIVE_WEBSITE` flag; all config is zod-validated there (ARCHITECTURE §9) |
| `src/app/store/[host]/{about,services,gallery}/…` | New files, not edits; required for the plan's public routes. Store tenants are routed to the existing redirect/404 helper |
| `package.json` / lockfile + new font module | Only if Q3 = add the 8 missing fonts |
| `docs/IMPLEMENTATION_STATUS.md`, `docs/DECISIONS.md` (one ADR) | Process requirement |

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| Two "informative" concepts (legacy `site_mode` vs new type) confuse sellers | Keep `NEXT_PUBLIC_INFORMATIVE_SITES_ENABLED` **off** while `FEATURE_INFORMATIVE_WEBSITE` is on, so the quiz's site-type question and the Settings switch stay hidden. Decide the legacy mode's future separately (Q7) |
| Worker 10 ms CPU / cold start | Informative modules load only on informative routes; the dashboard and store-layout branches use `await import()`, so store requests never evaluate informative code; guard tests stay green |
| Store CSS bundle grows from new Tailwind utilities | Few utilities, CSS variables for theming; measured with `check-worker-css` each milestone |
| Tenant directory cache returns a stale `websiteType` | Type is immutable, so staleness cannot happen after creation; a new tenant has no cached entry |
| `/services` etc. become real routes for stores | They delegate to `redirectOrNotFound`, so behaviour is identical to the catch-all today |
| E2E expectations in the plan exceed current infra | See Q8 |
| Flaky `validate-worker-secrets` test | Pre-existing; noted, not changed |

---

## 6. Milestone notes against this discovery

- **M1:** the migration (column + trigger only) and its down path, the flag in the env schema, the
  `WEBSITE_TYPES` constant, the session payload, both guards (dashboard ↔ `/informative` stub layout),
  `PLATFORM_ONLY_PREFIXES`, and the directory field. Unit tests for the guards and the parser.
- **M2:** the `info_*` tables, RLS, the two RPCs, regenerated types, `tests/rls/informative.test.ts`
  (run with `pnpm test:db`).
- **M3:** the theme registry plus a zod config schema; a unit test that all 11 configs are valid and
  meet AA contrast on their token pairs; the section library; demo content.
- **M4–M7:** as in the plan.
- **M8:** visual snapshots via the existing `scripts/dev/protect/visual-baseline.mts` (Playwright) at
  360/768/1280; Lighthouse; CSS and Worker checks.

---

## 7. Decisions needed before M1

| # | Question | My recommendation |
|---|---|---|
| Q1 | New immutable `tenants.website_type` alongside the existing switchable `stores.site_mode` (and INFORMATIVE tenants also set `site_mode='informative'` for free commerce guards)? | **Yes** (D1) |
| Q2 | Flag = server env `FEATURE_INFORMATIVE_WEBSITE` = `off`/`internal`/`all` (internal = platform staff); flag off → Step 0 hidden, routes 404, existing informative accounts see a maintenance page (per .docx)? | **Yes** (D2) |
| Q3 | 8 theme fonts are not installed (Nunito, Source Sans 3, Oswald, Lato, Sora, DM Serif Display, Quicksand, Nunito Sans). Add them as `@fontsource` packages, or substitute installed fonts? | **Add them** (self-hosted, lazy, ~20–40 KB each, only when used) |
| Q4 | The .docx requires Back on the first step of both branches. Add a flag-gated Back on the store flow's lang screen (shown only when the flag is on), even though it touches a store-flow file? | **Yes**: flag off is byte-identical |
| Q5 | Analytics events via GA4 `gtag`/`dataLayer` (no-op when absent) + server log, no new table? | **Yes** |
| Q6 | Post-login: branch in `role-routing.ts` (the .docx's "single redirect helper"), with the dashboard-layout guard as backstop? | **Yes** |
| Q7 | Leave the legacy informative mode and its 10 presets untouched (flag kept off)? | **Yes** for v1 |
| Q8 | E2E: the repo has no Playwright test suite. Add a minimal `playwright.config.ts` + `tests/e2e` (local only, not in `pnpm check` / CI), or cover journeys with integration + RLS tests and keep visual snapshots in the existing baseline script? | **Add a minimal local suite**, outside `pnpm check` |
| Q9 | Enquiry permissions: read with `customers.read`, update status/notes with `customers.write` (Sales Associate role can then handle leads)? | **Yes** |
| Q10 | Slug: the store flow has no availability check (derive from name + `-2` on clash). Mirror that exactly, or add a live `store_slug_available()` check? | **Live check** (better UX; tiny SECURITY DEFINER function) |
| Q11 | Logo: drop SVG (upload service rejects it; XSS risk). Phone: reuse the India-only validator (`+91`)? | **Yes** to both |
| Q12 | Store-action guard via `requireTenant()` rejecting INFORMATIVE tenants (one choke point), with an explicit exception for shared account pages (profile, plan, team)? | **Yes** |
| Q13 | Rich text: structured blocks / plain text rendered as React (no HTML stored, no sanitizer dependency)? | **Yes** |
| Q14 | API surface as server actions (repo convention) instead of REST `/api/informative/*`, with a CSV export route handler? | **Yes** |

Plus the plan's open questions for the product owner: a separate plan for informative sites; custom
domains in v1 (the domain feature is reusable as-is); real calendar booking later; who supplies theme
imagery (default proposal: Unsplash via the existing `unsplash-stock` helpers, with credits).
