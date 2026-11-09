# Production Verification Results — Phase 1

_Companion to [`PRODUCTION_VERIFICATION_CHECKLIST.md`](./PRODUCTION_VERIFICATION_CHECKLIST.md) · executed 2026-11-09 22:07 IST (Asia/Kolkata) · **docs/report only** — no deploy, no production writes, no migrations, no application code changes._

**Executor:** Cloud agent (Phase 1)  
**Target:** Production Worker `pictocart` / `www.pictocart.in` + codebase evidence  
**Rules followed:** Non-destructive checks only; no secret values printed; no PASS without evidence.

---

## Executive decision

| Question | Answer |
|---|---|
| Is production verification **complete**? | **No** |
| Wave A **application code** approved? | **No — BLOCKED** until checklist §§2–3 Pass (or documented remediation A1) |
| Wave A **docs-only** (A2/A3/A4) approved? | **Yes — may proceed in parallel** (per execution plan gate) |
| Wave B | **Blocked** — §7.4 has only informal curl TTFB; no demonstrated product pain + no signed measurement |
| Wave C | **Not started** — needs product approval |

### Blockers remaining (Wave A code)

1. **§2.1** Preview self-test with production `CRON_SECRET` → expect `mintVerify: "ok"` (**BLOCKED** — no production cron secret in this environment).  
2. **§2.3–2.7** Seller Theme Editor mint / preflight / cookie / Bot Fight (**MANUAL** + CF dashboard).  
3. **§3.1–3.5** Draft save / publish / storefront reflect / rollback / draft isolation (**MANUAL** on a test store — would mutate theme data if run; not executed here).  
4. **§9.1–9.2** Worker secrets name inventory + current known-good version id (**ENVIRONMENT-DEPENDENT** — CF dashboard / deploy access).

### Non-blockers for Wave A code (still open)

- **§1 Redis** — Worker Redis posture **NOT VERIFIED**; may waive as L1-only (does not require architecture change).  
- **§4 RLS** — local `pnpm test:db` **BLOCKED** (no host PostgreSQL); production RLS spot-checks **MANUAL**.  
- **§5 / §8** CONFLICT / multi-tab — unit evidence for autosave gate only; browser **MANUAL**.  
- **§7** Perf — lab curl TTFB sampled; LCP/editor TTI **NOT VERIFIED**.

---

## Classification legend

| Class | Meaning |
|---|---|
| **AUTOMATABLE** | Safe via commands/tests in this or a CI environment without mutating production data |
| **MANUAL** | Needs browser, seller login, two tabs, or human product sign-off |
| **ENVIRONMENT-DEPENDENT** | Needs production secrets, CF/Supabase/Upstash dashboard, or deploy credentials |

Status values used: **PASS** · **FAIL** · **BLOCKED** · **NOT VERIFIED**  
(N/A reserved for consciously waived items with a written reason.)

---

## Environment capability (this run)

| Capability | Available? | Notes (no secret values) |
|---|---|---|
| Public HTTPS to `www.pictocart.in` | Yes | `/api/health/ready` **200** |
| Production `CRON_SECRET` / Worker secrets | No | Not in process env; Cursor app secrets empty; local `.env.local` must not be assumed to match production |
| Cloudflare dashboard / `cf` CLI authenticated | No | `cf`/`wrangler` not used; no Worker secret name listing |
| Upstash console | No | Local `.env.local` has **no** `UPSTASH_REDIS_REST_*` keys set |
| Local Supabase stack | No | `supabase status` unavailable |
| Host PostgreSQL for `pnpm test:db` | No | `psql` / `pg_isready` missing |
| Unit tests (vitest) | Yes | 7 files / 84 tests passed (see § Evidence packs) |
| Seller browser session | No | No interactive production login in this phase |

**Observed public build id (header only):** `x-vinext-build-id: a23f80d177018561933d7fe01457fe1b` on ready + storefront responses.

---

## Results by checklist item

### §1 Redis production configuration and hit/miss metrics

