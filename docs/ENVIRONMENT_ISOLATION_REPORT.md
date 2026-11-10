# Environment Isolation Report — Pictocart

_Date: 2026-11-10 (Asia/Kolkata) · **Audit / plan only** — no infrastructure changes, no secret values, no deploys._

Companion plans: [`STAGING_ENVIRONMENT_SETUP_PLAN.md`](./STAGING_ENVIRONMENT_SETUP_PLAN.md), [`THEME_EDITOR_E2E_TEST_PLAN.md`](./THEME_EDITOR_E2E_TEST_PLAN.md).  
Verification context: [`PRODUCTION_VERIFICATION_RESULTS.md`](./PRODUCTION_VERIFICATION_RESULTS.md).

---

## 1. Executive verdict

| Question | Answer |
|---|---|
| Are staging and production **truly isolated** today? | **No** |
| What is commonly called “staging” (`pictocartdev.in`)? | A **DNS / host alias** on the **same** Cloudflare Worker and **same** Supabase project as production |
| What is truly isolated today? | **Local** Supabase CLI project (`project_id = newpictocart`) + `*.localhost` storefronts only |
| Can Theme Editor publish/rollback E2E run safely against current “staging”? | **No** — would write production data |

---

## 2. Inventory (names only — no secret values)

### 2.1 Supabase

| Environment | Project / ref | Role | Isolated? |
|---|---|---|---|
| **Production hosted** | `v2pictocart` / `ugbjlpdhktrlkyuijkfc` | Live tenants, Auth, Storage, Edge Functions | Baseline production |
| **Development (local)** | CLI `project_id = newpictocart` (API typically `:54321`) | Seed + RLS tests; `*.localhost` | **Yes** — local only |
| **Staging hosted** | — | — | **Missing** |

Evidence: `docs/DEPLOY_ROOT_PROMOTE.md`, `docs/ARCHITECTURE.md` (one hosted project model), `supabase/config.toml`, `supabase/seed.sql` (“Never run against production”), `docs/PRODUCTION_VERIFICATION_RESULTS.md`.

Local agent `.env.local` (presence audit): `NEXT_PUBLIC_SUPABASE_URL` host = `ugbjlpdhktrlkyuijkfc.supabase.co` while `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN=localhost` — a **hybrid** that talks to **hosted production DB** from a localhost platform root. Dangerous for publish tests.

### 2.2 Cloudflare Workers & routes

| Resource | Name / pattern | Notes |
|---|---|---|
| Production app Worker | `pictocart` (Airy Fact account) | vinext / ADR-011 |
| Custom Domains | `pictocart.in`, `www.pictocart.in`, `pictocartdev.in`, `www.pictocartdev.in` | **Same Worker** |
| Wildcard storefronts | Route `*.pictocart.in/*` + proxied `AAAA * → 100::` | Production stores |
| workers.dev | `pictocart.airy-fact.workers.dev` (default in GHA) | Platform alias via `WORKERS_DEV_HOST` |
| Wrong-account Worker | `newpictocart` (account `8ee184…`) | **Not** production — do not deploy here |
| Legacy | `pictocart-domain-router` | Hostinger / CF-for-SaaS only; not vinext origin |

Evidence: `cloudflare.config.ts`, `docs/DEPLOY_CLOUDFLARE_WORKERS.md`, `.github/workflows/deploy-cloudflare-workers.yml`, ADR-011 in `docs/DECISIONS.md`.

Traffic model (current):

```
pictocart.in / www / *.pictocart.in  → Worker pictocart → Supabase ugbjlpdhktrlkyuijkfc
pictocartdev.in / www                → Worker pictocart → same Supabase
pictocart.<account>.workers.dev      → Worker pictocart → same Supabase
```

### 2.3 Environment variable names & sources

