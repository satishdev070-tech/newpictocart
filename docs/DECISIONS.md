# Architecture Decision Records

Format: **Status** (Accepted / Proposed / Open) · Context · Decision · Consequences.
"Proposed" = the default direction I will implement unless you say otherwise. "Open" = needs your call before the slice that depends on it.

---

## ADR-001 — Greenfield scaffold · Accepted
**Context.** Phase 0 audit: the repo held only `docs/` (12 blueprint files), no code, no git, no Supabase project files. Nothing to preserve.
**Decision.** Scaffold with `create-next-app` (App Router, TypeScript, Tailwind, ESLint, `src/` dir, pnpm) and build Phase 1 on top of it.
**Consequences.** Layout uses `src/` (blueprint showed `app/` at the root); otherwise follows `02_ARCHITECTURE.md`.

## ADR-002 — Stack versions · Accepted
Next.js **16.3** (Turbopack default; `middleware` renamed to `proxy.ts`; async-only request APIs; error boundaries receive `retry`), React 19.2,
TypeScript **5.9** (TS 7 native compiler is out but Next's type plugin/typegen target 5.x), Tailwind 4, Zod 4, `@supabase/ssr` 0.12,
`@supabase/supabase-js` 2.117, Vitest 5, pnpm 10, Node ≥ 20.9.
Next 16 ships version-matched docs in `node_modules/next/dist/docs/`; `AGENTS.md` tells agents to read them before coding.

## ADR-003 — Modular monolith with feature modules · Accepted
One Next.js app; domain logic in `src/features/<domain>/server`, never in JSX; shared infrastructure in `src/lib`.
No microservices in V1. Cloudflare Worker is an edge router only, not a second backend.

## ADR-004 — Host-based multi-tenancy via proxy rewrite · Accepted
**Decision.** `src/proxy.ts` classifies the host. Storefront hosts (`{slug}.{root}` and custom domains) are rewritten to the internal
`/store/{host}/…` tree. `/store/*` is unreachable from the platform host. Seller/admin paths (`/dashboard`, `/admin`, `/login`, `/signup`, `/onboarding`)
404 on storefront hosts so seller sessions live only on the platform origin.
**Why.** One storefront codebase for subdomains and custom domains; host in the path gives a natural cache key; no tenant id in URLs.
**Also.** `/s/{storeSlug}` path-based URLs from the blueprint are **not** implemented. They would put all stores on one origin (shared cookies/localStorage across tenants). Subdomains work locally via `acme.localhost:3000`.

## ADR-005 — Tenant resolution only from verified `domains` rows · Accepted
Every store gets a `domains` row for its platform subdomain (type `platform_subdomain`, auto-verified) and one per custom domain (verified by DNS TXT).
`tenantDirectory.findByHost()` reads **verified** rows only. The `[host]` segment must equal the proxy-verified `x-paliya-host` header or the request 404s.
Inbound `x-paliya-host` headers from clients are stripped.

## ADR-006 — Supabase key usage · Accepted
- Publishable key + user session for all tenant data (RLS enforced).
- Secret key (`SUPABASE_SECRET_KEY`) only in `lib/supabase/admin.ts`, guarded by `server-only`, for: host→tenant lookup, verified webhooks, platform ops after an explicit platform-permission check, background jobs.
- ESLint forbids `createClient` from `@supabase/supabase-js` outside `lib/supabase/*`.
- Server identity via `auth.getClaims()`, never `getSession()`.
- Env names follow Supabase's new API keys (`sb_publishable_…`, `sb_secret_…`); the legacy anon/service_role JWT keys also work in the same variables.


**Additions (2026-10-02, social suite):** the secret-key client is also used for (1) `platform_app_credentials` (platform permission check first; ciphertext only), (2) inbox webhooks writing `social_conversations`/`social_messages` after the Meta `X-Hub-Signature-256` check, with the store resolved from a connected integration, (3) `ai_generations` logging and (4) `gbp_reviews` sync, both after a `marketing.write` check with a server-resolved tenant.

**Addition (2026-10-11, image variants):** `/api/img` (lib/storage/variants-server.ts) uses the secret-key client for one write only: a derived WebP copy (`{original}__w{480|960|1600}.webp`) next to an EXISTING public original in `store-assets`, when that copy is missing. It never reads private data, never overwrites originals, and validates the path (`tenant/{uuid}/…`, raster extension) and width (fixed ladder). New uploads make their copies with the uploader's own client (RLS). Reason: store images are served pre-sized from Supabase Storage instead of Vercel Image Optimization, whose per-transformation quota paused the platform.

**Addition (2026-10-18, storefront Instagram feed):** `features/social/server/instagram-feed.ts` reads the store's connected `instagram` integration (via `activeIntegration`, secret-key client) for the tenant resolved from the verified host, only when a SocialProof section has `source: "instagram"`. The Page token never leaves the server; only validated public media fields (https Instagram/Facebook CDN image, instagram.com permalink, caption) are cached (Data Cache, 1 h, tagged with the storefront tag) and rendered. Any failure falls back to the seller's manual posts.

**Addition (2026-10-20, signup without an email provider):** `signUpAction` may call `auth.admin.createUser` (email already confirmed) and then `signInWithPassword` with the password the seller just chose when Auth rejected signup solely because the confirmation email could not be sent. That path runs when no email provider is configured, and also on a non-production server or when the platform root is `localhost` even if a Resend key is saved but the send failed. Production with a configured provider still surfaces the email error and does not confirm the user. An existing account is confirmed if it is still unconfirmed, then signed in with that same password; the password is never replaced.

**Addition (2026-10-24, app-sent auth emails):** `features/auth/server/auth-codes.ts` uses `auth.admin.generateLink` (types `magiclink` and `recovery`) to obtain the one-time code and token hash WITHOUT Supabase sending an email, then sends the branded email itself through `handleAuthEmailHook` → `sendEmail()` (Resend, `email_log`). It may also call `auth.admin.createUser` with `email_confirm: false` for (1) a merchant or shopper signing up by email code (passwordless) and (2) the store sign-up form (the shopper's own password); the account stays unconfirmed until the emailed code is verified with `verifyOtp`. Reason: Supabase's built-in mailer is limited to ~2 emails/hour and never reached Resend ("Too many attempts", no auth emails in Resend), and the Send Email hook needs dashboard setup per project. Requests are rate-limited per IP and per email; reset requests never reveal whether an account exists.

**Addition (2026-10-25, Super Admin port):** after a `platform.users.manage` check, `features/platform-users/server.ts` uses the secret-key client to (1) create a confirmed account (Admin → Users → Add user; optional password, otherwise an emailed one-time set-password link), (2) generate a recovery link for a non-staff account, and (3) ban or unban sign-in (`ban_duration`) with `profiles.status`. After a `platform.partners.manage` check, "Create partner directly" creates the partner's auth account the same way. Platform staff accounts and the acting admin are never targeted; every write is audited. All directory reads go through SECURITY DEFINER SQL (`platform_user_directory`, `platform_user_stats`, `platform_user_detail`), not the secret key.

**Addition (2026-10-28, My Profile):** `features/account/server.ts` uses the secret-key client for two reads only: (1) the store's `partner_referrals` row (+ partner name, email, code) for the tenant resolved from the seller's membership (the table is platform-only under RLS), shown as "Partner connection" on My Profile; (2) platform-wide `orders` / `products` head counts (no rows) on Admin → My Profile, after a `platform.tenants.read` check. Profile edits, password changes and the data export use the person's own session; deletion requests are audited only (a super admin deletes from Admin → Users).

**Addition (2026-10-28, Admin → Users actions):** after a `platform.users.manage` check and the pure rules in `features/platform-users/rules.ts` (super admin only; never platform staff or the acting admin), `features/platform-users/server.ts` uses the secret-key client to (1) set a generated temporary password (`auth.admin.updateUserById`, returned once, never logged), (2) link an account as a customer of a store the admin picked (store re-read first; also needs `platform.tenants.manage`), and (3) delete an account (`auth.admin.deleteUser`) together with the stores it owns alone, after the admin typed `DELETE`; audited with `tenant_id` null. Super admin grant/revoke uses the admin's own RLS session.

**Addition (2026-10-28, seller AI on NVIDIA):** the NVIDIA NIM key is one more `platform_app_credentials` row (`nvidia`, same encryption, read by the secret-key client as in (1) above). The seller AI `ai_generations` log write (secret-key client) now also follows a `catalog.write`, `content.write` or `analytics.read` membership check (product, blog, coach, store assistant, store setup), always with the tenant from the membership. Store data for the assistant and store setup writes use the seller's own RLS session.

**Addition (2026-10-28, platform AI wallet gateways):** `platform_app_credentials` may also hold **Razorpay** and **Cashfree** secrets used only to collect AI credit recharges for the platform (not store checkout; never `tenant_integrations`). Reads/writes follow the same secret-key + `platform.settings.manage` pattern as (1). Verified platform webhooks at `/api/webhooks/platform/razorpay` and `/api/webhooks/platform/cashfree` use the secret-key client to stamp and complete `ai_credit_purchase_requests` (RPC `complete_ai_credit_purchase_payment`, service_role only).

## ADR-007 — Edge → origin trust via HMAC-signed host · Accepted
The Worker forwards the original hostname with `x-paliya-edge-{host,ts,sig}` where `sig = HMAC-SHA256(EDGE_SHARED_SECRET, host + "\n" + ts)`.
The proxy accepts it only if the signature is valid and ≤ 300 s old; otherwise it falls back to the literal Host header. Anyone hitting the origin directly cannot claim a tenant host.

## ADR-008 — Money as integer paise · Accepted
TS uses integer minor units; DB uses `numeric(12,2)`; conversion only in the data layer (`lib/money.ts`). Discount percentage rounds down.

## ADR-009 — Permissions matrix in code, seeded to DB · Accepted
`lib/permissions/matrix.ts` is the single source. Phase 2 seeds `roles/permissions/role_permissions` from it; RLS helper
`has_tenant_permission(tenant_id, perm)` is `SECURITY DEFINER` with `search_path = ''` and schema-qualified references.
V1 uses the five system roles only; tenant-defined custom roles are a later feature.

## ADR-010 — Caching strategy for storefront · Accepted (dynamic for v1)
Next 16 **Cache Components** (`cacheComponents: true`, `"use cache"`, `cacheTag`) fits catalog pages well (static shell + streamed dynamic cart/account),
but it changes the rules for every route (dynamic access must sit under `<Suspense>`). Phase 1 leaves it **off** and renders storefronts dynamically.
Proposal: enable it at the start of Phase 7 with tags `tenant:{id}`, `tenant:{id}:product:{id}`, `tenant:{id}:theme`, invalidated from catalog/theme services.


**Update (2026-10-02):** cross-request caching is now done with `unstable_cache` (`src/lib/cache/storefront.ts`; production only): tenant directory (tags `tenant-directory`, `host:<host>`), published theme, store profile and features (`tenant:<id>:storefront`), 120 s TTL. Every mutation that changes them calls `revalidateStorefront(tenantId)`; plan/flag changes call `revalidateAllStorefronts()`. **Update (2026-10-27):** `revalidateStorefront` drops only that tenant's entries (incl. its directory identity); the host → tenant mapping is dropped only by domain changes via `revalidateTenantDirectory()`. Site mode, tracking tags (public IDs only) are cached per tenant too. Draft preview and Live Preview are never cached; product, price and stock reads are not cached.

**Update (2026-10-27, Redis L2):** optional Upstash Redis (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) sits behind `unstable_cache` for the same public storefront loaders. Cold instances hit Redis before Supabase. Invalidation deletes indexed Redis keys alongside `revalidateTag`. Unset env = previous behaviour. Rate limiting stays Postgres (ADR-025); cart/session/dashboard stay uncached. Catalog/product Redis deferred until free-tier usage is measured.

**Update (2026-10-27, seller/admin Phase 1):** private dashboard and Super Admin list/detail reads stay **live** (no Data Cache / Redis on tenant products, orders, customers, or admin tenant directories). Public catalogues may use Data Cache with tags and write-path `revalidateTag`: marketplace custom themes + open demo origins (`MARKETPLACE_*`), and anon-readable platform `product_types`.

**Update (2026-10-28, public catalogue Redis):** shared helper `cachedPublic` / `revalidatePublicTags` (`src/lib/cache/public-cache.ts`) powers storefront (`sf:v1`) and platform public catalogues (`pub:v1`): marketplace themes/demos, platform `product_types`, marketing landing, public platform config, and `feature_flags` **defaults only** (no tenant overrides). Private admin/dashboard lists stay uncached. Feature-flag writes also invalidate `platform-feature-flag-defaults`.

## ADR-011 — Hosting target for the Next.js app · Open (needed by Phase 11; affects nothing before)
Options:
1. **Vercel** for Next.js + Cloudflare in front (DNS, Cloudflare for SaaS custom hostnames, Worker). Most compatible with Next 16 features; two vendors; custom hostnames must also be added to Vercel via its API.
2. **Cloudflare Workers via OpenNext** (`@opennextjs/cloudflare`) — one vendor, custom hostnames handled natively by Cloudflare for SaaS; some Next features lag (check Cache Components/ISR support at the time).
Code is kept host-agnostic (Node runtime, no Vercel-only APIs) so either works.

## ADR-012 — `tenants` vs `stores` · Accepted
The blueprint has both with overlapping columns (name, slug, logo, currency, timezone). Proposal: `tenants` = account/billing/status/plan;
`stores` = 1:1 storefront profile with `tenant_id` as its **primary key** (logo, favicon, contact, social, locale). No duplicated columns.

## ADR-013 — Composite tenant foreign keys · Accepted
Every tenant table gets `unique (tenant_id, id)`; child tables reference `(tenant_id, parent_id)`. Join tables (`collection_products`,
`variant_option_values`, `product_tag_map`, `wishlist_items`, `cart_items`, `discount_products`, `discount_collections`, `return_items`) also carry `tenant_id`.
This makes a cross-tenant link (tenant A's product in tenant B's collection) impossible at the constraint level, and keeps RLS policies simple (`tenant_id` on every row).

## ADR-014 — Single source of truth for stock · Accepted
The blueprint stores stock twice (`product_variants.stock_quantity/reserved_quantity` **and** `inventory_levels`). Proposal: `inventory_levels` is authoritative
(one default location per tenant in V1); variants carry no stock columns. Reservations and decrements run in a Postgres function using
`UPDATE … SET available = available - $n WHERE available >= $n` (row-level lock, no negative stock) and write an `inventory_movements` row in the same transaction.

## ADR-015 — Order numbers & price integrity · Accepted
Per-tenant, gap-tolerant order numbers from a `tenant_counters` row locked `FOR UPDATE` inside the order-creation function.
`cart_items.unit_price_snapshot` is display-only; checkout **re-prices server-side** from current variant prices and discount rules, then snapshots into `order_items`.

## ADR-016 — Customer identity across stores · Accepted
Supabase Auth cookies are per host, so shoppers sign in on each store's domain. One `auth.users` identity can map to separate `customers` rows in
several tenants; each tenant sees only its own `customers` row (RLS). Seller accounts (tenant memberships) sign in only on the platform domain.

## ADR-017 — Theme versions are immutable once published · Accepted
`theme_versions` rows: one mutable `draft` per tenant theme; publishing copies the draft into a new immutable `published` version; rollback re-publishes an
older version as a new version (history stays linear and auditable). Section settings are validated against each section's zod schema on save **and** on render.

## ADR-018 — Security headers now, CSP later · Accepted
Baseline headers ship now (`nosniff`, HSTS, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`, COOP).
CSP with nonces is deferred to hardening, when the payment provider's checkout script is known.
**Resolved (2026-09-25):** framing is set per request by `src/proxy.ts` via `framingHeaders()`: storefront responses send
`Content-Security-Policy: frame-ancestors 'self' <platform origin>` (no XFO, which can't name another origin) so the theme editor can
iframe them; platform responses send `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN`. Full script-src CSP remains open.

## ADR-019 — Fonts · Accepted
No `next/font/google` for now (it fetches at build time). Platform uses system stacks via tokens; storefront theme fonts will be self-hosted files in Storage/`public` chosen by theme settings (Phase 6).

## ADR-020 — Payments & shipping providers · Accepted (Razorpay + COD, Shiprocket)
Provider abstraction either way (`PaymentProvider`, `ShippingProvider` interfaces; webhook signature verification per adapter). COD is built in.
Suggested first adapters for Indian D2C: **Razorpay** (payments) and **Shiprocket** (shipping). Please confirm or name your preferred providers.

## ADR-021 — Platform brand & root domain · Open
Placeholder brand "The Paliya" (`src/config/platform.ts`) and example root domain `paliya.store` in tests/docs. Tell me the real brand name and platform domain.

## ADR-022 — Signed cart cookie · Accepted
Carts are server rows; the browser holds only `paliya_cart` = HMAC-signed `{tenantId}:{cartId}` (key derived from `APP_SECRET` via HKDF).
A cookie from another store or with a bad signature is ignored. Checkout re-prices from the DB (ADR-015); the cookie is never trusted for prices.

## ADR-023 — Variant options as `option1..3` · Accepted
Fashion variants need at most three axes (size, colour, fit/material). Variants carry `option1..3` values plus product-level option names,
which keeps filters, CSV import/export and uniqueness constraints simple. Swatch colours live in `variant_option_values`.

## ADR-024 — Theme config as versioned JSON + section registry · Accepted
A theme is `{ tokens, header, productCard, layout: {header, footer}, templates: {home, collection, product} }` where each list is
`SectionInstance[]` (`{id, type, settings, blocks?, visibility}`) over 23 section types. `SECTION_DEFINITIONS` describes each type's
editor fields; the storefront `REGISTRY` maps type → server component. Configs are zod-validated on save; unknown types are dropped at
render. Drafts use optimistic concurrency (`updated_at` base, explicit force); publish copies the draft into an immutable version (ADR-017).

## ADR-025 — Postgres-backed rate limiting · Accepted
`public.svc_rate_limit(key, limit, window_seconds)` (fixed window, `security definer`, executable by service_role only) is called by `lib/rate-limit.ts`
from server actions. Works on any host without Redis; edge rules (Cloudflare) can be added in front later.

## ADR-026 — `typedRoutes` off · Accepted
Dynamic hrefs built from data (store hosts, slugs, admin filters) made `typedRoutes` noisy without catching real bugs. Route params and
page props stay typed via `next typegen` (`PageProps<"/route">`, `LayoutProps`).

## ADR-027 — Support access is read-only and time-boxed · Accepted
Platform staff never impersonate a user. `start_support_session(tenant, reason, minutes)` (reason ≥ 10 chars, 15–240 min, audited in the
store's log) lets `app.has_permission` grant the **viewer** permission set for that tenant until expiry. The support view reads through the
staff member's own RLS session; there are no write paths. Ending or expiry removes access immediately.

## ADR-028 — Marketing site on the platform host · Accepted
Route group `src/app/(marketing)` (`/`, `/pricing`, `/features`, `/privacy`, `/terms`, `/og`). Pricing reads active `plans` with the anon
client (RLS `plans_public_select`), revalidated hourly, falling back to `FALLBACK_PLANS` if the database is unreachable. Demo content is
fictional and labelled as such.

## ADR-029 — Edge Worker for custom domains · Accepted
`workers/domain-router` fronts Cloudflare for SaaS custom hostnames: strips client `x-paliya-*` headers, adds the signed host (ADR-007),
proxies to `ORIGIN_URL`, maps origin-host redirects back to the customer host and strips `x-middleware-rewrite`. It holds no tenant data.


## ADR-030 — Per-store integrations in one encrypted table · Accepted
Payment, shipping, tracking and social connections live in `tenant_integrations` (one row per store + provider). Secrets are a single AES-256-GCM JSON blob; public settings sit in `public_config`. The table has RLS enabled with no policies, so only server code with the secret key (ADR-006) reads it, always with a server-resolved tenant id after a permission check. Status is set only by a real provider test or OAuth result (`not_connected | connected | error | expired | disabled`), and a provider can be enabled only when connected. Replaces `tenant_payment_settings` (migrated) and the platform-level Shiprocket env credentials.

## ADR-031 — Theme marketplace as style presets · Accepted
Marketplace themes are presets (tokens, layout, per-section style settings) applied onto the store's existing config as a draft. Content is kept, style is replaced, then the store publishes through the normal publish/rollback flow. We chose this over copying whole demo configs, which would inject another store's text and images, and over separate theme codebases, which would multiply renderer maintenance.

## ADR-032 — One SVG renderer for creative preview and output · Accepted
Creative templates are data (layers + fields) rendered by one pure function to SVG: in the browser for preview, and rasterised with sharp on the server for the saved PNG. Standard serif/sans fonts are used in both, so output matches preview without shipping font files to the renderer.

## ADR-033 — Super admin "Log in as store" · Accepted (amends ADR-027)
Requested by the platform owner (2026-10-11): super admins can sign in **as** a store member (the owner by default) to fix things
on the seller's behalf. Read-only support sessions (ADR-027) stay the default for support staff; this path is limited to the
`super_admin` role with `platform.tenants.manage`, needs a written reason, and is audited in the store's log
(`support.signed_in_as_member` / `support.signed_out_of_member`) before the session switches. Mechanism: Admin API magic-link
hash → `verifyOtp` on the server, so no email is sent and no password is seen. A signed, httpOnly `bb_support_login` cookie
(2 h) drives a dashboard banner naming the admin, with "End support sign-in" (signs out, back to `/admin/login`). Platform staff
accounts can never be targeted (refused if the target has a `platform_memberships` row). Same guards apply to password resets
(reset link for `platform.tenants.manage`; setting a password directly is super admin only; passwords are never logged or emailed).

## ADR-034 — Auth emails through Resend via the Supabase Send Email hook · Accepted
Instead of Supabase's mailer (or SMTP), Supabase calls `POST /api/auth/email-hook` (Standard Webhooks signature,
`SEND_EMAIL_HOOK_SECRET`). We build the token-hash link on the callback that started the flow (platform `/auth/callback`
or the store's `/account/auth/callback`, both accept `token_hash`), only for hosts we serve (platform or a verified store
host; anything else falls back to `/auth/confirm`), brand it (store name/logo for shoppers, platform for sellers) and send it
through `sendEmail()` (Resend, `email_log`, idempotency). If Resend is not configured the hook logs that the message
was not delivered and returns success, so Auth can finish creating the user. A real Resend failure still returns
an error so the user is not left waiting for mail that failed to send.

## ADR-035 — Unsplash photos in the media library are imported copies · Accepted
The media picker hands callers storage paths (`tenant/{id}/media/…`), and every image field resolves them with
`assetUrl()`, which only accepts store paths. So a seller's "use this Unsplash photo" imports a copy (≤ 2000 px JPEG from
images.unsplash.com) into the store's own library with the member's session (Storage + `media_assets` RLS, no admin client),
instead of teaching every consumer about external URLs. The Unsplash License allows this. API-guideline duties are kept:
browsing hotlinks images.unsplash.com thumbnails with "Photo by X on Unsplash" links (UTM), each import or super-admin "Copy URL"
calls the photo's `download_location`, the photo is looked up by id server-side (never a URL from the browser), and the credit
goes into the copy's alt text and file name. The API key stays server-side; searches go through Next's fetch cache and a
per-store rate limit (the API's demo tier is 50 requests/hour).

## ADR-036 — In-app notifications: per-recipient rows written by DB triggers · Accepted
The bell (seller dashboard + super admin console) reads `public.notifications`, one row per recipient. Producers are
`AFTER` triggers on the tables where events already happen (orders, returns, inventory_levels, reviews, customers, carts,
domains, ai_generations, plan_requests, profiles, tenants, stores), fanning out through `app.notify_tenant` /
`app.notify_platform` to members whose role (system or custom) grants the event's permission, minus the actor and users who
muted the type. Triggers catch every code path (storefront RPCs, verified webhooks, dashboard actions) without the
secret-key client, and each producer swallows its own errors so a notification can never roll back the business write.
Rows are deduped by `(user_id, dedupe_key)`. RLS: own rows only, while still a member; clients may update `read_at` only.
Time-based reminders (trial ending) and retention run in `notifications_run_reminders()` from the notifications cron
(service role). Platform events without a table yet (APK requests, disputes, payout failures) go through
`notifyPlatform()` → `notify_platform_event()` (service role, after the caller verified the event). Live updates use
Supabase Realtime on the user's rows with a 60 s polling fallback. Chosen over a shared row + per-user read table (more
complex RLS and Realtime filtering) and over app-level `emit()` calls (misses SQL-only paths such as `place_order`).

## ADR-037 — Custom marketplace themes: AI from a reference, stored in `public.themes` · Proposed
Super Admin → Themes creates marketplace themes from a reference URL and/or screenshots. The output is the existing
marketplace **preset** (tokens + chrome + home composition with the layout-variant vocabulary), not a store ThemeConfig, so
applying it reuses `applyThemePreset` and keeps each seller's content. Custom themes live in `public.themes` (migration 1500,
extended by 3100): `config` holds the theme document, `active` = published; RLS already limits writes and drafts to
`platform.settings.manage`. Built-in themes stay in code and always win a key clash. The reference page is fetched by an
SSRF guard (https, port 443, public addresses checked inside the socket lookup, 3 checked redirects, 8 s / 1.5 MB caps) and
reduced to a summary with no page text, logos or image URLs; screenshots go only to the AI request and are not stored. The
model is told to recreate the look, never content; its JSON is repaired (unknown sections/settings dropped, values clamped,
hero + product list guaranteed), strictly validated (zod + "applies to a store config"), regenerated once with the issues if
still invalid, and every image slot is filled from Unsplash with credits. The existing LLM client gained optional image
parts (Anthropic, Gemini; Groq stays text-only and is tried last when screenshots are attached). Rate limit: 6/hour,
30/day per platform user. Chosen over a new table (the reserved one fits) and over storing reference screenshots (copyright,
storage) or scraping reference images (never allowed).

## ADR-038 — Sarvam voice onboarding (Tara) → ready draft store · Accepted
**Context.** Sellers need a multi-language path from account → business facts → a draft store with
starter catalogue and a curated theme, without forcing theme/plan wizard steps.
**Decision.** Keep Google **or** name/email/password signup; require `email_confirmed_at` (or OAuth
identity) before `/onboarding` voice or `create_tenant`. Persist `onboarding_locale` on user
metadata. Tara (`voiceTurnAction`) uses server-only Sarvam STT/chat/TTS with a locale capability
map (`SARVAM_LOCALES`): STT-only languages chat in English then translate; TTS omitted when Bulbul
does not support the locale. After confirm, `saveBusinessAction` → `seedReadyStore` applies the
industry best-fit marketplace theme and seeds content; Ready is the default landing (theme/plan
optional via “Change theme”). Pre-tenant voice is rate-limited by user; AI credits debit on seed.
**Consequences.** `SARVAM_API_KEY` required for voice; form path works without it. Theme/plan are no
longer required onboarding steps.

## ADR-039 — Cache-first start journey · Accepted
**Context.** The Pictocart prototype collects language, intent, business facts, and manual setup
choices before account creation; sellers expect to resume after OAuth or email confirmation.
**Decision.** Public **`/start`** stores the journey in **`localStorage`** (`pictocart.start.draft.v1`)
and sets cookie **`pc_start_draft=1`** after welcome. **`finalizeStartDraftAction`** runs only after
verified auth (Google or email/password), creates or reuses the owned tenant, applies optional
payment/WhatsApp/city prefs, then **`seedReadyStore`** with a seller brief. Pre-auth Tara uses
**`startVoiceTurnAction`** (IP rate limit) sharing **`runTaraTurn`** with post-auth voice.
**Consequences.** Logged-in users without the cookie still redirect to the dashboard; with the
cookie they can finish on `/start`. `SARVAM_API_KEY` still required for voice; manual path works
without it.

## ADR-040 — One sign-in page; the account picks the panel · Accepted
Sellers and platform staff sign in at `/login` (`/seller/login` renders it too; `/admin/login` redirects). After sign-in, `lib/auth/role-routing.ts` sends active platform staff to `/admin`, store members to `/dashboard`, and others to onboarding, using the user's own membership rows (RLS), never the URL or a form field. A requested `next` is honoured only for a panel the account can use. Console access is still enforced by `requirePlatform` (404 otherwise), so the shared page reveals nothing. Accounts with both get a panel switch in the sidebar.
