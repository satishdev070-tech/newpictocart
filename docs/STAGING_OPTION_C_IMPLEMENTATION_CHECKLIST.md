# Option C — Implementation-Ready Staging Checklist

_Date: 2026-11-10 22:28 IST (Asia/Kolkata)_  
_Status: **Awaiting explicit owner approval** — do not provision, change DNS, deploy, migrate, or merge until confirmed._

Locked preferences (owner, provisional):

| # | Decision | Choice |
|---|---|---|
| Strategy | Completely isolated staging | **Option C** |
| Prod / pictocartdev | Untouched | **No changes** |
| Supabase | New project | `pictocart-staging` |
| Worker | New name | `pictocart-staging` |
| Redis | Prefer L1-only first | Supported for Theme E2E (see §5) |
| Payments / email | Omit real delivery | Mocks / log-only for Theme E2E v1 |
| Deploy / migrate | Blocked | Until owner provides staging project **ref** + authorization |
| PR #119 | Prepare only | **Do not merge** without final confirmation |

Related: [`STAGING_PREFLIGHT_REVIEW.md`](./STAGING_PREFLIGHT_REVIEW.md), [`STAGING_ENVIRONMENT_SETUP_PLAN.md`](./STAGING_ENVIRONMENT_SETUP_PLAN.md), [`THEME_EDITOR_E2E_TEST_PLAN.md`](./THEME_EDITOR_E2E_TEST_PLAN.md), [`ENVIRONMENT_ISOLATION_REPORT.md`](./ENVIRONMENT_ISOLATION_REPORT.md).

---

## 1. Recommended staging subdomain (controlled domain)

Under the existing Cloudflare zone **`pictocart.in`** (already controlled), without touching **`pictocartdev.in`**:

| Role | Hostname | Notes |
|---|---|---|
| Platform (canonical) | `https://staging.pictocart.in` | `NEXT_PUBLIC_PLATFORM_URL` |
| Platform www (optional) | `https://www.staging.pictocart.in` | Alias or skip |
| Storefronts | `https://{slug}.staging.pictocart.in` | Requires root below |
| **Platform root env** | `staging.pictocart.in` | `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` |

**Why this shape:** App storefronts are `{slug}.{NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN}`. Setting root to `staging.pictocart.in` yields `e2e-theme.staging.pictocart.in` and keeps production `*.pictocart.in` on Worker `pictocart` unchanged.

**DNS records the owner will add later (not now):**

| Type | Name | Target |
|---|---|---|
| Worker Custom Domain | `staging` | Worker `pictocart-staging` |
| Worker Custom Domain | `www.staging` (optional) | Worker `pictocart-staging` |
| Route | `*.staging.pictocart.in/*` | Worker `pictocart-staging` |
| DNS | `AAAA *.staging` → `100::` (proxied) | Same pattern as prod wildcard |

**Do not** use `pictocartdev.in` as staging root (Option B risks).  
**Do not** set staging root to bare `pictocart.in` (collides with prod stores).

**Alternate** (if you prefer a separate zone later): buy/control `pictocart.dev` / `pictocart.stage` — not required if `staging.pictocart.in` is accepted.

---

## 2. Owner dashboard setup guide

### 2.1 Supabase Dashboard — project `pictocart-staging`

1. **New project** → name `pictocart-staging` → region prefer **Mumbai / `ap-south-1`** → generate DB password → save in vault.  
2. **Settings → API**: copy Project URL, publishable key, secret key → vault (never chat/git).  
3. Note **Project ref** (subdomain of `*.supabase.co`) — you will paste this into the approval message later.  
4. **Authentication → URL configuration**  
   - Site URL: `https://staging.pictocart.in`  
   - Redirect URLs:  
     - `https://staging.pictocart.in/**`  
     - `https://www.staging.pictocart.in/**` (if used)  
     - `https://*.staging.pictocart.in/**`  
     - Optional local: `http://localhost:3000/**`, `http://*.localhost:3000/**`  
   - **Do not** add production customer hosts unless required.  
5. **Authentication → Email**: keep defaults; for Theme E2E v1 prefer **password user** created manually so Resend is unnecessary.  
6. **Storage**: after migrations (later), confirm buckets `store-assets`, `private-files`, `platform-branding`.  
7. **SQL / CLI (later, authorized only):** link CLI to this ref; `db push` / migrate **only** this ref — never `ugbjlpdhktrlkyuijkfc`.  
8. **Seed (later):** synthetic user e.g. `theme-e2e@staging.local` + store slug `e2e-theme` with `theme.edit` + `theme.publish`. **No customer data copy.**

