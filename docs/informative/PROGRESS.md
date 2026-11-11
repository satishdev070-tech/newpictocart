# Informative Website — Progress

Plan: [PLAN.md](./PLAN.md) · Discovery: [DISCOVERY.md](./DISCOVERY.md) · Branch `claude/informative-website`

| Milestone | Status | Commit |
|---|---|---|
| M0 Discovery | ✅ Done (owner accepted Q1–Q14 on 2026-11-11) | `2857e08` |
| M1 Foundation | ✅ Done | see `git log` (feat(informative): M1) |
| M2 Data layer | — | |
| M3 Theme system | — | |
| M4 Onboarding | — | |
| M5 Seller panel | — | |
| M6 Public site | — | |
| M7 Enquiries | — | |
| M8 Hardening | — | |

---

## M1 — Foundation (2026-11-11)

### What landed

| Piece | Where |
|---|---|
| `tenants.website_type` (`ONLINE_STORE` default, backfilled by the `ALTER`, `INFORMATIVE`), check constraint, immutability trigger | `supabase/migrations/20261111008000_informative_website_type.sql` (down path in its header) |
| `create_tenant(…, p_website_type default 'ONLINE_STORE')`; INFORMATIVE skips the store-only `inventory_locations` row | same migration |
| Shared constant `WEBSITE_TYPE` / `WEBSITE_TYPES` / `parseWebsiteType` / `INFORMATIVE_HOME` | `src/features/informative/website-type.ts` |
| Flag `FEATURE_INFORMATIVE_WEBSITE` = `off` (default) / `internal` / `all` | `src/features/informative/flag.ts`, `src/lib/env/schema.ts`, `.env.example` |
| Session payload: `Membership.websiteType`, `TenantContext.websiteType` | `src/lib/tenant/membership.ts` |
| StoreRouteGuard (pages **and** server actions): `requireTenant()` redirects an active Informative tenant to `/informative/dashboard` | `src/lib/tenant/membership.ts` |
| InformativeRouteGuard: pure decision + server wrapper `requireInformativeTenant()` | `src/features/informative/guard.ts`, `src/features/informative/server/context.ts` |
| Post-login redirect: Informative-only accounts land on `/informative/dashboard` | `src/lib/auth/role-routing.ts`, `src/lib/auth/landing.ts` |
| Store route registration: `/informative` is platform-only (404 on store hosts) | `src/lib/tenant/routing.ts` |
| Panel stub: `/informative` → `/informative/dashboard`, guarded `(panel)` layout, placeholder dashboard, `/informative/maintenance` | `src/app/informative/**` |
| Types | `src/lib/supabase/database.types.ts` (hand-edited: the CLI generator is Docker-based; only `website_type` + `p_website_type` added) |

### Behaviour by flag

| | Flag `off` (production default) | Flag `internal` / `all` |
|---|---|---|
| Existing store accounts | Identical to today (same queries in landing; `requireTenant` gains one in-memory check) | Identical (landing runs one extra parallel membership query) |
| `/informative/*` for store accounts / signed out | 404 | → `/dashboard` / → login |
| Informative accounts | `/informative/*` → maintenance page; `/dashboard/*` → `/informative/dashboard` → maintenance | Panel renders; `/dashboard/*` → `/informative/dashboard` |
| Creating an Informative site | Impossible (no UI yet; M4 gates by `canCreateInformative`) | M4 |

### Decisions and deviations (rule: touch store code least)

