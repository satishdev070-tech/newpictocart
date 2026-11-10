# Production Verification Results

_Companion to [`PRODUCTION_VERIFICATION_CHECKLIST.md`](./PRODUCTION_VERIFICATION_CHECKLIST.md)._

| Phase | When (Asia/Kolkata) | Scope |
|---|---|---|
| **Phase 1** | 2026-11-09 22:07 IST | Classify checklist; safe public/code/unit probes |
| **Phase 2** | 2026-11-09 22:20–22:23 IST | First pass on four Wave A blockers |
| **Phase 2b** | 2026-11-10 20:29–20:31 IST | Seller mint UI, staging inspection, secrets inventory deepening |

**Rules followed:** No application code changes · no deploy · no migrations · **no production data writes** · secrets never printed · no PASS without evidence · no security bypasses · architecture preserved.

**Status vocabulary:** **PASS** (verified) · **Partial PASS** · **BLOCKED** · **WAIVED**

---

## Final decision (Phase 2b)

| Question | Answer |
|---|---|
| Production verification complete? | **No** |
| Wave A **application code** approved? | **No — NOT APPROVED** |
| Production **deployment** approved? | **No — NOT APPROVED** |
| Wave A **docs-only** (A2/A3/A4)? | **Yes — may proceed** |
| Production readiness claim? | **Not claimed** — mandatory gaps remain without evidence or signed waiver |

### Blocker / task scoreboard

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Authenticated `mintVerify` | **PASS** | Reconfirmed 2026-11-10 20:30 IST |
| 2a | Preview server path (cookie/CSP/deny/expiry/isolation/Bot Fight behavioral) | **PASS** | Phase 2 evidence stands |
| 2b | **Seller dashboard mint UI** (complete workflow) | **BLOCKED** | No usable seller session; see Task 1 |
| 2 complete workflow | Theme Editor preview end-to-end | **Partial PASS** | Server path PASS + dashboard mint BLOCKED |
| 3 | Publish → storefront → rollback | **BLOCKED** | No isolated staging Supabase; see Task 2 |
| 4a | Core Worker secrets (behavior) | **Partial PASS** | APP_SECRET / CRON_SECRET / Supabase proven live |
| 4b | CF Worker version UUID + dashboard name list | **BLOCKED** | No CF API token / GH secrets list 403 |
| 4c | Redis L1-only formal alternative | **WAIVED** (architecture) — **ops countersign pending** | ADR-010; see Task 3 |

### Human actions still required

1. Seller with `theme.edit` on a disposable store: open `/dashboard/theme`, confirm canvas mint (`POST /api/theme/preview-token` **200**) + iframe load.  
2. Explicit approval **or** isolated staging project for publish/rollback smoke (not production customer data).  
3. Cloudflare dashboard: record Worker **version UUID**; tick secret **names**; countersign Redis L1-only waiver **or** confirm Upstash pair names present.

---

## Task 1 — Seller Theme Editor preview-token mint UI

### Flow traced (code — not a UI Pass)

```
Theme Editor canvas / top-bar
  → mintPreviewEntry()  (preview-entry.ts)
      → POST /api/theme/preview-token  (credentials: same-origin, 3 retries)
          → requireTenant() + assertPermission(theme.edit)
          → createPreviewToken(tenantId, userId)  // APP_SECRET HMAC
          → JSON { ok, url: previewEntryUrl(storeOrigin, token), expiresAt }
      → fallback refreshPreviewUrlAction() if API fails
  → iframe navigates to {store}/preview?token=…&parent=…
  → /preview sets httpOnly sf_preview + 307 to path
  → 403 deny HTML postMessage {source:pictocart-preview,type:denied,reason}
```

Evidence paths: `src/features/theme/site-builder/preview-entry.ts`, `canvas-frame.tsx`, `src/app/api/theme/preview-token/route.ts`, `src/app/store/[host]/preview/route.ts`.  
Unit tests: `tests/unit/theme/preview-entry.test.ts` + `preview-token.test.ts` → **15 passed** (2026-11-10 20:31 IST).

### Dashboard mint UI attempt

