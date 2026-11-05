# Observability — Phase 1 (login path)

Architecture assessment and instrumentation notes. **Do not optimize login latency until the baseline table below has measured evidence.**

## Current state

| Piece | Status |
|---|---|
| Structured logger | Yes — `src/lib/observability/logger.ts` (JSON lines, redaction, `LOG_LEVEL`) |
| Request correlation | Yes — proxy sets `x-request-id` (`REQUEST_ID_HEADER` in `src/lib/tenant/routing.ts`) on every response |
| OpenTelemetry / tracing SDK | **No** — no OTel exporter, no collector, no span processor |
| Admin UI / telemetry schema | Yes — `/admin/performance/*` + migration `20261104007000_observability_center.sql` |
| Cron `/api/cron/observability` | Yes — retention cleanup (`observability_cleanup`) **then** alert evaluation (`evaluateAndRecordAlertsForCron`); alert failures soft-fail and still return the cleanup result |

Phase 1 adds **fail-soft wall-clock spans** on the login path (`obs.span` log lines + optional `Server-Timing` on the proxy response). Sampled rows are scheduled via `recordRequestEvent` / `after()` (fail-soft; never blocks auth). Status ≥ 400 auto-derives `error_fingerprint` / `error_message`; ingest upserts `observability_error_groups`.

## Login path map

Critical path when a signed-in (or cookie-bearing) visitor hits `/login` or `/seller/login`:

```
proxy (src/proxy.ts)
  └─ if sb-*-auth-token cookie → supabase.auth.getClaims()   [session refresh]
       + Server-Timing: proxy.claims
SharedSignInPage (src/features/auth/sign-in-page.tsx)
  └─ loadSignInSession
       ├─ getSessionUser (src/lib/auth/session.ts)
       │    ├─ auth.getClaims()
       │    └─ profiles select (display_name, status)
       └─ landingPathFor (src/lib/auth/landing.ts)
            └─ accountAccessFor
                 ├─ tenant_memberships count
                 └─ platform_memberships select
```

Anonymous first paint still runs `loadSignInSession` (getSessionUser → null); proxy skips getClaims when no auth cookie.

## How to read timings

### Structured logs (`obs.span`)

Each span is one JSON line from the logger:

```json
{"level":"info","msg":"obs.span","time":"2026-11-04T14:00:00.000Z","span":"session.getClaims","ms":42.3,"requestId":"…"}
```

Filter production / `next start` logs for `"msg":"obs.span"` (or `obs.span`). Correlate with `requestId` = response `x-request-id`.

Useful span names (Phase 1):

| Span | Where |
|---|---|
| `proxy.claims` | Proxy session refresh |
| `session.getClaims` | `getSessionUser` JWT validation |
| `session.profile` | `getSessionUser` profiles row |
| `sign_in.getSessionUser` | Shared sign-in page |
| `sign_in.landingPathFor` | Shared sign-in page |
| `landing.tenantMemberships` | `accountAccessFor` |
| `landing.platformMemberships` | `accountAccessFor` |
| `public_config.load` | Optional public platform config |

### Server-Timing (browser / curl)

When proxy measures claims refresh, the response includes:

```http
Server-Timing: proxy.claims;dur=42.3
```

In Chrome DevTools → Network → Timing → Server Timing, or:

```bash
curl -sI -H 'Cookie: …' 'http://localhost:3000/login' | grep -i server-timing
```

## Baseline evidence (Phase A — 2026-11-05)

Measure on a production build (`pnpm build` + `pnpm start`), same host/cookie conditions for Cold vs Warm. Leave cells blank until measured; **optimization waits for evidence.** **Do not claim login is fixed** from this baseline alone.

### Prod curl (anonymous, no auth cookie) — 2026-11-05

From Cloud Agent egress (edge POP `iad1`, function region `bom1` per `x-vercel-id`). Method: `curl` GET with `-w '%{time_starttransfer} %{time_total}'`. Cache: always `x-vercel-cache: MISS`, `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`, `age: 0`.

