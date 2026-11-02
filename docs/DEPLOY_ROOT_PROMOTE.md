# Promote platform root to `pictocart.in`

Full root cutover on the **same** Vercel project (`pictocart-u7pf`) and Supabase (`v2pictocart`). After this, store primaries and new creates use `{slug}.pictocart.in`. Staging hosts stay as platform aliases.

For the earlier alias-only step (www only, root still pictocartdev), see [DEPLOY_DOMAIN_ALIAS.md](./DEPLOY_DOMAIN_ALIAS.md). Broader Vercel notes: [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) § “Switching the root domain”.

## Locked decisions

| Item | Value |
|---|---|
| Model | Full root promote (not dual-root / request-host create) |
| Vercel project | `pictocart-u7pf` |
| DB | `v2pictocart` / `ugbjlpdhktrlkyuijkfc` |
| New root | `pictocart.in` |
| Canonical platform URL | `https://www.pictocart.in` |
| Staging | `pictocartdev.in` / `www` via `PLATFORM_HOST_ALIASES` |

## Prerequisites

1. Apex + www already on the project (`pictocart.in` → www, `www.pictocart.in`).
2. **`*.pictocart.in`** added and **verified** on Vercel. Wildcard needs Vercel nameservers (or `_acme-challenge` NS + `CNAME *`). Without it, store URLs never hit the app.
3. Keep `*.pictocartdev.in` — old store rows stay verified after the SQL move.

## Operator steps

### 1. Vercel env + redeploy

Production (and Preview if desired) on `pictocart-u7pf`:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` | `pictocart.in` |
| `NEXT_PUBLIC_PLATFORM_URL` | `https://www.pictocart.in` |
| `PLATFORM_HOST_ALIASES` | `pictocartdev.in,www.pictocartdev.in` |

Redeploy Production (`NEXT_PUBLIC_*` are baked at build). New creates then pass `p_root_domain=pictocart.in` into `create_tenant` / `platform_create_tenant`.

### 2. Move existing store primaries

Run [`supabase/dev/move-platform-root.sql`](../supabase/dev/move-platform-root.sql) once against the hosted DB (`new_root` is already `pictocart.in`):

- Inserts verified `{slug}.pictocart.in` for every non-cancelled tenant
- Promotes that row to **primary** when the current primary is a platform subdomain
- Custom-domain primaries untouched; old `{slug}.pictocartdev.in` rows kept

Idempotent — safe to re-run.

### 3. Supabase Auth

Authentication → URL Configuration:

- **Site URL:** `https://www.pictocart.in`
- **Redirect URLs** (keep staging while aliases remain):
  - `https://www.pictocart.in/**`, `https://pictocart.in/**`, `https://*.pictocart.in/**`
  - `https://www.pictocartdev.in/**`, `https://pictocartdev.in/**`, `https://*.pictocartdev.in/**`

Google Authorised JavaScript origins should already include both apex/www hosts if GIS is on (`GOOGLE_IDENTITY_SIGNIN=on`).

### 4. Verify

- `https://www.pictocart.in/admin/stores` — primaries show `*.pictocart.in`
- `https://{slug}.pictocart.in` — storefront loads (HTTPS cert issued)
- New store (admin or `/start`) — hostname `{slug}.pictocart.in`
- `https://www.pictocartdev.in` — still platform (alias)
- `https://{slug}.pictocartdev.in` — still resolves (non-primary row)
- `/seller/login` on www.pictocart.in — Google still completes

## Explicit non-goals

- Dual-root “create under whichever host you typed”
- Deleting `*.pictocartdev.in` domain rows or removing pictocartdev from Vercel
- Separate production Supabase project
- `www.{slug}.pictocart.in` (not covered by the one-level wildcard; proxy 404s them)
