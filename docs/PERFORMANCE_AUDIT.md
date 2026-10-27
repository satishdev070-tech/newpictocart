# Performance audit — intermittent slow page loads (2026-10-27)

Steps 1–3: measured audit. Steps 4–5: P0 and zod fixes applied and re-measured (see "Step 4–5").

## How this was measured

- Production build (`pnpm build`, Next 16.3.6 Turbopack) served with `next start` on `:3100`.
- Local Supabase (seed data: tenant *Aangan*, `aangan.localhost`), reached through a logging reverse
  proxy that records every Supabase HTTP call (path, start/end, duration) and can add a fixed delay
  per call. **0 ms** = raw local; **25 ms** = a realistic same-region Vercel → Supabase round trip.
- "Waves" = number of non-overlapping groups of Supabase calls, i.e. the sequential depth on the
  critical path. TTFB ≈ waves × round-trip + render.
- Signed-in runs use real sessions for the seeded owner (`owner@aangan.test`) and shopper.
- RLS cost measured with `EXPLAIN ANALYZE` inside `begin read only` as role `authenticated`.
- Not measured here (needs the deployed app): real LCP/INP, Vercel cold-start frequency, the
  production project's JWT signing mode and data volumes. See "Next measurements".

## Measurements

### Warm requests (same process, data cache populated)

| Route | Supabase calls | Waves | TTFB @0 ms | TTFB @25 ms |
|---|---:|---:|---:|---:|
| Storefront `/` (anonymous) | 23 | 6–7 | 88–93 ms | 227–251 ms |
| Storefront `/` (signed-in shopper) | 25 | 5–6 | 72–80 ms | 234–250 ms |
| Storefront `/products/[slug]` | 20 | 8 | 72 ms | 236–239 ms |
| Storefront `/collections` | 11 | 6 | 75–87 ms | — |
| Storefront `/search?q=` | 15 | 7 | 58–61 ms | — |
| Dashboard `/dashboard` | 23 | 4 | 100–126 ms | 193–195 ms |
| Dashboard `/dashboard/products` | 16 | 3 | 80–274 ms | 192–244 ms |
| Dashboard `/dashboard/orders` | 10 | 3 | 93–184 ms | — |
| Dashboard `/dashboard/theme` | 26 | 5–6 | 102–114 ms | 167–209 ms |

Adding 25 ms per call adds ~150 ms to storefront TTFB: the cost tracks **waves**, not call count.
At 60–80 ms per call (cross-region, or an Auth `getUser` round trip) the same pages pass 500 ms
before any rendering.

### Cold vs warm (fresh `next start` process, 25 ms per call)

| Route | Cold TTFB | Calls / waves (cold) | Warm TTFB | Calls / waves (warm) |
|---|---:|---:|---:|---:|
| Storefront `/` | **1,113–1,487 ms** | 31 / 10–11 | 230–250 ms | 23 / 6 |
| Dashboard `/dashboard` | **756 ms** | 26 / 5 (2 Auth JWKS fetches) | 195 ms | 23 / 4 |

The very first request after the build was **2,510 ms** (0 ms DB latency). A cold request is 4–6×
slower than a warm one. On Vercel every new function instance starts cold, with its own in-memory
caches. This is the main source of the "sometimes fast, sometimes several seconds" pattern.

### RLS

