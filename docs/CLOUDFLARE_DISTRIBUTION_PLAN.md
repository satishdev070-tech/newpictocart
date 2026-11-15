# Cloudflare distribution plan (staging + multi-Worker production)

_Status: proposed 2026-11-14. Nothing in this plan has been executed yet._

## Owner decisions (2026-11-14)

| Decision | Choice | Consequence for this plan |
|---|---|---|
| Staging database | **Share production Supabase** (`STAGING_SHARES_PRODUCTION_DATABASE=true`) | Staging is isolated at the Worker/KV/secret level only. Staging **never** runs crons, never receives payment/WhatsApp webhooks, and is used with test stores only. `APP_SECRET` must equal production's (DB ciphertext such as Admin → Email credentials is encrypted with it). |
| Workers plan | **Stay on Free** for now | Error 1102 stays possible (10 ms CPU). No Cron Triggers: schedules run from a GitHub Actions `schedule` workflow calling production `/api/cron/*` (min interval 5 min, best-effort timing). Free = 100k requests/day **per account**, shared by every Worker; splitting does not add quota. Upgrading later only flips phase 2.1/2.2 on. |
| Token access | Local gitignored `.env.cloudflare.local` | Read by commands without printing; deleted by the owner after the rollout. |


## Where we are today

| Item | State (verified 2026-11-14) |
|---|---|
| Production | One Worker `pictocart` serves **everything**: `pictocart.in`, `www`, `*.pictocart.in`, and the canary aliases `pictocartdev.in` / `www.pictocartdev.in`. Live commit `5b33760` (= `main`), `/api/health/ready` ok. |
| Staging | Does not exist. `Deploy staging` has failed at preflight on every merge because no `STAGING_*` secrets/KV exist. `pictocartdev.in` points at **production** (same DB). |
| Plan | Workers **Free**: 10 ms CPU per request → intermittent **Error 1102**; no Cron Triggers. |
| Crons | 7 `/api/cron/*` endpoints exist; nothing calls them on a schedule (the `vercel.json` crons are dead). Unpaid online orders hold stock until someone calls `expire-orders`. |
| Pipeline | `ci.yml` → `deploy-staging.yml` (auto) → `deploy-production.yml` (manual, typed confirm) → `deploy-worker.yml` (build, secrets, deploy, verify, auto-rollback). Good foundation; reused, not replaced. |
| GitHub secrets | Repo-level: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `APP_SECRET`, `CRON_SECRET`, Supabase ×3, `PLATFORM_HOST_ALIASES`, `FEATURE_INFORMATIVE_WEBSITE`. No `EMAIL_FROM` / `RESEND_API_KEY` / `GOOGLE_IDENTITY_SIGNIN` / `EDGE_SHARED_SECRET` at repo level (must be checked against the live Worker before any deploy, because `--secrets-file` **replaces** secrets). |

## Phase 0 results (2026-11-14, read-only)

| Item | Found |
|---|---|
| Account | Airy Fact, Workers **Free**, workers.dev subdomain `airy-fact` |
| Zones | `pictocart.in`, `pictocartdev.in`: both active, Free plan |
| Workers | only `pictocart` (no `pictocart-domain-router` deployed); no cron schedules; **Workers Logs/observability off**; no CPU limit |
| Custom Domains | `pictocart.in`, `www.pictocart.in`, `pictocartdev.in`, `www.pictocartdev.in` → `pictocart` |
| Routes | `pictocart.in/*`, `www.pictocart.in/*`, `*.pictocart.in/*` → `pictocart`; none on `pictocartdev.in` |
| DNS | `AAAA 100::` proxied for apex, www, `*` (prod); apex/www only (dev); mail = Hostinger MX + Resend DKIM |
| KV | `pictocart-vinext-kv-cache` (prod) only |
| Worker secrets | APP_SECRET, CRON_SECRET, DEPLOY_COMMIT_SHA, DEPLOY_ENVIRONMENT, EMAIL_FROM, FEATURE_INFORMATIVE_WEBSITE, GOOGLE_IDENTITY_SIGNIN, NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN, NEXT_PUBLIC_PLATFORM_URL, NEXT_PUBLIC_SUPABASE_*, PLATFORM_HOST_ALIASES, SUPABASE_SECRET_KEY, WORKERS_DEV_HOST |
| **Cloudflare for SaaS** | **Not enabled** on either zone, and the Worker has no `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID`. Seller custom domains cannot currently be provisioned in production. Owner action: SSL/TLS → Custom Hostnames → enable (first 100 hostnames free). |
| API token `pictocart-gha-deploy` | Valid, no expiry, no IP filter, **all** account + zone permissions including Billing, API Tokens, Memberships and Account Settings **Write**. Covers the whole plan; far broader than needed (see Token permissions). |