| Field | Content |
|---|---|
| **Status** | **BLOCKED** (complete workflow not PASS) |
| **Environment** | Production `www.pictocart.in` / `www.pictocartdev.in`; hosted Supabase `ugbjlpdhktrlkyuijkfc` (read-only membership lookup) |
| **Test performed** | 1) Unauthenticated `POST /api/theme/preview-token` on www + canary. 2) Reconfirm `mintVerify`. 3) Inspect whether any agent-usable seller session exists (seed users / test store ownership). 4) **Did not** password-login to real Gmail owner accounts. |
| **Evidence** | Unauth mint → HTTP **307** `Location: /login?next=%2Fdashboard` (both www + pictocartdev) · **2026-11-10 20:30 IST**. Seed `owner@aangan.test` exists on hosted Auth but **0** `tenant_memberships` (cannot `theme.edit`). Tenant `aangan` **absent** on hosted. `test2test` owner email is a personal Gmail — **no credentials available; not attempted**. |
| **Cookie / CSP / Bot Fight / isolation** | Prior Phase 2 **PASS** on storefront `/preview` probes remains valid; does **not** substitute for dashboard mint UI. |
| **Remaining risk** | Dashboard session cookie / SameSite / Workers route-handler mint path unproven in a real browser session on current build `a23f80d177018561933d7fe01457fe1b`. |
| **Required human action** | Sign in as seller with `theme.edit` → open Theme Editor → DevTools: `POST /api/theme/preview-token` **200** with `ok:true` (do not paste token) → canvas loads store preview. |

**Verdict for Task 1:** complete Theme Editor preview workflow = **Partial PASS** (server path **PASS** + dashboard mint UI **BLOCKED**). Per instructions: **do not mark complete preview workflow PASS**.

---

## Task 2 — Publish / storefront / rollback

### Staging / isolation inspection

| Probe | Result |
|---|---|
| `.env.local` `NEXT_PUBLIC_SUPABASE_URL` host | `ugbjlpdhktrlkyuijkfc.supabase.co` — documented production hosted project (`v2pictocart`) |
| Second / staging Supabase project in env or docs | **Not found** (`.env.example` has single placeholder; no `STAGING_SUPABASE_*`) |
| Local Supabase stack (`supabase status`) | **Unavailable** in this environment |
| `pictocartdev.in` | Canary **DNS/Worker alias** to the **same** Worker + same Supabase — **not** an isolated DB |
| Candidate slug `test2test` | Live **200** on production hostname; memberships exist — still **production data** |

| Field | Content |
|---|---|
| **Status** | **BLOCKED** |
| **Environment tested** | Inspection only (no mutations) |
| **Exact test performed** | Confirmed single hosted project; listed tenants include customer stores + `test2test`; no separate staging project URL/keys present. |
| **Evidence** | Phase 2b membership/tenant reads; `docs/IMPLEMENTATION_STATUS.md` / EMAIL OTP notes naming project `ugbjlpdhktrlkyuijkfc`; platform root in local env is `localhost` but API URL points at hosted prod. |
| **Why publish was not executed** | Would `INSERT`/`UPDATE` `theme_versions` and call `publish_theme` / `rollback_theme` on production. Forbidden by phase safety rules without isolated env or explicit human approval of a disposable store. |
| **Remaining risk** | Publish → `revalidateStorefront` → live visibility → rollback unverified on current Worker build. |
| **Required environment / approval** | Either (A) a dedicated staging Supabase project + Worker pointing at it, **or** (B) written human approval naming a disposable tenant slug whose theme may be published/rolled back, plus a seller session. |

**Manual steps (only after A or B):** draft edit → publish label → incognito storefront confirms → rollback → storefront restored → draft-only never public.

---

## Task 3 — Worker secrets inventory

| Field | Content |
|---|---|
| **Status** | **Partial PASS** (core runtime) + **BLOCKED** (CF version UUID / full dashboard name list) + Redis **WAIVED** (architecture; ops sign-off pending) |
| **Environment** | Production Worker behavior; `.github/workflows/deploy-cloudflare-workers.yml`; `docs/DEPLOY_CLOUDFLARE_WORKERS.md`; ADR-010; local key **presence** only |
| **Timestamp** | 2026-11-10 20:30–20:31 IST |

### Required / optional names (values never printed)

| Name | Required? | Source | Presence evidence this phase |
|---|---|---|---|
| `APP_SECRET` | **Yes** (runtime) | GHA secrets file + schema min 32 | **PASS** — `appSecretPresent: true`; aligned local mint verifies on Worker |
| `CRON_SECRET` | **Yes** (cron) | GHA + schema min 24 | **PASS** — self-test HTTP **200** `mintVerify: ok` (reconfirmed) |
| `SUPABASE_SECRET_KEY` | **Yes** | GHA | **PASS** (indirect) — `/api/health/ready` supabase ok |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | GHA | **PASS** (indirect) — ready + Auth admin reachable |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Yes** | GHA | **PASS** (indirect) — storefronts 200 |
| `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` | **Yes** | Baked `pictocart.in` in GHA JSON | **PASS** (behavioral) — `*.pictocart.in` routing |
| `NEXT_PUBLIC_PLATFORM_URL` | **Yes** | Baked `https://www.pictocart.in` | **PASS** (behavioral) |
| `PLATFORM_HOST_ALIASES` | Optional (defaulted in GHA) | Deploy docs | **Partial PASS** — canary hosts respond |
| `WORKERS_DEV_HOST` | Optional (defaulted) | Deploy docs | **NOT VERIFIED** on Worker bindings list |
| `EMAIL_FROM` | Optional (schema default) | schema / `.env.example` | **NOT VERIFIED** on Worker (absent in local `.env.local`) |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Optional pair | ADR-010 | **NOT VERIFIED**; local absent → L1-only **WAIVED** path |
| `RESEND_API_KEY` | Optional | `.env.example` | **NOT VERIFIED** |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | GHA deploy only | workflow | **BLOCKED** to list — not in agent env; `gh secret list` **403** |

