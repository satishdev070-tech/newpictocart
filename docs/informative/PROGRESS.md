# Informative Website — Progress

Plan: [PLAN.md](./PLAN.md) · Discovery: [DISCOVERY.md](./DISCOVERY.md) · Branch `claude/informative-website`

| Milestone | Status | Commit |
|---|---|---|
| M0 Discovery | ✅ Done (owner accepted Q1–Q14 on 2026-11-11) | `2857e08` |
| M1 Foundation | ✅ Done | see `git log` (feat(informative): M1) |
| M2 Data layer | ✅ Done | see `git log` (feat(informative): M2) |
| M3 Theme system | ✅ Done | see `git log` (feat(informative): M3) |
| M4 Onboarding | ✅ Done | see `git log` (feat(informative): M4) |
| M5 Seller panel | ✅ Done | see `git log` (feat(informative): M5) |
| M6 Public site | — | |
| M7 Enquiries | — | |
| M8 Hardening | — | |

---

## M1 — Foundation (2026-11-11)

### What landed

| Piece | Where |
|---|---|
| `tenants.website_type` (`ONLINE_STORE` default, backfilled by the `ALTER`, `INFORMATIVE`), check constraint, immutability trigger | `supabase/migrations/20261111008000_informative_website_type.sql` (down path in its header) |
| `create_tenant(…, p_website_type default 'ONLINE_STORE')`; INFORMATIVE skips the store-only `inventory_locations` row | same migration |
| Shared constant `WEBSITE_TYPE` / `WEBSITE_TYPES` / `parseWebsiteType` / `INFORMATIVE_HOME` | `src/features/informative/website-type.ts` |
| Flag `FEATURE_INFORMATIVE_WEBSITE` = `off` (default) / `internal` / `all` | `src/features/informative/flag.ts`, `src/lib/env/schema.ts`, `.env.example` |
| Session payload: `Membership.websiteType`, `TenantContext.websiteType` | `src/lib/tenant/membership.ts` |
| StoreRouteGuard (pages **and** server actions): `requireTenant()` redirects an active Informative tenant to `/informative/dashboard` | `src/lib/tenant/membership.ts` |
| InformativeRouteGuard: pure decision + server wrapper `requireInformativeTenant()` | `src/features/informative/guard.ts`, `src/features/informative/server/context.ts` |
| Post-login redirect: Informative-only accounts land on `/informative/dashboard` | `src/lib/auth/role-routing.ts`, `src/lib/auth/landing.ts` |
| Store route registration: `/informative` is platform-only (404 on store hosts) | `src/lib/tenant/routing.ts` |
| Panel stub: `/informative` → `/informative/dashboard`, guarded `(panel)` layout, placeholder dashboard, `/informative/maintenance` | `src/app/informative/**` |
| Types | `src/lib/supabase/database.types.ts` (hand-edited: the CLI generator is Docker-based; only `website_type` + `p_website_type` added) |

### Behaviour by flag

| | Flag `off` (production default) | Flag `internal` / `all` |
|---|---|---|
| Existing store accounts | Identical to today (same queries in landing; `requireTenant` gains one in-memory check) | Identical (landing runs one extra parallel membership query) |
| `/informative/*` for store accounts / signed out | 404 | → `/dashboard` / → login |
| Informative accounts | `/informative/*` → maintenance page; `/dashboard/*` → `/informative/dashboard` → maintenance | Panel renders; `/dashboard/*` → `/informative/dashboard` |
| Creating an Informative site | Impossible (no UI yet; M4 gates by `canCreateInformative`) | M4 |

### Decisions and deviations (rule: touch store code least)

