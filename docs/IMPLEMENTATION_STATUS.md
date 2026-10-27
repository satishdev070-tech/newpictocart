# Implementation Status

_Last updated: 2026-10-27 (Seller AI Phase 1: product generate) · 2026-10-27 (seller/admin Phase 1 speed) · 2026-10-27 (optional Upstash Redis L2 for storefront) · 2026-10-27 (storefront performance: cache scope, fewer DB waves, zod out of the client) · 2026-10-27 (team roles: Owner / Manager / Sales Associate) · 2026-10-26 (theme editor reliability) · 2026-10-25 (Unsplash API key in Admin → Media library)_


## Seller AI Phase 1 — Product Generate with AI (2026-10-27)

- **Edge:** `supabase/functions/generate-product` (+ `_shared/auth.ts`, `_shared/llm.ts`). Server-only invoke; LLM via `GEMINI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`.
- **Next:** `invokeEdgeFunction` in `src/lib/supabase/edge.ts`; `generateProductFromImageAction` (catalog.write) debits `generate_product` credits and refunds on failure.
- **UI:** Product editor “Generate with AI” — file upload for new products; store-assets `assetUrl` media for saved products; fills draft only (no auto-save).
- **Economy:** migration `20261027004200_seller_ai_generate_product.sql` inserts cost row; debit/refund also allow `catalog.write`. Registry: `ai-health/registry.ts` → `generate_product`.
- **Reuse (Phase 2/3):** `invokeEdgeFunction`, `supabase/functions/_shared/*`, credit debit/refund pattern in `catalog/server/generate-product.ts`.
- **Verification:** `pnpm check` ✅ (typecheck, lint, 128 files / 1,538 tests, build). Branch `cursor/seller-ai-product-generate-c73e`.

## Seller / admin Phase 1 speed (2026-10-27)

Dashboard and Super Admin stay **live** (no Data Cache on private tenant product/order lists — ADR-010). Phase 1 cuts serial DB waves and caches only public catalogues (marketplace themes, open demo origins, platform `product_types`).

- **Dashboard layout:** `getStoreSiteMode` runs in the same `Promise.all` as alerts / bell / trial (was a solo query before those).
- **Theme marketplace:** catalogue + tenant keys/entitlements/industry + open demos in one wave; `publishedCustomThemes` and open demo origins use production `unstable_cache` (`MARKETPLACE_*` tags); theme builder `refresh()` calls `revalidateMarketplaceCatalogue()`.
- **Theme editor:** menus load in the first `Promise.all` (embedded `menus→menu_items`, filter by handles after); `hasAiProviderConfigured()` gates AI without decrypting secrets; `SiteBuilder` is a `next/dynamic` import with a loading skeleton.
- **Admin signup chart:** `getSignupSeries` one `tenants.created_at` range select + `bucketCounts` (was 12 head counts).
- **Products list:** unused category/collection/SKU prep already skipped; filter picker uses lean `listCategoryFilterOptions`; `platformRows()` cached in production (tag `platform-product-types`, 600 s) with write-path revalidate.
- **Verification:** `pnpm check` ✅ (typecheck, lint, 126 files / 1,531 tests, build). Branch `cursor/seller-admin-speed-phase1-c73e`.

## Optional Upstash Redis L2 for public storefront cache (2026-10-27)

- **Why:** cold Vercel instances miss Next Data Cache and re-hit Supabase for directory/theme/profile. Free-tier Upstash shares those public reads across instances.
- **How:** `@upstash/redis` behind `cachedStorefront` (`src/lib/cache/storefront.ts` + `src/lib/cache/redis.ts`). L1 stays `unstable_cache`; L2 is Redis when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set (both optional; unset = previous behaviour). Invalidation deletes indexed Redis keys with `revalidateStorefront` / `revalidateTenantDirectory` / `revalidateAllStorefronts`.
- **Scope:** public storefront loaders only (same ADR-010 rules). Not cart, session, dashboard, secrets, or catalog/product/price/stock. Rate limits stay Postgres (ADR-025).
- **Ops:** create an Upstash DB near Mumbai, set the two env vars on Vercel. Aim to stay on the free tier; upgrade only if commands approach the daily cap.
- **Verification:** unit tests in `storefront-cache.test.ts` (env-off, L2 hit/miss, indexed delete).

## Storefront performance: cache scope, fewer DB waves, zod out of the client (2026-10-27)

Measured audit and before/after numbers are in `docs/PERFORMANCE_AUDIT.md`.

- **Directory cache scope:** `revalidateStorefront(tenantId)` no longer evicts every store's host lookup. The directory is now two cached layers: host → tenant (tag `tenant-directory`, dropped only by domain actions via the new `revalidateTenantDirectory()`), and tenant identity (slug, status, name, primary host; tagged with the tenant's storefront tag).
- **Storefront loaders:**
  - `getStoreSiteMode` is cached per tenant.
  - Tracking tags come from one cached query that reads public IDs only (`activePublicConfigs`, no secret decryption). Integration actions revalidate the tenant.
  - Menus and their items load in one embedded query.
  - The store layout reads draft status, render context, festive and tracking in one `Promise.all`.
  - The product page loads the product alongside the render context, and the wishlist flag chains on the customer.
- **Client JS:**
  - `@/lib/env/public` validates with a zod-free parser (`lib/env/public-parse.ts`, parity-tested against `publicEnvSchema`).
  - The builder `CanvasBridge` is lazy-loaded (`canvas-bridge-lazy.tsx`).
  - First-load JS (gzip): storefront 329 → 205 KB, product page 335 → 212 KB, dashboard 359 → 270 KB.
- **Measured (local prod build, 25 ms per Supabase call, median):**
  - Warm storefront home TTFB 257 → 159 ms (23 → 18 calls).
  - Warm product page 253 → 134 ms (20 → 15 calls).
  - Cold first request: no measurable change (840 vs 893 ms, within noise).
  - Rendered links/text identical before and after on home, product, collections and search.
- **Verification:** `pnpm check` ✅ (125 files / 1,515 tests, build). New tests: `env-public-parse.test.ts`, `tracking-config.test.ts`; updated `tenant-directory.test.ts`, `storefront-cache.test.ts`.

## Team roles: Store Admin (Owner) / Manager / Sales Associate (2026-10-27, QA #2 #3)

- **Three standard roles** instead of twelve: **Store Admin (Owner)** (the registering merchant, all access, can't be removed or changed by others), **Manager** (everything except billing; manages the team and roles but can't touch the owner) and **Sales Associate** (orders incl. cancel, customers, products view/edit, inventory; no settings, payments, domains, team, refunds, publish or delete). Invite and role pickers list only Manager, Sales Associate and the store's own custom roles; default is Sales Associate.
- **Migration `20261027004150_team_roles.sql`** (⏳ not yet applied to the hosted project): maps existing members and invitations (Store Admin, Store Manager, Catalog/Order/Inventory/Marketing/Content Manager → Manager; Analyst, Support Agent, Staff, Viewer → Sales Associate), reseeds `role_permissions`, tightens the role CHECK constraints, moves platform support sessions to the internal read-only `support_viewer` set, and reorders `list_tenant_members`. Seed user `staff@aangan.test` is now a Sales Associate.
- **Team page:** change role per member (Save role), deactivate/reactivate, remove (confirmed), resend / cancel invite (confirmed), plus a Roles card explaining each role. Custom roles (create / edit / delete) stay under Settings → Roles & permissions. All actions keep the `members.manage` / `roles.manage` server checks and DB escalation guards.
- **Verification:** unit tests for the matrix, SQL ↔ matrix seed and CHECK lists, role choice; `pnpm test:db` (24 files / 181 tests) ✅ on Postgres 17, including new manager/sales-associate/owner-protection/retired-role tests; migration checked on a DB with all 12 old roles (7 → Manager, 4 → Sales Associate, owner untouched).

## Header layouts, Logo badge design, fit-to-logo crop (2026-10-26)

- **Layout fix:** the Header section's Layout (Logo left / centred / right / large logo left) is now always applied. Choosing a layout clears the desktop override in Theme settings → Header → Logo position (it used to win silently). New **Logo right** layout.
- **Logo badge** header design: the whole logo hangs from the top of the bar in a tall tab over the page (`object-fit: contain`, never cropped), on phones too. Tab background: none (the logo file is the badge), white or brand colour, with a curved bottom; height / width sliders size it.
- **Fit to logo** in the crop dialog (logo-type images): trims transparent or plain-colour edges so the whole logo fills its space.
- **Also included:** the canvas review fixes (no stale CSS after renders, finish marker, re-handshake after full page loads, token renewed before posting) and the crop dialog's Strict Mode load fix.
- **Verification:** typecheck, lint, `pnpm test` (120 files / 1,452 tests) ✅. Local editor: reproduced the bug (Logo position Left + Layout Logo centred showed the logo left), then Layout → Logo right and Logo centred applied, Desktop position reset to Auto; Logo badge rendered hanging over the hero on desktop and phone.

## Theme editor (customizer) reliability, header, collage images, crop (2026-10-26)

- **Stuck "Loading 92%" / edits not applying:** the canvas only talked to one exact platform origin, so an editor opened on `www.` (or an alias) never received "ready" and every later edit was held back. The canvas now accepts all platform origins (`builderParentOrigins()`: platform URL, root with/without `www.`, aliases), the editor pings `hello` until the canvas answers, and a canvas that never connects shows "The store preview didn't connect" with Retry instead of loading forever.
- **"Preview session expired":** renders are authorised by the preview token sent with each edit (the frame cookie is only a fallback), the token is renewed in the background, and a rejected render renews the token and resends without reloading. The preview route now detects https / `.localhost` from the real Host (it was looking at the internal rewrite URL), so the frame cookie is SameSite=None; Secure; Partitioned where needed.
- **Slow edits:** colour / font / spacing changes are applied instantly in the canvas (no server render); header settings re-render only header + footer; section edits only their list (`changePlan`). Previously any token or header change re-rendered every slot. The "taking longer than usual" toast is shown only for edits, not for the first page load.
- **Header:** every design (Classic, Double rule, Inverted, Floating, Minimal, Editorial) renders distinctly and wins over preset styling; logo position / size work in each design (tests in `tests/unit/theme/header-variants.test.ts`).
- **Hero Editorial collage:** photos 2 and 3 are editable (`image2Path`/`image3Path` + alt text, collage only; empty → previous fallback then stock).
- **Crop & resize on upload:** cropper dialog (preset aspect per slot from `features/media/image-standards.ts`, free/1:1/4:5/16:9, zoom, rotate, "use original"), resized in the browser before the normal upload; each image field shows its recommended size.
- **Verification:** typecheck, lint, `pnpm test` (120 files / 1,441 tests), `pnpm build` ✅. Local editor (Supabase stack + dev server, seeded seller): canvas connects, colour palette applied in ~0.5 s with no server render, header designs Inverted / Floating / Editorial applied in ~2–3 s (dev mode), collage photo 2/3 fields shown. The crop dialog needs a real file pick and was covered by unit tests only.
- **Known:** Safari blocks third-party cookies in cross-site frames, so a store on a custom domain may still not open in edit mode there (the canvas bridge mounts only when the preview cookie is accepted). A storefront render error `cookies()` inside `after()` from the cart drawer was seen once under heavy local load; not reproduced at normal speed.

## Unsplash API key in the console (2026-10-25)

- **Admin → Media library** has an "Unsplash API key" card: paste the Access Key, **Save & test** (one `GET /photos?per_page=1` call; a key Unsplash rejects is never stored), **Test connection** (shows demo vs production mode and requests left this hour from the rate-limit headers), **Remove saved key**. The key is stored encrypted in `platform_app_credentials` (provider `unsplash`, same as the AI/Resend keys), is write-only (only a masked hint is shown) and wins over `UNSPLASH_ACCESS_KEY`, which stays as the fallback. Saves and tests are audited and rate limited; cached Unsplash fetches are revalidated on change.
- Every Unsplash call (marketing category photos, theme stock photos, media library search, download tracking) now reads the key through `features/media/unsplash/key.ts`.
- **Unsplash API guidelines** (listed on the card): photos hotlinked from images.unsplash.com, photographer + Unsplash credit with `utm_source=pictocart&utm_medium=referral`, `download_location` called whenever a photo is used, key server-side only, no Unsplash-clone experience. New Unsplash apps run in demo mode (50 req/h); apply for production in the Unsplash dashboard before launch.
- **Migration (NOT applied to the live project; owner approval needed):** `20261025004000_unsplash_credential.sql` adds `unsplash` to the `platform_app_credentials` provider check. Until it is applied, saving fails and `UNSPLASH_ACCESS_KEY` keeps working.
- **Verification:** typecheck, lint, `pnpm test` (116 files / 1,403 tests) ✅. Local Supabase + dev server: the card renders, a fake key is rejected by Unsplash (401) and not saved; the project's real key returns HTTP 200 in demo mode (50/h).

## Super Admin port: nine modules (2026-10-25)

Plan, gap analysis and decisions: [SUPER_ADMIN_PORT.md](SUPER_ADMIN_PORT.md). Re-implemented in this architecture (server components, `runAction` + `parseInput`, RLS + audited SECURITY DEFINER SQL, integer paise), not copied.

| Module | Route | Status |
|---|---|---|
| Users (all accounts: staff / seller / customer, stats, search, filters, list/grid, details with stores, sign-ins, audit trail, Add user, reset link, disable/enable) | `/admin/users`, `/admin/users/{id}` | ✅ (staff management moved to `/admin/platform-users`) |
| Revenue P&L (MRR, 30-day commission, credit packs, theme sales, AI cost, net profit, plan breakdown, theme P&L) | `/admin/revenue` | ✅ (themes are free here, so theme sales are ₹0; lifetime subscription part = current MRR, no payment ledger yet) |
| Commissions (GMV invoices, totals, search, status, mark paid / waive, run generation) + commission % on Plans | `/admin/commissions` | ✅ (rates default to 0% until set on Plans) |
| Partner analytics (presets, rank by, totals, leaderboard, CSV) | `/admin/partner-analytics` | ✅ |
| Partner payouts (cutoff, run batch, pending by partner, history, UTR) | `/admin/partner-payouts` | ✅ |
| Agencies (type tabs, server totals, owner → team) | `/admin/agencies` | ✅ (the old "Could not load partners" does not occur) |
| All partners (partners, licence requests, licences, demo shops, one-time codes, invite, create directly, detail page) | `/admin/partners`, `/admin/partners/{id}`, `/partner/accept/{token}` | ✅ admin side; no partner portal (partner actions are done by an admin on their behalf). Demo shops never store passwords; one-time codes are stored as hashes |
| AI health (feature → primary/fallback model registry used by `runGeneration`, Test button, model prices) | `/admin/ai-health` | ✅ |
| Credits economy (pricing, per-action costs, packs, promos, insights, grant) + seller packs/promo/custom amount | `/admin/credits-economy` | ✅ |