| # | Item | Class | Method | Actual result | Evidence | Status | Required action |
|---|---|---|---|---|---|---|---|
| 1.1 | Upstash env on Worker | ENVIRONMENT-DEPENDENT | CF Worker Variables/Secrets name check | Cannot list Worker bindings from this environment | No CF access; local `.env.local` Redis keys **absent** (presence-only probe) | **BLOCKED** | Ops: confirm both names on Worker **or** document L1-only waiver |
| 1.2 | Schema allows optional Redis | AUTOMATABLE | Code read | Optional URL + token in `serverEnvSchema` | `src/lib/env/schema.ts` lines ~123–124 | **PASS** | None |
| 1.3 | Fail-open 300ms | AUTOMATABLE | Code read | `REDIS_OP_TIMEOUT_MS = 300`; comments say fail-open | `src/lib/cache/public-cache.ts` | **PASS** | Ops acknowledge fail-open (manual note) |
| 1.4 | Hit/miss metrics | ENVIRONMENT-DEPENDENT | Upstash console / app logs | No Redis instrumentation run; no console access | — | **NOT VERIFIED** | Record Upstash request count or defer to Wave B3 |
| 1.5 | Prefixes `sf:v1` / `pub:v1` | AUTOMATABLE | Code read | Storefront prefix `sf:v1`; marketplace `pub:v1`; invalidation defaults those two | `storefront.ts`, `marketplace/cache.ts`, `public-cache.ts` | **PASS** | None |
| 1.6 | TTL awareness | AUTOMATABLE | Code read | Storefront `STOREFRONT_CACHE_SECONDS = 120`; demo origins `300` | `storefront.ts`; `marketplace/server.ts` | **PASS** | Ops know stale windows |

---

### §2 Theme preview token health

| # | Item | Class | Method | Actual result | Evidence | Status | Required action |
|---|---|---|---|---|---|---|---|
| 2.1 | Self-test `mintVerify` | ENVIRONMENT-DEPENDENT | `GET /api/cron/preview-token-self-test` + Bearer | Unauthenticated call → **401** `{"ok":false,"error":"unauthorized"}` (endpoint alive; auth enforced). Authenticated Pass **not** obtained | curl without secret; production `CRON_SECRET` unavailable here | **BLOCKED** | Ops run appendix command with production secret from secure store |
| 2.2 | `APP_SECRET` stable | ENVIRONMENT-DEPENDENT | Compare Worker secret age / self-test | Cannot confirm rotation state | Docs history mentions past restores; not current proof | **NOT VERIFIED** | Confirm via 2.1 Pass + CF secret audit (names/age only) |
| 2.3 | Seller mint API | MANUAL + ENV | Signed-in `POST /api/theme/preview-token` | Unauthenticated POST followed redirects (**307**); no seller session | curl | **BLOCKED** | Seller opens Theme Editor; expect 200 + token shape |
| 2.4 | Preflight / canvas | MANUAL | Browser Theme Editor | Not executed | — | **NOT VERIFIED** | Manual: canvas loads or clear deny reason |
| 2.5 | Host binding | MANUAL | Wrong-host preview | Not executed | — | **NOT VERIFIED** | Manual: mismatch → deny |
| 2.6 | Bot Fight Mode | ENVIRONMENT-DEPENDENT | CF zone bot management | No CF dashboard access | — | **BLOCKED** | Ops confirm Fight Mode off for iframe preview |
| 2.7 | `sf_preview` cookie | MANUAL | Browser after `/preview?token=` | Not executed | — | **NOT VERIFIED** | Manual: httpOnly cookie on store host |

**Commands for ops (do not echo secret values):**

```bash
# 2.1 — load CRON_SECRET from secure store into the shell env; do not print it
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.pictocart.in/api/cron/preview-token-self-test"
# Expect JSON containing "mintVerify":"ok"
```

---

### §3 Publish and cache invalidation