1. **No edit to `src/app/dashboard/layout.tsx` (touch point 6 unused).** The StoreRouteGuard sits in
   `requireTenant()`, which every `/dashboard` page, layout and store server action already calls.
   One check therefore covers pages and actions (the .docx's "store APIs reject Informative accounts")
   without a per-page or per-action edit. `DASHBOARD_NAV` is untouched; the Informative panel gets its
   own layout and nav (M5).
2. **`TenantContext.websiteType` is optional.** `features/onboarding/server.ts` (`ownerContext`)
   builds a `TenantContext` by hand. Optional (missing = ONLINE_STORE) avoids editing that store file.
3. **Deploy-order safety.** The .docx rollout says to deploy and *then* run migrations. Until the
   column exists, `listMemberships` gets an undefined-column error (`42703` / `PGRST204`) and retries
   the old select, so every account reads as ONLINE_STORE. No other error is swallowed (unit tested).
4. **Post-login with the flag off is byte-for-byte as before.** The extra membership query in
   `accountAccessFor` runs only when the flag is on, and soft-fails to "unknown". `requireTenant()`
   is the backstop. An account with any Online Store lands on `/dashboard` (an account with mixed
   types lands on its store; the switcher plus the guard handle the rest).
5. **`create_tenant` 3-argument signature dropped and recreated with a 4th defaulted argument**,
   not overloaded (PostgREST cannot disambiguate). Existing callers (`/start` finalize, legacy
   onboarding, the RLS test) pass 3 arguments unchanged. `platform_create_tenant` is untouched.
6. **The type is immutable even for the DB owner** (trigger). Changing a type would need the
   trigger dropped deliberately, per the non-goal "no switching".
7. **Shared account pages (Q12):** `/dashboard/profile`, plan and team live under `/dashboard` and go
   through `requireTenant()`, so Informative tenants cannot reach them yet. M5 gives the Informative
   panel its own Profile / Plan / Team entries, reusing the same feature components.
8. `tenants.store_type` already exists (`real`/`demo`/`test`, migration 1800). It is unrelated to
   `website_type`, which is a separate column.

### Verification

- `pnpm check` ✅: typecheck, lint, **202 files / 2121 tests**, build (6 min 19 s). An earlier run on a heavily loaded machine (load average ~16) had two 5 s timeouts in subprocess-spawning tests (`validate-worker-secrets`, `google-sign-in-slot`). Both pass on re-run, and the first is the flake recorded in DISCOVERY §1.1. All pre-existing tests are unchanged.
- Runtime smoke test (worktree dev server, hosted DB **without** migration 8000, which exercises the fallback):
  - Flag off: `/informative`, `/informative/dashboard` and `/informative/maintenance` → 404; `/start/lang` 200; `/login` 200; `/dashboard` → login (as before).
  - Flag `all`: `/informative` and `/informative/dashboard` → `/login?next=/informative/dashboard`; `/informative/maintenance` → 404; store routes unchanged.
  - No server errors.
- New unit tests (`tests/unit/informative/*`, 7 files, 30 tests): constant + parser, flag + env
  schema, guard matrix, post-login matrix, route registration, static migration checks, session
  payload (select, 42703 fallback, other errors still fail, guard follows the active store).
- New DB test `tests/rls/informative-website-type.test.ts` (5 tests): backfill, 3-argument
  `create_tenant` unchanged (inventory location), INFORMATIVE has no inventory location, unknown
  type rejected, type frozen.
- **DB harness note:** `pnpm test:db` is broken on `main` before this work. `supabase/tests/supabase-shim.sql`
  lacks `storage.objects.owner_id`, so `20261027004120_return_photos.sql` fails to load. Per rule 7 I
  did not change the shared harness. I loaded all migrations (including 8000) plus the seed into a
  local Postgres 17 using a scratch copy of the shim with that one column added, then ran the **full**
  existing RLS suite (24 files / 181 tests ✅) plus the new file (✅). On macOS the harness also needs
  `LC_ALL=en_US.UTF-8` and `PGBIN=/opt/homebrew/opt/postgresql@17/bin`. Suggested follow-up outside
  this project: add `owner_id text` to the shim.
- Online Store regression: `/start` code is untouched in M1, and `role-routing` behaviour is
  unchanged when `informativeOnly` is unset (existing `tests/unit/auth/role-routing.test.ts` passes
  unmodified).

### Shared files touched so far (all marked `INFORMATIVE: branch point`)

`supabase/migrations/20261111008000_informative_website_type.sql` (new), `src/lib/supabase/database.types.ts`,
`src/lib/tenant/membership.ts`, `src/lib/auth/role-routing.ts`, `src/lib/auth/landing.ts`,
`src/lib/tenant/routing.ts`, `src/lib/env/schema.ts` + `.env.example` (reason in DISCOVERY §4).
`database.types.ts` is generated output, so it carries no marker comment (a marker would be lost on
regeneration).

---

## M2 — Data layer (2026-11-11)

### What landed

| Piece | Where |
|---|---|
| 9 tables: `info_sites` (PK `tenant_id`), `info_site_private`, `info_services`, `info_pages`, `info_gallery_items`, `info_team_members`, `info_testimonials`, `info_faqs`, `info_enquiries` | `supabase/migrations/20261111008100_informative_content.sql` (down path in header) |
| Indexes: `tenant_id` leading on all; partial unique `(tenant_id, slug)` on live services and pages; one system page per type; enquiries by `(tenant_id, created_at desc)` and `(tenant_id, status)` | same |
| RLS + explicit grants (public = PUBLISHED site + open tenant + active/visible + not deleted; staff by permission key; **no client DELETE** grant on any table) | same |
| `app.is_informative_tenant`, `app.info_site_is_public`; trigger: `info_sites` rows only for INFORMATIVE tenants; content tables FK to `info_sites`, so the guard covers them transitively | same |
| DB types for the 9 tables | `src/lib/supabase/database.types.ts` (generated from the migration with `scripts/db/gen-types.mjs`, reformatted to the CLI style and inserted alphabetically) |
| Validators (zod) | `src/features/informative/schemas.ts` |
| Categories, price types + display, slugs (+ reserved public paths), page section contract | `categories.ts`, `pricing.ts`, `slug.ts`, `sections.ts` |
| Domain models + row mappers (numeric ↔ integer paise) | `model.ts` |
| CRUD services (tenant from context only, permission check first, soft delete, reorder, duplicate, publish, enquiry status/notes/filters/pagination/counts) | `src/features/informative/server/repo.ts` |

### Permission keys (existing matrix, no change)

| Data | Read | Write |
|---|---|---|
| Content (services, pages, gallery, team, testimonials, FAQs) | `store.read` | `content.write` |
| Site profile, contact, hours, social, SEO, options | `store.read` | `settings.write` |
| Appearance (theme, colours, fonts, logo) | `store.read` | `theme.edit` |
| Publish / unpublish | — | `theme.publish` |
| Notification settings (`info_site_private`) | `settings.write` | `settings.write` |
| Enquiries | `customers.read` | `customers.write` (status, notes, soft delete only, enforced by column grants) |

### Decisions and deviations

1. **Store id = `tenant_id`** (ADR-012). Content tables reference `info_sites(tenant_id)`, so a content
   row can't exist without the site, and the site can't exist for an Online Store (trigger). That
   gives "informative rows only for informative tenants" without a trigger on every table.
2. **Private notification settings in their own table** (`info_site_private`). `info_sites` is
   publicly readable once published, and RLS is row-level, so the owner's notification email lives in
   a staff-only table. Public reads never see seller emails or notes (plan API rule).
3. **Unique slug among live rows only** (partial index). The plan asks for unique `(storeId, slug)`
   plus soft delete; a full unique index would block reusing a deleted service's address.
4. **Enquiry → service link is tenant-scoped** (composite FK); deleting a service clears only `service_id`.
5. **Enquiries have no client INSERT grant at all.** Public submission arrives in M7 as a
   SECURITY DEFINER function (honeypot, rate limit, published-site check), like `submit_contact_message`.
6. **Rich text (Q13):** `description`/`about` are plain text (paragraphs). Nothing stores HTML.
7. **Editing a sample service clears `is_sample`**, so the "Sample" label disappears once the seller
   owns the content.
8. Fixed in review before commit: `reorderContent` creates a fresh query builder per row. Builders
   from one postgrest-js `from()` share their URL, so filters would otherwise pile up across updates.

### Verification

- New RLS test `tests/rls/informative-content.test.ts` (12 tests): owner isolation both ways, no
  cross-tenant write, no client hard delete, no informative rows for Online Stores, enquiry→service
  same-site FK, live-slug uniqueness and reuse, priced services need an amount, anon sees only
  published/active/visible rows of PUBLISHED sites, suspended tenant hidden, private settings and
  enquiries never public, enquiry column grants.
- New unit tests: `pricing-slug-sections`, `schemas-model`, `repo` (permission-first, tenant filter
  on every query, soft delete, system pages undeletable, reorder validation, publish stamp, enquiry
  update shape). `tests/unit/informative`: 10 files / 61 tests.
- Full RLS suite against all migrations (patched-shim scratch DB, see M1): **26 files / 198 tests ✅**.
  `custom-themes.test.ts` was re-run alone after its Vitest worker failed to start under machine load.
- `pnpm check` ✅: typecheck, lint, **205 files / 2152 tests**, build.

---

## M3 — Theme system (2026-11-11)

### What landed

| Piece | Where |
|---|---|
| Theme config contract (zod): id, name, bestFor, recommendedCategories, demoCategory, tokens {colors, fonts, radius, shadow, spacing, dark, headingCase}, layout {header, hero, servicesStyle, gallery, testimonials, footer, motif}, defaultSections, motion, palettes | `src/features/informative/themes/types.ts` |
| 11 theme configs, one folder each, palettes and fonts from the plan | `src/features/informative/themes/<id>/theme.config.ts` |
| Separate registry + category → 1–2 recommended themes (fallback Nexus Core + Smooth Wave) | `themes/registry.ts` |
| Token → CSS variable pipeline with seller overrides (primary, secondary, font pair) | `themes/tokens.ts` |
| WCAG maths: contrast ratio, readable text, `ensureContrast`, `ensureFill` | `themes/color.ts` |
| Fonts: 19 self-hosted families (8 new `@fontsource` packages, exact versions), preload off, only on informative routes; 11 font pairs | `src/app/informative-fonts.ts`, `themes/fonts.ts`, `package.json` |
| Shared section library: Header/Nav (classic, centered, transparent, minimal + no-JS mobile menu), Hero (split, fullBleedImage, carousel, typographic), About, ServicesGrid (grid, cards, deck, glass), ServicesList (list, menu), Highlights, Stats, Team, Gallery (grid, masonry, before/after), Testimonials (cards, carousel, quote), Pricing, FAQ, CTA band, Contact + map link, Enquiry form (markup only, preview disabled), Rich text, Footer, floating WhatsApp / sticky mobile Call + WhatsApp bar | `src/features/informative/site/{ui,chrome,sections,renderer}.tsx` |
| Motifs: stats strip, mountain silhouette, wave dividers, gold rules, neon glow, gradient, signature | same |
| Demo content per category (business, 6 services, 3 testimonials, 4 FAQs, team, stats, highlights) + 3 sample services per category for M4 | `src/features/informative/demo.ts`, `site/view.ts` |
| Default sections for Home/About/Services/Contact per theme (used by M4) | `src/features/informative/defaults.ts` |
| Flag-gated live preview: `/informative/preview/<themeId>?name=&category=&page=` (404 with flag off) | `src/app/informative/preview/[themeId]/page.tsx` |
| Thumbnails (640×400 WebP, ~7–19 KB each) | `public/informative/themes/<id>.webp` |
| Visual snapshots + thumbnail generator (`pnpm informative:shots`, 360/768/1280, full page, reduced motion) | `scripts/informative/theme-shots.mts` (output `.shots/`, git-ignored) |

### Decisions and deviations

1. **The existing 10 "informative" marketplace presets are untouched** (Q7). The 11 new themes form a
   separate registry rendered by their own section library; the store theme engine is not used.
2. **Every text colour is computed, not hand-picked.** `resolveColors` derives body, muted and link
   colours with ≥ 4.5:1 contrast against both background and surface, and picks button text that
   reads on the fill. A test asserts AA for all 11 themes **and** for hostile seller overrides
   (`#FFFF00`, `#00FF00`, `#000/#FFF`, mid-grey). That test found a real case: a mid-grey fill
   (`#777777`) can't reach 4.5:1 with either black or white text, so `ensureFill` darkens such a fill
   just enough for white text. A seller's exact colour can therefore shift slightly when it couldn't
   be made readable otherwise.
3. **Text over photos and gradients:** full-bleed and carousel heroes use a 60% black scrim (white
   text ≥ 4.5:1 even on a white photo); the Prism Deck gradient hero has a 40% scrim, because white
   on the pink end alone is about 3.5:1.
4. **No client JavaScript** in the section library: the carousels use CSS scroll-snap, FAQ and the
   mobile menu use `details`/`summary`, and all motion is under `motion-safe:` (reduced motion is
   respected; a render test asserts no un-gated transitions). There are no inline scripts.
5. **Images:** plain `<img>` with explicit width/height (no CLS) and `loading="lazy"`; only the hero
   (LCP) and logo are eager with `fetchpriority=high`. Demo photos are the repo's curated, credited
   Unsplash pools (`src/lib/unsplash-stock.ts`), with photographer credits in the footer; only
   photographers of photos actually shown are credited. Imagery is still an open product question
   (who supplies theme imagery). Note: the beauty pool's first hero shows branded skincare products,
   which is worth swapping when final imagery is chosen.
6. **Thumbnails live in `public/informative/themes/`**, not inside each theme folder as the plan
   sketches, because Next serves static files only from `public/`. They are regenerated by
   `pnpm informative:shots` from the real preview, so they never drift from the code.
7. **Recommendation ranking:** demo-category match first, then specialists (fewer recommended
   categories), then registry order (Salon → Radiant Alpha, Pure Gold). "Other" and unknown
   categories (including the plan's "Wellness", which isn't a Step 1 category) get Nexus Core +
   Smooth Wave.
8. **Fonts load only where used.** `informative-fonts.ts` is imported only by informative routes
   (never the root layout, proxy, marketing or root sitemap, the Worker-graph rule), with
   `preload: false`, so a browser downloads only the two families the active theme references.
9. **No new CSS file.** Everything is Tailwind utilities reading CSS variables, so the storefront
   CSS layer-order rule is untouched. New utility classes add a little to the shared stylesheet;
   `check-worker-css` passes (see Verification).
10. Fixed during review: the header CTA used `hidden` and `inline-flex` on one element. `cn()` joins
    without merging, so the CTA showed at 360 px; visibility now sits on a wrapper.

### Verification

- Unit (`tests/unit/informative`, 12 files / 97 tests): registry (exactly the 11 plan ids, one folder
  each, schema-valid, categories valid, 1–2 recommendations per category, fallback, separate from
  the marketplace), AA contrast for every theme and override set, CSS-variable coverage of the
  section library, font pairs and self-hosting, demo content counts, default pages valid, and a
  **render smoke test of every section in every theme** (one `h1`, sized images with alt, ≤ 2 eager
  images, preview form disabled, honeypot present, no inline scripts, motion only under `motion-safe:`).
- Visual: `pnpm informative:shots` captured all 11 themes at 360/768/1280 (33 full-page snapshots)
  and produced the thumbnails. The first screens and mobile layouts were reviewed by eye.
- `pnpm check` ✅: typecheck, lint, **207 files / 2188 tests**, build (incl. `/informative/preview/[themeId]`).
  A first run hit a corrupted `.next/dev/types` file left by a stopped dev server; it passed after
  clearing that cache (build output only).
- `pnpm build:vinext` + `scripts/ci/check-worker-css.mts` ✅: "4 stylesheets OK (layer order pinned,
  10 key rules present)". `root-metadata-imports` (Worker graph) is part of the unit run ✅.