| Source | What it configures |
|---|---|
| Cloudflare Worker secrets / `--secrets-file` | Runtime secrets for `pictocart` |
| GitHub Actions secrets | Same names used by deploy workflow (push deploy **paused**; `workflow_dispatch` only) |
| Local `.env.local` | Dev / hybrid; gitignored |
| `.env.example` | Documented names only |

**Required for Worker deploy secrets file (names):**  
`APP_SECRET`, `CRON_SECRET`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, plus baked `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` / `NEXT_PUBLIC_PLATFORM_URL`.

**GHA-only deploy credentials:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

**Optional / related names:** `PLATFORM_HOST_ALIASES`, `WORKERS_DEV_HOST`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `EMAIL_FROM`, `RESEND_API_KEY`, `EDGE_SHARED_SECRET`, social/AI keys (see `.env.example`).

Incomplete `--secrets-file` **replaces** bindings (wipe risk) — see deploy docs.

### 2.4 Redis / cache namespaces

| Item | Finding |
|---|---|
| Product | Optional Upstash Redis REST (ADR-010) |
| Env names | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (pair; unset = L1-only) |
| Key prefixes | `sf:v1` (storefront), `pub:v1` (public catalogues) |
| TTLs | Storefront ~120s; marketplace demos ~300s |
| Staging Redis | **Missing** as a separate instance |
| GHA secrets file | Does **not** currently upload Upstash keys |

Evidence: `docs/DECISIONS.md` ADR-010, `src/lib/cache/storefront.ts`, `src/lib/cache/public-cache.ts`, `.env.example`.

### 2.5 Authentication callback URLs

| Environment | Documented Auth configuration |
|---|---|
| Production | Site URL `https://www.pictocart.in`; redirects include `https://www.pictocart.in/**`, `https://pictocart.in/**`, `https://*.pictocart.in/**` |
| Canary alias | Same Auth project also allowlists `pictocartdev.in` / `*.pictocartdev.in/**` |
| Local | `http://localhost:3000/**`, `http://*.localhost:3000/**` |
| Google OAuth | Provider redirect `https://<project-ref>.supabase.co/auth/v1/callback`; GIS may keep UX on platform host |

Evidence: `docs/GOOGLE_LOGIN.md`, `docs/DEPLOY_ROOT_PROMOTE.md`, `src/lib/platform/urls.ts` (`authRequestOrigin`).

**Implication:** Auth is **one project** spanning prod + canary hosts — not a staging Auth silo.

### 2.6 Storage buckets

| Bucket | Visibility | Scope today |
|---|---|---|
| `store-assets` | Public (path-keyed) | Same hosted Supabase |
| `private-files` | Private | Same hosted Supabase |
| `platform-branding` | Public | Same hosted Supabase |

Evidence: `src/lib/storage/assets.ts`, migrations / `supabase/setup-all.sql`.

### 2.7 Domain routing (app)

| Mechanism | Behavior |
|---|---|
| `src/proxy.ts` | Host → platform vs storefront rewrite `/store/[host]/…` |
| `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` | Store URLs `{slug}.{root}` |
| `NEXT_PUBLIC_PLATFORM_URL` | Canonical platform origin |
| `PLATFORM_HOST_ALIASES` | Extra exact platform hosts (canary) |
| `WORKERS_DEV_HOST` / `CF_PAGES_URL` | workers.dev as platform |

Evidence: `src/lib/platform/hosts.ts`, `src/lib/platform/urls.ts`, `.env.example`.

### 2.8 Test automation present today

| Kind | Status |
|---|---|
| Vitest unit / RLS | Extensive under `tests/` |
| Playwright browser E2E for Theme Editor | **Missing** (`@playwright/test` installed; used for `pnpm themes:capture` screenshots only) |
| `playwright.config.*` | **None** |

---

## 3. Isolation matrix