- **Permissions:** new `platform.finance.read`, `platform.finance.manage` (super_admin, finance) and `platform.partners.manage` (super_admin). ADR-006 addition for account creation / reset / ban.
- **Migrations (NOT applied to the live project; owner approval needed, apply in order):** `20261025003700_platform_finance.sql`, `20261025003800_partners.sql`, `20261025003900_ai_economy.sql`. Until applied, the new pages show a pending-migration notice and AI credits keep today's behaviour.
- **Verification:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (115 files / 1,398 tests) and `pnpm build` ✅. `pnpm test:db` ✅ (24 files / 178 tests, all migrations from scratch on Postgres 17; on macOS run with `PGBIN=/opt/homebrew/opt/postgresql@17/bin LC_ALL=en_US.UTF-8`). All three migrations also applied on a local Supabase stack (`supabase start --runtime native -x functions -x studio`), and every page was opened in the dev server as the seeded super admin: Users (disable account audited), Revenue, Commissions, Partners (created an agency, issued 10 licences at ₹8,500 → analytics ₹85,000), Agencies, Partner analytics, Partner payouts, AI health, Credits economy (₹0.09/credit, ~67%, ₹100 → 1,111 credits).
- **Known, pre-existing:** React "unique key" warning from `AdminLayout` → `AppShellClient` (not changed here).


## Bugs 2.0 tester fixes #1–#10 (2026-10-23)

- **1–3 Tara / login:** Clearer voice errors (no INTERNAL for chat); building waits on finalize; prompt never re-asks Known facts; onboarding sends `historyJson`; shared silence auto-stop + max record length.
- **4 Free forever:** Migration `20261023003600_free_plan.sql` — free plan (10 products, `trial_days` 0); new free stores `active` with null trial end; trial banner only when trial + `trial_ends_at`.
- **5 Home URL:** Dashboard home shows truncated storefront host + Copy next to View store.
- **6–7 Themes:** Ecommerce best-fit skips informative; choose-theme publishes; ecommerce apply restores `site_mode`; mockups use name/tagline.
- **8 CSV:** Import mode on submit buttons; atomic create/update tally; clearer “matched by handle” copy.
- **9 Stock/variants:** “Configure Variant”; Generate validates instead of wiping; stock links to inventory.
- **10 Multi-image:** Direct Storage upload + attach; Server Action caps multi/oversize; sharp variants fire-and-forget.

## Admin login brand + seller login resilience (2026-10-23)

- **`/admin/login`:** Uses the Pictocart `.theme-brand` split (logo, orange radials, orange CTA) with a “Full command center” aside. Staff-only form behaviour unchanged (work email, no self-serve register).
- **Seller login crash:** Proxy session refresh, `getSessionUser`, and `landingPathFor` fail soft instead of 500ing; `sharp` moved to write-only `branding-images.ts` so BrandLogo / auth metadata never load it; `(auth)/error.tsx` logs digests for diagnosis.
- **Tests:** `tests/unit/auth/session-resilience.test.ts`, `proxy-session-refresh.test.ts`, `tests/unit/platform/public-config-no-sharp.test.ts`.

## Vercel Next.js deploy config (2026-10-21)

- **Cause of Production fail:** the Vercel project still expected a static `dist` output (`STATIC_BUILD_NO_OUT_DIR`) after a successful Next build. `vercel.json` now sets `framework: nextjs` with `pnpm install` / `pnpm build` and does not set `outputDirectory`.
- **Dashboard still required:** clear Output Directory if it is `dist`, set Framework to Next.js, and replace old `VITE_*` / bare `SUPABASE_*` env names with `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SECRET_KEY`, platform URL vars, `APP_SECRET`, and `CRON_SECRET` for the new Supabase project.

## Marketing hero device frames (2026-10-20)

- **Desktop wider:** the landing hero grid gives more width to the theme preview column (`0.88fr / 1.22fr`).
- **Phone shorter:** the large device preview sizes the phone by height (about half the desktop, max ~15rem) at a 9:16 frame instead of a skinny width on a full 390×844 ratio, so it reads as a handset beside a wider desktop.

## Onboarding polish, contact pages, and AI sections (2026-10-20)

- **Register and `/start` colour:** the seller register aside is top-aligned with the form. Onboarding screens use the logo orange (`#F97316` / `#C2410C`) for progress, buttons, and accents.
- **Google and signed-in finish:** Continue with Google shows a spinner and “Opening Google…” while the form submits. A seller who is already signed in, with a draft ready to save, stays on the building screen until `finalizeStartDraftAction` returns, then sees Done. A failure returns to the account step with the existing toast.
- **Manual product photos:** the product step offers four curated photos (food, fashion, furniture, handicrafts). The chosen photo shows in the form and on the live preview card. It is a local preview only; the draft product schema is unchanged.
- **About and Contact:** `ensureInfoPages` publishes About (from the store story) and Contact when those slugs are missing. It runs from the ready-store seed and from the photo backfill, so an existing store gets the pages the next time `/start` finishes. A failed insert is logged and does not stop store creation. `/pages/contact` and `/contact` show a Google Maps search embed (no API key) and a contact form.
- **Contact messages:** the form posts through `submitContactFormAction` (verified host, honeypot, rate limit). `submit_contact_message` is the only insert path. Staff with `content.write` read the latest 100 messages at **Content → Messages**. Apply `supabase/migrations/20261020003500_contact_messages.sql` before the form can store rows.
- **Add with AI:** when Gemini, Groq, and Anthropic are missing or fail, `generateSectionAction` asks Sarvam for one JSON section, sanitizes it, and inserts it like any other section. One AI credit is debited before the model call and refunded only if every model fails. If Sarvam is also unset, the panel shows the existing setup sentence.
- **Verification:** `pnpm check` ✅ (typecheck, lint, 99 files / 1,277 tests, build). The local dev server returns `EnvValidationError` because Supabase env vars are unset, so the register, `/start`, contact, and site-builder screens were not clicked through in a browser. Apply the contact migration, then finish `/start` again so an existing store receives About and Contact.

## Cache-first `/start` journey (2026-10-19)

- **`/start`** is a full prototype-order onboarding flow with **no database writes until the seller
  has a verified account**. Progress lives in **`localStorage`** (`pictocart.start.draft.v1`) and a
  **`pc_start_draft=1`** cookie (set after welcome) so signed-in users can return to finalize.
- **Screens:** Welcome → Language → Intent → Path (AI vs Manual) → **AI:** Tara voice → Building →
  Account (if needed) → persist → Done · **Manual:** Business → Products → Mood → Payment → Building →
  Account → persist → Done.
- **`finalizeStartDraftAction`** creates or reuses the owned store, applies payment/WhatsApp/city prefs,
  then **`seedReadyStore`** with a rich brief (seed counts in pipeline: **5 categories / 10 products /
  nav / homepage / 6 blogs / 5 testimonials**).
- **Voice before auth:** `startVoiceTurnAction` (IP rate-limited) uses shared **`runTaraTurn`**; post-auth
  onboarding voice unchanged.
- **Tests:** `tests/unit/start/*` (draft, flow, brief, register href) and `tests/unit/onboarding/seed-counts.test.ts`.
- **Account step:** `/start` uses a compact sign-up / sign-in form (name, email, password, hidden store name from the draft, Google `next=/start`). Password guidance is one line of text. `Hint` renders as a `div` so richer hints on `/seller/register` stay valid HTML. The building timer runs once per visit and then finalizes or opens the account step.
- **Tara on `/start`:** the mic asks for permission, records webm or mp4, and shows the conversation. Each turn sends the recent lines to Sarvam so Tara keeps collecting name, category, site mode, tagline, and city. The recording is uploaded with its filename beside the bytes, because Node's `File.name` cannot be assigned. **Quiz mode** asks those same facts by tapping, then continues into building. Email sign-up can be confirmed with the code from the email, or the seller can request a code instead of a password. Store setup continues if the theme or AI-credit debit fails, then publishes the seeded theme. The side panel draws the draft store and, once a slug exists, loads the store on its own host (`http://{slug}.localhost:3000` locally). Finish errors show in a toast, with Try again.
- **Mic, signup, blank page:** `Permissions-Policy` allows `microphone=(self)` so Tara can ask for the mic (camera stays off). The Send Email hook returns success when Resend is not configured. If the confirmation email still cannot be sent, signup confirms the seller and signs them in: always when no provider is configured, and also on localhost or any non-production server when a saved Resend key fails to send. Production with a configured provider still shows the email error. `/start` paints the welcome shell immediately and replaces it with the saved draft after hydration; a bad draft falls back to welcome.
- **Catalogue photos:** the ready-store seed copies curated photos for the store's industry into that store's media library and attaches them to products, categories, collections, blogs, and the homepage. A failed download does not stop store creation. A store that was seeded without photos gets them the next time `/start` finishes while the seller is signed in.
- **Verification:** `pnpm check` ✅ (typecheck, lint, 98 files / 1,273 tests, build). Browser signup was not run here: this environment has no Supabase URL. On localhost, a failed confirmation email now creates the account and signs the seller in. Pull this branch, restart `pnpm dev`, and finish `/start` again so an existing store receives its photos.

## Prototype start journey (2026-10-19, superseded routing)

- Public CTAs still open **`/start`** (journey above replaces register-first for new sellers).
- Locale is stored on signup metadata (`onboarding_locale`) and carried into `/onboarding` when used.

## Sarvam voice onboarding → ready store (2026-10-19)

- **Auth gate:** `/onboarding` blocks voice and store create until email is confirmed (password
  signup). Google OAuth and existing name/email/password register/login are unchanged; sellers can
  resend the confirmation link from the verify panel.
- **Language + method:** after verify, sellers pick any Sarvam STT locale (`SARVAM_LOCALES`, 23
  codes) then **Talk with Tara** or the classic business form.
- **Tara voice:** `voiceTurnAction` runs STT → Sarvam-105B chat → Bulbul TTS (when supported),
  extracts name / category / siteMode / tagline, rate-limits by user, and falls back to typed input
  or the form. Pre-store turns are rate-limited only; AI credits debit on the ready-store seed.
- **Build & ready:** `saveBusinessAction` creates a draft store then continues to **Building**, which
  calls `seedReadyStore` (curated theme + 5 categories / 10 products / nav with category submenus /
  homepage / 6 blogs / 5 testimonials). Theme and plan steps are optional; Ready offers **Change theme**.
  If Sarvam is unset or returns an invalid plan, a deterministic catalogue of the same counts is used.
- **Sarvam client:** `src/lib/sarvam/{locales,client}.ts` + `SARVAM_API_KEY` (server-only). Seed
  pipeline lives under `src/features/onboarding/seed/`.
- **Tests:** steps resolution, voice fact→industry mapping, existing onboarding action redirects.
- **Verification:** `pnpm typecheck` ✅, `pnpm lint` ✅, `pnpm test` ✅ (91 files, 1,247 tests),
  `pnpm build` ✅.

## Informative sites, marketplace, editor controls and AI credits (2026-10-19)

- **Website mode:** onboarding and Settings → General now support an **Informative website** or
  **Online store** choice. Informative mode hides commerce-only storefront controls and blocks
  cart, checkout and account routes, limits dashboard and builder navigation to relevant features,
  and retains existing store data when changed. The additive `20261019003300_site_mode.sql`
  migration must be applied before the choice is stored; the application safely retains the
  existing online-store behaviour until then.
- **Theme marketplace:** added ten informative templates (consultancy, interior, restaurant,
  clinic, wedding, architecture, loans, visa, salon and cleaning), site-type/industry filters and
  a persistent category sidebar. Theme previews open as a separate full-page tab; device previews
  retain the true 390 × 844 phone frame.
- **Site builder:** every section receives desktop and phone controls for content scale (80–130%),
  content width, and top/bottom margin and padding. Header settings include menu font size,
  weight, letter spacing, case and colour. The trust-strip icon field accepts the existing icon
  library or a tenant-owned media image, retaining compatibility with old icon choices.
- **AI credits:** the additive `20261019003400_ai_credits.sql` migration supplies a 100-credit
  grant for newly created stores, an auditable ledger, debit/refund functions, purchase requests
  and platform approval/manual-grant functions. Seller balance/history/purchase controls and the
  platform review page are implemented. AI generation reserves credit first and refunds it on
  provider failure. Until this migration is applied, current AI behaviour remains unchanged. The
  "online" purchase route records a payment-verification request; automatic payment capture needs
  a configured platform billing gateway.
- **Verification:** `pnpm typecheck` ✅, `pnpm lint` ✅, `pnpm test` ✅ (88 files, 1,233 tests),
  and `NEXT_BUNDLER=webpack pnpm build` ✅. The default Turbopack build was not allowed to finish
  while the already-running local development server held the shared `.next` workspace; no source
  errors were reported before it was stopped.

