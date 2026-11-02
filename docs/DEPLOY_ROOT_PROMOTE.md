# Promote `pictocart.in` (same Git + staging DB; split later)

Operational cutover for making **`pictocart.in`** the platform root while keeping the **same** Git repo and Supabase project that already serve **`pictocartdev.in`**. A dedicated production database and a real staging project come **later** (see bottom).

Canonical steps also live in [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) §2. SQL: [`supabase/dev/move-platform-root.sql`](../supabase/dev/move-platform-root.sql).

## Locked decisions

| Decision | Choice |
|---|---|
| Git | Same repo (`newpictocart`) |
| Vercel (target) | Project that already serves `pictocartdev.in` — slug **`pictocart-u7pf`**, team **antariksh** (CSP / `*.vercel.app` aliases) |
| Database (now) | Same as staging: **`v2pictocart`** / `ugbjlpdhktrlkyuijkfc` |
| Platform root | `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN=pictocart.in` → stores `{slug}.pictocart.in` |
| Staging URL (temporary) | `pictocartdev.in` + `www` via `PLATFORM_HOST_ALIASES` (same app + same DB mirror, not an isolated sandbox) |

## Pre-flight snapshot (2026-11-02, Asia/Kolkata)

Observed before cutover:

| Host | What it is today |
|---|---|
| `https://www.pictocartdev.in` | Next.js Pictocart app on Vercel (`x-matched-path: /`, Mumbai `bom1` in path) |
| `https://pictocart-u7pf.vercel.app` | Same Next app (unknown Host → store rewrite) |
| `https://www.pictocart.in` | **Different** Vercel deploy: static HTML (~2.7 KB), `iad1` only, **not** the Next app |
| `https://aangan.pictocartdev.in` | Hits Next `/store/[host]` (correct app) |
| `https://aangan.pictocart.in` | Same static deploy as www (not storefront) |

DNS (both apexes already on Vercel nameservers):

- `pictocart.in` NS → `ns1.vercel-dns.com` / `ns2.vercel-dns.com`
- `pictocartdev.in` NS → same
- `pictocart.in` TXT includes Resend domain verification, Hostinger SPF, Google site verification — **preserve** these when editing DNS

**Implication:** `pictocart.in` / `www` / `*` must be **removed from the old (static) Vercel project** and **added on `pictocart-u7pf`** before Production env/redeploy will serve the real app.

## Phase checklist (operator)

### A — Confirm access

- [ ] Vercel access to **`pictocart-u7pf`** and to the project that currently owns `www.pictocart.in`
- [ ] Supabase SQL + Auth on **`v2pictocart`**
- [ ] Production env already has the same Supabase URL + publishable + secret keys as staging; **do not rotate `APP_SECRET`**

### B — Attach domains on the Next project

1. On the **old** project: remove `pictocart.in`, `www.pictocart.in`, `*.pictocart.in`.
2. On **`pictocart-u7pf` → Domains**: add `pictocart.in`, `www.pictocart.in` (canonical: redirect apex → `www` unless you prefer apex), `*.pictocart.in`.
3. Keep `pictocartdev.in`, `www.pictocartdev.in`, `*.pictocartdev.in` on `pictocart-u7pf` during transition.

### C — Env + redeploy

Production variables, then **Redeploy** (`NEXT_PUBLIC_*` are baked at build):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` | `pictocart.in` |
| `NEXT_PUBLIC_PLATFORM_URL` | `https://www.pictocart.in` |
| `PLATFORM_HOST_ALIASES` | `pictocartdev.in,www.pictocartdev.in` |

Leave Supabase keys on **v2pictocart**.

### D — Domain rows in Supabase

In the SQL editor for `v2pictocart`, run [`move-platform-root.sql`](../supabase/dev/move-platform-root.sql) (`new_root := 'pictocart.in'`). Adds verified `{slug}.pictocart.in`; does not delete old `*.pictocartdev.in` rows.

### E — Auth / email / Google

- Auth Site URL: `https://www.pictocart.in`
- Redirects: `https://www.pictocart.in/**`, `https://pictocart.in/**`, `https://*.pictocart.in/**`, plus temporary `https://pictocartdev.in/**`, `https://*.pictocartdev.in/**`
- Resend: verify `pictocart.in` (or `mail.…`) and update Admin → Email / `EMAIL_FROM` when ready
- Google GIS origins: `https://pictocart.in`, `https://www.pictocart.in` ([GOOGLE_LOGIN.md](./GOOGLE_LOGIN.md))

### F — Verify

- [ ] `https://www.pictocart.in` serves the **same** Next marketing shell as `pictocartdev.in` (not the old static page)
- [ ] `https://pictocartdev.in` still loads (alias)
- [ ] `https://{known-slug}.pictocart.in` resolves a store; old `*.pictocartdev.in` still works until retired
- [ ] Seller login / OTP callbacks land on `pictocart.in`
- [ ] Optional: `curl -H "Authorization: Bearer $CRON_SECRET" https://www.pictocart.in/api/cron/domains`

## Later: separate production DB + real staging

**Out of scope for this cutover.** When ready:

1. Create a new Supabase **production** project; migrate or rebuild; point Production Vercel env at prod keys only.
2. Give `pictocartdev.in` its **own** Vercel project or custom environment with staging DB keys and `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN=pictocartdev.in`.
3. Remove `pictocartdev.in` from Production `PLATFORM_HOST_ALIASES` and drop staging Auth redirects from the **prod** Supabase project.

Until then, treat `pictocartdev.in` as a **hostname mirror** of production data — not a safe sandbox.