### 2.2 Cloudflare Dashboard — Worker `pictocart-staging`

1. Same account as prod (Airy Fact) → **Workers & Pages** → Create Worker named **`pictocart-staging`** (empty ok; first real upload via `cf deploy` later).  
2. **KV**: create namespace e.g. `pictocart-staging-vinext-cache`; copy namespace **id** for a future staging `cloudflare` config pin (do not reuse prod KV id `2a8074bf…` in staging config when eng implements it).  
3. **Custom Domains** on Worker `pictocart-staging`: `staging.pictocart.in` (+ optional `www.staging.pictocart.in`).  
4. **Triggers → Routes**: `*.staging.pictocart.in/*` → `pictocart-staging`.  
5. **DNS** (zone `pictocart.in`): ensure proxied records for staging hosts / `*.staging` as required by Custom Domains + wildcard route (same pattern as prod docs).  
6. **Variables / Secrets**: upload via complete JSON `--secrets-file` at first deploy (template §4) — never partial file.  
7. **Leave unchanged:** Worker `pictocart`, Custom Domains for `pictocart.in` / `www` / `pictocartdev.in` / `www.pictocartdev.in`, route `*.pictocart.in/*`.

### 2.3 GitHub (optional now, required before CI deploy)

1. Repo → **Settings → Environments → New**: `staging`.  
2. Add Environment secrets (names in §4) — values only after project exists.  
3. Do **not** overwrite production Actions secrets used by Worker `pictocart`.

### 2.4 Explicitly skip for Theme E2E v1

| Integration | Staging v1 action |
|---|---|
| Resend / SEND_EMAIL_HOOK | Omit; use password login for E2E seller |
| Razorpay / Cashfree / PayU | Omit platform + tenant gateways |
| Meta / Pinterest / Google OAuth apps | Omit unless separately approved |
| Upstash Redis | Omit (L1-only) |
| Production cron schedulers | Do not retarget; add staging-only curls later if needed |

---

## 3. Free tiers vs charges (estimates — verify in consoles)

| Resource | Likely free for Theme E2E? | When you may pay |
|---|---|---|
| Supabase project | Often **Free** tier OK for one synthetic store + low traffic | Pro (~\$25/mo) if Free limits/PITR needed |
| Cloudflare Worker `pictocart-staging` | **Free** plan often enough for manual + light CI | Workers Paid (~\$5/mo) if Cron Triggers required |
| CF DNS on existing `pictocart.in` zone | **No extra** (already on CF) | — |
| CF KV namespace | Free allocation usually enough | Overage if abused |
| Upstash | **N/A** if L1-only | If later enabled, Free → then ~\$10/mo |
| Resend / Google / payment test accounts | **N/A** if omitted | When enabling email/pay |
| GitHub Actions minutes | Usually within free/team quota | Heavy Playwright matrix |

**L1-only Redis limitation (accepted for v1):** no cross-isolate L2; storefront may stay stale up to ~**120s** without Redis; marketplace demos ~**300s**. Theme publish E2E should assert visibility with **retry ≤120s** (already in E2E plan). Rate limits remain Postgres (ADR-025). **Supported** for required Theme Customizer publish/rollback tests.

---

## 4. Environment variable templates (placeholders only)

### 4.1 Staging Worker secrets file (JSON)

Save as a local vault path later — **never commit real values**. Also mirrored at [`env-templates/staging.worker.secrets.example.json`](./env-templates/staging.worker.secrets.example.json).

```json
{
  "APP_SECRET": "REPLACE_WITH_openssl_rand_hex_32",
  "CRON_SECRET": "REPLACE_WITH_openssl_rand_hex_24",
  "NEXT_PUBLIC_SUPABASE_URL": "https://REPLACE_STAGING_PROJECT_REF.supabase.co",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "REPLACE_STAGING_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY": "REPLACE_STAGING_SECRET_KEY",
  "NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN": "staging.pictocart.in",
  "NEXT_PUBLIC_PLATFORM_URL": "https://staging.pictocart.in",
  "PLATFORM_HOST_ALIASES": "",
  "WORKERS_DEV_HOST": "REPLACE_OPTIONAL_pictocart-staging.ACCOUNT.workers.dev",
  "EMAIL_FROM": "Pictocart Staging <no-reply@example.com>"
}
```