## Phase overview

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 0 | Repository audit | ✅ Done | Greenfield |
| 1 | Foundation | ✅ Done | Env, Supabase clients, host routing, permissions, errors, validation, UI primitives |
| 2 | Schema, RLS, storage, seed, types | ✅ Done | 13 migrations, RLS on every table, composite tenant FKs, storage buckets, seed |
| 3 | Auth & tenant | ✅ Done | Signup/login/magic link/reset, onboarding, invites, tenant switcher |
| 4 | Catalog | ✅ Done | Products + variants (option1–3), media, categories, collections (manual + rules), size charts, CSV import/export |
| 5 | Inventory | ✅ Done | Per-variant stock, adjustments ledger, thresholds, concurrency-safe reservation in `place_order` |
| 6 | Theme engine | ✅ Done | Theme config JSON, 23 section types, draft/publish/rollback, editor with live iframe preview |
| 7 | Storefront | ✅ Done | Home, listings with filters, PDP, search, pages, blog, FAQ, contact, stores, SEO, sitemap/robots |
| 8 | Checkout & orders | ✅ Done | Cart cookie, checkout, Razorpay + COD, webhook, order status, invoices, customer accounts |
| 9 | Seller dashboard | ✅ Done | Home overview added in the audit pass (it was still a placeholder); orders, returns, customers, discounts, reviews, content, analytics, settings, team, domains |
| 10 | Super admin | ✅ Done | `/admin` console (below) |
| 11 | Cloudflare / domains | ✅ Done | Custom domains + verification cron, `workers/domain-router` edge Worker |
| 12 | Hardening | 🟡 Partial | Rate limits, framing policy, secret redaction, upload body limits; full CSP with nonces open (ADR-018) |
| 13 | Launch readiness | 🟡 Partial | CI workflow added; hosting target (ADR-011) and brand/domain (ADR-021) still to confirm |

## Verification (2026-09-25, after the audit pass)

| Gate | Result |
|------|--------|
| `pnpm typecheck` | ✅ clean |
| `pnpm lint` (0 warnings) | ✅ clean |
| `pnpm test` (unit) | ✅ 22 files, 229 tests |
| `pnpm test:db` (RLS + SQL on Postgres 17) | ✅ 74 tests; all 14 migrations apply from scratch; seed runs twice without duplicates |
| `pnpm build` | ✅ |
| Runtime vs real Supabase (`next start`) | ✅ store pages 0.4–0.7 s, marketing 0.02 s; order #1 placed, paid and confirmed; seller, staff and shopper sign-in verified |

Still not verified here: live Razorpay keys and webhooks, Resend email, Shiprocket, Cloudflare custom hostnames.

## Hostinger deploys: build auto-selects webpack; readiness check (2026-10-12)

- `pnpm run build` runs `scripts/build.mjs`, which uses webpack where Turbopack's native compiler can't load (glibc < 2.29, as on Hostinger). Tested in `tests/unit/build-script.test.ts`.
- `/api/health/ready` lists missing or invalid environment variables (names and reasons only) and whether Supabase is reachable. It returns 503 until both are fine, and does no DB access. Troubleshooting is in `docs/DEPLOY_HOSTINGER.md`.

## Store subdomains and custom domains on Hostinger (2026-10-12)

- `workers/domain-router/wrangler.toml` is configured for pictocart.in: it routes `*.pictocart.in`, `thepaliya.com` and `www.thepaliya.com` to the Worker, with origin `https://pictocart.in`.
- Setup steps are in `docs/DEPLOY_HOSTINGER.md` (Cloudflare free plan, `EDGE_SHARED_SECRET`).
- Verified on a production build: a signed host resolves to that store; a forged signature falls back to the platform.

## Plan requests and activation; product count (2026-10-13)

- **Seller → Settings → Plan & billing** (`/dashboard/settings/plan`): current plan, status, trial end, usage vs
  limits, plan cards (monthly/yearly with yearly saving), and **Upgrade / Activate / Downgrade** requests (owner only,
  `billing.manage`); pending request with cancel, request history. Trial and suspended banners link here.
- **Super admin → Plan requests** (`/admin/plan-requests`, also a callout on the admin overview): pending first,
  approve (switches the plan and makes the store active in one transaction, optional months paid + note) or decline.
- **Super admin → Store**: "Plan & subscription" card (plan, status, trial, pending request with approve/decline,
  history) and **Activate plan** (plan + active in one step, reason required) for trial/suspended stores.
- Migration 2900 (`supabase/dev/apply-2900.sql`): `plan_requests` (RLS read for members/platform, no direct writes),
  `request_plan`, `cancel_plan_request`, `platform_decide_plan_request` (SECURITY DEFINER, audited). Pages degrade
  with a notice until it is applied. Tests: `tests/rls/plan-requests.test.ts`, `tests/unit/billing/plans.test.ts`.
- Dashboard home: the "Active products" tile is now **Products** (whole catalogue, excluding archived) with
  "N live · M draft · View all", because counting only active products looked like products were missing.

## Payments, super-admin store control, Resend auth email, more industries (2026-10-11)

- **Online payments at checkout (fix).** `loadPaymentOptions` no longer gates every gateway on the Razorpay flag
  (`online_payments`), which hid Cashfree/PayU at checkout; each gateway is gated by its own flag in `activeIntegration`.
  The first successful "Save & test" of a payment gateway now switches it on (it used to stay off until a separate
  "Enable" click, so stores looked configured but checkout had no "Pay online"). Settings → Payments shows whether online
  payment is live and why not; checkout shows "secured by <gateway>". Go-live hints: Cashfree domain whitelisting, Razorpay
  website approval.
- **Dashboard → Payments** (`/dashboard/payments` + CSV export): every gateway attempt with status, method, gateway ids
  and order link; collected total, success rate, per-gateway totals and refunds for the filtered period.
- **Super admin → New store** (`/admin/tenants/new`): existing or new owner account (super admin), plan, trial/active, trial
  length, industry, store type, contact details, marketplace theme (draft or published), coming-soon or live, welcome email.
- **Super admin → store Team**: reset-password link (emailed + copyable), set password (super admin), **Log in as store**
  (super admin; reason, audit, dashboard banner, "End support sign-in"). ADR-033.
- **Auth email via Resend**: Supabase Send Email hook → `/api/auth/email-hook` (Standard Webhooks signature,
  `SEND_EMAIL_HOOK_SECRET`), branded per store/platform, token-hash links (platform `/auth/callback` now accepts them).
  Admin → Email shows the sending-domain status from Resend, hook state and the last 25 sends. ADR-034.
- **16 new industries** (eyewear, fragrances, home décor, kitchen, home textiles, toys, gifts, plants, pooja, tools, music,
  art, beverages, sweets, mobile accessories, ayurveda), five themes each (80 themes, `themes/extended.ts`, no demo stores
  yet: the marketplace shows the token mockup). Migration 2700 (`supabase/dev/apply-2700.sql`) seeds the categories.
- Tests: `tests/unit/payments/*`, `tests/unit/email/auth-hook.test.ts`, `tests/unit/platform/store-admin-schemas.test.ts`;
  theme marketplace tests cover the new industries (≥5 distinct layouts each).
