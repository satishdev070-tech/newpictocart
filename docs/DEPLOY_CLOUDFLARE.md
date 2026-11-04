# Cloudflare in front of Vercel (recommended)

**Decision:** ADR-011 accepted — run the **Next.js app on Vercel**; put **Cloudflare** in front for DNS, TLS, CDN, WAF. Do **not** deploy this app to static Cloudflare Pages. Do **not** cut production to OpenNext Workers until a dedicated spike is green (see § OpenNext deferred).

Related: [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) (origin), [DEPLOY_ROOT_PROMOTE.md](./DEPLOY_ROOT_PROMOTE.md) (root `pictocart.in`), [DEPLOY_HOSTINGER.md](./DEPLOY_HOSTINGER.md) (Hostinger + `workers/domain-router` — **not** this path).

```
Visitor → Cloudflare (DNS/CDN/TLS) → Vercel (Next.js) → Supabase
```

## Why this path

| Approach | Use? |
|---|---|
| Cloudflare DNS/CDN → Vercel | **Yes** — keeps Server Actions, `proxy.ts`, crons, `sharp` |
| Static Cloudflare Pages | **No** — app is multi-tenant dynamic |
| OpenNext on Workers | **Later** — compatibility spike only |
| Hostinger + domain-router Worker | Only if origin leaves Vercel |

## Staging meaning (pictocartdev.in)

Both hosts share Vercel project **`pictocart-u7pf`** and Supabase **`v2pictocart`**. Putting Cloudflare on `pictocartdev.in` first is a **canary edge path**, not an isolated database. Treat writes as production-like.

**Env (already live post-promote):**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` | `pictocart.in` |
| `NEXT_PUBLIC_PLATFORM_URL` | `https://www.pictocart.in` |
| `PLATFORM_HOST_ALIASES` | `pictocartdev.in,www.pictocartdev.in` |

Leave these unchanged for the Cloudflare cutover. App deploys and crons stay on Vercel.

---

## Phase 0 — Preconditions

Confirm before touching nameservers:

1. **Origin healthy**
   - `https://www.pictocartdev.in/api/health` → `{"ok":true}`
   - `https://www.pictocartdev.in/api/health/ready` → `env.ok` and `supabase.ok`
   - `https://www.pictocart.in/api/health` → `{"ok":true}`
2. **DNS today (baseline):** both zones use Vercel nameservers (`ns1.vercel-dns.com` / `ns2.vercel-dns.com`). Response `server: Vercel` (no `cf-ray` yet).
3. **Vercel Domains:** project still has `pictocartdev.in`, `www.pictocartdev.in`, `pictocart.in`, `www.pictocart.in`, `*.pictocart.in` (and `*.pictocartdev.in` if old store rows still need it). Keep them **verified** after NS move.
4. **Cloudflare account** ready (Free plan is enough for DNS/CDN canary).
5. **Copy every existing DNS record** from Vercel DNS (MX, Resend SPF/DKIM, Google verifications, etc.) **before** switching nameservers — MX/TXT must be recreated on Cloudflare or email breaks.
6. Optional smoke script (from repo): `pnpm exec tsx scripts/ops/smoke-cloudflare-hosts.mts`

---

## Phase 1 — Canary: pictocartdev.in on Cloudflare

Leave **`pictocart.in` on Vercel DNS** until this phase is clean.

### 1. Add the zone

1. Cloudflare → **Add a site** → `pictocartdev.in` → Free.
2. Import/recreate records (next section). Do **not** change registrar nameservers until records look right.

### 2. DNS records (origin = Vercel)

In Vercel → Project → Settings → **Domains**, open each hostname and copy the exact target Vercel shows. Typical pattern:

| Type | Name | Content | Proxy |
|---|---|---|---|
| CNAME | `www` | `cname.vercel-dns.com` (or the value Vercel shows) | **Proxied (orange)** |
| A / AAAA / CNAME | `@` | Vercel apex target (often A `76.76.21.21` or ALIAS/CNAME flattening to `cname.vercel-dns.com`) | **Proxied (orange)** |
| CNAME | `*` | same Vercel CNAME target as www | **Proxied (orange)** only if you still serve `{slug}.pictocartdev.in` |

Also recreate **all** MX/TXT/CAA from the Vercel DNS export (**DNS only / grey** for mail/auth records).

### 3. SSL/TLS

- SSL/TLS → Overview → **Full (strict)** (Vercel presents a valid cert on the origin hostname).
- If you see redirect loops or SSL errors: briefly set records to **DNS only (grey)**, confirm Vercel works, then re-enable orange cloud.