| # | Item | Class | Method | Actual result | Evidence | Status | Required action |
|---|---|---|---|---|---|---|---|
| 3.1 | Draft save | MANUAL | Edit + autosave on test store | Not run (would write draft) | Code path exists: `saveThemeDraftAction` | **NOT VERIFIED** | Staff-only manual on disposable test store |
| 3.2 | Publish | MANUAL | Publish with label | Not run (would archive/publish) | `publishThemeAction` → `revalidateStorefront` | **NOT VERIFIED** | Manual |
| 3.3 | Storefront reflects publish | MANUAL | Hard-refresh after publish | Not run | Live storefronts respond **200** (baseline only) | **NOT VERIFIED** | Manual after 3.2 |
| 3.4 | Rollback | MANUAL | History UI | Not run | RPC `rollback_theme` in actions | **NOT VERIFIED** | Manual |
| 3.5 | Draft never public | MANUAL | Incognito vs draft-only change | Not run | — | **NOT VERIFIED** | Manual |
| 3.6 | Marketplace demos policy | AUTOMATABLE | Code + call-site search | `SHOWCASE_STORES` code constant; live open via `marketplace/server.ts` @ 300s; `revalidateMarketplaceDemos` **defined, never called** | `showcase.ts`, `server.ts`, `cache.ts`; rg call sites | **PASS** | Prefer document ≤300s TTL (Wave A2 docs); do not wire “for completeness” |
| 3.7 | Post-deploy monitor subset | AUTOMATABLE (partial) | Public ready + storefront | `/api/health/ready` **200** `{ok:true, supabase reachable}`; `november-two` / `nuts-fruits-store` **200**; self-test auth not run | curl 2026-11-09 | **NOT VERIFIED** | Full Pass needs 2.1 + ready + one storefront within 15m of a deploy |

**Safe public probes already used:**

```bash
curl -fsS "https://www.pictocart.in/api/health/ready"
curl -sS -D- -o /dev/null "https://november-two.pictocart.in/" | head
```

---

### §4 Supabase RLS

| # | Item | Class | Method | Actual result | Evidence | Status | Required action |
|---|---|---|---|---|---|---|---|
| 4.1 | Anon cannot read drafts | ENVIRONMENT-DEPENDENT / MANUAL | Anon SELECT or `pnpm test:db` | DB tests not runnable here | RLS tests exist under `tests/rls/` | **BLOCKED** | Run `pnpm test:db` in env with Postgres **or** staff SQL with anon key (read-only) |
| 4.2 | Staff draft read | MANUAL | Seller session | Not run | — | **NOT VERIFIED** | Manual |
| 4.3 | Cross-tenant deny | AUTOMATABLE (CI) / MANUAL | RLS suite | Not run this env | `tests/rls/tenant-isolation.test.ts` references `publish_theme` | **BLOCKED** | CI/`test:db` |
| 4.4 | Publish permission | AUTOMATABLE (CI) / MANUAL | RLS suite | Not run | Same | **BLOCKED** | CI/`test:db` |
| 4.5 | `tenant_is_open` gate | MANUAL / ENV | Suspended store check | Not run | — | **NOT VERIFIED** | Manual on non-prod suspended fixture if available |

**Manual / CI commands:**

```bash
# When host Postgres + local stack available (destructive to *local test DB only* — not production):
pnpm test:db
# Prefer CI green on main for RLS confidence; do not disable RLS in production.
```

---

### §5 Theme draft conflict handling

| # | Item | Class | Method | Actual result | Evidence | Status | Required action |
|---|---|---|---|---|---|---|---|
| 5.1 | Two tabs load | MANUAL | Browser | Not run | — | **NOT VERIFIED** | Manual |
| 5.2 | Stale save → CONFLICT | MANUAL (+ unit partial) | Browser | Server compares `baseUpdatedAt`; UI handles CONFLICT | `theme/actions.ts`; `top-bar.tsx` | **NOT VERIFIED** | Manual two-tab |
| 5.3 | Reload path | MANUAL | Browser | Not run | — | **NOT VERIFIED** | Manual |
| 5.4 | Force save path | MANUAL | Browser | Not run | `force=1` path in actions / legacy editor | **NOT VERIFIED** | Manual |
| 5.5 | Autosave gate during conflict | AUTOMATABLE | Unit test | `shouldScheduleAutosave({ conflict: true }) === false` | `tests/unit/site-builder-autosave.test.ts` **PASS** | **PASS** (unit) | Still confirm in UI (5.2) |