| URL | Cold TTFB (s) | Warm TTFB (s) | Cold total (s) | Warm total (s) | `x-vercel-id` region | Server-Timing | Sample `x-request-id` |
|---|---:|---:|---:|---:|---|---|---|
| `https://www.pictocart.in/login` | **0.764** (first); later idle ~0.31–0.32 | **0.288–0.377** (median ~0.33) | 1.352 (first body); warm ~0.29–0.35 | ~0.29–0.35 | `iad1::bom1::…` | **Absent** (anonymous) | cold `e126707e-…`; warm `e8e4cf67-…` |
| `https://www.pictocart.in/seller/login` | **0.693** | **0.325** | 0.697 | 0.328 | `iad1::bom1::…` | **Absent** (anonymous) | cold `9858bd15-…`; warm `a9201780-…` |
| `https://www.pictocartdev.in/login` | **0.435** (then idle ~0.37) | **0.329–0.380** | 0.448 | ~0.33–0.40 | `iad1::bom1::…` | **Absent** (anonymous) | cold `ac6e1e31-…`; warm `3103120f-…` |

Notes on these numbers:

- **Anonymous path only** — no `sb-*-auth-token` cookie, so proxy skips `getClaims` and does **not** emit `Server-Timing: proxy.claims` (by design in `src/proxy.ts`).
- First hit after a quiet period can be ~2× warm (~0.69–0.76 s vs ~0.33 s). A short 8 s idle did **not** reproduce a 0.7 s cold — true cold isolates are intermittent on Vercel.
- Warm `/login` repeats (n=3+): TTFB ≈ **287–377 ms**. All MISS (HTML login is intentionally uncacheable).
- `vercel.json` → `"regions": ["bom1"]` matches response `x-vercel-id` function segment `bom1`. Edge segment `iad1` is the measuring client's POP, not the app region.

### Span-level table (still mostly unknown without signed-in cookie + logs)

| Span / stage | Cold (ms) | Warm (ms) | Notes / date |
|---|---:|---:|---|
| `proxy.claims` | _unknown_ | _unknown_ | Needs auth cookie; Server-Timing then expected on response |
| `session.getClaims` | _unknown_ | _unknown_ | Needs `obs.span` / admin telemetry or signed-in Server-Timing correlation |
| `session.profile` | _unknown_ | _unknown_ | |
| `sign_in.getSessionUser` | _unknown_ | _unknown_ | Includes claims + profile when signed in |
| `sign_in.landingPathFor` | _unknown_ | _unknown_ | Includes memberships; only when `getSessionUser` non-null |
| `landing.tenantMemberships` | _unknown_ | _unknown_ | |
| `landing.platformMemberships` | _unknown_ | _unknown_ | |
| End-to-end `/login` TTFB (signed-in) | _unknown_ | _unknown_ | Not measured Phase A (no session cookie in agent) |
| End-to-end `/login` TTFB (anonymous) | **~690–760** (true cold) | **~290–380** | Prod `www.pictocart.in`, 2026-11-05; see table above |

Cold = fresh Node process / new serverless isolate. Warm = same process, caches warm.

### Auth redirect behavior (code review — Phase A)

| Path | Behavior | Evidence |
|---|---|---|
| Signed-in store owner / staff hitting `/login` or `/seller/login` | **Client redirect** after draft clear — **not** a server `redirect()` | `SharedSignInPage` returns `<ClearStartDraftOnLogin signedInLanding={panelLanding} />`; client `router.replace(signedInLanding)` in `clear-start-draft-on-login.tsx` |
| Signed-in account with onboarding landing (`/start…`) | **Stays on login form** with “already signed in” UI | `signedInNoStore` branch in `sign-in-page.tsx` |
| Anonymous | Renders sign-in form; proxy skips claims | `proxy.ts` `hasSupabaseAuthCookie` gate |
| Protected routes (`requireUser`) | **Server** `redirect()` to login | `session.ts` `requireUser` |
| Double `getClaims` when cookie present | Proxy then RSC `getSessionUser` — React.cache does not span proxy→RSC | `proxy.ts` + `session.ts` |