**Intentionally omitted for v1:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, payment/OAuth/AI keys.

Generate secrets (owner machine):

```bash
openssl rand -hex 32   # APP_SECRET
openssl rand -hex 24   # CRON_SECRET
```

### 4.2 Staging local / CI `.env` template

Mirrored at [`env-templates/staging.env.example`](./env-templates/staging.env.example):

```bash
# Staging app / Playwright — placeholders only
NEXT_PUBLIC_SUPABASE_URL=https://REPLACE_STAGING_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=REPLACE_STAGING_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=REPLACE_STAGING_SECRET_KEY
APP_SECRET=REPLACE_WITH_openssl_rand_hex_32
CRON_SECRET=REPLACE_WITH_openssl_rand_hex_24
NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN=staging.pictocart.in
NEXT_PUBLIC_PLATFORM_URL=https://staging.pictocart.in
# Leave Redis unset for L1-only
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=

# Playwright (after E2E implementation PR)
E2E_BASE_URL=https://staging.pictocart.in
E2E_STORE_ORIGIN=https://e2e-theme.staging.pictocart.in
E2E_STORE_SLUG=e2e-theme
E2E_SELLER_EMAIL=theme-e2e@REPLACE_STAGING_INBOX
E2E_SELLER_PASSWORD=REPLACE_STAGING_SELLER_PASSWORD
```

### 4.3 Production names to **never** reuse for staging HMAC

| Name | Why |
|---|---|
| Production `APP_SECRET` | Preview tokens would verify across envs |
| Production `CRON_SECRET` | Staging cron would authorize against wrong intent if URLs mixed |
| Production Supabase keys | Breaks isolation gates G1/G4 |

---

## 5. Isolation verification gates G1–G10 (with expected evidence)

Run **before** any publish/rollback test. Record timestamp (Asia/Kolkata) and redacted evidence.

| Gate | Check | Expected evidence |
|---|---|---|
| **G1** | Staging Supabase host ≠ prod | Staging secrets/URL host ≠ `ugbjlpdhktrlkyuijkfc.supabase.co`; screenshot of staging API settings host (no keys) |
| **G2** | Distinct Worker / build | `curl -sI https://staging.pictocart.in/api/health/ready` vs prod; staging served by Worker `pictocart-staging`; prod `x-vinext-build-id` unchanged |
| **G3** | `APP_SECRET` divergence | Staging-minted token → prod self-test `external` = `sig_fail`; prod-aligned token → staging `sig_fail` (tokens never logged) |
| **G4** | Synthetic data only | Staging tenant list contains `e2e-theme` (and peers); **no** customer slugs (`nuts-fruits-store`, etc.) |
| **G5** | DNS → staging Worker | `e2e-theme.staging.pictocart.in` resolves/proxied to `pictocart-staging` (CF dashboard route/domain), not prod `pictocart` |
| **G6** | Auth session isolation | Staging seller session cannot open `https://www.pictocart.in/dashboard/theme` as authenticated editor |
| **G7** | Storage isolation | Test upload only visible in staging Storage; prod bucket unchanged |
| **G8** | Cron isolation | Staging self-test with staging `CRON_SECRET` → `mintVerify: ok`; prod scheduler still only hits `www.pictocart.in` |
| **G9** | Canary untouched | `www.pictocartdev.in` still on Worker `pictocart`; build id matches prod www (Option C invariant) |
| **G10** | Ready + mintVerify | Staging `/api/health/ready` `ok`; staging preview self-test `mintVerify: ok` |

**Theme publish/rollback E2E is forbidden until G1–G10 all PASS.**

---

## 6. Staging-only deployment & rollback runbook

### 6.1 Preconditions

- [ ] Owner approved this checklist.  
- [ ] Staging Supabase **project ref** confirmed in writing.  
- [ ] Eng has a **staging-targeted** deploy config (separate PR — not done yet; prod `cloudflare.config.ts` still names `pictocart` only).  
- [ ] Complete staging secrets JSON ready (no prod values).  
- [ ] DNS/Custom Domains for `staging.pictocart.in` + `*.staging.pictocart.in` attached to **`pictocart-staging` only**.