- Verification: `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ (57 files, 708 tests) · `pnpm build` ✅ ·
  `pnpm test:db` ✅ (17 files, 134 tests; all migrations incl. 2700 apply from scratch).
- **To go live:** run `supabase/dev/apply-2700.sql`; set `SEND_EMAIL_HOOK_SECRET` and enable the hook in Supabase
  (Admin → Email has the exact URL); Resend key + verified domain in Admin → Email.
- Not verified here (no Supabase project or gateway accounts in this environment): live Razorpay/Cashfree payments, the
  Supabase hook call, Resend delivery, and the Admin API calls (createUser, generateLink, verifyOtp) used by
  create-store / reset / log-in-as.

## Images without Vercel Image Optimization (2026-10-11)

The Vercel Hobby team was paused for exceeding Image Optimization transformations.
- Store images use a custom `next/image` loader (`src/lib/images/loader.ts`): `/api/img?p=…&w=…`
  308-redirects (cached 1 year) to a pre-sized WebP copy in Supabase Storage,
  `{original}__w{480|960|1600}.webp`. Copies are made at upload (uploader's client, RLS) and,
  for older images, once on first request (secret-key client, ADR-006 addendum). Deleting an
  image deletes its copies. No Vercel Image Optimization is used anywhere.
- WebP only, srcset widths 96/384/640/1080/1920, 31-day optimizer cache (belt and braces).
- Marketing theme previews are screenshots (`pnpm themes:capture` / GitHub Action "Capture theme
  previews") or mockups; the live demo store loads only on "Live preview".

## Order printing, festive vibes, checkout gateway choice (2026-10-11)

- **Print center** `/print/orders?ids=…&docs=invoice,slip,label,thanks` (orders.read, RLS):
  tax invoice (A4, frozen invoice snapshot), packing slip with tick boxes (A5), shipping label
  4×6 in / 100×150 mm with COD/PREPAID, Code 128 barcode (AWB when booked, else order number),
  return address (thermal label printers), and a thank-you "welcome to the family" card (A6) with
  the items and the store's socials; message editable in Settings → Checkout. Each document prints
  on its own paper size (CSS named pages). Order page: Invoice / Shipping label / Packing slip /
  Print all. Orders list: tick orders and print labels, slips or everything at once.
  The old `/dashboard/orders/[id]/invoice` and `/packing-slip` links (which 404'd) redirect there.
- **Checkout**: with more than one live gateway, shoppers pick "Online payment · Razorpay" or
  "· Cashfree" at checkout; the pay page pre-selects and starts that gateway (`?via=`).
- **Festive vibes** (migration 2800, `stores.festive_settings`): Settings → Festive vibes schedules
  Navratri / Durga Puja / Diwali / Karva Chauth / Holi / Raksha Bandhan / Eid / Wedding season /
  Independence Day / Christmas / New Year / Sale looks with start/end dates (IST, inclusive):
  announcement bar, garland under the header, optional falling petals (reduced-motion aware).
  The theme itself isn't changed; previews show the plain theme.
- **Product editor**: "% off" column (sets price from MRP) and "Set % off MRP on all".
- **Admin → Stores**: compact list (store, type, status, plan, address, orders) that expands for
  owner, category, counts, revenue, dates and actions.
- **Trial banner** names the plan and days left; Admin → Change plan can also end the trial
  (status → active), which is why a store on the Scale plan still said "free trial".
- **Store details**: "Brand & sharing" checklist (logo, favicon, share image, social links).

## Move a domain between stores; owner closes a store (2026-10-03)

- **Migration 2600** (`supabase/dev/apply-2600.sql`, two SECURITY DEFINER functions, no data
  changed on apply).
- **Settings → Domains → Move to another store**: a seller who has `domains.manage` on both
  stores moves a connected custom domain (e.g. thepaliya.com) to their other store. Same hostname,
  so it stays verified and live on Vercel: no DNS change, no downtime. `tenant_id` stays frozen
  per row: the old row is retired (kept for history) and an identical row is created for the
  target in one transaction; a verified domain becomes the target's primary; audited in both
  stores; storefront + host directory caches are invalidated so the switch is immediate.
- **Settings → Store details → Close this store** (owner only): typed confirmation (store
  address), refused while a custom domain is attached; sets status `cancelled` (store offline,
  hidden from the switcher); nothing is deleted and support can reopen it from Admin → Stores.
- Tests: `tests/rls/move-domain-close-store.test.ts`.

## Fixes after go-live of 2500 (2026-10-03)

- `apply-2500.sql` failed on production because migration 2000 (social suite) was never applied
  there (`platform_app_credentials` missing), which rolled back the whole script, so the branding
  bucket didn't exist and logo uploads were refused. 2500 now creates `platform_app_credentials`
  if missing (same definition as 2000) and is safe to re-run. Tested on a database without it.
- Branding: social share image slot (1200×630, served by `/og` for every marketing page's
  og:image / X card); per-slot size checks; preview of the chosen file before upload; a live
  preview panel (browser tab, header with logo on the left, footer, link-share card); a setup
  warning when the bucket is missing, plus actionable upload errors. The uploaded favicon and
  header logo now also brand the admin console (top left) and the seller dashboard tab.
- Custom domains: `www.brand.com` and `brand.com` now serve the same store when either one is a
  verified custom domain (canonical URLs stay on the registered one; never for platform
  subdomains). A domain that points at the platform but isn't verified yet shows a "Connecting
  domain" page with next steps instead of a bare 404.

## Live theme previews, platform console options, checkout options (2026-10-03)

- **Real theme previews.** Marketing hero, category cards, theme cards and the theme detail page
  now show the theme live on its demo store (`?sf_theme=<key>`, applied in memory only), in lazy,
  scaled iframes rendered at true device sizes: desktop 1280×800 and phone 390×844 (the phone
  frame shows the store's real mobile layout). The token mockup is the fallback until the demo
  loads, or when a theme has no demo store. Store pages may now be framed by every exact platform
  origin (root, `www`, aliases) instead of only `NEXT_PUBLIC_PLATFORM_URL`, so previews also work
  on the apex `pictocart.in` (`platformFrameOrigins`, `src/lib/security/headers.ts`).
- **Migration 2500** (`20261003002500_platform_branding_checkout.sql`, `supabase/dev/apply-2500.sql`),
  additive only: anon may read `platform_settings` keys under `public.`; public `platform-branding`
  storage bucket (writes need `platform.settings.manage`, no SVG); `resend` allowed in
  `platform_app_credentials`; `stores.checkout_settings jsonb default '{}'`. Code fails open to
  today's behaviour until it is applied.
- **Admin → Branding & analytics** (`/admin/branding`): header logo, footer logo and favicon for
  the marketing site, seller sign-in and onboarding (falls back to the text wordmark); GA4
  measurement ID → gtag.js on marketing pages only, skipped for GPC / Do Not Track visitors,
  with page views on client navigation and `data-analytics` CTA clicks as events.
- **Admin → Sign-in & checkout** (`/admin/sign-in`): Google provider status (from Supabase Auth),
  the exact redirect URLs to register, and switches for Google sign-in for sellers and for store
  customers (enforced in the server actions too) and for location autofill.
- **Admin → Email (Resend)** (`/admin/email`): API key (AES-GCM encrypted, write-only) and From
  address; DB values override `RESEND_API_KEY` / `EMAIL_FROM`; "send a test email to me".
- **Stores: Dashboard → Settings → Checkout**: guest checkout on/off (when off, checkout redirects
  to sign-in and `placeOrder` refuses guests) and "Use my current location" on/off. Checkout shows
  "Check out faster with Google" to signed-out shoppers when Google sign-in is available.
- **Location autofill**: browser geolocation (Permissions-Policy now `geolocation=(self)`) →
  `/api/geo/reverse` → OpenStreetMap Nominatim (rate limited per IP and globally to ~1 req/s,
  identified User-Agent, attribution shown). Fills area, city, state, PIN; never the house line;
  coordinates rounded and not stored. India only. For high volume, switch to a commercial
  geocoder (single function in `src/app/api/geo/reverse/route.ts`).
- Tests: `tests/unit/platform-config/public-config.test.ts`, `tests/rls/platform-branding.test.ts`.
- Not verified here (no outbound network): real Nominatim responses, Resend delivery, GA4 hits.

## Theme marketplace direct apply (2026-10-01)

- Sellers with both `theme.edit` and `theme.publish` can now choose **Apply to store** from
  the marketplace. It builds the normal content-safe draft and publishes it immediately.
- **Save as draft** remains available for the existing review-and-customise workflow; the prior
  published version remains in history for rollback.
- Marketplace cards now show the actual, lazy-loaded demo storefront with the selected theme
  applied in memory. The token mockup remains only as a fallback for unseeded demo stores.
- Verification: `pnpm typecheck` ✅ · focused marketplace lint ✅ · `pnpm test` ✅ (32 files,
  368 tests) · `pnpm build` ✅.
  A final `pnpm check` is currently blocked by an unrelated, newly edited showcase-data lint
  error: unused `tile` in `scripts/dev/showcase/data/griha-smart.ts`.

### Pending on the cloud database (run in the Supabase SQL Editor)

1. `supabase/dev/cleanup-duplicate-seed.sql`: removes rows duplicated when the old seed ran twice (dev data only).
2. `supabase/migrations/20260925001100_admin_tenant_stats.sql`: admin tenant table stats. Until it's applied, the owner/orders/GMV columns stay hidden.

### Audit pass: changes

- **Auth:** `/seller/login|register|forgot-password` (old URLs 308-redirect), `/admin/login` (Pictocart brand shell + staff copy), role-based post-login landing, shopper forgot/reset password, store callback accepts token-hash links.
- **Storefront:** SVG icons, search overlay + `/search/suggest`, cart drawer with free-shipping progress, drawer mobile nav, header scroll state, carousel/hero layout fix, hero mobile image, PDP rating under title + SKU.
- **Dashboard:** real home overview (`features/analytics/home.ts`), shared zero-filled `RevenueChart`, full-width theme editor with a true-width scaled preview.
- **Admin:** post-login `.theme-panel` (Pictocart orange); sign-in uses `.theme-brand`; tenant table owner/products/orders/GMV (`platform_tenant_list_stats`).
- **Platform:** Server Action / proxy body limit 25 MB (uploads over 1 MB failed before).
- **Data:** seed fixed (GoTrue token columns, idempotent inserts); `scripts/dev/demo-media/run.mts` generates original demo imagery and publishes the demo theme.
- **Tests:** `zeroFillDays`; admin stats RPC; shopper↔shopper and shopper→seller/platform isolation.

## Pictocart marketing site + seller onboarding (2026-10-03)

- Brand: platform name is now "Pictocart". `.theme-brand` tokens in `globals.css` (provisional palette; the logo file wasn't available; see `docs/BRAND.md`). `BrandLogo` renders a text wordmark until `PLATFORM_LOGO` is set.
- Marketing (`src/app/(marketing)`): new home, `/features`, `/pricing` (plan cards, monthly/yearly toggle, comparison table from plan limits/features), `/themes` (search, category filter, pagination, loading/error/empty states), `/themes/[key]` (detail + live demo preview), `/themes/[key]/use` (signup / onboarding / dashboard handoff), `/how-it-works`. Accessible header with mobile menu, footer, platform `sitemap.xml` + `robots.txt`.
- Theme previews: token-driven `ThemeMockup` (new `phone` size) per theme; "Preview Theme" opens the theme on its demo store (`?sf_theme`, in-memory, showcase tenants only).
- Sign-up carries `?plan` / `?theme` through registration, Google sign-in and email confirmation (user metadata `requested_plan` / `requested_theme`). New accounts always go through onboarding (the auto-create-from-name path was removed).
- Onboarding (`/onboarding`): Account → Business (name, category, address; server-validated slug, duplicate-safe retry) → Theme (applied as a draft via `theme/server/apply-marketplace.ts`, now server-only) → Plan (preference only: saved to the account and audited as `tenant.plan_requested`; no entitlement change, no checkout exists) → Ready checklist + preview. Resumes an owned draft store; existing sellers get a choice instead of a duplicate store.
- Draft stores: migration 2400 (`stores.launch_status`, default `live` so every existing store is unchanged). Onboarding creates `draft` stores; storefront shows "coming soon" (noindex, robots `Disallow`, no sitemap) unless the owner's signed preview cookie is present. Dashboard home shows Preview / Publish (`settings.write`). All reads fail open to `live`.
- Tests: `tests/unit/marketing-site`, `tests/unit/onboarding/*` (steps, launch, actions incl. forged store ids and duplicate submits), `tests/rls/store-launch.test.ts`.
- To apply: run `supabase/dev/apply-2400.sql`. Not built: online plan billing (no payment integration for subscriptions exists).

## Domains settings page resilience (2026-10-03)

- `/dashboard/settings/domains` crashed ("This page couldn't load") in production. The page now degrades instead: `listTenantDomains` falls back to the pre-migration-21 columns when the database lacks `provider`/`provider_status`/`dns_records`/`redirect_hostname` (logs `domains.schema_outdated`; fix by applying `supabase/dev/apply-2100.sql`), `domainSettings()` reads only the variables it needs instead of the whole server env, a failed plan lookup hides only the add form (`domains.allowance_failed`), and any other failure shows an inline message (`domains.page_failed`).
- Tests: `tests/unit/domains/domains-page-resilience.test.ts`.

## Root domain switch to pictocart.in (2026-10-03)

- Production returned a plain 500 on every host: `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` was not a bare hostname, so `publicEnv()` threw `EnvValidationError` in the proxy. The schema now reduces a pasted URL (`https://www.example.in/`) to the bare root; ports and non-hostnames are still rejected.
- `supabase/dev/move-platform-root.sql`: idempotent ops script adding `{slug}.{new root}` platform-subdomain rows (and moving the primary off old platform subdomains; custom primaries untouched). Tested on the local test DB.
- Tests: env normalisation, proxy routing for `www.pictocart.in` / `{slug}.pictocart.in`.

## Platform host aliases / Vercel 404 fix (2026-10-03)

- Bug: on `saas-ecom-puce.vercel.app`, `/` returned the 404 page. `classifyHost` only knew `{root}`/`www.{root}`, so the Vercel host was a `custom-domain`, the proxy rewrote it to `/store/[host]`, the `domains` lookup found no row and the layout called `notFound()`.
- `src/lib/platform/hosts.ts` `platformHostAliases()`: exact extra platform hosts from `NEXT_PUBLIC_PLATFORM_URL`'s host, `PLATFORM_HOST_ALIASES` (validated in `env/schema.ts`), and `VERCEL_URL`/`VERCEL_BRANCH_URL`/`VERCEL_PROJECT_PRODUCTION_URL` (`*.vercel.app` only). `classifyHost`/`decideRoute`/`checkCustomDomain` take the list; aliases can't be added as custom domains.
- `tenant/directory.ts`: a failed lookup throws `TenantDirectoryError` (5xx, logged with PostgREST code) instead of looking like an unknown host.
- `.env.example` uses placeholders and lists `APP_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_PLATFORM_URL`, `PLATFORM_HOST_ALIASES`. `docs/DEPLOY_VERCEL.md` covers `*.vercel.app` setup and the Hobby cron trade-off (crons currently daily).
- Tests: `tests/unit/platform-hosts.test.ts`, `proxy-platform-host.test.ts` (real proxy), `tenant-directory.test.ts`, routing/env additions.

## Custom domains on Vercel + go-live guide (2026-10-03)

- `src/lib/vercel/domains.ts`: Vercel REST client (add / get / verify / remove project domain, domain config). Config comes from `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` in env (not yet in `env/schema.ts` or Admin → Social apps).
- Domains flow: when Vercel is configured, adding a domain registers it on the project, plus the apex/www companion as a 308 redirect. The settings page shows the exact records from the API (ownership TXT, A/CNAME, Vercel TXT). "Check now" and the cron map the API state to `provider_status` (`pending_dns | verifying | misconfigured | active | error`). A domain is `verified` (routable) only when our TXT matches and Vercel says verified. SSL is active only when Vercel reports `misconfigured: false`. Remove deletes it from Vercel with `removeRedirects`. The Cloudflare path is unchanged.
- Migration 21 (`20261003002100_domains_vercel.sql`, `supabase/dev/apply-2100.sql`): `domains.provider`, `provider_status`, `dns_records`, `redirect_hostname`. The insert policy now refuses seller-set edge fields.
- `vercel.json` crons and `docs/DEPLOY_VERCEL.md` (environment variables, wildcard subdomains, Supabase, crons, The Paliya and Ramya steps).
- Tests: `tests/unit/vercel-domains.test.ts` (mocked fetch, status mapping), `tests/rls/domains-vercel.test.ts`.

## Go-live suite (2026-10-03)

- Ramya design v2: centred-nav header with mega menu, auto-scrolling tilt carousel, Krishna/Radha decor (original SVG motifs + CC0 Met paintings), blue #0a3f79 palette, mobile bottom nav, refined finish (all opt-in settings; `docs/DESIGN_RAMYA.md`).
- Custom domains on Vercel (Domains API, DNS records, SSL status, cron) and `vercel.json` crons (`docs/DEPLOY_VERCEL.md`).
- All transactional email through Resend with branded templates, `email_log`, per-store toggles, event dispatcher (`docs/EMAIL.md`).
- WhatsApp Business order notifications (approved templates, checkout opt-in, queue + retries, STOP/START) (`docs/WHATSAPP_NOTIFICATIONS.md`).
- Migrations to apply in order: 1900, 2000, 2100, 2200, 2300 (`supabase/dev/apply-*.sql`).

## Ramya store, Sutra Atelier theme, speed and loader (2026-10-02)

- New live store **Ramya By Ayushi Paliya** (`ramya-by-ayushi-paliya`, tenant `c89edac3-…`), owned by admin@paliya.test, catalogue copied read-only from The Paliya (`scripts/dev/clone-store/run.mts`; reviews, orders, customers not copied).
- **Sutra Atelier** preset (`sutra-atelier`) and new opt-in sections and options: ProductSpotlight, CompactProducts, FeatureBand, arch tiles, tilted carousel, overlay edits, greyscale reel strip, full-bleed and journal banners, hero counter, condensed display font. Published on Ramya via `scripts/dev/ramya/apply-theme.mts`.
- Speed: cached tenant, theme and profile reads (TTFB ~0.5 s → ~0.3 s), Inter no longer preloaded on storefronts (fonts 183 → 84 KB), 948 KB logo PNG now optimised, PDP images 1 MB → 124 KB.
- Loader for every store: per-page skeletons (`loading.tsx`) plus a top progress bar in the theme accent.

## Multi-industry theme ecosystem (2026-09-30)

| Area | Status | Notes |
|---|---|---|
| Audit | ✅ | `docs/THEME_ECOSYSTEM_AUDIT.md` (stores classified; The Paliya fingerprinted before any change) |
| Store categories / store type | ✅ | Migration 1800 applied in the cloud. Showcase stores are `demo` with their industry; aangan/rangrez `test`; The Paliya and the unknown store stay `real` |
| Industry + style theme catalogue | ✅ | 103 themes: 5+ for every industry (fashion 12); handicrafts 1 |
| All 20 industries | ✅ | Phases 5–6 added books, pets, automotive, smart home, bags, watches, organic, gourmet, general |
| Content slots | ✅ | Slot-aware `applyThemePreset`; unused slots kept hidden |
| New section | ✅ | `BrandStrip` (wordmarks/logos, row or marquee) |
| Live Preview | ✅ | `?sf_theme=` on showcase stores only, in memory, noindex; desktop/mobile dialog in the dashboard |
| Marketplace UI | ✅ | Industry chips, style filter, search, sort, badges |
| Product specifications | ✅ | `attributes.specs` (label/value) in the editor, payload and PDP; "Type: Other" hidden |
| Showcase demo stores | ✅ | kaya-studio, voltnest, dewbloom, kasa-living, harvest-basket, suvarna, kadam, aarogya, khel-studio, nanhe, pustak-ghar, pawdesh, gearbay, griha-smart, safarnama, ghadi-co, bhoomi-organics, crumb-and-co, sabkuch (20–25 products each): real open-licence photos checked by eye, credits page, no seeded reviews |
| Super admin | ✅ | Store type badge, category, type/category filters (hidden until migration 1800 is applied) |

Protection of The Paliya: a data fingerprint over 30 tenant tables (`scripts/dev/protect/snapshot-tenant.mts`)
plus full-page desktop/mobile screenshots (`scripts/dev/protect/visual-baseline.mts`), compared
before and after this work: data identical in all tables, and 11/12 pages pixel-identical (the
12th differs only in image-decode noise inside one product photo).

Verification: `pnpm check` passes (typecheck, lint, 388 unit tests, build); DB tests 93/93 (local).
Since migration 1800, compare snapshots with `SNAPSHOT_IGNORE_COLUMNS=tenants.store_type,stores.category_id`
(the new columns keep their defaults for The Paliya: `real`, `null`).

## Phase 3 (2026-09-26): platform control and growth tools

| Gate | Result |
|------|--------|
| `tsc --noEmit` / `pnpm lint` (0 warnings) | ✅ clean |
| `pnpm test` (unit) | ✅ 30 files, 274 tests |
| `pnpm test:db` (Postgres 17) | ✅ 8 files, 92 tests; 18 migrations apply from scratch; `apply-phase3.sql` applies on a phase-2 database with seed data |
| `pnpm build` | ✅ |
| Runtime against the cloud project | ⏳ blocked until `supabase/dev/apply-phase3.sql` is applied (phase-3 tables return 404 today) |

| Area | Status | Doc |
|---|---|---|
| Super admin bootstrap (env), `/admin/stores`, store configuration, integrations overview | ✅ | SUPER_ADMIN.md, SUPER_ADMIN_SETUP.md |
| Theme marketplace (10 themes, apply-to-draft) | ✅ | THEME_MARKETPLACE.md |
| Payments: Razorpay, Cashfree, PayU + COD; unified encrypted integrations | 🟡 live gateways unverified | PAYMENT_INTEGRATIONS.md |
| Shipping: Shiprocket + Delhivery, track/label/pickup/cancel | 🟡 live couriers unverified | SHIPPING_INTEGRATIONS.md |
| SEO settings, verification, canonical/noindex, WebSite JSON-LD | ✅ | SEO_SYSTEM.md |
| GA4 / Google Ads / Meta Pixel, e-commerce events, attribution | ✅ (refund event not sent) | ANALYTICS_SYSTEM.md |
| Social hub (Meta, Pinterest, YouTube connect), scheduler | 🟡 needs OAuth apps | SOCIAL_MEDIA.md |
| Social planner backend (calendar, planned manual channels, campaigns, hashtag sets, key dates, product-to-post) | ✅ backend + RLS/unit tests | SOCIAL_MEDIA.md |
| Creative studio (9 templates, PNG to media library) | ✅ | CREATIVE_STUDIO.md |
| thepaliya.com import; Jaipur Boutique theme (marquee, shoppable videos, drawer menu, size chips, page-content marker) | ✅ | THEPALIYA_IMPORT.md, THEME_MARKETPLACE.md |
| Settings centre + Security & activity | ✅ | SECURITY.md, RBAC.md |

### Pending on the cloud database

1. `supabase/dev/apply-phase3.sql` (migrations 1500 + 1600, one transaction).
2. Cron: `/api/cron/social-publish` every 5 min and `/api/cron/gbp-reviews` every 6 h (Bearer `CRON_SECRET`), alongside `expire-orders` and `domains`.

## Phase 2 (2026-09-26): premium UI, RBAC, media, multi-store

| Area | Status | Doc |
|---|---|---|
| Design system, light/dark (light default), lucide icons | ✅ built | DESIGN_SYSTEM.md |
| App shell (seller + console): collapsible sidebar, breadcrumbs, ⌘K, notifications, account menu | ✅ built, ⏳ visual QA | UI_UX_REDESIGN_AUDIT.md |
| Auth redesign: staff, merchant login/register/forgot, customer login/register/forgot | ✅ built + screenshotted | UI_UX_REDESIGN_AUDIT.md |
| Super admin dashboard (8 KPIs, GMV trend, plans, activity) | ✅ built, ⏳ needs migration 1400 | UI_UX_REDESIGN_AUDIT.md |
| RBAC: 27 permissions, 3 system roles (12 until 2026-10-27), custom roles, escalation guards, Team + Roles UI | ✅ built, 8 DB tests, ⏳ needs migration 1200 | RBAC_AUDIT.md |
| Media library + picker (drag & drop, progress, cancel/retry, replace, usage, alt text) | ✅ built, 3 DB + 4 unit tests, ⏳ needs migration 1300 | MEDIA_LIBRARY_AUDIT.md |
| 10 unique demo stores (data, art, themes, owners) | ✅ generator written, ⏳ not yet run on the cloud DB | MULTI_STORE_AUDIT.md |
| Customer account overview | ✅ built + screenshotted | |

**To finish phase 2 on the cloud project:** run `supabase/dev/apply-phase2.sql` in the SQL Editor (migrations 1200–1400 in one transaction), then
`pnpm exec tsx --env-file=.env --env-file=.env.local scripts/dev/demo-stores/run.mts` to create the 10 stores.

Verification (2026-09-26): `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm test` ✅ 24 files / 238 tests · DB tests ✅ 85 (Postgres 17) · `pnpm build` ✅.

## What's in each area

### Storefront (`src/app/store/[host]/**`, `src/features/storefront`, `src/features/theme/render`)
Host-resolved tenant (verified `domains` row or signed edge header), theme tokens + section registry, header/footer/mega menu,
collection/category/search listings with filters and sort, PDP (gallery, zoom, size guide, variants, PIN check, reviews, recently viewed),
cart, checkout, pay (Razorpay/test), order confirmation + printable invoice, account (orders, addresses, wishlist), CMS pages, blog, FAQ,
contact, store locator, per-store sitemap/robots, redirects, suspended/preview states, event tracking.

### Seller dashboard (`src/app/dashboard/**`)
Products (editor, bulk, import/export), collections, categories, size charts, inventory, orders (fulfilment, cancel, refunds, invoices),
returns, customers (+export), discounts, reviews moderation, content (pages, blog, menus, FAQs, locations, redirects), analytics,
theme editor, domains, settings (store, shipping, PIN rules, COD, payments, taxes, notifications, team).

### Super admin (`src/app/admin/**`, `src/features/platform`)
Overview (stores, GMV, signups, trials ending, pending domains), tenants list/search/filter, tenant detail (status with reason + confirmation,
plan change, trial extension, usage vs plan limits, storage, domains + re-check, team, feature-flag overrides with effective source,
audit trail), create store for a user, plans CRUD (prices, limits, features), feature flags, platform users (roles/disable/remove),
platform-wide audit log with filters, platform settings, usage & storage, custom-domain overview, integration presence (booleans only),
**support sessions**: time-boxed, reason-required, audited, read-only view of a store's orders/products via RLS viewer grants.

### Marketing site (`src/app/(marketing)/**`, `src/features/marketing-site`)
Landing page (hero, demo-store preview with theme look switcher + device toggle, problem→solution, themes, builder, features, fashion
features, illustrative metrics, how it works, pricing with monthly/yearly toggle from live `plans`, FAQ, CTA), `/pricing`, `/features`,
`/privacy`, `/terms`, OG image route, JSON-LD (Organization, SoftwareApplication, FAQPage).

### Edge (`workers/domain-router`)
Cloudflare for SaaS Worker: strips client `x-paliya-*` headers, signs the customer host (HMAC-SHA256, 5-min window), proxies to the origin,
rewrites origin-host redirects, strips `x-middleware-rewrite`. Cross-tested against the app verifier.

## Security checklist

- Tenant never taken from the browser: storefront = verified host; dashboard = membership; admin = platform membership + permission.
- RLS on every table; composite `(tenant_id, id)` FKs; guard triggers block privileged column edits from `authenticated`.
- Service-role client limited to `lib/supabase/admin.ts` uses listed in ADR-006; `server-only` enforced.
- All inputs zod-validated (`parseInput`); PostgREST search terms sanitised; no raw SQL from input.
- Redirects via `safeRedirect`; storefront `[...rest]` uses stored redirects only.
- Webhooks: Razorpay HMAC verified; cron endpoints require `CRON_SECRET`.
- Uploads: MIME sniff + size limits per bucket; private bucket for invoices.
- Prices snapshotted into `order_items`; stock reserved atomically in `place_order`.
- Audit log for tenant admin actions, platform actions and support sessions.
- Framing: storefronts `frame-ancestors 'self' <platform origin>`; everything else `frame-ancestors 'self'` + `X-Frame-Options`.
- Rate limits (Postgres-backed) on login/OTP, signup, cart, checkout, account actions, storefront forms, invites, exports, support sessions and domain verification.
- Logs redact secrets/PII; admin integration page reports env presence only.

## Open risks / follow-ups

1. **Decisions needed:** ADR-011 hosting (Vercel vs Cloudflare/OpenNext), ADR-021 real brand + root domain.
2. Full CSP with nonces (script-src) not yet enabled — needs Razorpay checkout script allowance (ADR-018).
3. Storefront renders dynamically; Cache Components adoption deferred (ADR-010) — add CDN caching once hosting is chosen.
4. Suspended stores return 200 with an "unavailable" page (App Router layouts can't set 503).
5. Email/Shiprocket/Cloudflare adapters are implemented against their APIs but untested against live accounts.
6. Subscription billing for plans (charging sellers) is out of scope; plans are assigned by admins/onboarding.
7. No media library UI yet (`media_assets` + upload pipeline exist); theme image fields take uploads directly.
8. Unknown product/collection slugs render not-found with `noindex` but HTTP 200 (store `loading.tsx` streams first).
9. Browser end-to-end tests (Playwright) not yet written; flows were verified manually.
10. Responsive screenshot sweep across 320–1920 px not completed.

## Running locally

```
cp .env.example .env.local        # fill Supabase + APP_SECRET
pnpm install
pnpm dev                          # platform: http://localhost:3000, stores: http://{slug}.localhost:3000
pnpm exec tsx --env-file=.env --env-file=.env.local scripts/dev/demo-media/run.mts   # dev only: demo imagery for the seed stores
pnpm check                        # typecheck → lint → unit tests → build
pnpm test:db                      # local Postgres 16 + Supabase shim; applies migrations + seed, runs RLS tests
pnpm db:types                     # regenerate src/lib/supabase/database.types.ts from migrations
```

## WhatsApp order notifications (2026-10-03, go-live role D)

- Template-only WhatsApp Cloud API messages for order placed / shipped / out for delivery / delivered / abandoned cart, gated on connection + per-event mapping + checkout opt-in + valid E.164 phone. Registered as a channel of the shared dispatcher (`src/features/notifications/events.ts`).
- Migration 23 (`customer_whatsapp_optins`, `whatsapp_notification_settings`, `notification_jobs` + claim functions), queue with retries/backoff, cron `/api/cron/notifications`, status/STOP webhook handler, Settings → Notifications page (template picker from the WABA, test send, recent messages). See `docs/WHATSAPP_NOTIFICATIONS.md`.
- Pending integration: checkout opt-in checkbox + recording, and one webhook line in the inbox handler (see that doc). Out-for-delivery has no producer yet.

## Go-live C: Email via Resend (2026-10-02)
- `src/lib/email/` holds the Resend REST client with Idempotency-Key, `sendEmail` and the `email_log` writer. Recipients are stored hashed and masked, never bodies. With no key set, the status is `logged` (not sent).
- `src/features/notifications/events.ts` is the shared dispatcher (`emit`, `dispatch`, `registerChannel`), running after the response via `after()`. The email channel lives in `notifications/email/channel.ts`.
- Branded HTML and text templates cover: order confirmation (with COD amount due), owner new-order alert, payment failed, shipped, out for delivery, delivered, cancelled, refund, return update, abandoned cart (opt-in), team invite, and contact-form forward.
- Migration 22 (`20261003002200_email_log.sql`) adds `email_log` and `email_preferences`, with toggles in Settings → Notifications. The old `notifications/send.ts` has been removed.
- See `docs/EMAIL.md` for setup (Resend domain DNS, Supabase SMTP) and what's still missing.


## Pictocart rebrand and landing page CMS (branch `pictocart`)

- Platform renamed to **Pictocart** (`src/config/platform.ts`), domain examples `pictocart.in`, DNS
  ownership record `_pictocart-verify`. Logo, favicon and palette applied (docs/BRAND.md).
- Home page rebuilt to the earlier pictocart.in layout: hero with rotating words and stats, trust
  strip, "what / where to sell" grid, 5 steps with built-in illustrations, FAQ, features, themes
  (live catalogue), categories, pricing (Plans console), testimonials, final CTA, footer with
  socials and a floating WhatsApp button.
- **Landing page CMS** (`/admin/landing`, permission `platform.settings.manage`): every section's
  text and lists, section order and visibility, header menu, footer, socials, WhatsApp number
  and SEO. Stored as one JSON document in `platform_settings` key `public.marketing.landing`
  (anon-readable via the existing `public.%` policy; no migration needed). Parsing falls back to
  defaults per section (`src/features/marketing-site/landing.ts`, unit tested); saves are validated
  server-side, rate limited, audited and revalidate the site immediately.
- Testimonials ship empty and hidden: add only real merchant quotes.

## Theme layout variants, per-category layouts, Unsplash theme imagery (2026-10-16)

- Every core section has several layouts as editable settings (hero ×7, product grid ×6, category tiles ×5,
  story ×5, testimonials ×5, newsletter ×5, USP band ×5, header styles ×6, footer layouts ×4, per-section
  spacing and product image shape). Defaults reproduce the old look, so saved themes render unchanged.
  Details and the variant API: `docs/THEME_MARKETPLACE.md` → "Layout variants".
- Each category has a layout personality (`src/features/theme/layouts/personalities.ts`); all marketplace
  themes get their variants, header style and footer layout from it by position, so themes look different
  across and within categories. `signatureComposition(industry)` gives a new store's default home page.
- Theme editor: variant fields are a grid of layout cards with diagrams; Design has "Stock photos".
- Empty image slots use curated / API Unsplash photos for the store's category, with credits
  (`src/lib/unsplash-stock.ts`, `getStockSet`, `themeUnsplashImages`, `getThemeUnsplashImages`). Product
  placeholders only on demo stores and Live Preview.
- Marketplace mockups draw each theme's real layout with category photos.
- No migration. Tests: `tests/unit/theme-layouts.test.ts`.
- Verified: `pnpm check` green (66 files / 784 tests, build OK). Visual check at 1280px and 375px of furniture,
  bakery, jewellery, electronics, books, beauty and pets themes, using a temporary page that renders the real section
  components with sample data (the local dev database has no showcase stores). Not yet checked on real showcase stores.

## Home themes section + Unsplash category photos (2026-10-16)

- Theme cards (`theme-card.tsx`): fixed 4:3 preview stage with the phone sized from the stage
  height and pinned inside it, so it no longer overhangs the card; equal preview heights, clamped
  tagline, full-width stacked buttons, hover lift / photo zoom (reduced-motion aware).
- Card preview priority: captured screenshot → category photo → token mockup. `src/lib/unsplash.ts`
  (`getCategoryImage` / `getCategoryImages`, reusable by other sections) searches Unsplash with
  `UNSPLASH_ACCESS_KEY` (fetch-cached 1 day) and falls back to a curated `images.unsplash.com` photo
  per category; cards show the required "Photo: X / Unsplash" credit. Unit tested (fallbacks).

## Marketing header mega menu and footer (CMS-driven)

- **Mega menu**: the header nav item named in `header.megaMenu.trigger` (default "Features") opens
  a six-column panel (Sell, Source, Design, Channels, Operate, Grow) with tinted icon chips per
  column, a bottom bar and a theme marketplace link. Small client component
  (`components/mega-menu.tsx`); the rest of the header stays server-rendered. Opens on hover,
  focus or click; Escape, tabbing out, outside click or navigation close it; `aria-expanded` on
  the trigger. Three columns with a scrollable, height-capped panel at `lg`, six from `xl`. Phones
  get an accordion of the same columns inside the mobile nav sheet. Menu links use `<Link prefetch>`.
- **Footer** (`components/site-footer.tsx`): dark navy, CMS link columns with an optional
  highlighted link (default "Investors"), divider, logo / copyright / share + social icons in
  brand colours (Instagram, X, Facebook, YouTube, LinkedIn, WhatsApp, Pinterest, Telegram, Threads;
  empty URL = hidden). **Share** popover (`components/share-button.tsx`) for the current page on
  WhatsApp, Facebook, X, LinkedIn, Telegram, Pinterest, Email and copy link, plus the device
  share sheet (Web Share API) where available. Floating WhatsApp button kept.
- **CMS**: `header.megaMenu`, `footer.groups[].links[].highlight`, the extra social keys and
  `footer.share` were added with zod `.default()`s, so documents saved before them still parse and
  keep their nav and links (unit tested in `tests/unit/marketing-site/landing.test.ts`). Option
  lists and defaults live in `src/features/marketing-site/chrome-content.ts`. Editing UI in
  `/admin/landing` → Header & menu (mega menu columns/items, icon, colour) and Footer (highlight
  flag, all socials, share toggle/message/networks).
- Fixed: the mobile nav sheet was only a few pixels tall because the header's `backdrop-blur`
  makes it the containing block for the sheet's `position: fixed`.
- Not yet: the default footer links "Contact", "Support", "Refund Policy" and "Investors" point at
  existing pages (no dedicated pages exist); set real URLs in the CMS. Social URLs ship empty.

- **Home page redesign: hero, trust strip, categories, feature grid** (2026-10-16). Hero: CSS
  `@starting-style` entrance and a browser-frame slideshow (`hero-slideshow.tsx`; cross-fade, dots
  with a progress bar, pause on hover/focus/off-screen/hidden tab, pause button, no autoplay under
  reduced motion). CMS `hero.slides` (image, alt, caption), `slideInterval` (2–20 s) and `autoplay`;
  with no slides it falls back to `imageUrl`, then to rotating showcase-theme previews. Trust
  chips are `{label, icon, color}` (plain-string chips from older saves get an icon and colour from
  their name; under reduced motion the marquee becomes wrapped rows). Categories are `items`
  `{label, icon, color, href, imageUrl}` shown as gradient icon tiles (older `chips` are converted).
  "What & where to sell" cards get colour-coded icon chips per tag (`color` "auto" or a fixed
  palette colour), a gradient hover border and a staggered scroll reveal (`reveal.tsx`, an
  IntersectionObserver island). Palette: `ACCENT_COLORS` in `landing.ts` with classes in
  `landing-icons.tsx`; 24 icons added. Editor: icon picker grid, colour swatches, slides list.
  All new fields have zod defaults; back-compat is covered in `tests/unit/marketing-site/landing.test.ts`.

## Panel theme and navigation speed: seller dashboard + super admin (2026-10-16)

- **Theme.** Both panels render inside `.theme-panel` (added by `AppShell`): Pictocart orange on warm-neutral surfaces, soft tinted surfaces (`tint-peach|lavender|mint|sky|rose`, each with `-border` and `-ink`), semantic colours, light and dark. AA contrast: white on `--primary` (#cc4a0c) 4.6:1, `--accent` on `--accent-soft` 4.8:1, `--subtle` on the canvas 5.1:1; dark mode 6.8:1 / 7.5:1. Vivid `accent-strong` (#f97316) only for non-text marks. Staff and seller **sign-in** share `.theme-brand`; the admin topbar shows an "Admin mode" marker instead of a separate console palette.
- **Type.** In panels the scale is one step larger (body 15/24, small 14/22, h1 26/34 …) via `--text-*-size` variables, and display/h1–h3 use Manrope 700 (`--font-heading`). Inter stays the UI font.
- **Logo.** `PanelLogo` / `PanelMark` (`components/app-shell/panel-logo.tsx`) show the Pictocart logo (uploaded header logo first) linking to the panel home, on a white chip in dark mode; the square mark in the collapsed rail and the mobile topbar.
- **Shell.** Seller nav regrouped as Dashboard · Catalog · Sales · Marketing · Storefront · Analytics · Settings. Multi-item groups are collapsible submenus (grid-rows animation, no measuring, `inert` when closed; the active group opens by default, choices saved per browser). Exactly one item is active (longest matching href). Breadcrumbs moved from the topbar into the content area; the topbar has the wide search, a light/dark toggle, notifications and account. Primitives: `StatCard` gained optional `tone` + `icon`, `Badge` a `brand` tone, `AppearanceQuickToggle`; cards/buttons are rounder.
- **Speed.** 25 new `loading.tsx` boundaries (14 → 39) using shared skeletons (`components/app-shell/skeletons.tsx`), so every sidebar destination shows its fallback on click and is prefetched up to it. Clicking a nav item highlights it before the route commits (preview, dev mode: ~0.2 s to highlight vs ~1.2 s to commit, where it used to appear). Submenu links are prefetched on hover/focus of the group, and a `useLinkStatus` dot shows a pending navigation. Notification links in topbar popovers are now `next/link` (they did full page reloads). `getPlatformOverview` is `React.cache`d (the console layout and overview page ran the `platform_overview` RPC twice per load: now once); the dashboard layout reads cookies in parallel with alerts/trial info; the console layout no longer loads branding itself.
- **Not verified here:** signed-in dashboard/admin pages (sign-in was not available to the session); visual QA used the real `AppShell` and primitives with mock data at 375 px and 1440 px, light and dark.

## Theme previews on the marketing site + Unsplash in the media library (2026-10-16)

- **Home themes section:** two rows of four by default, one theme per industry (fashion, gourmet, jewellery, beauty,
  furniture, electronics, handicrafts, general; then grocery, footwear, kids, watches up to the max of 12), 4/2/1 columns.
  CMS field `themes.limit` (2–12, default 8). Back-compat: documents saved with the old `themes.count` still validate; a
  stored `count` of 4 (the old default) now means the new default, any other value is kept (`themesShown`).
- **Preview Theme** (home cards, `/themes`, `/themes/[key]`) → `/themes/[key]/preview` (noindex): the live demo store in a
  Desktop/Phone frame when any showcase demo store is up (theme's own demo first, then its industry's, then any:
  `previewDemoCandidates`), otherwise a server-rendered sample store from the theme preset with Unsplash photos.
  Root cause of "no real preview": the showcase demo stores were never built on the connected project or on pictocart.in,
  so no live URL and no screenshots existed. `/themes` cards now show the category photo too.
- **Capture script** (`scripts/themes/capture-previews.mts`): uses the same demo fallback, works against a local dev
  server (`--root localhost --port 3000`); not run here because no demo store is up. How to regenerate:
  docs/THEME_MARKETPLACE.md → "Marketing site previews".
- **Media library Unsplash tab** (dashboard Media page, media picker, new super-admin `/admin/media`): theme/category
  photos + Unsplash search, attribution, import-on-insert with the download endpoint triggered (ADR-035, MEDIA_LIBRARY_AUDIT.md).
- **Not verified here:** the signed-in Media pages and picker (seed accounts exist only for a local Supabase; this
  worktree uses the cloud project), and a real live preview / screenshot capture (no demo store is up). Checked in the dev
  server: home grid (8 cards, 4 columns, photos, preview links), `/themes` cards, preview page desktop + phone.
- Note: the configured `UNSPLASH_ACCESS_KEY` is a demo-tier key (50 requests/hour); apply for production (5000/hour)
  before launch. Responses are cached, but a cold cache needs ~20 requests.

## Panel sidebar toggle and tinted KPI cards (2026-10-16)

- **Sidebar.** Fixed: the collapsed rail let the nav overflow (`overflow-visible`), pushing the footer's Collapse/Expand button off screen, so the sidebar looked stuck as an icon rail. The toggle now sits at the top of the sidebar in both states (aria-label + tooltip) and the nav scrolls inside (`min-h-0`). The preference lives in a cookie per panel (`pc_sidebar_seller` / `pc_sidebar_admin`); `AppShell` is now a server wrapper that reads it, so the first paint has the right width. Expanded: logo, labels, submenus with chevrons, active group auto-opens, ↑/↓/Home/End move focus, →/← open/close a submenu. Collapsed: Pictocart mark, one icon per section with tooltips, sections with children open a flyout submenu on hover or click (Enter/→ opens and focuses the first link, ↑/↓ inside, Esc/← closes and returns focus). Tooltips and flyouts are `position: fixed` so the scrollable rail never clips them. Mobile drawer unchanged apart from a surface background.
- **Navigation.** Seller nav gained an **Accounts** group (Customers, Team, Roles & permissions, Plan & billing) and now links every settings/content page that was only reachable from the Settings sub-nav (Checkout, Taxes, Notifications, Security, SEO, Domains, Store locations, Redirects). Admin groups have their own icons. `tests/unit/dashboard/app-shell-nav.test.ts` checks every nav href has a page, icons/labels, active-item and group resolution, breadcrumbs, flyout clamping and the cookie parser.
- **KPI cards.** `StatCard` tones (mint, lavender, peach, sky, rose, + new amber, teal tokens for light and dark) render a soft diagonal gradient, matching border, an icon chip in the tint's ink, an overline label, and a hover lift (off under reduced motion); optional `trend` chip. The admin overview's 8 KPIs and the seller dashboard's KPI strip use it (the bespoke `Kpi` / bordered strip are gone).
- **Not verified here:** signed-in pages. Sign-in would send the super-admin password to the hosted Supabase project, so the session rendered the real `AppShell`, nav configs and `StatCard`s in a temporary unauthenticated harness route (removed before commit) and checked expanded, collapsed (+flyout, tooltip) and mobile drawer at 1440 px / 390 px in light and dark, plus keyboard flows and cookie persistence with headless Chrome.


## In-app notifications: bell, pages, producers (2026-10-16)

- **Data** — migration `20261016003000_in_app_notifications.sql`: `notifications` (per recipient: scope tenant/platform,
  type, title, body, in-app link, data, dedupe key, read_at; RLS own rows while still a member; clients update `read_at`
  only) and `notification_preferences` (per-user muted types). Added to the `supabase_realtime` publication when present.
  Types hand-added to `database.types.ts`. Design: ADR-036.
- **Producers (DB triggers)** — seller: new order (COD at placement, online once paid), payment received / failed, order
  cancelled, returned/RTO, return requested, low stock / sold out, new review, new customer, abandoned cart recovered
  (only after an email/WhatsApp reminder), plan request decided, AI credits low (80 %) / used up, custom domain verified /
  failed, SSL active / failed. Platform: new sign-up, new store, store published, plan request. Cron
  (`/api/cron/notifications`): trial ends in ≤3 days (deduped per store and day) + retention (read > 90 days, any > 180).
- **Reserved, no producer yet** — APK requests, disputes, failed platform payments/payouts: those flows/tables don't
  exist. Types, icons and `notifyPlatform()` (`src/features/notifications/inbox/server.ts`) are ready for them.
- **UI** — `features/notifications/inbox/**`: header bell with unread badge + popover (icon per type, relative time,
  mark read on click, mark all as read, keeps the "needs attention" counters, link to the page), `/dashboard/notifications`
  and `/admin/notifications` (all/unread + group filters, pagination, mark unread, per-type in-app preferences at
  `?tab=preferences`), "Recent activity" card on the dashboard home. Live via Supabase Realtime + 60 s polling fallback.
- **Tests** — `tests/rls/notifications.test.ts` (RLS, producers, recipients by permission, mutes, dedupe, cart recovery,
  reminders, function grants), `tests/unit/notifications/inbox.test.ts` (catalog ↔ SQL producers, AI limit sync, link
  safety, relative time, server-resolved audience in actions, preferences).
- **Not done** — migration not applied to the remote Supabase project; e-mail/WhatsApp copies of these alerts.

## Demo stores: 2 live stores per category (2026-10-17)

- **What** — `pnpm seed:demo-stores` creates 72 demo storefronts (2 for each of the 36 store categories in
  `src/features/stores/industries.ts`), each live with: an invented Indian brand (name, slug, owner, story, tagline,
  address, phone, `hello@<slug>.example`), wordmark logo + favicon in the theme colours, 5 categories, 4 collections
  (bestsellers, new arrivals, deals, gifts), 15 products with variants (sizes, shades, pack sizes…), prices in integer
  paise with MRPs, stock, HSN and SEO, Unsplash product photos and banners, menus, About / shipping / returns / contact /
  privacy / terms / image-credits pages, FAQs, 5 sample reviews, three shipping rates (standard, free over a threshold,
  metro express by PIN prefix), COD and GST (`tax_settings`) settings, and a published marketplace theme. The two stores
  of a category use two different themes with different layout variant sets (hero / product layout / header style /
  footer layout; `pickThemes()`), e.g. fashion: Runway Editorial vs Fashion Marketplace.
- **Code** — `scripts/demo/`: `data/*.ts` (36 categories × 2 brands × 5 departments × 6 products; store A sells the
  even products, store B the odd ones), `generate.ts` (pure plan: brand, catalogue, shipping, GST, reviews, theme pick),
  `theme.ts` (store content for every section the theme uses → real `applyThemePreset` → `parseThemeConfigStrict`),
  `photos.ts` + `data/unsplash-cache.json` (Unsplash search results per department), `guard.ts` (CLI + target guard),
  `seed-demo-stores.mts` (runner), `fetch-photos.mts` (fills the photo cache).
- **Real code paths** — tenant data is written as the demo owner under RLS with the dashboard's RPCs/tables:
  `create_tenant`, `save_product` (via `productInputSchema` / `toSaveProductPayload`), `set_collection_products`,
  storage uploads, a theme draft + `publish_theme`. The secret key is used only for auth admin (owner account, magic-link
  session), platform columns (`status`, `plan_id`, `store_type`, `category_id`, `launch_status`), sample reviews (no
  owner insert policy; written with `source = 'sample'`, migration 1700) and `--remove`.
- **Demo marking (no migration)** — `tenants.store_type = 'demo'` (migration 1800) + category set; owners are
  `owner@<slug>.demo.test` (undeliverable) with a random password that is never printed or stored and
  `app_metadata.demo_store = true`. Super admins can still open a store with "Log in as store".
- **Photos** — Unsplash's demo key allows 50 searches/hour, so `pnpm seed:demo-stores:photos --wait` fills
  `scripts/demo/data/unsplash-cache.json` (180 searches, ~4 h) and the seeder only reads the cache: seeding makes no
  Unsplash API calls. A department without cached results uses the curated pool in `src/lib/unsplash-stock.ts`.
  Photos are downloaded from images.unsplash.com, converted to WebP and stored in `store-assets`; each media-library item
  keeps the credit in its alt text and file name (same convention as the Media Library's Unsplash import) and every
  store has an `/pages/image-credits` page. Photos match the department, not the exact product.
- **Safety** — refuses any non-local Supabase URL unless `--target=remote --yes`; only slugs from the data files; an
  existing tenant with such a slug is used only if it is `demo`, owned by `owner@<slug>.demo.test` and not protected
  (The Paliya), otherwise skipped. A remote run also refuses while any photo search is uncached
  (`--allow-curated-photos` overrides). Idempotent and resumable (keyed on store / product / category / collection
  slugs); a store that hit a network error is finished by re-running (optionally `--slug=<slug>`).
- **Run locally** — start a local stack (`supabase start`), then point the script at it:
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local> SUPABASE_SECRET_KEY=<local> pnpm seed:demo-stores`
  (variables on the command line win over `.env.local`). Options: `--dry-run`, `--category=<industry>`,
  `--slug=a,b`, `--retheme` (publish a freshly built theme). Storefronts: `http://<slug>.localhost:3000`.
- **Run on the live project (owner approval needed)** — `pnpm seed:demo-stores --dry-run`, then
  `pnpm seed:demo-stores --target=remote --yes --root=<domain>` (optionally `--category=<industry>` first).
  `--root` gives each store a verified `<slug>.<root>` subdomain and makes it primary (storefronts resolve by exact
  hostname); a remote run refuses a localhost root. The owner decided (2026-10-17) the demo stores must NOT be served
  on `pictocart.in`: don't pass that root. `--refresh-photos` replaces product photos that differ from the
  plan. Owner sign-in retries when Supabase Auth rate-limits; a store that fails on a network error is finished by
  re-running with `--slug=<slug>`.
- **Live status (2026-10-17)** — all 72 stores are seeded on project `ugbjlpdhktrlkyuijkfc` (active, demo, live,
  15 products, 2,162 product photos matching the plan, published theme). They answer only on `<slug>.localhost`
  (not publicly reachable). A test `kesari-threads.pictocart.in` row was reverted (status `removed`, localhost
  primary again). To make them public later, pick a domain and run the seeder with `--root=<domain>`.
- **Verify** — Super admin → Stores, filter type "Demo" (72 stores with categories); open a few `https://<slug>.<root>`
  storefronts; `pnpm exec vitest run tests/unit/demo-stores.test.ts`.
- **Remove** — `pnpm seed:demo-stores --remove [--category=…] [--slug=…] [--target=remote --yes]` closes the stores the
  way the platform closes stores (`status = 'cancelled'`: storefront 404s, `launch_status = 'draft'`). It is not a hard
  delete: tenants cascade into the append-only `audit_logs`, so the platform has no delete path. Re-running the seeder
  reopens them.
- **Tested** — `tests/unit/demo-stores.test.ts` (target guard + CLI, data for every category, valid/unique plans, paise
  and MRP, store contents, distinct themes + layouts per category, theme config validity, photo cache/fallback). Seeded
  all 72 stores into a local Supabase stack (CLI stack on shifted ports) and checked storefronts (Kesari Threads,
  Urban Dhaga, Tarang Audio, Chai Chaupal) at desktop and mobile widths: home, product page, variants, MRP/discount,
  COD note, reviews, no horizontal scroll; re-runs are idempotent; `--remove` → 404, re-seed → live. That run used a
  partial photo cache; the final cache (all 180 searches, 10+ photos each) was checked by resolving all 2,104 product
  photo URLs, not by a second full local seed (Docker stopped during the session).
- **Not done / follow-ups** — not run against the remote project (needs the owner's go-ahead); platform dashboard
  totals don't exclude `store_type = 'demo'` yet (the store list can filter by type); no Unsplash download-tracking
  ping for seeded photos; a hard purge of demo tenants would need a DB function that can bypass the audit-log guard.

## Super Admin theme manager + AI theme builder (2026-10-17, branch `claude/jovial-jang-80a4f6`)

- **Super Admin → Themes** (`/admin/themes`, `platform.settings.manage`): every built-in theme plus custom themes (drafts
  included) as a grid with search, Built-in / Custom / Drafts filter and category chips. Preview page (`/admin/themes/{key}`:
  desktop + phone mockups, sample store with the theme's Unsplash photos and credits, Live Preview link on the category's
  showcase store for published themes). Custom themes: Edit, Publish/Unpublish, Duplicate, Delete. Built-in: Duplicate & edit.
- **Create new theme** (`/admin/themes/new`): name, category, reference https URL and/or up to 3 screenshots (PNG/JPEG/WebP,
  ≤ 3.5 MB, magic-byte checked, not stored), plus an acknowledgement that only the look is recreated. Pipeline
  (`src/features/theme/builder`): `fetch-guard.ts` (SSRF guard) → `extract.ts` (colours, fonts → allowed font keys, header,
  section order; no page text) → `prompt.ts` → existing LLM client (`neural-pulse/server/llm.ts`, now with image parts;
  Anthropic `claude-opus-5-5` by default) → `schema.ts` repair + strict validation, one regeneration on failure →
  `images.ts` Unsplash fill via `getStockImages` (credits kept) → saved as a draft → editor.
- **Theme editor** (`/admin/themes/{key}/edit`): details, colours/fonts/buttons/spacing, header/footer chrome, product card,
  home sections (reorder, add, remove, layout variants from `sections/variants.ts`), photos with credits; live preview
  (layout, phone, sample page). Save draft / Save & publish / Save & unpublish (server re-validates).
- **Sellers**: published custom themes appear in `/dashboard/themes` (+ detail, apply, admin "New store" picker, Live Preview)
  through `marketplace/registry.ts` (`getMarketplaceThemes`, `findAnyMarketplaceTheme`). The marketing site `/themes` still
  lists built-in themes only (follow-up).
- **Migration (pending, not applied to the remote project):** `20261016003100_custom_marketplace_themes.sql` adds `style`,
  `source`, `source_url`, `created_by`, `published_at`, a 256 KB `config` cap and an index to `public.themes`. Until it is
  applied, creating/saving custom themes fails; the seller catalogue just shows built-in themes (reads never throw).
- Tests: `tests/unit/theme-builder/*` (fetch guard, extraction, repair/validation incl. every built-in theme duplicating
  cleanly, pipeline retry, prompt, Unsplash fill), `tests/rls/custom-themes.test.ts` (drafts hidden, writes platform-only,
  constraints). Script: `scripts/dev/theme-builder/run.mts <url> <industry> <name> [screenshots] [--no-ai]` runs the pipeline
  without the app or DB writes.
- **Not verified:** the live AI call (no Anthropic/Gemini/Groq key is configured in the dev project or env) and the signed-in
  admin flow in the dev server (the migration isn't applied there). Verified against `https://www.allbirds.com/` with
  `--no-ai`: guarded fetch + 3 stylesheets, summary, repair, validation and 13 Unsplash API photos with credits.

## Seller site builder: full-screen visual theme editor (2026-10-17, branch `claude/zen-wilson-bf8a17`)

Dashboard → Storefront → Theme editor is now a full-screen visual builder (design: `docs/THEME_BUILDER.md`).

- **Chrome:** back, store name + saved state, "Pages:" switcher (Pages / eCommerce / Members area / Popups),
  undo/redo (buttons + ⌘Z / ⇧⌘Z), desktop/mobile canvas, Preview (saved draft, new tab), Save draft (conflict →
  "Save anyway"), Publish with version note, version history with Restore.
- **Left rail:** Pages (groups, gear settings, Add page: blank + 10 templates with wireframe thumbnails), Menus
  (header/footer, drag to reorder, sub-items, "Update menu" dialog with None / Home / Pages / Products /
  Collections / Blog posts / Blog category / Web address / Popup, target, anchor, name, advanced), Theme settings
  (preset tokens, palettes + custom colours, H1–H6 / paragraph / small type scale, buttons & layout, header,
  product cards), Embed apps (WhatsApp button, back to top, links to analytics/SEO), Layers (page tree, eye,
  drag, duplicate/delete), Popup editor.
- **Canvas:** the real storefront in an iframe; hover/select outlines and a toolbar (Edit, Change design,
  settings, colours, up/down, ⋮ duplicate/hide/delete), "+" and "Add with AI" above/below sections. Edit =
  Section data with a managed item list (add, drag, edit, copy, delete) and an item editor with toggled groups and
  Update; Change design uses the existing layout variants. Unsaved edits re-render through
  `renderCanvasAction` (storefront server action, preview-cookie authorised), so the canvas is the storefront's
  own renderer. Product, collection, cart, search, account, blog and content pages have templates around their
  own content (PageContent marker).
- **Theme document (no migration, back-compatible defaults):** templates `collectionList, page, blog, search,
  cart, account`; `pages[]` (site-builder pages at /pages/<handle>, take precedence over a content page with the
  same slug; new handles avoid existing content-page slugs); `popups[]`; `menus` (theme copies replace the
  database menu with that handle, so menu edits follow draft → publish); `embeds`; `tokens.typography`;
  per-section `style` colour overrides.
- **Add with AI:** `generateSectionAction` (theme.edit, 30/day per store, platform Gemini/Groq providers);
  output is sanitised to the section schema, images blanked (stock photos fill them).
- **Preview cookie** is now `SameSite=None; Secure; Partitioned` (localhost over http included): a store on a
  custom domain (or `*.localhost` in dev) is cross-site to the platform, where the old Lax cookie never reached
  the editor iframe. Dev store links follow the port in `NEXT_PUBLIC_PLATFORM_URL`.
- Tests: `tests/unit/site-builder-{schema,pages,sections,theme}.test.ts` (schema + back-compat, link resolution,
  protocol, undo reducer, ops, templates, palettes, typography CSS, AI sanitiser).
- Verified: `pnpm check` green. Dev server (port 3001) on demo store `nook-living` via super admin "Log in as
  store": canvas select → section panel, item edit + Update (live), undo, Change design, palette, menu edit (live
  in header), page switching (Product details renders real product with unsaved edits), Layers, Add section,
  Add with AI (FAQ generated + inserted), Add page (About template, unsaved page previews), popup on canvas, embed
  toggles, mobile view, Save draft (storefront draft render matches), Publish (v4, original content restored first).
- Not done / limits: hover outlines can't be exercised by the in-app test browser inside a scaled (desktop,
  < 1280px canvas) frame, so desktop clicks were tested at 1400px; the builder is desktop-first (narrow screens
  scroll the top bar); list items have no "hide" flag (the ⋮ menu offers Edit / Copy / Delete); the item editor's
  local copy can go stale if the same item changes elsewhere while it is open.

## Product images + product types for every industry

- **Images:** `ProductMediaManager` used to copy `media` into `useState` once, so images added from the media
  library (or uploaded) never showed after `refresh()`, and the next reorder failed with "images changed". It now
  renders the server order, with `useOptimistic` for moves. Each image has **Set as main** and the main one has a
  **Main** badge. The main image is the lowest position (`features/catalog/media-order.ts`, with a tie-break by
  storage path), and the dashboard, product cards and product page/og:image all use it. Attach skips
  non-images and duplicates, and accepts up to 30 paths.
- **Product types:** `features/catalog/product-types.ts` holds the catalogue (about 140 types in code, each
  mapped to industries, with attribute templates: `fashion` fields, `sizes`, labelled `specs` stored in
  `attributes.specs`, and a care label). Super Admin → Product types (`/admin/product-types`) can rename a type,
  assign industries, edit its template, disable it, reset it or add a new one. These edits are stored in
  `product_types`. Sellers can create store-only types from the product form (`tenant_product_types`). The
  product form suggests types for the store's industry first and shows clothing fields only for clothing types
  (or when a product already has values in them).
- **Migration `20261018003200_product_types` (not applied yet):** drops the fashion-only CHECK on
  `products.product_type` and creates both tables. Until it is applied: the code catalogue is used, Super Admin
  edits and custom types return a "migration pending" message, and new type keys are saved as `other` with
  `attributes._type` (read back everywhere; the migration moves the value back into `product_type`).
- Tests: `tests/unit/products-types-images.test.ts`.

## Site builder: pages panel menu, homepage, page sections (2026-10-18, branch `claude/builder-polish`)

- Pages panel ⋮ menus (SEO & page setup with social image + noindex, Rename, Set as subitem, Set as
  homepage, Duplicate, Delete; Blog: Manage blog / Rename), "Add new page" pinned at the bottom.
- Theme fields (defaulted, back-compatible): `homePageId`, `builtinTitles`, page `socialImagePath` / `noindex`.
- New sections: ContactInfo, RichText, BlogPosts, Gallery, Team, CallToAction (≥3 variants each);
  About / Contact / Blogs / Gallery / Team / Privacy templates use them.
- Canvas: empty page lists offer "Add a section". Tests: `tests/unit/site-builder-page-sections.test.ts`.
- See docs/THEME_BUILDER.md "Pages panel and page sections".

## Section designs, group a (2026-10-18, branch `claude/builder-polish`)

New "Change design" options (first value of every list = the old look; old themes unchanged):
- FAQ: accordion + split, cards, numbered, chat bubbles (optional contact button, spacing).
- PromoBanner: tiles + full-width, split, three-tile mosaic, overlapping card, offer strip, text only (tone / alignment / badge).
- Footer: +5 layouts (mega with newsletter, brand panel, contact buttons, illustrated, two slim rows); seller-uploaded illustration (`imagePath`/`imageAlt`) also as decoration "My illustration".
- Hero: +3 fading slideshows (`HeroStage` island: thumbnails / numbered progress / dots, autoplay with pause button, paused on hover/focus/hidden tab, off under reduced motion).
- CategoryGrid: +4 (circle avatars, overlay cards, bento, banner rows with description).
- Instagram (SocialProof): layouts become variant cards (+ profile page, reels carousel, collage with follow card); `source: "instagram"` shows the connected Instagram account's latest posts (server-side, cached 1 h, ADR-006 addition), falling back to manual posts; builder help points to Marketing → Social → Accounts.
Code: `render/designs-a.tsx`, `storefront/components/hero-stage.tsx`, `social/server/instagram-feed.ts`, `theme/designs-a.css`, wireframes in `site-builder/variant-diagrams-a.ts`. Tests: `tests/unit/section-designs-a.test.ts`. Not verified in a browser (no dev server run).

## Builder polish round (2026-10-18, branch `claude/builder-polish`)

Owner review of 19 screenshots, built by 7 parallel agents and integrated here (details in the sections
above and in `docs/THEME_BUILDER.md`):
- Logo: real width/height controls for desktop and phones, logo position (left / centre split / centre
  above / right, phone left / centre) on every header style; 10 new self-hosted fonts with a live picker.
- Builder UX: orange progress bar while the canvas updates, gradient selected-section overlay, cleaner
  toolbar with section-name chip, ON/OFF pill toggles, pinned Update button, "Add with AI" pill and a
  "Coming soon" state when AI isn't configured.
- Products: "Add from media library" fixed (stale client copy of the image list), "Set as main" + Main badge,
  industry-aware product types with per-type fields, seller custom types, Super Admin `/admin/product-types`.
  **Migration `20261018003200_product_types.sql` is NOT applied** — until it is, the built-in catalogue is used,
  admin/custom type edits show "migration pending", and new type keys are saved via a fallback.
- Media library: asset-manager dialog (upload, Images, Stock photos, Icons, inspector, Insert media) and a
  197-icon allowlisted library (`icon:<name>` in image fields, inline SVG in theme colours).
- Pages: per-page ⋮ menus (SEO & page setup, rename, set as subitem, set as homepage, duplicate, delete),
  `homePageId`, empty-page "Add a section" placeholder, new page sections ContactInfo / RichText / BlogPosts /
  Gallery / Team / CallToAction.
- Designs: every section has ≥3 designs (FAQ 5, Promo 7, Footer 9 incl. illustration upload, Hero 10, Category
  tiles 9, Instagram 6 with a real feed from the connected Instagram account, all others ≥3).
- Tests: `tests/unit/section-render-smoke.test.ts` server-renders every section × design (166 cases).
- Verified: `pnpm check` green (86 files / 1213 tests, build OK); dev server on nook-living: builder, logo
  size/position, hero designs, progress bar, page menus, new page, product images + type suggestions, media
  library + icons. Live store renders unchanged.

## Informative theme correction (2026-10-19)

- The ten Informative marketplace entries now use service-site previews and cards: no marketplace card,
  detail page or public Preview Theme route borrows an unrelated online-store demo.
- An untouched starter site receives brochure copy when an informative theme is applied: enquiry hero,
  services/proof, story, FAQ/contact and no shipping/COD/product-band copy. Existing stores retain their
  edited content when changing themes. Product-dependent `FeatureBand` sections were removed from the
  informative compositions.
- Verified: `pnpm typecheck`, `pnpm lint`, and `pnpm test` (88 files, 1234 tests).

## Seller authoring, marketing and feedback polish (2026-10-19)

- **Responsive marketing and sign-in:** the landing-page device preview now keeps a conventional phone
  aspect ratio beside a wider desktop preview. Merchant sign-in, registration and recovery use a 60:40 desktop
  layout, orange action buttons, an uncropped store preview at suitable viewport heights, email-entry hygiene,
  and clear password-strength guidance. The existing Google OAuth action and all server-side auth safeguards are
  unchanged.
- **Authoring workflows:** pages now begin with editable starter content and can add an existing Media Library
  image or upload a new one. New page, collection and category URL handles follow their title until the seller
  edits them. Product descriptions have a safe plain-text Write/Preview editor with heading, paragraph and
  bullet helpers; no untrusted HTML is stored or rendered. Product CSV import has a clearer drop area, client
  file checks and a structured validation/import-result panel.
- **Feedback and credits:** a shared, accessible, top-right glass toast surface reports successful, warning and
  failed dashboard actions while retaining inline field errors. The dashboard header shows a tenant-scoped AI
  credit balance when the AI-credit migration is available.
- **Creative Studio and Neural Pulse:** sellers can start a branded creative from an active product (copy, price
  and first image), choose Media Library assets, hand a saved tenant-owned PNG into the social composer, and
  follow a clear Brand → Generate → Review → Plan workflow. Creative and Neural Pulse actions now use the shared
  toast feedback.
- **Verification:** `pnpm typecheck`, `pnpm lint`, and `pnpm test` passed together (89 files, 1236 tests);
  `git diff --check` is clean. The local Next/Turbopack production build entered its compile step then remained
  idle in this environment, so its two exact processes were stopped after the successful static and test checks.
- **External setup still required:** apply migration `20261019003400_ai_credits.sql` before the balance can
  appear; configure the documented Supabase Send Email Hook/Resend credentials for branded auth messages;
  configure Google OAuth client credentials/redirects to test Google login; and add an Unsplash access key for
  live stock-photo search beyond its fallback results.

## Bugs 2.0 #11–#16: site builder preview (2026-10-23, branch `claude/bugs-2-0-builder`)

- **#11 edits not reaching the canvas.** `changedLists` (site-builder/ops.ts) ignored `embeds` (WhatsApp, back-to-top…)
  and `builtinTitles`, and returned `[]` for edits outside the section lists (e.g. a page renamed), so nothing was posted.
  These now re-render every slot. The canvas maps each slot to the list it actually shows (`slotListOf` in slots.ts:
  home slot → chosen homepage, handle slots → their page) before deciding what to re-render.
- **#12 "Previewing your unpublished theme" after publishing.** Publishing keeps the draft row, so the banner showed forever.
  `getStorefrontTheme` now reports `unpublished` (draft ≠ published, `hasUnpublishedChanges` in theme/preview.ts); the
  banner says "unpublished changes" only then, and is hidden inside the builder canvas.
- **#13 / #14 / #16 stuck "Updating…", slow refresh, "Preview couldn't be updated".** Server actions from one page run one
  after another; a render per edit built a backlog. The canvas (canvas-bridge.tsx) now runs one render at a time and merges
  edits that arrive meanwhile (union of changed lists, newest document), applying results in order. The builder
  (canvas-frame.tsx) arms a 20 s watchdog per render; a lost or failed render reloads the canvas automatically (up to 2 times
  in a row), then shows the error with **Retry**. Debounce 250 → 150 ms.
- **#14.2 / #15 "You don't have permission".** The canvas render is authorised by the 2 h preview cookie. A FORBIDDEN render
  now reports `code: "forbidden"`; the builder mints a new preview token and reloads the canvas, re-sending unsaved edits.
- **#14.1 margin back to 0.** Spacing CSS handles 0 correctly (section-box.ts); the stale preview was the render backlog above.
- **#0.5 Google sign-in shows `ugbjlpdhktrlkyuijkfc.supabase.co`.** Configuration, not code: Google names the domain that
  handles the OAuth callback. Fix = Supabase **Custom Domain** add-on (e.g. `auth.pictocart.in`, Supabase Pro), then update
  the Google OAuth client's authorised redirect URI and `NEXT_PUBLIC_SUPABASE_URL`. Also set the app name/logo/home page on
  the Google OAuth consent screen (Google Cloud → APIs & Services → OAuth consent screen).
- **#4 (from PR #19) still open on the live DB:** the `free` plan has `trial_days = 90` on v2pictocart, so new stores open as
  trials. Migration `20261023003600_free_plan.sql` sets it to 0 and makes `create_tenant` open trial-less plans as active.
- Tests: `tests/unit/bugs-2-0-builder.test.ts`, `tests/unit/site-builder-sections.test.ts` (changedLists).
- Not verified in a signed-in browser session (needs a super-admin / seller login).

## Auth emails, merchant OTP sign-up, Google sign-in, builder progress (2026-10-24, branch `claude/auth-email-builder-fixes`)

- **Root cause of "no emails" / "Too many attempts":** `email_log` on v2pictocart had no `auth_*` rows ever, so the Send Email hook
  was never enabled and Supabase's built-in mailer (≈2 emails/hour, not Resend) sent sign-up/OTP/reset mail. Separately, the
  Resend key saved in Admin → Email started failing on 2026-10-23 with **401 "API key is invalid"** (key rotated/revoked).
- **Fix (code):** `features/auth/server/auth-codes.ts` — `generateLink` (no Supabase email) + `handleAuthEmailHook` renderer →
  Resend (ADR-006 addition). Used by merchant sign-up/sign-in by code, `/start` codes, merchant forgot password (code or link),
  store sign-up confirmation (code), store "Email me a code", store forgot password (code or link). Email copy leads with the code
  in a peach box ("valid for 60 minutes"), subject "123456 is your Pictocart sign-in code", real Pictocart logo.
- **Fix (you):** paste a new Resend API key in **Admin → Email** (domain `pictocartdev.in` must be verified in Resend).
- **Merchant auth screens (wireframes):** `/seller/register` = Google + email → 6-box code (auto-advance, paste, Resend with 30 s
  cooldown, Change email) → onboarding. `/seller/login` = "Email me a code" (default) or Password. Component:
  `components/auth/email-code-flow.tsx` (platform + store tones).
- **Onboarding quiz:** new first step "What are you building?" (Informative website / E-commerce store), saved as
  `onboarding_site_mode` and pre-selecting the site mode in the form and Tara voice paths (existing store setup unchanged).
- **Google consent shows the Supabase URL:** `GoogleIdentityButton` (Google Identity Services + `signInWithIdToken`, nonce) makes the
  merchant sign-in run on pictocartdev.in so Google shows that domain. Enable with `GOOGLE_IDENTITY_SIGNIN=on` after adding
  `https://pictocartdev.in` to the OAuth client's *Authorised JavaScript origins* (client id auto-read from Supabase's authorize
  redirect, or `NEXT_PUBLIC_GOOGLE_SIGNIN_CLIENT_ID`). Store sites keep the redirect flow (wildcard origins aren't allowed by Google);
  for those the only full fix is the Supabase Custom Domain add-on.
- **Product form overflow:** `lg:grid-cols-[1fr_320px]` → `minmax(0,1fr)` (variants table scrolls inside its card); same fix on
  customers, returns, festive and shared dashboard forms.
- **Builder:** green "Updating 45%" chip + green progress bar, "✓ Updated" on success, amber + warning toast after 6 s, error toast.
  **Add with AI** is enabled when Sarvam is configured too (it was gated on Gemini/Groq/Anthropic only, showing "Coming soon").
- Tests: `tests/unit/auth/auth-codes.test.ts`, `tests/unit/auth-ui-and-onboarding.test.ts`, onboarding steps.
- **Follow-up (2026-10-24): code length + store Google sign-in.**
  - Emails arrived with **8-digit** codes: Supabase's *Email OTP Length* is 8 on v2pictocart. The code boxes now follow the real
    length (`codeLength` returned by the request actions, 6–10). To get 6-digit codes, set Supabase → Authentication → Sign In /
    Providers → Email → **Email OTP Length = 6**.
  - **Store Google sign-in** never returned to the store: Supabase only redirects to allow-listed URLs and store subdomains aren't
    listed. Now relayed through the platform (`/auth/store-google` → Google → `/auth/store-google/callback` → single-use token →
    the store's `/account/auth/callback`), which links the existing customer profile by email (or creates one) and opens
    `/account`. `features/customer-account/server/google-relay.ts`; only stores we serve are accepted as return hosts.

## QA item 4: size charts by category, product override, PDP dialog (2026-10-27, branch `claude/qa-size-chart-cf9da4`)

Tester: a size chart could be created but not attached to products and never showed on the storefront.
Causes: the product editor only offered the chart picker for clothing/sized product types, the PDP link only
appeared next to an option literally named "Size", and categories had no chart at all.

- Migration `20261027004100_category_size_charts.sql`: `categories.size_chart_id` (tenant-scoped FK, set null on delete).
- Size charts page: "Apply to categories" checkboxes (saved with the chart; unticked categories lose it). Category form: "Size chart" select.
- Product editor: picker shown for every product once the store has a chart: Category default (shows the inherited chart) / a specific chart / No size chart.
  "No size chart" is stored as `products.attributes._size_chart = "none"` (internal `_` key), so `save_product` is unchanged.
- Storefront (`getProductBySlug`): product's own chart → nearest chart on its category or a parent category → none
  (`resolveSizeChartId` in `src/features/catalog/size-chart.ts`, unit tests in `tests/unit/catalog/size-chart.test.ts`).
  Only active categories are visible to the storefront (RLS), so a hidden parent category does not pass its chart down.
- PDP: "Size chart" link by the Size option (or under the options when the product has none) opens a centred native
  `<dialog>` (`size-chart-dialog.tsx`) with the table, unit and note; closes on Esc, Close or backdrop. The chart model has no image field.
- Verified on the local seeded store (:3302): created a chart and ticked Sarees → saree PDP shows it; product set to
  "No size chart" → hidden; kurta with its own chart → own chart; dupatta (no chart) → no link; mobile dialog checked.