---

### §6 XSS and HTML embed security

| # | Item | Class | Method | Actual result | Evidence | Status | Required action |
|---|---|---|---|---|---|---|---|
| 6.1 | Embeds model | AUTOMATABLE | Schema inspect | Only `whatsapp` + `backToTop` | `schema/site.ts` `embedsSchema` | **PASS** | None — audit XSS claim remains downgraded |
| 6.2 | RichText as text | AUTOMATABLE (code) + MANUAL (UI) | Code: `Paragraphs` renders `{p}` in `<p>`; no `dangerouslySetInnerHTML` in theme render | Confirmed text nodes | `sections-pages.tsx`; rg clean | **PASS** (code) | Optional UI paste spot-check |
| 6.3 | Maps allowlist | AUTOMATABLE | Unit + code | `parseMapsEmbedUrl` only `https://www.google.com/maps/embed…` | `definitions-pages.ts`; `site-builder-page-sections.test.ts` **PASS** | **PASS** | Optional UI paste |
| 6.4 | `javascript:` href | AUTOMATABLE | Unit + code | Theme `isSafeHref` rejects non-https / non-path | `schema/primitives.ts`; content `blocks.test.ts` covers content `isSafeHref` | **PASS** | Optional UI CTA |
| 6.5 | CSP posture | AUTOMATABLE (headers) | curl storefront/www | `Content-Security-Policy: frame-ancestors …` present; **no** full `script-src` | www + storefront response headers | **PASS** (documented posture) | Do not invent full CSP lockdown without inventory |
| 6.6 | CMS cross-tenant images | AUTOMATABLE | Unit | `blocksBelongToTenant` rejects foreign paths | `tests/unit/dashboard/blocks.test.ts` **PASS** | **PASS** (unit) | Optional live save attempt |

---

### §7 Production performance measurements

| # | Item | Class | Method | Actual result | Evidence | Status | Required action |
|---|---|---|---|---|---|---|---|
| 7.1 | Storefront LCP | MANUAL / lab tool | WebPageTest/CrUX/Perf | **Not measured** (curl ≠ LCP) | — | **NOT VERIFIED** | Record LCP with named tool |
| 7.2 | Editor TTI | MANUAL | Performance panel | Not run | — | **NOT VERIFIED** | Manual |
| 7.3 | Publish → visible | MANUAL | Stopwatch | Not run | — | **NOT VERIFIED** | Manual after §3 |
| 7.4 | Heavy template TTFB | AUTOMATABLE (partial lab) | curl TTFB | `november-two` ~6.2s; `nuts-fruits-store` ~7.1s (single samples, cold-ish) | curl `-w time_starttransfer` | **NOT VERIFIED** | Re-measure with waterfall; **do not start Wave B** on this alone |
| 7.5 | Redis vs L1 | ENVIRONMENT-DEPENDENT | Toggle Redis | Cannot toggle Worker env | — | **NOT VERIFIED** | Optional after 1.1 known |
| 7.6 | Logo path cache | AUTOMATABLE (code) + MANUAL | Code: path/URL arg to `unstable_cache`, 7d | Path-keyed behavior documented in code comments | `storefront/server/logo.ts` | **PASS** (code intent) | Manual logo replace optional |

**Informal lab only (not a Pass for 7.4 pain gate):**

```bash
curl -sS -o /dev/null -w "ttfb=%{time_starttransfer}s code=%{http_code}\n" \
  "https://nuts-fruits-store.pictocart.in/"
```

---

### §8 Multi-tab synchronization

