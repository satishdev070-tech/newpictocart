# Staging Preflight Review — PR #119

_Date: 2026-11-10 21:56 IST (Asia/Kolkata) · **Read-only** — no provision, deploy, DNS change, secret rotation, migration, or production modification._

Reviews: PR [#119](https://github.com/satishdev070-tech/newpictocart/pull/119) +  
[`ENVIRONMENT_ISOLATION_REPORT.md`](./ENVIRONMENT_ISOLATION_REPORT.md) ·  
[`STAGING_ENVIRONMENT_SETUP_PLAN.md`](./STAGING_ENVIRONMENT_SETUP_PLAN.md) ·  
[`THEME_EDITOR_E2E_TEST_PLAN.md`](./THEME_EDITOR_E2E_TEST_PLAN.md).

---

## 0. PR #119 integrity

| Check | Result |
|---|---|
| Base → head | `cursor/prod-verification-phase1-c73e` → `cursor/staging-e2e-prep-c73e` |
| Files changed | **4 markdown files only** |
| Non-docs / app / config / migrations | **None** |
| Unexpected modifications | **None found** |

| Path | Change |
|---|---|
| `docs/ENVIRONMENT_ISOLATION_REPORT.md` | Added |
| `docs/STAGING_ENVIRONMENT_SETUP_PLAN.md` | Added |
| `docs/THEME_EDITOR_E2E_TEST_PLAN.md` | Added |
| `docs/IMPLEMENTATION_STATUS.md` | Status pointer only |

**Confirmed:** PR #119 is documentation-only (+785 / −1). Safe to merge as planning without runtime impact.

---

## 1. Does a separate Supabase staging project already exist?

| Source inspected | Finding |
|---|---|
| `.env.local` / `.env.example` | Single URL slot; local points at `ugbjlpdhktrlkyuijkfc.supabase.co` |
| `supabase/config.toml` | Local CLI `project_id = newpictocart` only |
| GHA deploy workflow | One `NEXT_PUBLIC_SUPABASE_URL` secret → production Worker |
| Docs / status history | Only hosted ref `ugbjlpdhktrlkyuijkfc` (`v2pictocart`) |
| `STAGING_SUPABASE_*` vars | **Absent** |
| Cursor app secrets | Empty for this workspace |

**Verdict:** **No accessible separate hosted staging Supabase project.**  
Only isolation today = **local CLI** project `newpictocart`. Hosted canary and production share `v2pictocart`.

---

## 2. Can `pictocartdev.in` safely move to a dedicated staging Worker?

### Current coupling (evidence)

| Coupling | Detail |
|---|---|
| Same Worker | Custom Domains on `pictocart` (ADR-011); live `x-vinext-build-id` **identical** on www.pictocart.in and www.pictocartdev.in (`a23f80d…`, 2026-11-10) |
| Same Supabase | Auth, DB, Storage, Edge Functions |
| Platform alias | `PLATFORM_HOST_ALIASES=pictocartdev.in,www.pictocartdev.in` (GHA default) |
| Auth redirects | Prod Auth allowlists pictocartdev hosts |
| Domain rows | After root promote, `{slug}.pictocartdev.in` kept as **non-primary** verified rows |
| Theme preview | Cross-site cookie path (`SameSite=None; Partitioned`) when parent is pictocartdev → `*.pictocart.in` |
| CSP | Storefront `frame-ancestors` includes pictocartdev origins |
| Email | Resend historically verified for `pictocartdev.in` |
| Rollback runbook | “Leave canary on Workers during production rollback” |

### Migration options

| Option | Safe for Theme E2E publish/rollback? | Recommendation |
|---|---|---|
| **A.** Rebind pictocartdev Custom Domains to new Worker **still using prod Supabase** | **No** — data not isolated | **Reject** for E2E publish tests |
| **B.** Rebind pictocartdev to new Worker + **new** Supabase; remove from prod Worker aliases/Auth | **Yes**, after cleanup | Possible, but **high ops risk** (see below) |
| **C.** Leave pictocartdev as **production canary**; create **new** staging domain (e.g. `staging.pictocart.dev`) + new Worker + new Supabase | **Yes** | **Preferred** |

### Why B is risky (not “unsafe forever,” but not a quick win)

1. Must remove pictocartdev from prod Worker Custom Domains **and** `PLATFORM_HOST_ALIASES` or prod build still treats it as platform.  
2. Must update Supabase Auth Site URL / redirects carefully — mistakes break seller login on canary **and** can confuse prod Auth allowlists.  
3. Non-primary `*.pictocartdev.in` store domain rows still resolve to **prod** tenant data unless DNS stops pointing at prod Worker first.  
4. Preview cookie / CSP / Google GIS origins need coordinated updates.  
5. During cutover, a mis-ordered DNS step can send staging traffic to prod DB or blank the canary.

**Verdict:** Do **not** treat “move pictocartdev to a staging Worker” as the first staging move unless the owner explicitly accepts Option B’s DNS/Auth cleanup. Prefer **Option C** (new staging hostname + new Worker + new Supabase) and keep pictocartdev as prod canary.

---

## 3. Production dependencies that must be isolated

| Dependency | Production today | Staging must have |
|---|---|---|
| **Database** | Supabase Postgres `ugbjlpdhktrlkyuijkfc` | Separate project; synthetic seed only |
| **Authentication** | Same project Auth; Site URL www.pictocart.in; redirects include pictocart + pictocartdev | Separate Auth (comes with new project); staging Site URL + redirects only |
| **Storage** | Buckets `store-assets`, `private-files`, `platform-branding` on prod project | Same bucket **names** on staging project (empty / synthetic objects) |
| **Secrets** | Worker `pictocart` bindings; GHA production secrets | Distinct `APP_SECRET`, `CRON_SECRET`, Supabase keys; never reuse prod HMAC secrets |
| **Redis** | Optional shared Upstash (`sf:v1` / `pub:v1`) | Separate Upstash DB **or** staging L1-only (ADR-010) |
| **Cron jobs** | HTTP Bearer to `www.pictocart.in/api/cron/*` (`expire-orders`, `domains`, `social-publish`, `notifications`, `gbp-reviews`, `observability`, `preview-token-self-test`, …) | Staging scheduler → **staging** URLs only; staging `CRON_SECRET`; do not point prod cron at staging or vice versa |
| **Payment integrations** | Platform Razorpay / Cashfree / PayU in `platform_app_credentials`; store gateways in `tenant_integrations`; webhooks `/api/webhooks/platform/{razorpay,cashfree,payu}` | Staging: **test-mode** keys only, or omit gateways for Theme E2E; webhook URLs must hit staging host — never prod webhook secrets on staging |
| **Email** | Resend / Admin Email / `SEND_EMAIL_HOOK_SECRET` + Auth Send Email hook | Staging Resend domain or log-only; separate hook secret on staging Auth; no customer mailboxes |
| **Webhooks (Meta etc.)** | `META_WEBHOOK_VERIFY_TOKEN`, social callbacks | Staging-only verify tokens / callback URLs if tested; else leave unset |
| **Edge / custom domains** | `EDGE_SHARED_SECRET`, CF-for-SaaS | Separate if staging custom domains tested |
| **AI provider keys** | Gemini/Groq/NVIDIA/etc. (optional) | Optional staging keys or omit for Theme E2E |
| **Cloudflare KV / Images** | Prod Worker bindings | Staging Worker bindings (new KV namespace recommended) |
| **DNS / domains** | `pictocart.in`, `*.pictocart.in`, pictocartdev aliases | Staging zone/subdomain only |
| **GitHub deploy** | Secrets → Worker `pictocart` | GitHub Environment `staging` → Worker `pictocart-staging` |

Theme Editor E2E **minimum** isolation set: Database + Auth + Storage + Worker secrets (`APP_SECRET`/`CRON_SECRET`) + platform/store DNS. Payments/email/webhooks can be disabled on staging for the first Theme suite.

---

## 4. Owner provisioning checklist (exact steps)

**Do nothing below until you explicitly approve.** Costs are **order-of-magnitude estimates** (public list prices change; verify in each console).

### 4.1 Decisions to lock first

- [ ] Staging hostname strategy: **Option C** (new domain) **recommended** / Option B (repurpose pictocartdev) only with extra DNS/Auth plan  
- [ ] Staging root example: `staging.<your-domain>` + `*.staging.<your-domain>`  
- [ ] Redis: separate Upstash **or** L1-only waiver for staging  
- [ ] Payments/email on staging: omit for Theme E2E **or** test-mode only  

### 4.2 Supabase (dashboard)

1. Create project `pictocart-staging` (prefer `ap-south-1`).  
2. Store URL + publishable + secret keys in password manager (not chat).  
3. Link CLI to **staging ref only**; apply `supabase/migrations/**`.  
4. Confirm buckets exist; seed **synthetic** seller + store (`e2e-theme`).  
5. Auth → Site URL = staging platform; redirects = staging hosts only.  
6. **Do not** run seed against `ugbjlpdhktrlkyuijkfc`.

**Expected cost:** Supabase Free tier often enough for E2E; Pro ~\$25/mo if Free limits insufficient.

### 4.3 Upstash (optional)

1. Create DB `pictocart-staging` near Mumbai.  
2. Put REST URL/token in staging secrets only.

**Expected cost:** Free tier usually enough; paid from ~\$10/mo if exceeded.

### 4.4 Cloudflare

1. Create Worker `pictocart-staging` (and KV namespace if required by vinext pin).  
2. Attach staging Custom Domains / `*.staging…` route (not prod wildcards).  
3. Upload **complete** JSON secrets file (new `APP_SECRET`/`CRON_SECRET` + staging Supabase).  
4. Smoke: staging `/api/health/ready` + preview self-test.  
5. **Leave** prod Worker `pictocart` and pictocartdev Custom Domains unchanged (if Option C).

**Expected cost:** Workers Free may suffice for low E2E traffic; Paid if Cron Triggers desired (~\$5/mo platform + usage). External HTTP cron can stay free.

### 4.5 GitHub

1. Create Environment `staging`.  
2. Add staging secret **names** (separate from production).  
3. Add future `workflow_dispatch` deploy workflow (eng, after approval) — never auto-deploy staging from `main` push to prod.

### 4.6 Auth / Google / Resend (as needed)

1. Staging Auth URLs (step 4.2).  
2. If GIS: staging origins in Google Cloud.  
3. If email OTP E2E: staging Resend domain or disable send (log-only).

### 4.7 Cron

1. Point any staging scheduler at `https://<staging-platform>/api/cron/*` with **staging** `CRON_SECRET`.  
2. Confirm production scheduler still only hits `www.pictocart.in`.

### 4.8 Rollback procedures (if something goes wrong mid-provision)

| Mistake | Rollback |
|---|---|
| Staging Worker accidentally given **prod** Supabase URL | Redeploy staging with staging URL; rotate staging `APP_SECRET` if tokens leaked cross-env; **do not** rotate prod `APP_SECRET` casually |
| Staging DNS pointed at prod Worker | Remove staging route/Custom Domain from prod Worker; restore DNS to staging Worker or delete record |
| pictocartdev unbound from prod too early (Option B) | Re-add Custom Domains to Worker `pictocart`; restore `PLATFORM_HOST_ALIASES`; Auth redirects |
| Migration applied to **prod** ref by mistake | Stop; restore from Supabase backup / point-in-time if enabled; treat as sev-1 — this preflight forbids that command |
| Partial secrets upload wiped staging bindings | Redeploy staging with **full** secrets JSON |

---

## 5. Cursor vs manual owner approval

| Task | Cursor / agent (after approval) | Owner / ops manual |
|---|---|---|
| Write/merge planning docs (PR #119) | Done / merge when ready | Approve merge |
| Create Supabase / CF / Upstash / DNS | **No** (unless you later grant tools + explicit approve) | **Yes** |
| Generate staging secrets offline | Can suggest commands (`openssl rand…`) — owner runs | Store in vault |
| Apply migrations to staging ref | Possible **after** approval + linked ref confirmation | Confirm project-ref every time |
| Deploy `pictocart-staging` | Possible after config PR + approval | Approve first staging deploy |
| Seed synthetic seller | Scriptable after approval | Create inbox / password |
| Configure Auth / Google / Resend dashboards | **No** | **Yes** |
| Payment test keys | **No** | **Yes** if needed |
| Implement Playwright suite | Yes, in a **later** approved code PR | Review selectors / CI secrets |
| Production publish/rollback tests | **Never** | N/A |
| Rotate production secrets | **Never** in this workstream | Only under separate incident process |

---

## 6. Validate staging isolation **before** publish/rollback tests

Run this gate checklist; **all must PASS** before any Theme publish E2E:

| # | Isolation gate | Pass criteria |
|---|---|---|
| G1 | Supabase host | Staging Worker `NEXT_PUBLIC_SUPABASE_URL` host ≠ `ugbjlpdhktrlkyuijkfc.supabase.co` |
| G2 | Worker identity | Requests to staging platform return staging build; prod `www.pictocart.in` build unchanged |
| G3 | Secret divergence | Staging-minted preview token fails diagnose on **prod** self-test (`sig_fail`); prod token fails on staging |
| G4 | Data plane | Staging DB tenant list = synthetic only (no customer slugs like `nuts-fruits-store`) |
| G5 | DNS | `{e2e-slug}.{staging-root}` resolves to staging Worker, not prod `pictocart` |
| G6 | Auth | Staging login session cookie scoped to staging host; cannot open prod `/dashboard/theme` as that session |
| G7 | Storage | Upload on staging appears only in staging `store-assets` (path prefix / dashboard) |
| G8 | Cron | Staging self-test uses staging `CRON_SECRET`; prod cron URL still only prod |
| G9 | Canary untouched | `www.pictocartdev.in` still same prod build id as www (if Option C kept canary) |
| G10 | Ready probes | Staging `/api/health/ready` ok; staging `mintVerify: ok` |

Only after G1–G10: enable Playwright cases 12–15 (publish / cache / visibility / rollback).

---

## 7. Concise owner approval checklist

Reply with explicit approval (or amendments) for each:

1. **Merge PR #119** (docs-only planning)? `[ ] yes / [ ] no`  
2. **Staging strategy:** `[ ] Option C — new staging domain + new Worker + new Supabase (recommended)` · `[ ] Option B — repurpose pictocartdev (higher risk)` · `[ ] defer`  
3. **Authorize creating** Supabase project `pictocart-staging`? `[ ] yes / [ ] no`  
4. **Authorize creating** Cloudflare Worker `pictocart-staging` + staging DNS? `[ ] yes / [ ] no`  
5. **Redis:** `[ ] new Upstash DB` · `[ ] staging L1-only waiver` · `[ ] defer`  
6. **Payments/email/webhooks on staging for v1 Theme E2E:** `[ ] omit` · `[ ] test-mode only`  
7. **Authorize Cursor later** to apply migrations/deploy to staging **only** after you confirm the staging project ref? `[ ] yes / [ ] no`  
8. **Confirm forbidden:** no prod migrations, no prod secret rotation, no customer data copy, no pictocartdev cutover without a written Option B plan. `[ ] acknowledged`

**This agent will wait for your explicit approval before any provisioning.**

---

## Summary

| Question | Answer |
|---|---|
| Staging Supabase already exists? | **No** (only prod hosted + local CLI) |
| Move pictocartdev to staging Worker safely? | **Not as a shortcut** — prefer new domain; Option B only with full DNS/Auth cleanup + new DB |
| PR #119 unexpected code? | **None** — docs only |
| Ready to provision? | **Not until you approve the checklist above** |
