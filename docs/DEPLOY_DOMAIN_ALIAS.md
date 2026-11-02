# Alias `www.pictocart.in` onto the staging Vercel project

**Historical narrow cutover:** point `https://www.pictocart.in` at the same Next.js deploy as `https://www.pictocartdev.in` without changing store subdomains. Same Git, same Supabase (`v2pictocart`).

**Superseded for production:** the platform root is now **`pictocart.in`**. Follow [DEPLOY_ROOT_PROMOTE.md](./DEPLOY_ROOT_PROMOTE.md) for the full promote (wildcard, env flip, `move-platform-root.sql`, Auth). Keep this doc as the alias-only playbook if you need to attach another marketing host without moving store roots.

## Locked decisions (alias-only)

| Item | Value |
|---|---|
| Target Vercel project | `pictocart-u7pf` (already serves `pictocartdev.in`) |
| Platform root | Unchanged — `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN=pictocartdev.in` |
| Store hosts | Stay `{slug}.pictocartdev.in` |
| New platform hosts | `www.pictocart.in` + apex `pictocart.in` (redirect → www) via Domains + `PLATFORM_HOST_ALIASES` |

Without `PLATFORM_HOST_ALIASES`, `www.pictocart.in` can be treated as a store host and 404.

## Operator steps (alias-only)

### 1. Move domains

1. On the **old** project (static ~2.7 KB `www.pictocart.in`): remove `pictocart.in`, `www.pictocart.in`, `*.pictocart.in` if present.
2. On **`pictocart-u7pf`**: add `www.pictocart.in`; add `pictocart.in` as **308 → www**.
3. Keep all `pictocartdev.in` domains. Skip `*.pictocart.in` unless you need it later (required for [full promote](./DEPLOY_ROOT_PROMOTE.md)).

### 2. Env + redeploy

Production on `pictocart-u7pf`:

| Variable | Value |
|---|---|
| `PLATFORM_HOST_ALIASES` | `pictocart.in,www.pictocart.in` |
| `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` | leave `pictocartdev.in` |
| Supabase / `APP_SECRET` | unchanged |

Redeploy Production.

### 3. Auth + Google

Supabase `v2pictocart` → Auth redirect URLs, add:

- `https://www.pictocart.in/**`
- `https://pictocart.in/**`

Vercel: `GOOGLE_IDENTITY_SIGNIN=on` (so seller Google consent shows your domain, not `*.supabase.co`).

Google Cloud OAuth client → Authorised JavaScript origins: both `pictocart.in` / `www` and
`pictocartdev.in` / `www`. Consent screen application name: **Pictocart**.

Merchant OAuth `redirectTo` follows the browser host via `authRequestOrigin()` (see
[GOOGLE_LOGIN.md](./GOOGLE_LOGIN.md)) so PKCE does not break across the alias.

### 4. Verify (alias-only)

- `https://www.pictocart.in` → same Next marketing app as staging (not static stub)
- `https://pictocart.in` → redirects to www
- `https://www.pictocartdev.in` → unchanged
- Stores still on `*.pictocartdev.in`
- `/seller/login` on both hosts: Google completes without `?error=link`; GIS chooser shows the site host
