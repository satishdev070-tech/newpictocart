# Observability — Phase 1 (login path)

Architecture assessment and instrumentation notes. **Do not optimize login latency until the baseline table below has measured evidence.**

## Current state

| Piece | Status |
|---|---|
| Structured logger | Yes — `src/lib/observability/logger.ts` (JSON lines, redaction, `LOG_LEVEL`) |
| Request correlation | Yes — proxy sets `x-request-id` (`REQUEST_ID_HEADER` in `src/lib/tenant/routing.ts`) on every response |
| OpenTelemetry / tracing SDK | **No** — no OTel exporter, no collector, no span processor |
| Admin UI / telemetry schema | Yes — `/admin/performance/*` + migration `20261104007000_observability_center.sql` |

Phase 1 adds **fail-soft wall-clock spans** on the login path (`obs.span` log lines + optional `Server-Timing` on the proxy response). Sampled rows are scheduled via `recordRequestEvent` / `after()` (fail-soft; never blocks auth).

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

## Baseline evidence (fill after measuring)

Measure on a production build (`pnpm build` + `pnpm start`), same host/cookie conditions for Cold vs Warm. Leave cells blank until measured; **optimization waits for evidence.**

| Span / stage | Cold (ms) | Warm (ms) | Notes / date |
|---|---:|---:|---|
| `proxy.claims` | _TBD_ | _TBD_ | Auth cookie present |
| `session.getClaims` | _TBD_ | _TBD_ | |
| `session.profile` | _TBD_ | _TBD_ | |
| `sign_in.getSessionUser` | _TBD_ | _TBD_ | Includes claims + profile |
| `sign_in.landingPathFor` | _TBD_ | _TBD_ | Includes memberships |
| `landing.tenantMemberships` | _TBD_ | _TBD_ | |
| `landing.platformMemberships` | _TBD_ | _TBD_ | |
| End-to-end `/login` TTFB (signed-in) | _TBD_ | _TBD_ | |
| End-to-end `/login` TTFB (anonymous) | _TBD_ | _TBD_ | |

Cold = fresh Node process / new serverless isolate. Warm = same process, caches warm.

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

Instrumentation is live on the login path (`obs.span`, optional `Server-Timing: proxy.claims`, optional request header `x-pc-claims-ms` when the proxy measured claims). **Measured bottleneck is TBD** until production spans are collected into the baseline table above — do not treat any single lab timing as a fixed claim.

### Safe structural notes (not yet “fixed”)

- **Double `getClaims` when a session cookie is present:** proxy refreshes/validates via `supabase.auth.getClaims()`, then the RSC sign-in path runs `getSessionUser` → `getClaims` again (React.cache only dedupes within the RSC tree, not across proxy → page). Skipping the page-side verify would weaken auth; keep both until JWT verification mode and cache strategy are confirmed.
- **Recommend verifying** Supabase auth JWT mode (asymmetric / local verify vs network `getUser` fallback) and that production stays on the **Vercel `bom1`** region (see `vercel.json`) next to the Supabase project region.
- **Anonymous / signed-out cold login:** proxy already skips claims when no `sb-*-auth-token` cookie; `getSessionUser` returns null quickly after failed/empty claims. Membership queries only run when signed in (`landingPathFor` already parallelizes tenant + platform memberships via `Promise.all`).
- **`getSessionUser` remains sequential claims → profile** (profile query needs `claims.sub`); React.cache avoids duplicate work within one RSC request.
- **No unverified “fixed 12.5s” claim.** Any end-to-end login latency number must come from correlated `requestId` spans (and preferably production), not anecdote.

### Optional correlation header

When the proxy measures claims, it sets internal request header `x-pc-claims-ms` (stripped from clients; see `PROXY_CLAIMS_MS_HEADER`). `SharedSignInPage` logs `proxy.claims.header` so RSC logs can sit next to `session.getClaims` under the same `requestId`. This does not remove the second verify.

## Optimization candidates

Candidates only — **do not claim login is fixed** until the baseline table has measured Cold/Warm numbers (and preferably production `requestId`-correlated spans). Expected wins below are order-of-magnitude guesses for planning, not SLAs.

| Candidate | Evidence needed | Expected win (if confirmed) | Risk |
|---|---|---|---|
| Dedupe or cache JWT verify across proxy → RSC | `proxy.claims` + `session.getClaims` both large on same `requestId` | Could remove ~one claims RTT (often tens–hundreds of ms; region-dependent) | Must not skip RSC auth boundary |
| Confirm local JWT verify (no network `getUser` fallback) | Compare claims ms cold vs warm; check Supabase JWT settings | Large cold spikes shrink if today falling back to network | Config-only; verify in staging |
| Keep memberships on `Promise.all` (already done) | `landing.tenantMemberships` \|\| `landing.platformMemberships` ≈ max, not sum | Already ~serial sum → max of the two | None (shipped) |
| Overlap public config with session on `/login` (safe warm) | `public_config.load` vs `sign_in.getSessionUser` on same request | Hides config latency behind session when both needed for first paint / Google slot | Behavior unchanged if cache shared |
| Avoid recording duplicate work inside `getSessionUser` | Single `session.getClaims` + one `session.profile` per RSC request | N/A if already one each (current design) | Do not parallelize profile before `sub` |

Fill the baseline table first; only then pick one candidate and re-measure.
