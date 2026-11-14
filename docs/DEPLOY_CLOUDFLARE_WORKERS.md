# Deploy Pictocart on Cloudflare Workers (vinext)

**ADR-011 production origin:** the Next.js app runs on **Cloudflare Workers via vinext**. Do **not** use static Pages or OpenNext for this cut. Vercel remains a **rollback** target only (keep project domains until soak completes; **disconnect Git** so PRs are not blocked by Vercel checks).

Related: [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) (legacy/rollback), [DEPLOY_HOSTINGER.md](./DEPLOY_HOSTINGER.md) (Node + domain-router), `workers/domain-router` (Hostinger-only; unused when vinext is origin).

## Auto-deploy (GitHub Actions → Airy Fact)

The pipeline is described in [CI_CD.md](./CI_CD.md). Merges to `main` deploy **staging** (`deploy-staging.yml` → Worker `pictocart-staging`, pictocartdev.in). **Production** (`pictocart`, pictocart.in) deploys only through the manual, approved `deploy-production.yml`. Both use `deploy-worker.yml`, which:

- writes a complete JSON secrets file and validates it with `scripts/ci/validate-worker-secrets.mts`;
- runs `cf deploy --prebuilt --secrets-file`;
- verifies the domain serves the deployed commit (`/api/health` `commit`), `/api/health/ready`, the preview-token self-test and public routes;
- rolls back to the previous Worker version if any check fails.

The secret rules below still apply. Generate secrets with hex (no `$` / quotes): `openssl rand -hex 32` for `APP_SECRET` (≥32), `openssl rand -hex 24` for `CRON_SECRET` (≥24). **Do not rotate `APP_SECRET` casually**: Admin → Email (Resend) ciphertext in `platform_app_credentials` is encrypted with it. Do **not** rely on GitHub check **Workers Builds: newpictocart** (account `8ee184…`): that is the wrong Cloudflare account/worker.

### Stop Vercel deploy checks (required)

1. Vercel → project `pictocart-u7pf` → **Settings → Git → Disconnect** this repository.
2. GitHub → repo **Settings → Integrations** → remove/restrict the Vercel app if it still posts.
3. Remove required status check `Vercel` from branch protection if present.
4. In-repo: `vercel.json` sets `"ignoreCommand": "exit 1"` so any residual Vercel Git hook skips builds (project kept for ADR-011 rollback only).

```
Visitor → pictocart.in / www / *.pictocart.in → vinext Worker → Supabase
Visitor → pictocartdev.in / www (canary aliases) → same Worker → Supabase
Visitor → pictocart.<account>.workers.dev → same Worker → Supabase
```

## Compatibility (vinext check)

Last run: **93% compatible** (Next 16.3.6 App Router + `src/proxy.ts`).

| Item | Status |
|---|---|
| `next/*` imports | Supported |
| Server Actions `bodySizeLimit` | Supported |
| `experimental.proxyClientMaxBodySize` | Ignored by vinext (harmless) |
| Images | Needs optimizer — configured via Cloudflare Images |
| Native `sharp` | **Unavailable on Workers** — `/api/img` falls back to originals; variants soft-fail |

## Init flags (already applied)

```bash
pnpm dlx vinext init \
  --platform=cloudflare \
  --cdn-cache=workers-cache \
  --data-cache=kv \
  --image-optimization=cloudflare-images \
  --no-prerender \
  --ignore-wrangler-config \
  --name pictocart
```

Generated: [`vite.config.ts`](../vite.config.ts), [`cloudflare.config.ts`](../cloudflare.config.ts). Scripts: `dev:vinext`, `build:vinext`, `start:vinext`, `deploy:vinext`. Existing `pnpm dev` / `pnpm build` (Next on Vercel) still work.

## Build & deploy

```bash
pnpm install          # allow esbuild + workerd build scripts (package.json pnpm.onlyBuiltDependencies)
pnpm run build:vinext
pnpm run deploy:vinext   # requires cf auth or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
```

Auth:

```bash
npx cf auth login
# or export CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=…
```

Without an account, a **temporary** deploy works for ~60 minutes:

```bash
pnpm run build:vinext
npx cf deploy --temporary-account --prebuilt
# Claim URL is printed — claim before expiry to keep the Worker
```

Verified 2026-11-05: temporary Workers upload (~3 MiB gzip). **Deploy without `--secrets-file` leaves the Worker env empty** — `/api/health` still returns 200, but `/api/health/ready` is 503 and `/` becomes **Error 1101 (Worker threw exception)** when `parseEnv` fails. Always pass secrets on deploy (or set them in the dashboard), then claim:

```bash
npx cf deploy --temporary-account --prebuilt --secrets-file /path/to/worker-secrets.env
```

Canaries with secrets (2026-11-06): `https://pictocart.airy-fact.workers.dev` and `https://pictocart.silver-uranium.workers.dev` — `/`, `/login`, `/seller/login`, `/api/health/ready` all **200**. Curl may still hit CF bot challenge 403 on some HTML routes before claim; use a browser after claim.

**Canary Custom Domains (2026-11-06):** `pictocartdev.in` + `www.pictocartdev.in` on Worker `pictocart`. Verified `/`, `/login`, `/api/health`, `/api/health/ready` all **200**.

**Production cutover (2026-11-06):** zone `pictocart.in` on the same account (Airy Fact). Custom Domains for **`pictocart.in`** + **`www.pictocart.in`**. Wildcard stores via Worker Route `*.pictocart.in/*` + proxied DNS `AAAA * → 100::` (Custom Domains cannot use `*`). Mail/verification TXT/MX/CAA imported before NS flip. Do not point A/AAAA at Cloudflare edge IPs (Error 1000).

## Env / secrets (Workers)

Mirror Production (Supabase URL/keys, `APP_SECRET`, `CRON_SECRET`, platform root/URL, email):

| Variable | Production value |
|---|---|
| `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` | `pictocart.in` (hostname only — no scheme) |
| `NEXT_PUBLIC_PLATFORM_URL` | `https://www.pictocart.in` |
| `PLATFORM_HOST_ALIASES` | `pictocartdev.in,www.pictocartdev.in` (canary aliases; apex/www come from `PLATFORM_URL`) |
| `WORKERS_DEV_HOST` / `CLOUDFLARE_WORKERS_HOST` | `pictocart.<account>.workers.dev` so proxy treats it as platform |
| `CF_PAGES_URL` | optional full `https://…workers.dev` |
| `EMAIL_FROM` | `Pictocart <no-reply@pictocart.in>` (verified Resend domain) — **required in every secrets file** |
| `RESEND_API_KEY` | preferred in the secrets file; otherwise Admin → Email DB credential must decrypt with this `APP_SECRET` |
| `GOOGLE_IDENTITY_SIGNIN` | optional `on` for GIS button (classic OAuth still works when unset) |

Set secrets via dashboard / Workers settings multipart PATCH / `--secrets-file` on deploy. Always pass secrets — empty env → Error 1101 on `/`.

### Incomplete `--secrets-file` wipes login email

`npx cf deploy --prebuilt --secrets-file …` **replaces** Worker `secret_text` bindings with the keys in that file. It does **not** merge with the dashboard. A 9-key “core only” JSON (Supabase + `APP_SECRET`/`CRON_SECRET` + platform hosts) that omits `EMAIL_FROM` / `RESEND_API_KEY` / `GOOGLE_IDENTITY_SIGNIN` **deletes** those bindings.

Symptom after an incomplete upload: seller OTP toast **“Couldn't send a code…”** (`reason: "auth"` when `SUPABASE_SECRET_KEY` is wrong/placeholder, or `reason: "provider"` when Resend env is gone and DB decrypt fails). Marketing UI changes are unrelated.

**Agent / manual deploy checklist** (before every `cf deploy --secrets-file`):