---

## M4 — Onboarding (2026-11-11)

### What landed

| Piece | Where |
|---|---|
| Step 0 "What do you want to build?" (two native-radio cards, choice persisted, analytics) at `/start/build` | `src/app/start/build/page.tsx`, `onboarding/components/type-selector.tsx` |
| Entry branch: bare `/start` → `/start/build` when allowed; otherwise exactly today's `/start/lang` | `src/app/start/page.tsx` (branch point) |
| Back on the store flow's first step → Step 0, only when Step 0 exists | `start-page.tsx`, `start-journey.tsx`, `lang-screen.tsx` (optional prop; branch points) |
| Steps 1–4 + finish at `/start/informative/<step>` with their own draft (`pictocart.start.informative.v1`) and resume / no-skip-ahead guard | `src/app/start/informative/**`, `onboarding/components/*`, `onboarding/draft.ts` |
| Step 1 fields and rules from the plan (name 2–80, category, tagline ≤ 120, phone, WhatsApp "same as phone", email, city, address, logo ≤ 2 MB PNG/JPG/WebP, address) + live address check | `basic-info-step.tsx`, `checkInformativeSlugAction`, `store_slug_available()` |
| Step 2: 11 themes, Recommended badges (1–2), swatches, full-screen live preview (iframe of the real renderer) with desktop/mobile toggle, the user's name **and logo** | `theme-step.tsx`, `session-logo.tsx`, preview `?logo=session` |
| Step 3: up to 3 services (name, short description, price type + ₹ price), "Skip, I'll add later" | `services-step.tsx` |
| Step 4: the existing account creation (Google, or the same emailed-code actions as the store journey) returning to finish | `account-step.tsx` |
| One-transaction completion, idempotent; samples flagged `is_sample` when skipped; logo uploaded to `tenant/<id>/informative/…` | `complete_informative_onboarding()` (migration 8200), `completeInformativeOnboardingAction`, `onboarding/payload.ts` |
| Analytics: `onboarding_type_selected`, `informative_theme_previewed`, `informative_theme_selected`, `informative_onboarding_completed` | `onboarding/analytics.ts` (GA4/dataLayer when present) + server log on completion |

