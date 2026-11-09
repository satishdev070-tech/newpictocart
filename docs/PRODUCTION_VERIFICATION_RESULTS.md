# Production Verification Results

_Companion to [`PRODUCTION_VERIFICATION_CHECKLIST.md`](./PRODUCTION_VERIFICATION_CHECKLIST.md)._

| Phase | When (Asia/Kolkata) | Scope |
|---|---|---|
| **Phase 1** | 2026-11-09 22:07 IST | Classify checklist; safe public/code/unit probes |
| **Phase 2** | 2026-11-09 22:20–22:23 IST | Resolve four Wave A blockers with evidence |

**Rules followed:** No application code changes · no deploy · no migrations · **no production data writes** · secrets never printed · no PASS without evidence · architecture preserved.

**Environments touched:** Production Worker `pictocart` / `www.pictocart.in` (read-only HTTPS); production Supabase project referenced by local `.env.local` (read-only REST selects + in-process crypto only). Local platform root remains `localhost` (not used as a full staging app in this phase).

---

## Final decision (Phase 2)

| Question | Answer |
|---|---|
| Are all **four** blockers resolved? | **No** — **2 of 4** resolved; **2 remain human/ops** |
| Wave A **application code** approved? | **No — NOT APPROVED** |
| Production **deployment** approved? | **No — NOT APPROVED** (and out of scope: this phase did not deploy) |
| Wave A **docs-only** (A2/A3/A4)? | **Yes — may proceed** |
| Wave B / C? | **Not approved** |

### Four blockers — status summary

| # | Blocker | Status | Owner |
|---|---|---|---|
| 1 | Authenticated `mintVerify` | **PASS** | — |
| 2 | Seller Theme Editor preview (token / preflight / cookie / CSP / Bot Fight / isolation / invalid+expired) | **PASS** (HTTP/crypto path) with residual **seller-dashboard mint UI** not browser-tested | Seller QA optional for UI chrome |
| 3 | Publish → storefront → rollback | **BLOCKED** | Human on disposable test store |
| 4 | Worker secrets inventory + known-good version + Redis waiver | **PARTIAL** — core secrets **PASS** by behavior; CF version id + full name listing + Redis posture **NOT VERIFIED / WAIVED candidate** | Ops (CF dashboard) |

### Human actions still required before Wave A application code

1. **Publish / rollback smoke** on an explicitly owned disposable store (candidate slug `test2test` exists and returns **200**, but was **not** mutated here because it shares the production Supabase project).  
2. **Cloudflare Worker** dashboard: record current **version UUID**; confirm secret **names** inventory (esp. `EMAIL_FROM`, optional Redis/Resend); either set Upstash pair **or** sign **L1-only waiver**.  
3. Optional: signed-in Theme Editor open on a test store to confirm canvas preflight UX (server preview path already evidenced).

---

## Phase 2 — Blocker detail

### 1. Authenticated `mintVerify` — PASS

| Field | Content |
|---|---|
| **Status** | **PASS** |
| **Environment** | Production `https://www.pictocart.in` |
| **Auth mechanism** | `GET /api/cron/preview-token-self-test` requires `Authorization: Bearer <CRON_SECRET>`; compare via SHA-256 + `timingSafeEqual` (`src/features/domains/cron-auth.ts`). Unset/short secret never authorizes. Handler mints+verifies in-process with Worker `APP_SECRET` (no DB write). |
| **Requirements** | Worker must have `CRON_SECRET` ≥24 chars and `APP_SECRET` ≥32; same values used by mint+verify. |
| **Test performed** | Loaded `CRON_SECRET` from local `.env.local` into curl **without printing**; called production self-test. |
| **Evidence** | HTTP **200**; JSON `ok: true`, `mintVerify: "ok"`, `appSecretPresent: true`, `controls.wrongTenant: "tenant_mismatch"`, `controls.garbage: "sig_fail"` · **2026-11-09 22:20:42 IST** |
| **Remaining risks** | Local `.env.local` `CRON_SECRET` matches production today; rotation without updating local ops notes would break this probe. Do not commit secrets. |
| **Required action** | None for this blocker. Re-run after every Worker secrets deploy. |