| # | Item | Class | Method | Actual result | Evidence | Status | Required action |
|---|---|---|---|---|---|---|---|
| 8.1 | Same-tab canvas sync | MANUAL | Browser | Not run | postMessage architecture in site-builder | **NOT VERIFIED** | Manual |
| 8.2 | No live merge across tabs | AUTOMATABLE (code) + MANUAL | Code: no theme Realtime/Zustand | `rg` finds no zustand/realtime in `src/features/theme` | Code search | **PASS** (by design / code) | Manual confirm B does not auto-update |
| 8.3 | CONFLICT after peer save | MANUAL | See §5 | Not run | — | **NOT VERIFIED** | Manual |
| 8.4 | Phone vs desktop | MANUAL | Devices | Not run | — | **NOT VERIFIED** | Manual |
| 8.5 | Product decision | MANUAL | Stakeholder | No sign-off captured | — | **NOT VERIFIED** | Accept single-active-editor **or** open Wave C ADR |

---

### §9 Deploy safety spot-checks

| # | Item | Class | Method | Actual result | Evidence | Status | Required action |
|---|---|---|---|---|---|---|---|
| 9.1 | Secrets completeness | ENVIRONMENT-DEPENDENT | CF bindings names | Cannot list | Incomplete `--secrets-file` wipe risk documented in deploy runbook | **BLOCKED** | Ops inventory names: Supabase + `APP_SECRET`/`CRON_SECRET`/`EMAIL_FROM` (+ optional Redis/Resend) |
| 9.2 | Known-good Worker version | ENVIRONMENT-DEPENDENT | CF versions | Live build id header only (`a23f80d…`); **Worker version UUID not confirmed this run** | Historical docs cite older version ids | **NOT VERIFIED** | Record current CF Worker version id in ticket |
| 9.3 | Theme rollback UI | MANUAL | Theme Editor history | Not run | `rollback_theme` action present | **NOT VERIFIED** | Manual |
| 9.4 | No `APP_SECRET` rotate on rollback | MANUAL | Ops policy | Confirmation not obtained | Deploy docs warn on secret skew | **NOT VERIFIED** | Ops written confirmation |

---

### §10 Sign-off (this phase)

| Role | Name | Date (Asia/Kolkata) | Notes |
|---|---|---|---|
| Ops / deploy | — | — | **Pending** — §§2.1, 1.1, 9.1–9.2 |
| Engineering | Cloud agent Phase 1 | 2026-11-09 22:07 IST | Code + public probes only; see this report |
| Product (Realtime / CMS) | — | — | N/A — Wave C deferred |

**Overall:** **Not Verified** (incomplete — blockers remain)

**Blockers before Wave A application code:** §2.1 authenticated self-test; §2.3–2.7 editor preview path; §3.1–3.5 publish/rollback smoke (or explicit time-boxed waiver with owner).  

**Blockers before Wave B:** §7.4 signed measurement showing pain.  

**Waivers:** None recorded yet for Redis L1-only (recommended if Worker Redis intentionally unset).

---

## Evidence packs (this run)

### A. Public production probes

| Probe | Result |
|---|---|
| `GET https://www.pictocart.in/api/health/ready` | **200** `{"ok":true,"env":{"ok":true},"supabase":{"ok":true,"detail":"reachable"},"node":"v22.23.4"}` · CSP `frame-ancestors 'self'` · `server: cloudflare` · `x-vinext-build-id: a23f80d177018561933d7fe01457fe1b` |
| `GET https://www.pictocart.in/` | **200** · same CSP / build id |
| `GET https://november-two.pictocart.in/` | **200** · storefront CSP includes platform frame-ancestors allowlist · TTFB ~6.2s |
| `GET https://nuts-fruits-store.pictocart.in/` | **200** · TTFB ~7.1s |
| `GET https://aangan.pictocart.in/` | **404** (host responds; store may be absent) |
| `GET …/api/cron/preview-token-self-test` (no auth) | **401** `unauthorized` |
| `POST …/api/theme/preview-token` (no auth) | **307** (redirect; unauthenticated) |

### B. Unit tests executed (non-destructive)

