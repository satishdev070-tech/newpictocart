# Deploy Pictocart on Cloudflare Workers (vinext)

**ADR-011 canary:** run the Next.js app on **Cloudflare Workers via vinext**. Keep **Vercel** as production for `pictocart.in` until the canary soaks. Do **not** use static Pages or OpenNext for this cut.

Related: [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) (current prod), [DEPLOY_HOSTINGER.md](./DEPLOY_HOSTINGER.md) (Node + domain-router), `workers/domain-router` (unused for this canary).

```
Visitor → pictocartdev.in / *.workers.dev → vinext Worker → Supabase
Visitor → pictocart.in (unchanged) → Vercel → Supabase
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

## Env / secrets (Workers)

Mirror Production (Supabase URL/keys, `APP_SECRET`, `CRON_SECRET`, platform root/URL). For canary:

| Variable | Canary value |
|---|---|
| `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` | keep `pictocart.in` (or leave as prod) |
| `PLATFORM_HOST_ALIASES` | include `pictocartdev.in,www.pictocartdev.in` |
| `WORKERS_DEV_HOST` / `CLOUDFLARE_WORKERS_HOST` | `pictocart.<account>.workers.dev` so proxy treats it as platform |
| `CF_PAGES_URL` | optional full `https://…workers.dev` |

Set secrets via `cf workers secrets` / dashboard. `NEXT_PUBLIC_*` must be present at **build** time for vinext as with Next.

## Custom domain (pictocartdev.in)

Adding the zone under **Domains** is not enough — the hostname must be attached to the **Worker**.

1. Claim or use a real Cloudflare account (not Free cron-limited temp if you need schedules).
2. **DNS cleanup:** On the `pictocartdev.in` zone, delete apex/`www` **A/AAAA** records that point at Cloudflare IPs, and any **CNAME** to another proxied Cloudflare hostname or a raw `workers.dev` target. Those cause **Error 1000 (DNS points to prohibited IP)**. Do not paste Cloudflare or `workers.dev` IPs into A records.
3. Workers → `pictocart` → Settings → **Domains & Routes** → Add → **Custom domain** → add `pictocartdev.in` and `www.pictocartdev.in`. Cloudflare creates the DNS records and certificate. Prefer Custom Domains over manual Worker Routes + `AAAA 100::` for this full-app canary.
4. Set Worker secret/var `PLATFORM_HOST_ALIASES` to include `pictocartdev.in,www.pictocartdev.in` (exact hosts; see `src/lib/platform/hosts.ts`). Keep the secrets that fixed Error 1101 (`APP_SECRET`, Supabase keys, etc.).
5. Keep **`pictocart.in` on Vercel** until canary is green. Do **not** route pictocartdev through `workers/domain-router`.
6. Smoke: `/api/health`, `/api/health/ready`, `/login`, `/seller/login` on both apex and `www`.

## Crons

Workers **Free** allows **0** Cron Triggers (temporary account hit this limit). On **Paid**, add to `cloudflare.config.ts`:

```ts
import { triggers } from "cf/config";
// inside defineWorker({…}):
triggers: [triggers.scheduled({ schedule: "0 0 * * *" })],
```

Until a vinext `scheduled` handler fans out, call the same routes as Hostinger (daily is fine):

```bash
for p in social-publish expire-orders domains gbp-reviews notifications observability; do
  curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://www.pictocartdev.in/api/cron/$p"
done
```

## Images / sharp

- vinext uses **Cloudflare Images** optimizer for `next/image`.
- On-demand WebP via `sharp` in [`src/lib/storage/variants-server.ts`](../src/lib/storage/variants-server.ts) soft-fails; [`/api/img`](../src/app/api/img/route.ts) redirects to the original.
- Theme builder SSRF guard uses `dns.promises` + Cloudflare DoH (no `dns.lookup`) — Workers-safe.

## Rollback

- Unbind `pictocartdev.in` from the Worker (or leave DNS on Vercel).
- Production `pictocart.in` stays on Vercel — no NS flip required to roll back the canary.
- Remove vinext-only deps only if abandoning Workers (not required to keep shipping on Vercel).

## domain-router

[`workers/domain-router`](../workers/domain-router) stays for Hostinger origins. This canary Worker **is** the origin — do not route pictocartdev through domain-router.