### `OBSERVABILITY_ENABLED` (production)

| Check | Result |
|---|---|
| Unauthenticated `GET /admin/performance` | **307** → `/login?next=%2Fadmin` (cannot read settings UI) |
| Unauthenticated `/admin/performance/settings` | Same 307 |
| `.env.example` | No `OBSERVABILITY_*` keys documented |
| Agent `.env.local` | No `OBSERVABILITY_ENABLED` / `OBSERVABILITY_LOGIN_SPANS` set |
| Inference from anonymous curl | **Cannot infer** — no Server-Timing on anonymous (expected anyway); no public flag endpoint |

Treat production master switch as **unknown** until an authenticated admin opens Monitoring settings or Vercel env is inspected by an operator.

### JWT / Supabase (public only — no secrets)

Production HTML references project host `ugbjlpdhktrlkyuijkfc.supabase.co` (same as local `NEXT_PUBLIC_SUPABASE_URL` host). Public Auth JWKS:

- `GET /auth/v1/.well-known/jwks.json` → **200**, one **ES256** EC P-256 key with a **`kid`**
- OpenID config lists `id_token_signing_alg_values_supported`: RS256, HS256, ES256

So the project **publishes asymmetric verify keys**. That supports local `getClaims()` verification when tokens carry a matching `kid` (avoids network `getUser` fallback described in `docs/PERFORMANCE_AUDIT.md`). Phase A did **not** decode a live session JWT (no cookie); whether every issued access token is ES256+kid in prod remains **ops-confirm** (Supabase → Auth → JWT signing keys / a real `sb-*-auth-token` header decode of `alg`/`kid` only).

JWKS cold fetch from the measuring host was ~0.83 s TTFB once — consistent with cold Auth/JWKS cost on a new isolate; warm claims should be local crypto if ES256+kid holds.

## Env vars