**Command (ops; do not echo secret):**

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.pictocart.in/api/cron/preview-token-self-test"
# Expect: "mintVerify":"ok"
```

---

### 2. Seller Theme Editor preview — PASS (server path)

| Field | Content |
|---|---|
| **Status** | **PASS** for mint/verify alignment, `/preview` cookie, CSP `frame-ancestors`, deny reasons, expired/invalid/tenant isolation, Bot Fight behavioral check. **NOT VERIFIED** for signed-in dashboard `POST /api/theme/preview-token` UI session. |
| **Environment** | Production storefront `nuts-fruits-store.pictocart.in` (read-only preview probes); production self-test for external token diagnose. |
| **Tests performed** | See table below. Tokens minted with local `APP_SECRET` (proven aligned to Worker) — **token values never logged**. |

| Sub-check | Result | Evidence |
|---|---|---|
| Local `APP_SECRET` ↔ Worker | **PASS** | External diagnose on self-test: fresh token `external.ok: true` (**22:22 IST**) |
| Expired token (diagnose) | **PASS** | `external.reason: "expired"` |
| Wrong tenant (diagnose) | **PASS** | `external.reason: "tenant_mismatch"` |
| Garbage / missing / malformed `/preview` | **PASS** | `403` + `data-preview-error` = `sig_fail` / `missing_token` / `sig_fail`; `unknown_host` on `aangan.pictocart.in` |
| Valid token → cookie | **PASS** | `307` → `/`; `Set-Cookie: sf_preview` **httpOnly**, **Secure**, **SameSite=Lax**, `Max-Age=7200` (with `parent=https://www.pictocart.in` also Lax) |
| Expired on `/preview` | **PASS** | `403` `expired`; no cookie set |
| Wrong tenant on `/preview` | **PASS** | `403` `tenant_mismatch`; no cookie |
| CSP `frame-ancestors` | **PASS** | Storefront allows `'self'` + `www.pictocart.in` + canary/workers.dev origins |
| Bot Fight on preview | **PASS** (behavioral) | No `cf-mitigated`, no challenge HTML on `/preview` 403 or storefront **200**; CF dashboard Fight Mode toggle **not** inspected |
| Seller mint API (session) | **NOT VERIFIED** | Unauthenticated `POST /api/theme/preview-token` → **307**; no seller session in this agent |
| Canvas preflight UX | **NOT VERIFIED** (UI) | Preflight logic is code-backed; server `/preview` outcomes above are what preflight consumes |

| Remaining risks | Required action |
|---|---|
| Bot Fight could still be toggled on later; dashboard cross-site (`pictocartdev.in`) needs Partitioned cookie path in a browser | Optional seller QA on Theme Editor; ops keep Fight Mode off |

---

### 3. Publish → storefront → rollback — BLOCKED

| Field | Content |
|---|---|
| **Status** | **BLOCKED** |
| **Environment tested** | None for mutations. Read-only discovery only. |
| **Exact reason** | Safety rules forbid **modifying production data**. Local `.env.local` `NEXT_PUBLIC_SUPABASE_URL` host is `*.supabase.co` and serves live Pictocart tenants (e.g. `nuts-fruits-store`, `november-two`). Publishing/rolling back would write `theme_versions` in that project. No isolated staging database or approved disposable-store waiver was provided. |
| **Candidate test store (not used)** | Slug `test2test` — HTTP **200** on `https://test2test.pictocart.in/` · still on the **same** production Supabase project → **not** mutated without explicit human ownership. |
| **Code path evidence (not a Pass)** | `publishThemeAction` / `rollback_theme` → `revalidateStorefront` in `src/features/theme/actions.ts` |
| **Remaining risks** | Untested publish→cache→rollback on current Worker build |
| **Required owner/action** | Human seller/ops on an **explicitly disposable** store: draft edit → publish → hard-refresh storefront → rollback → confirm live theme. Record timestamps. Do **not** use customer stores (`nuts-fruits-store`, etc.). |

**Manual steps (human):**

1. Sign in as owner of disposable store (e.g. only if `test2test` is confirmed internal).  
2. `/dashboard/theme` → change a harmless heading → wait autosave.  
3. Publish with label `verify-phase2`.  
4. Incognito storefront hard-refresh → heading visible.  
5. Rollback to prior version → storefront matches prior.  
6. Confirm draft-only edits never appear on incognito before publish.

---

### 4. Worker secrets inventory — PARTIAL

| Field | Content |
|---|---|
| **Status** | **PARTIAL** — behavioral proof for core runtime secrets; CF name listing + version UUID + Redis **unverified** |
| **Environment** | Production Worker behavior + deploy workflow/docs + local key **presence** (no values) |

#### Required names (from `.github/workflows/deploy-cloudflare-workers.yml` secrets file)