### Decisions and deviations

1. **Step 0 lives at `/start/build`** and only bare `/start` is branched. Deep links to the store flow
   (`/start/lang`, marketing CTAs) still go straight into it, and the query string (`?plan=`) is
   carried to the store branch.
2. **Back on the store flow's first step (Q4)** is an optional `onBack` prop on `LangScreen`, threaded
   from `StartPageContent`. It is set only when Step 0 is available, so with the flag off the store
   screen renders exactly as before (verified in the browser). These three edits sit under the
   "onboarding entry/router" touch point.
3. **Completion reuses the creation service** (plan: "via the existing store-creation service, passing
   the type"). `complete_informative_onboarding` calls `create_tenant(…, 'INFORMATIVE')` from M1 inside
   one transaction, then sets `site_mode='informative'` and `launch_status='draft'` (so existing
   commerce guards and "coming soon" apply), and creates the site (DRAFT), private settings, the 4
   system pages with the theme's default sections, and the starter or 3 sample services. Store-only
   records that are **not** created: inventory location, shipping rates, COD/UPI settings, sample
   products, collections and categories, and the store theme draft (DB-tested).
4. **Idempotent twice over:** the RPC returns the caller's existing INFORMATIVE tenant for the same
   slug, and the action retries once on a unique-violation race. The finish step fires once per
   page load.
5. **The logo before an account exists** is downscaled in the browser (≤ 512 px, WebP/PNG) and kept in
   the draft. The preview iframe reads it from `sessionStorage` (same origin; never uploaded). After
   the transaction, the server re-checks it (PNG/JPG/WebP data URL, ≤ 2 MB, bytes sniffed by
   `uploadTenantImage`) and uploads it under `informative/`. This is best effort, because storage
   isn't transactional; a failed upload is logged and the site still gets created. SVG is refused (Q11).
6. **Address check (Q10):** new `store_slug_available()` (SECURITY DEFINER, reveals only taken/free),
   rate-limited to 60 per 10 min per IP. The final word is still the `tenants.slug` unique constraint.
7. **Account step** reuses `requestStartEmailCodeAction` / `verifyStartEmailCodeAction` (via the shared
   `EmailCodeFlow`) and Google sign-in with `next=/start/informative/finish`, so no new auth code was
   written. **Known limitation:** an account that *already owns a store* and signs in **with Google**
   during this flow is sent to its existing panel by the OAuth callback (`landingFor` treats `/start/*`
   as onboarding). The email-code path returns to finish. Such users can restart at `/start/build`.
   Changing this would mean editing the callback rule (left for review).
8. **Flag stages:** `all` lets anyone in; `internal` shows Step 0 and the steps only to signed-in
   platform staff (everyone else sees today's flow); `off` 404s the informative routes.
9. **Accessibility:** native radios (with explicit `aria-labelledby`) for the type and theme choices;
   errors linked by `aria-describedby`; focus moves to the first invalid field; the preview is a native
   modal `<dialog>` (focus trap, Escape); the live address hint is a polite live region outside the
   label. The browser walk caught two issues, both fixed: errors and hints inside `<label>` were
   polluting field names, and swatch keys were duplicated where a theme reuses a colour.
10. Finishing lands on `/informative/dashboard?welcome=1` (the M1 stub; the checklist comes in M5).

### Verification

- DB test `tests/rls/informative-onboarding.test.ts` (6): slug check; the complete transaction
  (tenant INFORMATIVE, owner, subdomain, `site_mode`/`launch_status`, DRAFT site, notify email, 4
  pages, 3 samples, **no** store-only rows); idempotent double submit; all-or-nothing rollback on an
  invalid service; oversized payload; someone else's slug; anonymous refused.
- Unit `tests/unit/informative/onboarding.test.ts` (21): Step 1 rules, draft resume, logo types,
  payload mapping (samples vs starters, paise → numeric, unique slugs, pages/contact), the entry
  branch with the flag on and off (query kept), and the completion action refused when the flag is
  off (no DB call).
- Browser walk on a worktree dev server (hosted DB, which has none of the migrations, so nothing was
  created; the slug check fails quietly there by design):
  - **Flag on:** `/start` → Step 0 → Online Store → the unchanged `/start/lang` + Back → Step 0 with the
    choice kept → Informative → Step 1 validation and focus, address suggestion → Step 2 recommended
    badges (clinic → Zenith Prime, Smooth Wave), full-screen preview with the user's name, mobile
    390 px toggle, "Use this design" → Step 3 → Skip → Step 4 (Google + email code).
  - **Guards:** `finish` signed out → `account`; a deep link with no draft → `basic-info`.
  - **Flag off:** `/start`, `/start?plan=pro` and `/start/build` → `/start/lang` (query kept);
    `/start/informative/*`, preview and panel → 404; the language screen has no Back button.
- The end-to-end account creation + completion against a database with migrations 8000–8200 is
  covered by the DB tests; the browser E2E of the whole journey is part of M8.
- `pnpm check` ✅ **208 files / 2209 tests** + build; full RLS suite ✅ **27 files / 204 tests**
  (patched-shim scratch DB, run serially); `build:vinext` + `check-worker-css` ✅.

---

## M5 — Seller panel (2026-11-11)

### What landed

| Route | What the seller can do |
|---|---|
| Shell (`(panel)/layout.tsx`) | Shared `AppShell` (header, account menu, appearance toggle, sidebar collapse) with the Informative sidebar (`panel/nav.ts`, filtered by permission); store/site switcher; View website; Sign out |
| `/informative/dashboard` | Welcome banner after onboarding; setup checklist (logo, 3+ own services, contact info, design, publish); new/converted enquiry counts; last 5 enquiries; status; View site; Publish/Unpublish |
| `/informative/services` (+ `/new`, `/[id]`) | Search, category filter, add/edit, soft delete, move up/down, active/featured toggles, duplicate, image upload, price type + price (₹ → paise), duration, category, address, per-service SEO; samples are labelled and become the seller's own on edit |
| `/informative/pages` (+ `/new`, `/[id]`) | System pages + custom pages; section editor (show/hide, reorder, add from the section library, remove, edit headings and text); page settings (title, address for custom pages, published, SEO) |
| `/informative/gallery` | Multi-upload (up to 30 at once), caption, alt text, album, reorder, delete |
| `/informative/team`, `/testimonials`, `/faqs` | Add/edit/delete/reorder; photo; rating; show/hide |
| `/informative/enquiries` | Read-only list (filters, detail, status, notes and CSV come in M7) |
| `/informative/appearance` | Switch design (content kept, preview link per design), own colours (optional), font pair, logo, favicon, hero image |
| `/informative/business` | Name, category, tagline, about, phone, email, WhatsApp (same as phone), city, address, map link, opening hours per day, social links |
| `/informative/seo` | Site title, meta description, share image |
| `/informative/domain` | Subdomain (see decision 4) |
| `/informative/settings` | Enquiry notification email/WhatsApp toggles, enquiry form options (success message, preferred date/time, privacy text), publish/unpublish, delete website |
| `/informative/profile` | Profile and password (the existing account forms and actions) |

Server actions: `src/features/informative/actions.ts` (runAction → parseInput → `requireInformativeTenant()` → repo permission check → write → audit for publish/unpublish and theme switch → revalidate panel + public site cache).

### Decisions and deviations

1. **Own layout instead of a sidebar switch inside the store layout.** The panel passes
   `INFORMATIVE_NAV` to the same `AppShell`; `DASHBOARD_NAV` and the store layout are untouched
   (asserted by a test). This is the "sidebar selector" touch point without editing the shared file.
2. **Reordering uses Move up / Move down buttons, not drag-and-drop.** They work with keyboard and screen
   readers and need no client JS library; the order is stored the same way (`sort_order`).
   Drag-and-drop can be layered on later.
3. **Publish** sets `info_sites.status` (+ `published_at`) **and** `stores.launch_status`, so the existing
   "coming soon" logic agrees with the site status (M6 renders from `info_sites`). Both are audited.
4. **Domain:** the plan says "reuse the existing custom-domain feature if it exists; otherwise show the
   subdomain only". The feature exists but resolves its tenant with `requireTenant()`, which (by
   design, M1) refuses Informative tenants, and custom domains for Informative sites in v1 is an open
   product question. v1 therefore shows the subdomain and a "coming soon" note. Enabling it later
   means passing the informative context into the domain actions (no store change).
5. **Delete website** reuses the store's `close_own_store` RPC (owner only, typed confirmation,
   nothing hard-deleted, support can reopen), then goes to `/start`.