- Staff policies call `app.has_tenant_permission(tenant_id, …)` with a column argument, so it runs
  per row (it appears in the scan's `Filter`, not as an `InitPlan`). Products count for 6 rows:
  11.7 ms and 350 buffer hits when cold.
- Synthetic test with 10,000 rows: the per-row check costs ~3 ms warm (~55 ms on the first call).
  A single hoisted check costs ~0.4 ms.
- At current data sizes RLS is **not** a primary bottleneck. It becomes one for count/list queries
  on tenants with tens of thousands of rows (orders, products, notifications).

## Root causes (ranked by measured impact)

### P0-1 Cold instances re-run everything: no shared cache, sequential waves, JWKS fetch
- Cold storefront: +8 Supabase calls, +4–5 waves, plus module init. Result: 1.1–1.5 s vs 0.23 s.
- `cachedStorefront` (`src/lib/cache/storefront.ts`) uses `unstable_cache` with a 120 s revalidate.
  After a revalidate window, or on a new instance before the shared Data Cache answers, the
  directory, profile, theme, features and launch lookups all hit the DB again. The directory lookup
  is two sequential admin queries (`src/lib/tenant/directory.ts:35,48`).
- A cold dashboard fetches `/.well-known/jwks.json` twice, sequentially: once in the proxy runtime
  and once in the server runtime (75 ms + 28 ms).

### P0-2 Any merchant's save evicts every store's host directory
- `revalidateStorefront()` always calls `revalidateTag(TENANT_DIRECTORY_TAG, { expire: 0 })`
  (`src/lib/cache/storefront.ts:43`). TENANT_DIRECTORY_TAG is shared by every host entry.
- It is called from about 30 actions: store settings, SEO, COD, festive, theme publish/rollback,
  launch, domains, billing, onboarding.
- So whenever one seller saves, the next request to **every** store pays the uncached 2-query
  directory lookup. More active merchants means more frequent random slow requests.
- Fix: invalidate only `host:<host>` / `tenant:<id>` entries, and only from domain, status and
  name changes.

### P0-3 Storefront work that is uncached and sequential on every request
Calls seen on **every** warm storefront home request:
- `stores.site_mode` read with no cache at all (`src/features/stores/site-mode-server.ts:14`).
  It runs first, before everything else.
- Menus: menus → menu_items → slug lookups, 3 sequential waves, React-cache only
  (`src/features/storefront/server/content.ts:28-47`).
- Tracking: `loadIntegration` ×3 using the admin client, **decrypting secrets** just to read public
  IDs, then `getEntitlements` (3 more admin queries)
  (`src/features/integrations/server/store.ts:85-107`).
- Festive and tracking are awaited one after the other, *after* `getRenderContext`
  (`src/app/store/[host]/layout.tsx:83-84`). That is 2–3 extra waves on every store page.
- `platform_app_credentials` (Unsplash key) is read per request, React-cache only
  (`src/features/media/unsplash/key.ts:12`).
- Review summary downloads up to **5,000 rating rows** to compute an average
  (`src/features/storefront/server/content.ts:209-210`). It is called by the reviews section.
- The `stores` row is read 5 separate times per request: profile, launch_status, site_mode,
  festive, category.
- `catalog.ts` (product, category, collection, listings, facets) has no cross-request cache. The
  product page runs about 8 waves: `getProductBySlug` waits for the full render context, and the
  wishlist read runs after the `Promise.all`.

### P1-4 Dashboard: four sequential waves before any page code
- Proxy `getClaims` → `getSessionUser` (`getClaims` + `profiles`) → `listMemberships` → layout
  `stores.site_mode` (`src/app/dashboard/layout.tsx:54`, outside the `Promise.all`) → the layout
  batch → the page batch.
- Dashboard home issues 23 calls. The same `stores` row is read 3 times. The "to fulfil" count
  query is duplicated (`alerts.ts:17` and `analytics/home.ts:52`).
- **Production risk:** `auth-js` 2.117 `getClaims()` falls back to a network `getUser()` when the
  JWT is HS256 or has no `kid`. If the production project still uses the legacy JWT secret, every
  signed-in request pays **2 Auth round trips** (proxy + server). Locally the tokens are asymmetric
  (0 Auth calls when warm). This needs checking in Supabase → Auth → JWT signing keys.

### P1-5 Third-party and other slow calls inside render
- `settings/notifications` calls the WhatsApp Graph API during render
  (`src/app/dashboard/settings/notifications/page.tsx:24-26`).
- Checkout does about 6 waves, including a network `auth.getUser()` (`withIdentityName`,
  `checkout/page.tsx:31`).
- Cart awaits the quote and then the recommendations, although they are independent
  (`cart/page.tsx:25-30`).

### P2-6 RLS per-row permission functions (scales with data)
- See the RLS measurements above. Ways to fix it without weakening policies:
  - add `tenant_id = any(app.my_tenant_ids())` style initPlan-friendly predicates, or
  - wrap the helper in a `(select …)` with a constant tenant argument where possible.
- Also add an index on `orders (tenant_id, placed_at desc)`. "Recent orders" sorts by `placed_at`,
  but only `(tenant_id, created_at desc)` exists today.

### Client side
First-load JS from the production build (gzip measured with `gzip -c | wc -c`):

| Route | Raw | Gzip |
|---|---:|---:|
| Marketing home | 941 KB | 261 KB |
| Storefront home | 1,049 KB | 290 KB |
| Product page | 1,068 KB | 297 KB |
| Dashboard home | 1,181 KB | 320 KB |
| `/dashboard/theme` (site builder) | 1,603 KB | 451 KB |

- **P1 — zod reaches every shopper (391 KB raw / ~90 KB gzip, about 31% of storefront JS).**
  - The import chain is client components → `src/lib/storage/assets.ts` → `@/lib/env/public` →
    `src/lib/env/schema.ts` (zod).
  - Zod is only used there to validate `NEXT_PUBLIC_*` values.
  - Fix: a zod-free public env reader for client code.
- **P1 — store images take an extra hop.**
  - The custom loader sends each image to `/api/img`, which issues a 308 redirect to Storage
    (`src/lib/images/loader.ts:17`, `src/app/api/img/route.ts:32-36`).
  - When a size variant is missing, the request itself does the HEAD, fetch, sharp resize and
    upload (`src/lib/storage/variants-server.ts:47-54`).
  - First-visit LCP images pay for a function call plus the redirect.
  - Fix: emit the variant URL directly once the variant exists (generate variants at upload).
- **P2 — dashboard repeat requests.**
  - The notification bell polls a server action every 60 s on top of its realtime channel
    (`use-live-notifications.ts:6,39`).
  - The inbox calls `router.refresh()` on an interval, which re-runs every layout query.
- **P2 — only one `dynamic()` import in the codebase.**
  - `SiteBuilder`, `CreativeStudio` and `RevenueChart` are imported statically.
- Already fine:
  - The LCP hero uses `priority`, and `sizes` is set.
  - Tracking scripts use `afterInteractive` inside `<Suspense>`.
  - All 26 storefront fonts are `preload: false`.

## Step 4–5: fixes applied and re-measured (P0 + zod)

### Changes
| Fix | Files |
|---|---|
| Directory split into host → tenant (domain-change tag only) and tenant identity (tenant tag). `revalidateStorefront` no longer evicts every store. New `revalidateTenantDirectory()` called from domain actions. | `src/lib/tenant/directory.ts`, `src/lib/cache/storefront.ts`, `src/features/domains/actions.ts`, `src/features/platform/actions.ts` |
| `getStoreSiteMode` cached per tenant | `src/features/stores/site-mode-server.ts` |
| Tracking tags: one cached query, public IDs only (no secret decryption). Integration actions revalidate the tenant. | `src/features/tracking/server/config.ts`, `src/features/integrations/server/store.ts`, `src/features/integrations/actions.ts` |
| Menus + items in one embedded query (3 → 2 waves) | `src/features/storefront/server/content.ts` |
| Store layout: draft check, render context, festive, tracking in one `Promise.all` | `src/app/store/[host]/layout.tsx` |
| Product page: product loads alongside the render context; wishlist chained on the customer | `src/app/store/[host]/products/[slug]/page.tsx` |
| Zod-free public env parser (parity-tested against the zod schema) | `src/lib/env/public-parse.ts`, `src/lib/env/public.ts`, `src/lib/env/schema.ts` |
| Builder `CanvasBridge` lazy-loaded (only used in the builder preview) | `src/features/theme/site-builder/canvas/canvas-bridge-lazy.tsx`, `src/app/store/[host]/layout.tsx` |

### Before / after (same harness, 25 ms per Supabase call)

The base commit and the change were built separately and run alternately on the same port.
Values are medians.

| Measurement | Before | After |
|---|---:|---:|
| Warm storefront `/` TTFB (n=6) | 257 ms | **159 ms** (−38%) |
| Warm storefront `/` Supabase calls / waves | 23 / 6 | **18 / 4** |
| Warm product page TTFB (n=6) | 253 ms | **134 ms** (−47%) |
| Warm product page calls / waves | 20 / 8 | **15 / 4** |
| Cold storefront `/` TTFB (fresh process + empty data cache, n=3) | 840 ms | 893 ms (no measurable change) |
| Cold dashboard TTFB (n=3) | 351 ms | 329 ms (no change expected; dashboard untouched) |
| First-load JS storefront `/` (gzip) | 329 KB | **205 KB** (−38%) |
| First-load JS product page (gzip) | 335 KB | **212 KB** |
| First-load JS `/dashboard` (gzip) | 359 KB | **270 KB** |
| First-load JS marketing `/`, `/dashboard/theme` | 299 / 490 KB | 299 / 489 KB (still include zod) |

These JS sizes count the chunks named in each page's HTML. The agent's earlier table used a
different method, so its numbers are lower.

Rendered links and text are byte-identical before and after on `/`, `/products/[slug]`,
`/collections` and `/search`.

**Not measured live:** the P0-2 effect (one store's save evicting other stores). It needs a server
action from a second seller. The behaviour is covered by `tests/unit/storefront-cache.test.ts`,
and it only matters in production with many active merchants.

**Cold starts did not improve.** A fresh process spends ~600 ms on start-up and compilation, and a
data-cache miss still runs host → tenant → loaders in sequence. Vercel Fluid compute (keeps
instances warm) and the remaining P1 items are the next levers.

## Database changes proposed (not applied)
1. `create index concurrently orders_tenant_placed_idx on orders (tenant_id, placed_at desc) where status <> 'pending';`
2. `create index concurrently returns_tenant_status_idx on returns (tenant_id, status);` for the
   dashboard alert count.
3. RPC `storefront_review_summary(p_tenant)` returning `avg`/`count`, replacing the 5,000-row
   download.
4. Later, once data volume justifies it: initPlan-friendly RLS for staff read policies on orders,
   products and customers. Benchmark with `EXPLAIN ANALYZE` on a production-sized copy first.

## Remaining issues (not done yet)
1. Dashboard: `site_mode` sits outside the layout `Promise.all`, and the home page duplicates
   counts (P1-4). Every seller page has 4 sequential waves.
2. Confirm the production JWT signing mode. Migrate to asymmetric keys if it is still HS256 (P1-4).
3. Review summary still downloads up to 5,000 rows. It needs DB change 3 (an RPC).
4. The Unsplash credential (`platform_app_credentials`) is still read and decrypted on every
   storefront request (React cache only).
5. Cart, checkout and settings/notifications waterfalls (P1-5). Catalog reads have no
   cross-request cache.
6. Client side:
   - Marketing pages still ship zod: `landing.ts` is reached via `landing-icons.tsx`, and
     `plans.ts` via the pricing table.
   - The `/api/img` 308 hop.
   - Notification bell polling on top of realtime.
   - `SiteBuilder` and `CreativeStudio` are not lazy-loaded.
7. Cold starts (see above). Indexes and RLS: DB changes 1, 2 and 4, after approval.

## Next measurements (need the deployed app / production access)
- Vercel: function region and cold-start rate per route (Observability → Functions); check the
  Supabase region matches `bom1`.
- Real-user Web Vitals (LCP/INP/TTFB) per route. Add `useReportWebVitals` or Vercel Speed Insights.
- Supabase: `pg_stat_statements` top queries by total time; row counts of the largest tenants;
  Auth JWT signing mode.

## Not covered locally
Three recent migrations (size charts, discount offers, team roles) are not applied to the local DB,
so routes that depend on those tables were not timed.
