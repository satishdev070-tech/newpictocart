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

- Local Supabase has no Docker. Export `SUPABASE_TELEMETRY_DISABLED=1` and `SUPABASE_EXPERIMENTAL_STACK=1`. Prefetch artifacts with `supabase stack prepare --runtime native`. Boot services with `supabase start --runtime native --exclude studio,mail,analytics,realtime,functions --eager` (otherwise they idle-stop). Leave `supabase/config.toml` ports as they are: API `54321`, database `54322`.
- `supabase status` talks to Docker and fails here. `supabase stack status --env` prints one JSON object. Map `API_URL`, `PUBLISHABLE_KEY`, and `SECRET_KEY` into gitignored `.env.local`, and set `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN=localhost` plus an `APP_SECRET` of at least 32 characters.
- `pnpm install` skips the esbuild postinstall. Run `pnpm rebuild esbuild` before `pnpm test`. `sharp` stays ignored in `pnpm-workspace.yaml`.
- Dev server: `pnpm dev`. Platform: `http://localhost:3000`. A host of `127.0.0.1` is unknown. Storefront: `http://aangan.localhost:3000`. Readiness: `GET /api/health/ready` with `Host: localhost`. Seed accounts are documented at the top of `supabase/seed.sql`.