6. **Shared account pages (Q12):** the Informative panel has its own `/informative/profile` that
   renders the existing `ProfileForm` / `ChangePasswordForm`, whose actions use `requireUser()` (not
   the store guard). Billing/plan and team management are not exposed in the Informative panel in v1
   (no separate plan; open question).
7. **Permissions:** the panel uses the existing roles. A **Sales associate** sees content and
   enquiries (read) but not Appearance, Business, SEO or Settings, and cannot upload or edit content;
   **Owner/Manager** get everything (test-covered).
8. **Rich text:** descriptions and section texts are plain text with line breaks (Q13); no HTML is
   stored or rendered.

### Verification

- Unit `tests/unit/informative/panel.test.ts` (10): every sidebar item has a page; the store
  sidebar is untouched; **every** panel page and the layout call `requireInformativeTenant()`;
  sidebar by role; actions (create vs update and rupees → paise, invalid input never reaches the
  repo, move swaps neighbours, publish → `launch_status` + audit, unknown design refused + theme
  switch audited, delete is owner-only via `close_own_store`, image upload permission + `informative/`
  path).
- `pnpm check` ✅ **209 files / 2219 tests** + build (all 20 `/informative/*` panel routes compile); RLS ✅
  **27 files / 204 tests**; `build:vinext` + `check-worker-css` ✅.
- **Not exercised in a browser:** the signed-in panel needs a Supabase project with migrations
  8000–8200 that the dev server can reach. The configured dev env points at the hosted project, which
  doesn't have them and which I didn't modify. The full journey (onboard → panel → publish → public
  site → enquiry) is the M8 E2E task.