### 6.2 First deploy (owner/eng after authorization)

```bash
# 1) Confirm secrets file host is staging ref (human eyeball — do not echo secrets)
# 2) Build
pnpm build:vinext
# 3) Deploy to STAGING worker only (exact CLI flags depend on staging config PR)
npx cf deploy --prebuilt --secrets-file /path/to/staging.worker.secrets.json
# 4) Gates
curl -fsS "https://staging.pictocart.in/api/health/ready"
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "https://staging.pictocart.in/api/cron/preview-token-self-test"
# Expect mintVerify ok — CRON_SECRET is staging's
```

### 6.3 Migrations (staging ref only)

```bash
# Verify linked project-ref == staging before any push
supabase projects list   # or dashboard
# Then migrate ONLY staging — never ugbjlpdhktrlkyuijkfc
```

### 6.4 Rollback staging

| Failure | Action |
|---|---|
| Bad staging Worker version | CF → Worker `pictocart-staging` → prior version rollback |
| Wrong secrets uploaded | Redeploy staging with **full** corrected JSON; if prod secrets were pasted by mistake, **rotate staging** secrets; treat prod exposure as incident (do not casually rotate prod `APP_SECRET`) |
| DNS pointed at wrong Worker | Fix Custom Domain / route to `pictocart-staging`; do not alter prod `*.pictocart.in` route |
| Bad migration on staging | Reset staging DB / restore staging backup; **never** “fix” by touching prod |

### 6.5 Production rollback note

Staging failures must **not** trigger production Worker/DNS changes. Prod rollback remains per [`DEPLOY_CLOUDFLARE_WORKERS.md`](./DEPLOY_CLOUDFLARE_WORKERS.md) (leave pictocartdev canary as-is).

---

## 7. Tasks Cursor can automate **after** explicit approval

| After you approve… | Cursor may |
|---|---|
| Merge of PR #119 | Prepare yes; **merge only when you say “merge #119”** |
| Staging config PR | Add `pictocart-staging` worker config / workflow / KV pin (code PR) |
| You paste staging **project ref** + “authorize migrate staging” | Run migrations against that ref only |
| You authorize first staging deploy + secrets file path on your side | Guide/`cf deploy` to staging Worker only |
| Staging green + G1–G10 | Implement Playwright suite per E2E plan (separate PR) |
| Never without ask | Prod deploy, prod migrate, DNS edits, secret rotation, pictocartdev changes, customer data copy |

---

## 8. Remaining risks & open decisions

| Item | Status |
|---|---|
| Exact hostname `staging.pictocart.in` vs alternate | **Needs your confirm** (recommended above) |
| Optional `www.staging.pictocart.in` | Open |
| Staging KV namespace creation | Owner dashboard |
| Eng config PR for second Worker name | Not started (blocked on approval) |
| E2E seller inbox (real email vs `@staging.local` + password) | Open |
| Second staging store for cross-tenant test 16 | Open |
| Hybrid `.env.local` still pointing at prod Supabase in cloud agents | Risk until agents use staging templates |
| Free-tier cold starts / Worker limits | Accept for v1 or upgrade later |
| L1-only ≤120s publish visibility | Documented; E2E retries required |

---

## 9. PR #119 merge readiness

| Check | Result |
|---|---|
| Documentation only? | **Yes** (markdown under `docs/` + env **example** templates with placeholders) |
| App/runtime/config production changes? | **No** |
| Conflicts | Re-check at merge time against base `cursor/prod-verification-phase1-c73e` |
| Merge now? | **No** — waiting for your final “merge #119” |

---

## 10. Stop — owner confirmation required

Please reply with:

1. **Hostname:** approve `staging.pictocart.in` / `*.staging.pictocart.in`? `yes` / alternative  
2. **Merge PR #119?** `yes` / `not yet`  
3. **Authorize owner-side creation** of Supabase `pictocart-staging` + Worker `pictocart-staging` + DNS? `yes` / `no` (Cursor still will not click-create unless you also authorize agent actions later)  
4. When Supabase exists, send **project ref only** (not keys) + `authorize migrate staging`  
5. When ready for first Worker upload: `authorize deploy staging`  

**No infrastructure, DNS, deploy, or migration will proceed until those explicit phrases.**
