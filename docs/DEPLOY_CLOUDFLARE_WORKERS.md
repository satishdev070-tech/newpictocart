# Deploy Pictocart on Cloudflare Workers (vinext)

**ADR-011 production origin:** the Next.js app runs on **Cloudflare Workers via vinext**. Do **not** use static Pages or OpenNext for this cut. Vercel remains a **rollback** target only (keep project domains until soak completes; **disconnect Git** so PRs are not blocked by Vercel checks).

Related: [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) (legacy/rollback), [DEPLOY_HOSTINGER.md](./DEPLOY_HOSTINGER.md) (Node + domain-router), `workers/domain-router` (Hostinger-only; unused when vinext is origin).

## Auto-deploy (GitHub Actions → Airy Fact)

Supported production path: [`.github/workflows/deploy-cloudflare-workers.yml`](../.github/workflows/deploy-cloudflare-workers.yml) via **`workflow_dispatch`** (push-to-`main` is paused until secrets are proven green).

1. Add repo **Actions secrets** (Settings → Secrets and variables → Actions). Required names: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (Airy Fact), `APP_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, optional `PLATFORM_HOST_ALIASES`, `WORKERS_DEV_HOST`. If any required secret is missing, the workflow fails at “Write Worker secrets file” (`APP_SECRET: missing APP_SECRET`) and **does not deploy** — use manual `cf deploy --prebuilt --secrets-file` until secrets are set.
2. Generate secrets with hex (no `$` / quotes): `openssl rand -hex 32` for `APP_SECRET` (≥32), `openssl rand -hex 24` for `CRON_SECRET` (≥24). Put the **same** values in GitHub Actions secrets and the Cloudflare Worker `pictocart` secrets. The workflow rejects short values before deploy. Bad/mismatched secrets make seller `/start` finalize show “The store could not be finished” after OTP.
3. Workflow runs `pnpm build:vinext`, writes a **JSON** secrets file (trims whitespace; validates with `serverEnvSchema` — prints field errors, never values), then `npx cf deploy --prebuilt --secrets-file …`, then curls `/api/cron/preview-token-self-test` (`mintVerify: ok`).
4. **Push-to-main deploy stays paused** until a manual **Actions → Deploy Cloudflare Workers → Run workflow** is green (`mintVerify: ok`). Then re-enable the `push` trigger in `.github/workflows/deploy-cloudflare-workers.yml`.
5. Do **not** rely on GitHub check **Workers Builds: newpictocart** (account `8ee184…`) — that is the wrong Cloudflare account/worker. Delete that Builds trigger in the Cloudflare dashboard.

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

Mirror Production (Supabase URL/keys, `APP_SECRET`, `CRON_SECRET`, platform root/URL):

| Variable | Production value |
|---|---|
| `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` | `pictocart.in` (hostname only — no scheme) |
| `NEXT_PUBLIC_PLATFORM_URL` | `https://www.pictocart.in` |
| `PLATFORM_HOST_ALIASES` | `pictocartdev.in,www.pictocartdev.in` (canary aliases; apex/www come from `PLATFORM_URL`) |
| `WORKERS_DEV_HOST` / `CLOUDFLARE_WORKERS_HOST` | `pictocart.<account>.workers.dev` so proxy treats it as platform |
| `CF_PAGES_URL` | optional full `https://…workers.dev` |

Set secrets via dashboard / Workers settings multipart PATCH / `--secrets-file` on deploy. Always pass secrets — empty env → Error 1101 on `/`.

**Important:** `pnpm deploy:vinext` (`vinext-cloudflare deploy`) does **not** accept `--secrets-file`. After a Vite build, upload with secrets explicitly:

```bash
pnpm run build:vinext
npx cf deploy --prebuilt --secrets-file /path/to/worker-secrets.env
```

`cloudflare.config.ts` only declares resource bindings (`ASSETS`, `IMAGES`, `VINEXT_KV_CACHE`, cache metadata). App secrets (`APP_SECRET`, `CRON_SECRET`, Supabase keys, …) are **not** typed there — they become `secret_text` bindings only when uploaded via `--secrets-file` / dashboard. Prefer a **JSON** `--secrets-file` (GHA does this). Dotenv format expands `$VAR` / `${VAR}` and can truncate secrets that contain `$`; process env also overrides file values (including empty).

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

Until Paid + a vinext `scheduled` handler, use an **external HTTP scheduler** (same as Hostinger) daily:

```bash
for p in social-publish expire-orders domains gbp-reviews notifications observability; do
  curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://www.pictocart.in/api/cron/$p"
done
```

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