### 4. Cache / WAF (recommended)

Cloudflare → Caching → Configuration:

- Do **not** enable aggressive “Cache Everything” for the whole site.
- Page Rules / Cache Rules — **Bypass cache** (or Eligible for cache = false) for:
  - `/api/*`
  - `/seller/*`, `/admin/*`, `/dashboard/*`, `/login*`, `/auth/*`
  - `/store/*` dynamic paths if you later route them through CF (usually Host-based on Vercel; wildcard store hosts still need correct Host passthrough)

Keep default CF CDN for static marketing assets only when safe; when unsure, prefer bypass for HTML document requests.

### 5. Cut nameservers

At the **registrar** for `pictocartdev.in`, replace Vercel NS with the two Cloudflare nameservers shown in the zone. Wait until Cloudflare zone status is **Active** (often minutes; up to 48h).

### 6. Canary smoke checklist

Run after `cf-ray` appears on responses (`curl -sI https://www.pictocartdev.in/api/health | rg -i 'cf-ray|server'`):

- [ ] `https://www.pictocartdev.in/` marketing loads
- [ ] `https://www.pictocartdev.in/api/health` and `/api/health/ready` OK
- [ ] `/seller/login`, `/admin/login` (no redirect loop)
- [ ] Google / OAuth on alias host still works (Auth redirects already include pictocartdev)
- [ ] One known `{slug}.pictocartdev.in` store if wildcard is proxied
- [ ] `https://www.pictocart.in/` still on Vercel path and healthy (control)

Or: `pnpm exec tsx scripts/ops/smoke-cloudflare-hosts.mts --canary`

### 7. Soak

Watch TLS, login, and storefront for a soak period you trust. Do **not** start Phase 2 until canary is clean.

### Rollback (canary)

1. Registrar: point nameservers back to `ns1.vercel-dns.com` / `ns2.vercel-dns.com`.
2. Or set Cloudflare records to **DNS only** and fix SSL mode.
3. Confirm `server: Vercel` and health OK again.

---

## Phase 2 — Production: pictocart.in on Cloudflare

Same pattern as Phase 1, for the live root.

### Extra requirements

| Record | Why |
|---|---|
| `www` → Vercel CNAME, proxied | Canonical platform URL |
| apex `@` → Vercel apex target, proxied | apex / redirects |
| `*` → Vercel CNAME, **proxied** | **Required** for `{slug}.pictocart.in` storefronts |

1. Add/move zone `pictocart.in` on Cloudflare; recreate **all** MX/TXT from Vercel DNS first.
2. Confirm Vercel still lists `*.pictocart.in` as verified after NS move (add any TXT/CNAME verification Cloudflare/Vercel request).
3. SSL **Full (strict)**.
4. Same cache bypass rules as Phase 1.
5. Cut registrar nameservers to Cloudflare when records are ready.

### Production smoke

- [ ] `https://www.pictocart.in/` and `/api/health/ready`
- [ ] Live `{slug}.pictocart.in` storefront + cart
- [ ] Checkout / payment return URLs
- [ ] Webhooks still reach Vercel (`/api/webhooks/*`) — providers call your public URL; CF must not block them
- [ ] Seller custom domains (if any) still work; Cloudflare for SaaS is **optional later** (`CLOUDFLARE_*` in [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md)) — do not block this cutover on SaaS

Or: `pnpm exec tsx scripts/ops/smoke-cloudflare-hosts.mts --prod`

### Rollback (prod)

Same as canary: restore Vercel nameservers, or grey-cloud + fix SSL. Prefer grey-cloud first if only the proxy is wrong.

---

## Do not use `workers/domain-router` on this path

[`workers/domain-router`](../workers/domain-router) signs `EDGE_SHARED_SECRET` for a **Hostinger** (or non-Vercel) origin that cannot terminate wildcards. While the Next app stays on **Vercel**, skip that Worker — Vercel already accepts the real `Host` and issues certs when domains are configured on the project.

---

## OpenNext deferred (ADR-011 spike)

Full `@opennextjs/cloudflare` hosting is **out of scope** until a spike proves:

- Next **16.3.x** + [`src/proxy.ts`](../src/proxy.ts)
- Server Actions (incl. large body limits)
- Cron replacement for [`vercel.json`](../vercel.json) → Workers cron / external scheduler + `CRON_SECRET`
- `sharp` / `/api/img` strategy
- Canary on `*.workers.dev` **before** any `pictocart.in` DNS change

Until then: **Cloudflare in front of Vercel** is the supported “host frontend on Cloudflare” process.
