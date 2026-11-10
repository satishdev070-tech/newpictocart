# Staging Environment Setup Plan — Pictocart

_Date: 2026-11-10 · **Plan only** — do **not** create resources, rotate secrets, deploy, migrate, or copy customer data until explicitly approved._

Depends on: [`ENVIRONMENT_ISOLATION_REPORT.md`](./ENVIRONMENT_ISOLATION_REPORT.md).  
Enables: [`THEME_EDITOR_E2E_TEST_PLAN.md`](./THEME_EDITOR_E2E_TEST_PLAN.md).

---

## 1. Goal

Deliver a **data-isolated** staging stack so Theme Customizer E2E (auth → edit → preview → publish → rollback) never touches production tenants, production Auth sessions of customers, or production Storage blobs.

**Non-goals (until later approval):** production deploy automation changes; Vercel dual-project revive; copying live stores into staging.

---

## 2. Target architecture

```
Seller browser / Playwright
        │
        ▼
staging.pictocart.dev  (or staging.<chosen-domain>)
*.staging.pictocart.dev storefronts
        │
        ▼
Cloudflare Worker: pictocart-staging   ← separate Worker name
        │
        ├─ secrets: staging-only APP_SECRET, CRON_SECRET, Supabase keys, …
        ├─ optional Upstash: pictocart-staging Redis (separate DB)
        │
        ▼
Supabase project: pictocart-staging (NEW)
  Auth · DB · Storage (store-assets, private-files, platform-branding)
  Seed: synthetic seller + one test store only
```

| Layer | Production (keep) | Staging (create) |
|---|---|---|
| Worker | `pictocart` | `pictocart-staging` |
| Supabase | `ugbjlpdhktrlkyuijkfc` / `v2pictocart` | **New** project (suggested name `pictocart-staging`) |
| Platform URL | `https://www.pictocart.in` | e.g. `https://staging.pictocart.dev` (TBD domain) |
| Root domain | `pictocart.in` | e.g. `staging.pictocart.dev` |
| Redis | Optional prod Upstash | **Separate** Upstash DB (recommended) or L1-only |
| Auth Site URL | `https://www.pictocart.in` | Staging platform URL only |
| `pictocartdev.in` | Remains prod canary alias | **Do not** overload as staging DB |

---

## 3. Dependencies

| Dependency | Why |
|---|---|
| Cloudflare account with permission to create Workers + DNS | Separate deployment target |
| Supabase org quota for a second project | Isolated DB/Auth/Storage |
| Domain or subdomain for staging hosts | Platform + `{slug}.{root}` |
| GitHub Environment `staging` (recommended) | Secrets scoped away from `main` production |
| Ability to run migrations **on staging only** | Schema parity without touching prod |
| Playwright runners (CI or local) | E2E after seed |

---

## 4. Step-by-step setup (manual — after approval)

### Step A — Supabase staging project

**Where:** Supabase Dashboard → New project.

1. Create project `pictocart-staging` (region preferably Mumbai / `ap-south-1`).  
2. Note (secure store — do not paste into chat): Project URL, publishable key, secret key.  
3. Apply **same migration set** as production (`supabase/migrations/**`) to staging **only** — via CLI linked to staging ref, never to `ugbjlpdhktrlkyuijkfc` by accident.  
4. Create storage buckets matching prod names: `store-assets`, `private-files`, `platform-branding` (policies from migrations/setup).  
5. Seed **synthetic** data only:
   - Prefer adapting `supabase/seed.sql` patterns (local users/stores) with staging hostnames `{slug}.staging.pictocart.dev`.  
   - **Forbidden:** dump/restore production tenant rows, customer PII, or production Storage objects.  
6. Create dedicated test seller:
   - Email e.g. `theme-e2e@staging.pictocart.local` (or real inbox you control).  
   - Membership `owner` (or role with `theme.edit` + `theme.publish`) on store slug e.g. `e2e-theme`.  
7. Auth → URL configuration:
   - Site URL = staging platform URL.  
   - Redirect allowlist: staging platform + `https://*.{staging-root}/**` + localhost if needed for hybrid debug.  
   - **Do not** add production customer hosts unless required for a documented exception.

**Acceptance:** Staging SQL Editor shows only synthetic tenants; Auth users list has no production customer emails.

### Step B — Staging Redis (recommended)

**Justification for separate instance (not shared prod prefixes):**  
Prod uses `sf:v1` / `pub:v1`. Sharing one Upstash DB with the same prefixes risks cross-env cache poisoning and confusing invalidation during E2E publish tests. A **separate Upstash database** is the safest isolation. Alternative: staging L1-only (omit Upstash) — acceptable for functional E2E; document TTL-only behavior.

**Where:** Upstash Console → Create database → REST URL + token → staging secrets only.

**Acceptance:** Staging Worker has its own URL/token pair **or** explicit L1-only waiver for staging.

### Step C — Cloudflare Worker `pictocart-staging`

**Where:** Same Airy Fact account (or dedicated staging account).

1. Duplicate deploy path from `docs/DEPLOY_CLOUDFLARE_WORKERS.md` / `cloudflare.config.ts` with a **new Worker name** `pictocart-staging` (requires a future config change — **not in this plan’s approval phase**).  
2. Bind KV / assets as required by vinext (pin KV id for staging namespace — create new KV if prod pin must not be shared).  
3. Custom Domains / routes:
   - Platform: `staging.<domain>`, `www.staging.<domain>` (exact names TBD).  
   - Stores: route `*.staging.<domain>/*` + DNS wildcard.  
4. Secrets file (JSON, complete set — never partial):