1. Start from a **complete** known-good JSON (not a trimmed subset). Never rotate `APP_SECRET` just to redeploy.
2. Include at least: core Supabase + platform keys, `EMAIL_FROM`, and either `RESEND_API_KEY` **or** confirm Admin → Email Resend decrypts with the same `APP_SECRET` (`--allow-db-resend` on the validator).
3. Validate: `pnpm exec tsx scripts/ci/validate-worker-secrets.mts /path/to/complete.json` (add `--allow-db-resend` only when env Resend is intentionally omitted).
4. Deploy + self-test: `mintVerify: "ok"`. Smoke `/seller/login` OTP (and password / Google if those accounts exist).

**Important:** `pnpm deploy:vinext` (`vinext-cloudflare deploy`) does **not** accept `--secrets-file`. After a Vite build, upload with secrets explicitly:

```bash
pnpm run build:vinext
npx cf deploy --prebuilt --secrets-file /path/to/worker-secrets.json   # prefer JSON over dotenv
```

`cloudflare.config.ts` only declares resource bindings (`ASSETS`, `IMAGES`, `VINEXT_KV_CACHE`, cache metadata). App secrets (`APP_SECRET`, `CRON_SECRET`, Supabase keys, `EMAIL_FROM`, …) are **not** typed there — they become `secret_text` bindings only when uploaded via `--secrets-file` / dashboard. Prefer a **JSON** `--secrets-file` (GHA does this). Dotenv format expands `$VAR` / `${VAR}` and can truncate secrets that contain `$`; process env also overrides file values (including empty).

**KV binding must be pinned:** `cf deploy` runs with `--strict` by default. Use `bindings.kv({ id: "…" })` for `VINEXT_KV_CACHE` (Airy Fact namespace `2a8074bf01e4433d824ab34d9531cf0b`). Unpinned `bindings.kv()` makes CI abort with a local/remote `kv_namespaces` id conflict.

**Workers Builds / wrong account:** GitHub “Workers Builds: newpictocart” on account `8ee184…` is **not** production. Production Worker is `pictocart` on the account in `CLOUDFLARE_ACCOUNT_ID` (zone NS for `pictocart.in`). **Delete** that Builds GitHub trigger (Cloudflare dashboard → Workers → `newpictocart` → Builds). Use **GitHub Actions** `Deploy Cloudflare Workers` (Airy Fact) or manual `cf deploy --prebuilt --secrets-file`.

**APP_SECRET must match mint + verify:** Theme preview tokens are HMAC’d with `APP_SECRET` (HKDF purpose `theme-preview`). Dashboard Server Actions and `{slug}/preview` must hit the **same** Worker version/secret. Shell-minted tokens that verify while browser-minted tokens 403 usually means the dashboard mint path used a different `APP_SECRET` (stale Vercel deploy, wrong Workers Builds account, or a version uploaded without the production secrets file).