1. **No edit to `src/app/dashboard/layout.tsx` (touch point 6 unused).** The StoreRouteGuard sits in
   `requireTenant()`, which every `/dashboard` page, layout and store server action already calls.
   One check therefore covers pages and actions (the .docx's "store APIs reject Informative accounts")
   without a per-page or per-action edit. `DASHBOARD_NAV` is untouched; the Informative panel gets its
   own layout and nav (M5).
2. **`TenantContext.websiteType` is optional.** `features/onboarding/server.ts` (`ownerContext`)
   builds a `TenantContext` by hand. Optional (missing = ONLINE_STORE) avoids editing that store file.
3. **Deploy-order safety.** The .docx rollout says to deploy and *then* run migrations. Until the
   column exists, `listMemberships` gets an undefined-column error (`42703` / `PGRST204`) and retries
   the old select, so every account reads as ONLINE_STORE. No other error is swallowed (unit tested).
4. **Post-login with the flag off is byte-for-byte as before.** The extra membership query in
   `accountAccessFor` runs only when the flag is on, and soft-fails to "unknown". `requireTenant()`
   is the backstop. An account with any Online Store lands on `/dashboard` (an account with mixed
   types lands on its store; the switcher plus the guard handle the rest).
5. **`create_tenant` 3-argument signature dropped and recreated with a 4th defaulted argument**,
   not overloaded (PostgREST cannot disambiguate). Existing callers (`/start` finalize, legacy
   onboarding, the RLS test) pass 3 arguments unchanged. `platform_create_tenant` is untouched.
6. **The type is immutable even for the DB owner** (trigger). Changing a type would need the
   trigger dropped deliberately, per the non-goal "no switching".
7. **Shared account pages (Q12):** `/dashboard/profile`, plan and team live under `/dashboard` and go
   through `requireTenant()`, so Informative tenants cannot reach them yet. M5 gives the Informative
   panel its own Profile / Plan / Team entries, reusing the same feature components.
8. `tenants.store_type` already exists (`real`/`demo`/`test`, migration 1800). It is unrelated to
   `website_type`, which is a separate column.

### Verification

- `pnpm check` ✅: typecheck, lint, **202 files / 2121 tests**, build (6 min 19 s). An earlier run on a heavily loaded machine (load average ~16) had two 5 s timeouts in subprocess-spawning tests (`validate-worker-secrets`, `google-sign-in-slot`). Both pass on re-run, and the first is the flake recorded in DISCOVERY §1.1. All pre-existing tests are unchanged.
- Runtime smoke test (worktree dev server, hosted DB **without** migration 8000, which exercises the fallback):
  - Flag off: `/informative`, `/informative/dashboard` and `/informative/maintenance` → 404; `/start/lang` 200; `/login` 200; `/dashboard` → login (as before).
  - Flag `all`: `/informative` and `/informative/dashboard` → `/login?next=/informative/dashboard`; `/informative/maintenance` → 404; store routes unchanged.
  - No server errors.
- New unit tests (`tests/unit/informative/*`, 7 files, 30 tests): constant + parser, flag + env
  schema, guard matrix, post-login matrix, route registration, static migration checks, session
  payload (select, 42703 fallback, other errors still fail, guard follows the active store).
- New DB test `tests/rls/informative-website-type.test.ts` (5 tests): backfill, 3-argument
  `create_tenant` unchanged (inventory location), INFORMATIVE has no inventory location, unknown
  type rejected, type frozen.
- **DB harness note:** `pnpm test:db` is broken on `main` before this work. `supabase/tests/supabase-shim.sql`
  lacks `storage.objects.owner_id`, so `20261027004120_return_photos.sql` fails to load. Per rule 7 I
  did not change the shared harness. I loaded all migrations (including 8000) plus the seed into a
  local Postgres 17 using a scratch copy of the shim with that one column added, then ran the **full**
  existing RLS suite (24 files / 181 tests ✅) plus the new file (✅). On macOS the harness also needs
  `LC_ALL=en_US.UTF-8` and `PGBIN=/opt/homebrew/opt/postgresql@17/bin`. Suggested follow-up outside
  this project: add `owner_id text` to the shim.
- Online Store regression: `/start` code is untouched in M1, and `role-routing` behaviour is
  unchanged when `informativeOnly` is unset (existing `tests/unit/auth/role-routing.test.ts` passes
  unmodified).

### Shared files touched so far (all marked `INFORMATIVE: branch point`)

`supabase/migrations/20261111008000_informative_website_type.sql` (new), `src/lib/supabase/database.types.ts`,
`src/lib/tenant/membership.ts`, `src/lib/auth/role-routing.ts`, `src/lib/auth/landing.ts`,
`src/lib/tenant/routing.ts`, `src/lib/env/schema.ts` + `.env.example` (reason in DISCOVERY §4).
`database.types.ts` is generated output, so it carries no marker comment (a marker would be lost on
regeneration).