| Name | Role | This-phase evidence |
|---|---|---|
| `APP_SECRET` | Preview HMAC / crypto | **PASS** — `appSecretPresent: true` + local-minted token verifies on Worker |
| `CRON_SECRET` | `/api/cron/*` Bearer | **PASS** — authenticated self-test **200** |
| `SUPABASE_SECRET_KEY` | Server Supabase | **PASS** (indirect) — `/api/health/ready` supabase `ok` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | **PASS** (indirect) — ready probe |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon/publishable | **PASS** (indirect) — ready / storefronts **200** |
| `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` | Host routing | Expected `pictocart.in` (baked in GHA JSON) — storefronts resolve |
| `NEXT_PUBLIC_PLATFORM_URL` | Platform URL | Expected `https://www.pictocart.in` |
| `PLATFORM_HOST_ALIASES` | Canary hosts | Optional w/ GHA default |
| `WORKERS_DEV_HOST` | workers.dev alias | Optional w/ GHA default |
| `EMAIL_FROM` | Mail from | Schema default exists; **name on Worker NOT VERIFIED** (local `.env.local` absent) |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | Optional L2 | **NOT VERIFIED** on Worker; absent locally → **L1-only waiver candidate** |
| `RESEND_API_KEY` | Optional email send | **NOT VERIFIED** |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | GHA deploy only | **NOT** in agent env; GH secrets list API **403** |

#### Known-good Worker configuration/version

| Signal | Value | Status |
|---|---|---|
| `x-vinext-build-id` (response header) | `a23f80d177018561933d7fe01457fe1b` | Observed Phase 1+2 |
| Cloudflare Worker **version UUID** | — | **NOT VERIFIED** (no CF API token; recent GHA deploy runs on `main` show **failure**) |
| Historical docs versions | e.g. `0a274bfc-…`, `7e11567d-…` | Stale relative to current build id — do not treat as current rollback target without dashboard confirm |

#### Redis L1-only — supported alternative (waiver text)

Per ADR-010 / `public-cache.ts`: unset Upstash env → L1 `unstable_cache` only; Redis errors fail open (300ms). **Limitations:** no cross-isolate L2; storefront stale window up to **120s**; marketplace demo origins up to **300s** without tag revalidate. **Not** used for dashboard/private data or rate limits (ADR-025 Postgres).

**Waiver (unsigned — needs ops signature):**  
> Production Worker `pictocart` may run **without** `UPSTASH_REDIS_REST_*` (L1-only). We accept fail-open behavior and TTL stale windows above. This is not an architecture defect.

| Remaining risks | Required action |
|---|---|
| Incomplete `--secrets-file` can wipe bindings on next deploy | Ops: dashboard name inventory before any deploy; never upload partial secrets |
| No recorded CF version UUID for instant rollback | Ops: copy version id from CF dashboard into runbook |
| Redis posture unknown | Sign L1-only waiver **or** confirm Upstash names present |

---

## Phase 1 carry-forward (unchanged conclusions unless superseded)

Phase 1 public probes and unit evidence remain valid:

- `/api/health/ready` **200**; storefronts **200**; CSP `frame-ancestors` present  
- Code/unit **PASS**: optional Redis schema, prefixes/TTLs, embeds XSS downgrade, maps/href/CMS tenant, autosave conflict gate  
- §3 publish mutations, §4 RLS `test:db`, §5/§8 browser CONFLICT, §7 LCP — still open / not Wave A code gates except publish smoke (blocker 3)

---

## Approval matrix (authoritative)

| Track | Decision | Evidence basis |
|---|---|---|
| Wave A **application code** | **NOT APPROVED** | Blocker 3 (publish/rollback) still **BLOCKED**; blocker 4 incomplete (version id / Redis waiver unsigned) |
| Wave A **docs/copy** (A2/A3/A4) | **APPROVED to proceed** | Plan allows parallel; no architecture change |
| Production **deployment** | **NOT APPROVED** | Not requested; GHA deploy history failing; secrets inventory incomplete; no new deploy in this phase |
| Wave B | **NOT APPROVED** | No §7.4 pain evidence |
| Wave C | **NOT APPROVED** | No product ADR |

---

## Completeness statement

**Production verification remains incomplete.**

Resolved with evidence in Phase 2: authenticated **`mintVerify: ok`**, preview token security/cookie/CSP/isolation/expiry paths, behavioral Bot Fight clear, core Worker secret **presence** via runtime behavior.

Still blocking Wave A application code / claiming production-ready verification:

1. Human publish → storefront → rollback on a disposable store (no production customer stores).  
2. Ops: CF Worker version UUID + secrets **name** inventory + Redis L1-only waiver **or** Upstash confirmation.