| Variable | Values | Effect |
|---|---|---|
| `OBSERVABILITY_ENABLED` | `true` / `false` / unset | Master switch. `true` → `obs.span` at **info**. `false` → spans never at info (debug only / off for ops). Unset → default off at info. |
| `OBSERVABILITY_LOGIN_SPANS` | `1` / unset | When `1` and `OBSERVABILITY_ENABLED` is **not** `false`, login-path spans log at **info** even if the master flag is unset. |
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` | Logger floor. Spans that fall to debug need `LOG_LEVEL=debug`. |

Helpers live in `src/lib/observability/timing.ts` (`timeAsync`, `serverTimingHeader`, `logSpan`).

## Rollback

Set:

```bash
OBSERVABILITY_ENABLED=false
```

(and unset `OBSERVABILITY_LOGIN_SPANS` if set). Redeploy / restart. Instrumentation stays in code but stops emitting info-level span noise; auth behavior is unchanged (all timing is fail-soft).

## Database performance note

The admin **Database performance** page aggregates spans whose names contain `db.`, `supabase.`, or `rpc` from `observability_request_events.spans`. It does **not** query Postgres `pg_stat_statements`. Enabling `pg_stat_statements` remains **optional ops** (Supabase/Postgres dashboard / SQL) when investigating DB-side query cost outside the app.

## Out of scope (later phases)

- OpenTelemetry SDK + exporter / collector
- Full coverage of every API route (MVP samples allowlisted + slow/error + sample rate)
- Auto-remediation of login latency without baseline numbers

## Phase 7 login findings

Instrumentation is live on the login path (`obs.span`, optional `Server-Timing: proxy.claims`, optional request header `x-pc-claims-ms` when the proxy measured claims). Phase A filled **anonymous** end-to-end TTFB on production; **per-span bottlenecks for signed-in traffic remain TBD** until cookie-bearing curl or admin telemetry is collected. Do not treat anonymous TTFB alone as a login “fix.”

### Safe structural notes (not yet “fixed”)

- **Double `getClaims` when a session cookie is present:** proxy refreshes/validates via `supabase.auth.getClaims()`, then the RSC sign-in path runs `getSessionUser` → `getClaims` again (React.cache only dedupes within the RSC tree, not across proxy → page). Skipping the page-side verify would weaken auth; keep both until JWT verification mode and cache strategy are confirmed.
- **Vercel region confirmed in prod responses:** `vercel.json` `bom1` and live `x-vercel-id` function segment `bom1` (2026-11-05). Supabase project region vs `bom1` co-location still ops-confirm.
- **JWT:** public JWKS is ES256 + `kid` for the production project ref (see Phase A). Still confirm issued access tokens use that key (not legacy HS256-only).
- **Anonymous / signed-out cold login:** proxy already skips claims when no `sb-*-auth-token` cookie; measured anonymous warm TTFB ~300 ms, intermittent cold ~700 ms. Membership queries only run when signed in (`landingPathFor` already parallelizes tenant + platform memberships via `Promise.all`).
- **Signed-in panel bounce is client-side** (`ClearStartDraftOnLogin` → `router.replace`) so users still pay full RSC `loadSignInSession` (claims + landing) before the client navigation — a Phase B UX/perf tradeoff if draft-clear can move earlier or server-redirect after a cookie-safe clear path.
- **`getSessionUser` remains sequential claims → profile** (profile query needs `claims.sub`); React.cache avoids duplicate work within one RSC request.
- **No unverified “fixed 12.5s” claim.** Any end-to-end login latency number must come from correlated `requestId` spans (and preferably production), not anecdote.

### Optional correlation header

When the proxy measures claims, it sets internal request header `x-pc-claims-ms` (stripped from clients; see `PROXY_CLAIMS_MS_HEADER`). `SharedSignInPage` logs `proxy.claims.header` so RSC logs can sit next to `session.getClaims` under the same `requestId`. This does not remove the second verify.

## Optimization candidates → recommended Phase B (evidence-justified)

Candidates only — **do not claim login is fixed.** Phase A justifies the order below; expected wins are planning guesses, not SLAs.

| Priority | Candidate | Evidence from Phase A / code | Expected win (if confirmed) | Risk |
|---|---|---|---|---|
| **B1** | Enable / confirm `OBSERVABILITY_ENABLED` (or `OBSERVABILITY_LOGIN_SPANS=1`) in prod + collect signed-in spans | Flag **unknown** without admin; anonymous curl cannot see span breakdown; Server-Timing only with cookie | Unblocks real `proxy.claims` / `session.*` numbers before more code changes | Ops-only; keep fail-soft |
| **B2** | Confirm issued JWTs are ES256+`kid` (already JWKS-public); migrate if any HS256 path remains | Public JWKS is ES256+kid; PERFORMANCE_AUDIT warns HS256 → network `getUser` | Removes Auth RTTs on signed-in proxy+RSC claims | Config; verify with one real token header |
| **B3** | Measure signed-in `/login` cold/warm (cookie) and compare `proxy.claims` vs `session.getClaims` on one `x-request-id` | Anonymous path skips claims; double-verify only matters when cookie present | Decide whether dedupe/cache across proxy→RSC is worth it | Must not skip RSC auth boundary |
| **B4** | Revisit client-only signed-in bounce (`ClearStartDraftOnLogin`) vs server redirect after draft clear | Code: full session+landing work then client `replace` — adds a round trip after TTFB | Saves one client navigation RTT for returning sellers; draft-clear must still run | UX/cookie clear must not regress |
| **B5** | Keep memberships on `Promise.all` (already done); overlap public config (already warmed in parallel) | Code already overlaps `getPublicPlatformConfig` with session | Marginal; already shipped | Low |
| Later | Dedupe JWT verify proxy→RSC | Needs B1–B3 numbers showing both spans large | ~one claims cost | Auth boundary |

**Not justified yet by Phase A alone:** claiming a specific claims-ms regression, changing region away from `bom1`, or shipping login “fixes” without signed-in span evidence. Anonymous ~300 ms warm / ~700 ms cold is a floor for the signed-out HTML path only.