| Layer | Prod `pictocart.in` | Canary `pictocartdev.in` | Local `*.localhost` |
|---|---|---|---|
| Cloudflare Worker | `pictocart` | **Same** | N/A (Next/`pnpm dev`) |
| Supabase DB / Auth / Storage | `ugbjlpdhktrlkyuijkfc` | **Same** | Separate CLI project |
| App secrets (`APP_SECRET`, …) | Worker bindings | **Same** | `.env.local` (may accidentally match prod) |
| Redis L2 | Optional shared Upstash | **Same** if set | Usually unset |
| Customer data risk if publish runs | **High** | **High** (same DB) | Low (local seed only) |

---

## 4. What already exists vs missing

### Exists
- Production Worker + domains + hosted Supabase.
- Local Supabase + seed users (`owner@aangan.test`, password documented in `seed.sql` for **local only**).
- Optional Redis L2 design with prefixes.
- Deploy / secrets runbooks.
- Production verification evidence for `mintVerify` + preview **server** path ([`PRODUCTION_VERIFICATION_RESULTS.md`](./PRODUCTION_VERIFICATION_RESULTS.md)).

### Missing for safe Theme Editor E2E
- Dedicated **staging Supabase** project.
- Dedicated **staging Worker** (or separate CF env) pointed only at staging Supabase.
- Staging-only secrets (especially distinct `APP_SECRET` / `CRON_SECRET`).
- Staging Auth Site URL + redirect allowlist.
- Staging Redis instance **or** deliberate L1-only with documented prefixes.
- Staging-only test seller + store (not a production customer tenant).
- Playwright config + Theme Editor E2E suite against staging.

### Misleading “staging”
`DEPLOY_ROOT_PROMOTE.md` calls `pictocartdev.in` “Staging” via `PLATFORM_HOST_ALIASES`. That is **host alias staging**, not data isolation. Explicit non-goal of that cutover: separate production Supabase — which also means **true staging was never delivered by that promote**.

---

## 5. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Hybrid `.env.local` → hosted prod DB | High | Never publish/rollback from agents using that URL; use local CLI or future staging project |
| Treating pictocartdev as safe E2E target | High | Block until true staging exists |
| Shared `APP_SECRET` across envs | High | Separate secrets per Worker |
| Shared Redis prefixes across envs | Medium | Separate Upstash DB **or** env-specific key prefix + separate instance |
| Copying production customer data into staging | High / policy | **Forbidden** — seed synthetic data only |
| Incomplete Worker secrets upload | High | Full JSON secrets file every deploy |

---

## 6. Manual actions & permissions required

| Actor | Permission / access | Action |
|---|---|---|
| Supabase org owner | Create project | New staging project (plan) |
| Cloudflare account admin (Airy Fact) | Workers + DNS | New Worker / routes / optional staging zone |
| GitHub admin | Actions secrets | Staging secret names (or Environment `staging`) |
| Auth / Google Cloud | OAuth clients | Staging redirect URIs if GIS/OAuth used |
| Upstash | Create DB | Staging Redis (recommended) |
| Engineering | Repo | Playwright suite after staging is live |

---

## 7. Acceptance criteria (this report)

- [x] Production vs local vs canary mapped with evidence paths.  
- [x] Explicit verdict: staging ≠ production isolation today.  
- [x] Missing pieces listed without secret values.  
- [x] No infrastructure mutated in this deliverable.

---

## 8. Exact next steps to unblock testing

1. **Approve** [`STAGING_ENVIRONMENT_SETUP_PLAN.md`](./STAGING_ENVIRONMENT_SETUP_PLAN.md) (do not create resources until approved).  
2. Provision isolated staging (Supabase + Worker + secrets + Auth + optional Redis).  
3. Seed **synthetic** seller + store only.  
4. Implement Playwright suite per [`THEME_EDITOR_E2E_TEST_PLAN.md`](./THEME_EDITOR_E2E_TEST_PLAN.md) against staging base URL only.  
5. Re-run production verification blockers that need a seller session **on staging**, not on production customer stores.