Backups: `/Users/macbookair/newpictocart/.cf-backups/20261114-183253/` (DNS BIND exports, routes,
Custom Domains, zone settings, Worker settings without secret values, deployments, versions, KV list).
Rollback target for production: version `e4f6bc29` (commit `5b33760`).

## Phase 1 progress (2026-11-14)

| Step | Status |
|---|---|
| KV `pictocart-staging-cache` | ✅ created, id `5291a451efdd4ccaae0a719ad3179321` |
| GitHub environment `staging` (deploys from `main` only) | ✅ |
| Variables `STAGING_KV_NAMESPACE_ID`, `STAGING_SHARES_PRODUCTION_DATABASE=true` | ✅ |
| `STAGING_CRON_SECRET` (fresh, distinct from production) | ✅ |
| `STAGING_NEXT_PUBLIC_SUPABASE_URL` (production project, public value) | ✅ |
| `STAGING_APP_SECRET`, `STAGING_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `STAGING_SUPABASE_SECRET_KEY`, `STAGING_FEATURE_INFORMATIVE_WEBSITE` | ✅ set by owner (production values) |
| Production gap: `GOOGLE_IDENTITY_SIGNIN` missing from GitHub | ✅ added by owner |
| Gate: every name the `Deploy staging` preflight checks is present | ✅ (checked by name; the first real run is phase 3) |
| `production` environment required reviewer, branch ruleset | deferred, needs owner OK (changes how merges/deploys are approved) |

**Shared-database guard (must hold until staging has its own DB):** no `*.pictocartdev.in` route or
wildcard DNS, so real stores are not reachable through staging; staging gets no cron schedule and
no payment/WhatsApp webhooks.

## Target topology

One build per commit (`pnpm build:vinext`), deployed as several Workers. Every app Worker carries the
**whole** app, so no module can go missing on any host. Distribution happens at the edge (domains
and routes), not by deleting code. That is the guarantee that existing modules keep working.

```
                         ┌──────────────── production (zone pictocart.in) ────────────────┐
 pictocart.in, www  ───► │ pictocart            (role=platform)  existing Worker, kept     │
                         │   marketing · login/signup · /start · /onboarding · /dashboard │
                         │   /admin · /informative panel · /partner · /invite · /print    │
                         │   /api/auth · /api/oauth · /api/webhooks/platform/* · /api/cron │
 *.pictocart.in/*   ───► │ pictocart-storefront (role=storefront) NEW                      │
 custom domains (SaaS)─► │   /store/[host]/* · store webhooks (razorpay/cashfree/payu)     │
                         │   /api/img · /api/analytics/pageview · search/suggest · sitemap │
                         │ pictocart-cron       (scheduled) NEW, ~50 lines, no app code    │
                         │   service binding → pictocart /api/cron/* with CRON_SECRET      │
                         └─────────────────────────────────────────────────────────────────┘
                         staging (zone pictocartdev.in): the same three, suffixed -staging,
                         own Supabase project, own KV, own secrets.
```

| Worker | Hosts | Shared with | Why separate |
|---|---|---|---|
| `pictocart` (platform) | apex, `www` (Custom Domains) | KV `VINEXT_KV_CACHE` (prod) | Seller/admin cold starts and heavy pages (theme editor, admin) no longer compete with shopper traffic; independent rollback. |
| `pictocart-storefront` | `*.pictocart.in/*` route + Cloudflare for SaaS fallback for custom domains | same KV namespace (cache invalidation from the dashboard must reach storefronts) | Shopper isolates stay warm; can be rolled back alone; its own CPU limit, logs and alerts. |
| `pictocart-cron` | none (scheduled) | service binding to `pictocart` | Replaces the missing schedules without touching app code. |
| `pictocart-domain-router` (legacy, Hostinger era) | decide in phase 0 | — | Retired if not attached to any route; otherwise replaced by SaaS → storefront Worker directly. |

Cron schedule (cron Worker on Paid; until then `.github/workflows/cron.yml`, production only): `*/5` expire-orders + notifications · `*/15` social-publish ·
hourly domains · daily gbp-reviews + observability · after every deploy preview-token-self-test
(already in `deploy-worker.yml`).

## Phases

Each phase ends with a gate. Production is only touched in phases 5–6, one route at a time, each
with a tested rollback.

### Phase 0: Access, inventory and backups (read-only)
1. Verify the API token and its permission groups (see "Token permissions").
2. Inventory: Workers, versions, deployments, routes, Custom Domains, KV namespaces, Cloudflare for
   SaaS custom hostnames + fallback origin, DNS for both zones, zone settings, WAF/rate-limit rules,
   cache rules, Worker secret **names** on `pictocart`, plan/subscription.
3. Backups: export both zones' DNS (BIND), record the active version id of every Worker, record
   the route/domain table. Stored outside git (contains no secrets, but is ops data).
4. Gate: the inventory matches this document, or the plan is amended before phase 1.

### Phase 1: Foundations (no traffic change)
1. **Workers Paid** ($5/mo): deferred by the owner. Until then: GitHub Actions cron workflow.
2. Staging database: shared with production (`STAGING_SHARES_PRODUCTION_DATABASE=true`). Staging
   secrets reuse production's Supabase + `APP_SECRET`; `STAGING_CRON_SECRET` is distinct and is never
   given to any scheduler.
3. KV namespaces `pictocart-staging-cache`; set `STAGING_KV_NAMESPACE_ID`.
4. GitHub: environments `staging` / `production` (required reviewer on production), all `STAGING_*`
   secrets with fresh values, and every optional production secret the live Worker actually has
   (`EMAIL_FROM`, `GOOGLE_IDENTITY_SIGNIN`, `EDGE_SHARED_SECRET`, …) so `--secrets-file` cannot wipe them.
5. Branch ruleset on `main` (`docs/CI_CD.md` → Branch protection).
6. Gate: `Deploy staging` preflight passes.

### Phase 2: Code changes for multi-Worker (one PR, behaviour-neutral)
1. `cloudflare.config.ts`: `CF_WORKER_ROLE` (`platform` | `storefront`) next to `CF_WORKER_NAME`;
   CPU limit (`limits.cpuMs`) once on Paid; Smart Placement off (Supabase is in one region; test both).
2. `.github/workflows/cron.yml` now (schedule → production `/api/cron/*`, Bearer `CRON_SECRET`,
   alerts on non-200). Later, on Paid: `workers/cron/`, a scheduled Worker (`cloudflare.config.ts` of its own, `triggers.scheduled`,
   service binding `APP` → platform Worker, `CRON_SECRET`), with unit tests for the schedule → path map.
3. `/api/health` adds `role` and `worker` fields (read from env) so verification can prove which
   Worker answered.
4. `deploy-worker.yml`: build once, deploy N Workers from the same output (matrix: platform,
   storefront, cron), verify per host, roll back **all** Workers of the run together if any check fails.
5. `scripts/ci/validate-worker-secrets.mts`: per-role required keys.
6. ~~Retire dead config~~ kept: `vercel.json` is the ADR-011 rollback path; `package-lock.json` is still updated by the owner's local npm use. Revisit after the rollout.
7. Gate: `pnpm check` green, review, merge → staging deploys automatically.

### Phase 3: Staging stack live
1. First staging deploy creates `pictocart-staging`, `pictocart-storefront-staging`, `pictocart-cron-staging`.
2. Move `pictocartdev.in` + `www` from production Worker to `pictocart-staging`; route
   `*.pictocartdev.in/*` + proxied `AAAA * → 100::` to the storefront staging Worker.
3. Remove `pictocartdev.in` from production `PLATFORM_HOST_ALIASES`.
4. Gate: every check in the module matrix below passes on staging.

### Phase 4: Staging soak (48 h)
Real flows on staging: seller signup → onboarding → product → theme publish → storefront →
cart → COD and test-mode online payment → webhook → order email → shipping booking → refund;
cron runs observed in logs; zero 1102/5xx in Workers analytics.

### Phase 5: Production rollout (low-traffic window, one step at a time)
1. Deploy `pictocart-storefront` and `pictocart-cron` with **no routes**; smoke-test via `workers.dev`
   with a signed host header (as the domain router does).
2. Attach `*.pictocart.in/*` to `pictocart-storefront`. Verify 5 real stores + 1 custom domain.
   Rollback = move the route back (seconds).
3. Point the Cloudflare for SaaS fallback / custom hostnames at the storefront Worker. Verify.
4. Enable cron triggers. Verify `expire-orders` and `notifications` in logs.
5. Gate: 24 h with error rate ≤ baseline.

### Phase 6: Edge hardening
WAF rate-limit rules (login, OTP, checkout, webhooks allowlisted), cache rules for `/_next/static`
and images, security-header audit, Health Checks + Notifications (email) on `/api/health/ready`
for both hosts, Workers Logs/Observability on, Logpush optional, token rotation runbook.

### Phase 7: Documentation and handover
Update `DEPLOY_CLOUDFLARE_WORKERS.md`, `CI_CD.md`, `IMPLEMENTATION_STATUS.md`, ADR in `DECISIONS.md`;
runbooks for rollback, secret rotation, adding a custom domain, adding a Worker.

## Module verification matrix (every route in `src/app`)

| Area (`src/app`) | Pages / handlers | Served by | Verification |
|---|---|---|---|
| `(marketing)` | 10 pages, `og`, `themes/[key]/use` | platform | 200 + render check on all 10 |
| `(auth)` + `auth/*` | 7 pages; callback, confirm, store-google ×2 | platform | password + OTP + Google login (seller) |
| `start`, `onboarding` | 5 + 1 | platform | full new-store flow on staging |
| `dashboard` | 72 pages; 5 CSV exports | platform | crawl all 72 as seed seller (200, no error boundary); exports download |
| `admin` | 58 pages; 2 exports | platform | crawl as super admin |
| `informative` | 22 pages; enquiries export | platform | crawl + `informative.spec.ts` e2e |
| `invite`, `partner`, `print` | 1 + 1 + 1 | platform | invite accept, partner page, invoice print |
| `store/[host]` | 30 pages; account callback, pay/payu, pay/return, preview, robots, sitemap, suggest | storefront | `store-regression.spec.ts`, cart → checkout (COD + test online), theme-editor preview iframe |
| `api/webhooks/*` (store) | razorpay, cashfree, payu | storefront (store host) | signed test event → 200 + `webhook_events` row |
| `api/webhooks/platform/*`, `meta`, `whatsapp` | 5 | platform | signed test event / verify challenge |
| `api/cron/*` | 7 | platform (called by cron Worker) | each returns 200 with Bearer; 401 without |
| `api/health`, `health/ready` | 2 | both | `commit`, `role`, `ok` per host |
| `api/img`, `analytics/pageview`, `informative/whatsapp-click`, `geo/reverse` | 4 | both (host-relative) | 200 from a store host and the platform host |
| `api/oauth/*` (social, Google Business) | 4 | platform | start redirects to provider |
| `api/theme/preview-token`, `site-verification/google` | 2 | platform | mint/verify; GSC file served on apex only |
| `api/auth/email-hook` | 1 | platform | Supabase hook signature check |

## Token permissions

Required for this plan (Account = Airy Fact; Zones = `pictocart.in`, `pictocartdev.in`):

| Scope | Permission | Used for |
|---|---|---|
| Account | Workers Scripts: Edit | deploy, versions, rollback, secrets, Custom Domains |
| Account | Workers KV Storage: Edit | staging KV, cache namespace |
| Account | Workers Tail: Read | live logs during rollout |
| Account | Workers Observability: Edit | logs/traces settings, queries |
| Account | Account Settings: Read | account id, plan, subdomain |
| Account | Account Analytics: Read | error-rate gates (1102/5xx) |
| Account | Notifications: Edit | health-check / error alerts |
| Zone | Zone: Read | zone ids |
| Zone | DNS: Edit | `AAAA *` records, backups |
| Zone | Workers Routes: Edit | `*.pictocart.in/*`, `*.pictocartdev.in/*` |
| Zone | SSL and Certificates: Edit | Cloudflare for SaaS custom hostnames + fallback origin |
| Zone | Zone Settings: Edit | cache/security settings |
| Zone | Cache Purge: Purge | post-deploy purge |
| Zone | Zone WAF: Edit (and Firewall Services: Edit) | rate-limit rules |
| Zone | Health Checks: Edit | origin health checks |

Not needed: Billing (the owner upgrades the plan), R2, D1, Pages, Access, user-level scopes.
