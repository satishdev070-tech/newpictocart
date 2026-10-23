<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project rules (The Paliya)

Read before changing code: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/IMPLEMENTATION_STATUS.md` (blueprint: `docs/00`–`10`).

- Never trust a tenant id from the request. Storefront tenant = verified host (`resolveStorefrontTenant`); dashboard tenant = user's membership.
- Create Supabase clients only via `src/lib/supabase/*`. The admin (secret key) client is limited to the uses in ADR-006.
- Mutations go through `runAction` + `parseInput` and check permissions from `src/lib/permissions/matrix.ts`.
- Money is integer paise in TS (`src/lib/money.ts`).
- Run `pnpm check` (typecheck → lint → test → build) before calling a slice done, then update `docs/IMPLEMENTATION_STATUS.md`.

## Cursor Cloud specific instructions

- Dependencies: Node 22 and pnpm 10.28 (`packageManager`). Refresh with `pnpm install --frozen-lockfile`.
- Local Supabase runs without Docker. Set `SUPABASE_EXPERIMENTAL_STACK=1` and use `supabase start --runtime native --eager` (CLI 2.121.0). `supabase stack prepare --runtime native` only downloads archives.
- The dev server reads gitignored `.env.local`. Point `NEXT_PUBLIC_SUPABASE_URL` and the publishable/secret keys at `supabase status --output-format json`, and set `APP_SECRET` (32+ chars) and `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN=localhost`.
- App URL is `http://localhost:3000` (`pnpm dev --hostname 0.0.0.0 --port 3000`). Requests to `127.0.0.1` are rejected as an unknown host. Seeded storefront: `http://aangan.localhost:3000`. Merchant sign-in: `http://localhost:3000/seller/login` (users are in `supabase/seed.sql`).
- `pnpm check` is the full gate. `pnpm test:db` needs host PostgreSQL binaries and is separate from the local Supabase stack.