| Name | Staging value source |
|---|---|
| `APP_SECRET` | **New** ≥32 hex (`openssl rand -hex 32`) — **not** prod |
| `CRON_SECRET` | **New** ≥24 hex |
| `NEXT_PUBLIC_SUPABASE_URL` | Staging project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Staging publishable |
| `SUPABASE_SECRET_KEY` | Staging secret |
| `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` | Staging root hostname |
| `NEXT_PUBLIC_PLATFORM_URL` | Staging platform full URL |
| `PLATFORM_HOST_ALIASES` | Optional staging aliases |
| `WORKERS_DEV_HOST` | Staging workers.dev if used |
| `UPSTASH_REDIS_REST_*` | Staging Redis or omit |
| `EMAIL_FROM` / `RESEND_API_KEY` | Staging mailbox / optional |

5. Post-deploy gate (staging URL):

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "https://<staging-platform>/api/cron/preview-token-self-test"
# Expect mintVerify: ok
curl -fsS "https://<staging-platform>/api/health/ready"
```

**Acceptance:** Staging `mintVerify: ok`; staging storefront host returns 200 for `e2e-theme`; production Worker version unchanged.

### Step D — GitHub / CI configuration locations

| Location | Purpose |
|---|---|
| GitHub → Settings → Environments → `staging` | Hold staging secret **names** |
| Future workflow `deploy-cloudflare-workers-staging.yml` (not created yet) | `workflow_dispatch` only; never on `main` push |
| Repo vars | `STAGING_PLATFORM_URL`, `STAGING_STORE_SLUG` (non-secret) |
| Playwright env | `E2E_BASE_URL`, `E2E_STORE_HOST`, `E2E_SELLER_EMAIL` (password via CI secret) |

**Do not** overwrite production Actions secrets used by Worker `pictocart`.

### Step E — Auth providers (if used in E2E)

- Password / email OTP for E2E seller is enough for Theme Editor tests.  
- If Google GIS required: register staging origins in Google Cloud + Supabase Auth; keep separate from prod client if possible.

### Step F — Dedicated test seller & store (checklist)

| Item | Requirement |
|---|---|
| Seller email | Staging-only, team-controlled |
| Password / OTP | Stored in password manager + CI secret — never in git |
| Store slug | `e2e-theme` (or similar); hostname `{slug}.{staging-root}` |
| Permissions | `theme.edit`, `theme.publish` |
| Content | Harmless sample theme draft; no customer PII |
| Label for publishes | `e2e-*` timestamps for easy cleanup |

---

## 5. Configuration requirements (summary)

| Config | Production | Staging |
|---|---|---|
| Worker name | `pictocart` | `pictocart-staging` |
| Supabase ref | `ugbjlpdhktrlkyuijkfc` | new |
| `APP_SECRET` | prod | **different** |
| Platform root | `pictocart.in` | staging root |
| Auth Site URL | www.pictocart.in | staging platform |
| Redis | optional prod | separate or L1-only |
| Seed | live tenants | synthetic only |

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Accidental `supabase db push` to prod | Separate CLI linked project; confirm `project-ref` before every command |
| Reusing prod `APP_SECRET` | Generate new; staging preview tokens must not verify on prod |
| Pointing staging Worker at prod Supabase | Checklist gate: URL host ≠ `ugbjlpdhktrlkyuijkfc` |
| DNS collision with prod wildcard | Use distinct parent domain/subzone |
| Email sending to real users | Use Resend test domain or disable outbound in staging |
| Cost (second Worker + Supabase + Redis) | Accept as cost of safe E2E |

---

## 7. What can be automated safely (after approval)

| Automation | Safe? |
|---|---|
| `supabase db push` / migration apply to **staging ref** | Yes, with ref pin |
| `pnpm build:vinext` + `cf deploy` to **pictocart-staging** | Yes, with staging secrets file |
| Playwright against staging URL | Yes |
| Production deploy / secret rotation | **No** in this workstream |
| Prod publish/rollback from CI | **No** |

---

## 8. Permissions required

- Supabase: create project + apply migrations.  
- Cloudflare: create Worker, KV, DNS, secrets.  
- GitHub: Environment secrets.  
- Domain registrar / CF DNS: staging zone or subdomain.  
- Optional Upstash: create DB.  
- Explicit **product/ops approval** of this plan before any create.

---

## 9. Acceptance criteria (staging ready for E2E)

- [ ] Staging Supabase ref ≠ production ref.  
- [ ] Staging Worker name ≠ `pictocart`.  
- [ ] Staging `APP_SECRET` / `CRON_SECRET` ≠ production (length checks only in logs).  
- [ ] `mintVerify: ok` on staging platform URL.  
- [ ] Test seller can open `/dashboard/theme` on staging and mint preview (UI).  
- [ ] Publish on staging store does **not** change any `*.pictocart.in` customer storefront.  
- [ ] No production customer rows in staging DB.  
- [ ] Playwright base URL points only at staging.

---

## 10. Exact next steps (ordered)

1. **Human:** Approve this plan (domain name choice + budget).  
2. **Ops:** Create Supabase staging project; apply migrations; seed synthetic seller/store.  
3. **Ops:** Create Upstash staging DB **or** sign staging L1-only.  
4. **Eng (after approval to change config):** Add `pictocart-staging` deploy target + GitHub Environment.  
5. **Ops:** Deploy Worker with complete staging secrets; run self-test + ready.  
6. **Eng:** Implement Playwright suite ([`THEME_EDITOR_E2E_TEST_PLAN.md`](./THEME_EDITOR_E2E_TEST_PLAN.md)).  
7. **QA:** Green E2E on staging → then revisit production verification blockers that need a seller session **without** using production customer stores.

**Stop here until approval.** No resources should be created from this document alone.