Self-test (Bearer `CRON_SECRET`):

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.pictocart.in/api/cron/preview-token-self-test"
# optional: diagnose a dashboard-minted token without echoing it
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.pictocart.in/api/cron/preview-token-self-test?token=…&tenantId=…"
```

Expect `mintVerify: "ok"`. External diagnose returns `sig_fail` / `tenant_mismatch` / `expired` / `bad_uuid` / `malformed`.

## Theme editor iframe preview

The seller Theme Editor mints via `POST /api/theme/preview-token`, **preflights** `{slug}.pictocart.in/preview?token=…` (`redirect: manual`) before setting the iframe `src`, and recovers on 403 `data-preview-error` without hanging at “Loading 92%”. Deny HTML also `postMessage`s `{source:"pictocart-preview",type:"denied"}` (fired 3×) so remount races still renew the token.

Keep **Bot Fight Mode off** (`fight_mode: false` on zone bot management) — Cloudflare challenges cannot run inside cross-origin iframes and show up as **403**. Platform subdomains use `sf_preview` with **SameSite=Lax**; custom domains still use **None + Partitioned**. Failed token/host checks return **403 HTML** with `data-preview-error` (`missing_token` / `unknown_host` / `sig_fail` / `tenant_mismatch` / `expired` / `bad_uuid` / `malformed` / `not_yet_valid`).

**Production deploy gate (required after every Worker upload):**

```bash
pnpm run build:vinext
npx cf deploy --prebuilt --secrets-file /path/to/worker-secrets.env   # or: pnpm deploy:cf:secrets …
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.pictocart.in/api/cron/preview-token-self-test"
# must print mintVerify: "ok"
```

Disable GitHub Workers Builds aimed at account `8ee184…` / worker `newpictocart` — that is not production.

## Production domains (`pictocart.in` + `*.pictocart.in`)

1. Add zone `pictocart.in` (Full DNS) on the Cloudflare account that owns Worker `pictocart`. Import MX/TXT/CAA (Hostinger mail, Resend DKIM, Google verification) **before** changing nameservers.
2. Attach Worker **Custom Domains** for exact hosts `pictocart.in` and `www.pictocart.in` (API: `PUT /accounts/{id}/workers/domains`). Cloudflare creates proxied `AAAA 100::` + certs. Delete any conflicting manual A/AAAA first.
3. Add Worker **Route** `*.pictocart.in/*` → `pictocart`, plus proxied DNS `AAAA * → 100::` (required for storefronts; Custom Domains reject wildcards).
4. Optional backup routes: `pictocart.in/*`, `www.pictocart.in/*` (Custom Domains already cover apex/www).
5. Do **not** attach `workers/domain-router` routes on this zone when vinext is the origin.
6. Flip registrar nameservers from `ns1/ns2.vercel-dns.com` → Cloudflare NS for the zone (e.g. `karina.ns.cloudflare.com` / `vicente.ns.cloudflare.com`). Wait until zone status **Active**.
7. Smoke: `https://www.pictocart.in` and apex `/api/health`, `/api/health/ready`, `/login`, `/seller/login`; one store `https://{slug}.pictocart.in`.

## Canary domains (`pictocartdev.in`)

Same Worker. Custom Domains for apex + `www`. DNS cleanup: delete apex/`www` A/AAAA that point at Cloudflare edge IPs (Error 1000). Set `PLATFORM_HOST_ALIASES` as above.

## Crons

Workers **Free** allows **0** Cron Triggers. On **Paid**, add to `cloudflare.config.ts`:

```ts
import { triggers } from "cf/config";
// inside defineWorker({…}):
triggers: [triggers.scheduled({ schedule: "0 0 * * *" })],
```

Until Paid + a vinext `scheduled` handler, `.github/workflows/cron.yml` calls production
`/api/cron/*` (every 5 min: expire-orders, notifications; half-hourly: social-publish, domains;
daily: gbp-reviews, observability). It is **off** until the repo variable
`PRODUCTION_CRON_ENABLED=true`. Run one job by hand: Actions → Cron (production) → Run workflow.
Staging is never scheduled (it shares the production database). See ADR-042.

## Error 1102 "Worker exceeded resource limits" (CPU budget)

**Root cause.** The Worker runs on the **Workers Free plan** (no Cron Triggers, see Crons), which
allows **10 ms of CPU per request**. A cold isolate must compile and evaluate the always-loaded
RSC/SSR graph (vinext runtime, React server renderer, Supabase, zod: ~2.8 MB of JS after the fix
below) before it renders anything. Even a local pre-parse of that graph costs ~10 ms of CPU on a
fast laptop, and an App Router render of an admin page (layout + page + streaming SSR) adds more.
Cloudflare tolerates small overruns, so the error is intermittent: cold isolates and heavier
renders (for example `/admin/domains` on 2026-11-11 06:54:09 UTC, Ray `a58b624e9a9b3e44`) cross
the limit. The admin page queries themselves are paginated and I/O-bound (wall time, not CPU).

**The real fix is the Workers Paid plan** ($5/month, 30 s default CPU per request). After
upgrading, optionally cap it in `cloudflare.config.ts`:
`defineWorker({ ..., limits: { cpuMs: 50_000 } })`. Don't add `limits.cpuMs` while still on
Free: Cloudflare rejects CPU limits on the Free plan at deploy time. Paid also unlocks Cron
Triggers.

**Code changes (2026-11-11) to cut CPU on every request.** They help, but they cannot bring an
App Router SSR request under 10 ms:
- The theme catalog (~300 KB of presets) left the always-loaded graph. The marketing chrome now
  uses the `MARKETPLACE_SHOP_THEME_COUNT` constant (`src/features/marketing-site/theme-count.ts`,
  test-checked against the catalog), and `src/app/sitemap.ts` imports the catalog and feature
  pages inside the handler.
- `@upstash/redis` (~180 KB) loads only when Upstash env is set (`getRedis()` is now async).
- The proxy skips the observability import and the `after()` callback when
  `OBSERVABILITY_ENABLED` is off (the default).
- Net effect: the always-loaded RSC graph went from 2,407 KB to 2,076 KB.
- Guard: `tests/unit/next/root-metadata-imports.test.ts` fails if the proxy, root
  layout/error/not-found or root metadata routes statically import heavy modules.

**Findings 2026-11-12 (after the Informative release).**
- The always-loaded RSC graph (static-import closure of `_virtual_vinext-rsc-entry`) is **2,188 KB**, up from 2,076 KB. The growth is the route table, the server-action manifest and the client-asset manifest, which grow with every route. No feature code was added to the always-loaded graph.
- Production responses for ISR pages (`/`, `/pricing`, `/features`, `/how-it-works`) are always `x-vinext-cache: MISS` with no `cf-cache-status`, so every request renders and pays the full CPU cost.
- vinext's Cloudflare adapter sends `Cache-Control: no-store` to browsers by design and expects the Worker's `VinextCachedResponse` export (`cache.enabled`) to serve repeats from Cloudflare's cache. That cache isn't serving these pages; it needs a look in the dashboard (Workers → `pictocart` → Settings / Caching, and KV `VINEXT_KV_CACHE` usage: the Free plan allows only 1,000 KV writes a day).
- On the Free plan, intermittent 1102 on uncached pages remains expected. The Workers Paid plan ($5/month) removes the 10 ms limit and lifts the KV write cap.

To confirm on the dashboard: Workers & Pages → `pictocart` → Metrics → CPU time (P50/P99) and
Logs (filter `outcome = exceededCpu`). This needs Cloudflare dashboard access.

## Storefront CSS on the Worker build (cascade layer order)

Browsers order `@layer`s by their **first appearance across all stylesheets on the page**. The
Vite/vinext build links client-component CSS (`loader.css`) *before* Tailwind's `globals.css`.
`loader.css` started with `@layer components {…}`, so `components` was declared before `base`.
Tailwind preflight (`*{margin:0;padding:0}`, transparent buttons) then beat every `.sf-*` rule.
The result in production was no container padding or centring, and blank CTA buttons whose text
colour matched their background. `next dev` and `next build` link `globals.css` first, so this
never showed locally.

**Rule:** every stylesheet except `globals.css` that uses `@layer` starts with
`@layer properties, theme, base, components, utilities;` (see `src/features/theme/storefront.css`).
**Guards:**
- `tests/unit/styles/css-layer-order.test.ts` checks the source CSS.
- `scripts/ci/check-worker-css.mts` runs in CI after `pnpm build:vinext`. It checks the emitted
  layer order and that key `.sf-*` and utility rules exist.

## Images / sharp

- vinext uses **Cloudflare Images** optimizer for `next/image`.
- On-demand WebP via `sharp` in [`src/lib/storage/variants-server.ts`](../src/lib/storage/variants-server.ts) soft-fails; [`/api/img`](../src/app/api/img/route.ts) redirects to the original.
- Theme builder SSRF guard uses `dns.promises` + Cloudflare DoH (no `dns.lookup`) — Workers-safe.

## Rollback

- Point `pictocart.in` nameservers back to Vercel (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`) while Vercel project domains remain configured.
- Or unbind Custom Domains / delete Worker Routes on the Cloudflare zone and restore Vercel DNS at the registrar.
- Canary `pictocartdev.in` is independent — leave it on Workers during a production rollback.
- Remove vinext-only deps only if abandoning Workers entirely.

## domain-router

[`workers/domain-router`](../workers/domain-router) stays for Hostinger / Cloudflare-for-SaaS origins only. When the vinext Worker is the origin for `pictocart.in`, do **not** attach domain-router routes on that zone.