```text
pnpm exec vitest run \
  tests/unit/site-builder-autosave.test.ts \
  tests/unit/site-builder-page-sections.test.ts \
  tests/unit/dashboard/blocks.test.ts \
  tests/unit/public-cache.test.ts \
  tests/unit/storefront-cache.test.ts \
  tests/unit/theme/preview-token.test.ts \
  tests/unit/rich-text.test.ts
# → 7 files, 84 tests passed
```

### C. Code facts re-confirmed

- Optional Redis: `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` optional in `src/lib/env/schema.ts`  
- Fail-open timeout: `REDIS_OP_TIMEOUT_MS = 300`  
- Prefixes: `sf:v1`, `pub:v1`  
- TTLs: storefront 120s; marketplace demos 300s  
- `revalidateMarketplaceDemos()` never called outside its definition  
- `embedsSchema`: WhatsApp + backToTop only  
- `Paragraphs`: React text children only  
- No Zustand / theme Realtime usage under `src/features/theme`

### D. Local env key presence (values never printed)

| Key | Present in `.env.local`? |
|---|---|
| `APP_SECRET` | yes |
| `CRON_SECRET` | yes |
| `EMAIL_FROM` | no |
| Supabase URL / publishable / secret | yes |
| `UPSTASH_REDIS_REST_*` | no |
| `RESEND_API_KEY` | no |

**Important:** Local presence ≠ production Worker bindings. Local secrets were **not** sent to production endpoints in this phase.

---

## Manual runbook (remaining blockers)

### Ops — Redis / secrets / preview (≈15–30 min)

1. Cloudflare → Worker `pictocart` → Variables/Secrets: tick **names only** for Redis pair (or write “L1-only” waiver).  
2. Confirm names: `APP_SECRET`, `CRON_SECRET`, Supabase keys, `EMAIL_FROM`.  
3. Record current Worker **version id**.  
4. Run §2.1 curl with production `CRON_SECRET` from password manager (never paste into chat).  
5. Zone → Bot Fight Mode: confirm off for preview iframes.

### Seller QA — Theme Editor / publish (test store only)

1. Open `/dashboard/theme` on a disposable store.  
2. Confirm preview canvas (§2.3–2.7).  
3. Two-tab CONFLICT (§5 / §8).  
4. Draft → Publish → hard refresh storefront → Rollback (§3.1–3.5).  
5. Optional: paste `<script>` in body, bad map iframe, `javascript:` CTA (§6 UI).

### Perf (before any Wave B)

1. Capture LCP (CrUX or WebPageTest) for one real store home.  
2. Capture heavy-page TTFB + waterfall (§7.4).  
3. Start B1 only if pain is clear vs baseline.

---

## Approval decision for Wave A

| Track | Decision | Rationale |
|---|---|---|
| **Wave A application code** (A1 code remediations, A5 audit log, optional A2 wire-up) | **NOT APPROVED** | §§2–3 production evidence incomplete; §2.1 BLOCKED |
| **Wave A docs / copy** (A2 docs TTL, A3 AI draft copy, A4 single-editor doc) | **APPROVED to proceed** | Explicitly allowed parallel to checklist by execution plan; no architecture change |
| **Wave B** | **NOT APPROVED** | §7.4 not Pass; informal curl TTFB is not a batching mandate |
| **Wave C** | **NOT APPROVED** | No product ask / ADR |

---

## Completeness statement

**Production verification is incomplete.**

Remaining blockers before claiming checklist complete / Wave A code gate open:

1. Authenticated production preview self-test (`mintVerify: ok`).  
2. Seller Theme Editor preview path (mint, preflight, cookie, Bot Fight).  
3. Publish / rollback / draft-isolation smoke on a test store.  
4. Worker secrets name inventory + recorded known-good version (or Redis L1-only waiver for §1.1).

Safe automated/code evidence from this phase supports: optional Redis schema, fail-open + prefixes + TTLs, demo-cache policy, embeds/XSS downgrade, CSP `frame-ancestors`, autosave conflict gate (unit), maps/href/CMS tenant checks (unit), and public platform readiness (`/api/health/ready` + live storefronts **200**).
