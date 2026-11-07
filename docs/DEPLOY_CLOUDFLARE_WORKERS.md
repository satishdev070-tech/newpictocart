# Deploy Pictocart on Cloudflare Workers (vinext)

**ADR-011 production origin:** the Next.js app runs on **Cloudflare Workers via vinext**. Do **not** use static Pages or OpenNext for this cut. Vercel remains a **rollback** target only (keep project domains until soak completes).

Related: [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) (legacy/rollback), [DEPLOY_HOSTINGER.md](./DEPLOY_HOSTINGER.md) (Node + domain-router), `workers/domain-router` (Hostinger-only; unused when vinext is origin).

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

`cloudflare.config.ts` only declares resource bindings (`ASSETS`, `IMAGES`, `VINEXT_KV_CACHE`, cache metadata). App secrets (`APP_SECRET`, `CRON_SECRET`, Supabase keys, …) are **not** typed there — they become `secret_text` bindings only when uploaded via `--secrets-file` / dashboard. Dotenv secrets files expand `$VAR` from the shell; **process env overrides file values (including empty)**.

**Workers Builds / wrong account:** GitHub “Workers Builds: newpictocart” on account `8ee184…` is **not** production. Production Worker is `pictocart` on the account in `CLOUDFLARE_ACCOUNT_ID` (zone NS for `pictocart.in`). Do not treat that check as a successful prod deploy; disable or retarget the Cloudflare Workers Builds integration to the Airy Fact account + worker `pictocart`, and always pass the same secrets file used for manual deploys.

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

The seller Theme Editor iframes `{slug}.pictocart.in/preview?token=…`. Keep **Bot Fight Mode off** (`fight_mode: false` on zone bot management) — Cloudflare challenges cannot run inside cross-origin iframes and show up as **403**, leaving the canvas stuck at “Loading 92%”. Platform subdomains use `sf_preview` with **SameSite=Lax**; custom domains still use **None + Partitioned**. Failed token/host checks return **403 HTML** with `data-preview-error` (`missing_token` / `unknown_host` / `sig_fail` / `tenant_mismatch` / `expired` / `bad_uuid` / `malformed` / `not_yet_valid`).

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