**No production secret values were read into the report or modified.**

### Known-good Worker configuration / version

| Signal | Value | Status |
|---|---|---|
| `x-vinext-build-id` | `a23f80d177018561933d7fe01457fe1b` | Observed Phase 1, 2, 2b on ready + canary |
| Cloudflare Worker **version UUID** | — | **BLOCKED** — no CF dashboard/API access |
| Recent GHA “Deploy Cloudflare Workers” | conclusions **failure** (2026-11-07) | Do not treat GHA as last known-good upload |
| Historical version UUIDs in status docs | Older than current build id | **Stale** — not rollback targets |

### Redis L1-only — formal alternative (**WAIVED**)

| Field | Content |
|---|---|
| **Status** | **WAIVED** as an **architecture-supported** production mode (ADR-010). **Not** an ops-signed production attestation that Worker Redis bindings are intentionally unset. |
| **Support evidence** | ADR-010: unset Upstash = previous L1-only behaviour; `public-cache.ts` fail-open 300ms; rate limits stay Postgres (ADR-025). `.env.example` documents optional Redis. |
| **Limitations** | No cross-isolate L2; storefront stale ≤**120s**; marketplace demo origins ≤**300s** without tag revalidate; no Redis for dashboard/cart/session. |
| **Remaining risk** | Actual Worker may or may not have Upstash set — unverified without CF dashboard. |
| **Required human action** | Countersign: “Worker `pictocart` runs L1-only by choice” **or** confirm both `UPSTASH_REDIS_REST_*` **names** present on Worker. |

---

## Phase 2 carry-forward (server preview path — still PASS)

| Sub-check | Status | Evidence (Phase 2) |
|---|---|---|
| `mintVerify` | **PASS** | Reconfirmed Phase 2b |
| APP_SECRET alignment | **PASS** | External diagnose `ok: true` |
| Valid token → `sf_preview` cookie | **PASS** | 307; httpOnly Secure Lax Max-Age 7200 |
| Expired / wrong tenant / garbage | **PASS** | 403 reasons `expired` / `tenant_mismatch` / `sig_fail` / `missing_token` / `unknown_host` |
| CSP `frame-ancestors` | **PASS** | Includes www + pictocartdev allowlist on storefront |
| Bot Fight behavioral | **PASS** | No challenge HTML / `cf-mitigated` on probed URLs |

---

## Approval matrix (authoritative after Phase 2b)

| Track | Decision | Evidence basis |
|---|---|---|
| Wave A **application code** | **NOT APPROVED** | Dashboard mint UI **BLOCKED**; publish/rollback **BLOCKED**; CF version id **BLOCKED** |
| Wave A **docs/copy** (A2/A3/A4) | **APPROVED to proceed** | Plan parallel gate |
| Production **deployment** | **NOT APPROVED** | Secrets inventory incomplete; no deploy in this phase; GHA deploy history failing |
| Wave B / C | **NOT APPROVED** | Unchanged |

---

## Completeness statement

**Production verification remains incomplete.**

| Verified **PASS** | Authenticated `mintVerify`; preview **server** cookie/CSP/deny/isolation/expiry; core secret **behavior** |
|---|---|
| **Partial PASS** | Theme Editor preview **complete** workflow (server PASS + dashboard mint BLOCKED); Worker secrets inventory (core PASS + CF list/version BLOCKED) |
| **BLOCKED** | Seller dashboard mint UI session; publish→rollback (no isolated staging); CF Worker version UUID / full binding name listing |
| **WAIVED** | Redis L1-only as ADR-010-supported mode (ops countersign still required before treating Redis posture as closed) |

Do **not** treat the platform as production-verification-complete or approve Wave A application code / production deployment until BLOCKED items are cleared with evidence or explicitly signed waivers.
