# Super Admin port from the old Pictocart app (plan)

_Written 2026-10-25, before coding. Source: `pictocart/pictocart` (`src/pages/admin/*`, `supabase/migrations/*`), read as reference only. Nothing is copied: the old app is Vite + React Query with client-side Supabase writes, and this repo uses server components, `runAction` + `parseInput` and RLS/SECURITY DEFINER SQL._

## What exists here vs the old app

| # | Module (old URL) | Old implementation | Already here | Missing / different |
|---|---|---|---|---|
| 1 | Users `/admin/users` | `profiles` + `user_roles` (admin/seller/customer) + `admin-manage-user` edge function | `/admin/users` lists **platform staff only** (`platform_memberships`); store-member password reset and "sign in as" (ADR-033) | Directory of **all** accounts with type label (platform staff / seller / customer), stats, search (name, email, phone, store, theme), role and store filters, list/grid, details with stores, sign-ins and audit trail, Add user |
| 2 | Revenue P&L `/admin/revenue` | Client-side sums over `subscriptions`, `orders`, `plan_configs.commission_percent`, theme packs, credit transactions (floats) | Plans with prices (rupees), tenant status/plan, orders, AI-credit purchase requests | Commission rate per plan, AI cost per call, a page that does the maths in integer paise |
| 3 | Commissions `/admin/commissions` | `commission_invoices` + `order_commissions`, edge function `generate-commission-invoices`, client-side status updates | Nothing | Invoice table, idempotent generation for the previous month, mark paid / waive (audited) |
| 4 | Partner Analytics | `partner_leaderboard` RPC (join fan-out double counts licences × commissions) | Nothing | Partner tables, a leaderboard that aggregates each source separately, CSV export |
| 5 | Partner Payouts | `admin_pending_payouts_summary`, `admin_run_payout_batch`, `admin_mark_payout_paid` | Nothing | Payout batch per cutoff, mark paid with UTR |
| 6 | Agencies | `admin_list_partner_orgs` RPC: the live page shows "Could not load partners" (the RPC is missing or fails on the live DB) | Nothing | Org list by type with server totals, owner detail with team |
| 7 | All Partners | `partners`, invites, licence requests/batches/keys, demo shops (**plaintext shop passwords**), one-time credit codes, promote/parent/payout % | Nothing | Same tabs, without storing demo-shop passwords (demo shops link to `store_type = 'demo'` stores) |
| 8 | AI Health | Hard-coded edge-function list, `ai_call_log`, `platform_llm_models`, NVIDIA/Pollinations | `ai_generations` log (kind, provider, model, tokens), provider keys in **Admin → Social apps** (Gemini, Groq, Anthropic), Sarvam for voice/sections | Feature registry for **this** app's AI features, per-feature primary + fallback provider/model actually used by `runGeneration`, model prices for AI cost, Test button |
| 9 | Credits Economy | `platform_credit_settings`, `ai_action_costs`, `ai_credit_packs`, `credit_promos`, wallets | `ai_credit_accounts/ledger/purchase_requests` (migration 3400), packs hard-coded in SQL and TS, 1 credit per generation, 100 welcome credits, `/admin/ai-credits` (queue + manual grant) | Editable pricing, per-action cost, packs and promos in tables (read by the credit RPCs), insights, grant tab |

## Decisions

- **Permissions.** Three new platform keys (matrix + SQL seed + tests): `platform.finance.read` (Revenue, Commissions, Partner analytics, Payouts: super_admin, finance), `platform.finance.manage` (generate/mark/waive invoices, run and pay payout batches: super_admin, finance), `platform.partners.manage` (partners, licences, agencies, demo shops, codes: super_admin). Users stays on `platform.users.manage`; AI Health and Credits Economy stay on `platform.settings.manage`, like the existing AI credits page.
- **Money.** Integer paise in TS (`src/lib/money.ts`), `numeric(12,2)` in SQL, rates as integer basis points (`commission_bps`, `direct_bps`, `override_bps`). Pure maths in `src/features/platform-finance/calc.ts` (unit tested).
- **Writes** go through SECURITY DEFINER functions that check `app.has_platform_permission` and write `audit_logs`; tables have RLS on with platform-only select policies and no direct write grants.
- **Users directory** reads `auth.users` through a SECURITY DEFINER function gated on `platform.users.manage` (same approach as `platform_user_emails`), so no secret-key client is needed for reads. Creating an account uses the existing ADR-006 "platform op after an explicit permission check" path.
- **GMV** = `grand_total − refunded_total` of orders that are paid (`paid`, `partially_refunded`) or COD and delivered. Commission = GMV × the store's plan `commission_bps`.
- **MRR** = active (not trial) stores × plan monthly price. There is no subscription payment ledger, so lifetime gross uses current MRR as the subscription part (same as the old page), and says so.
- **Theme sales.** Marketplace themes are free presets here (no price, no purchases). The Theme P&L shows adoption per theme with ₹0 revenue rather than invented numbers.
- **AI cost** = `ai_generations.tokens` × a per-model blended price (paise per 1M tokens) set on the AI Health page.
- **Partners.** Admin-side flows only; there is no partner portal in this repo. Partner-side actions (request licences, redeem one-time codes) are done by an admin on the partner's behalf. Invites email an accept link that attaches the signed-in account to the partner. Commissions accrue monthly on attributed stores' plan price (direct to the partner, override to the parent), idempotently.
- **Tiers / types** follow the old app: tiers `partner | state_head | regional_head`; types `agency | freelancer | intern | agent`.

## Migrations (NOT applied to the live project)

1. `20261025003700_platform_finance.sql`: permissions, `plans.commission_bps`, `commission_invoices`, users directory, revenue and invoice functions.
2. `20261025003800_partners.sql`: partners, invites, licence requests/batches/keys, referrals, commissions, payouts, demo shops, one-time codes, credit ledger, functions.
3. `20261025003900_ai_economy.sql`: credit settings, action costs, packs, promos, AI feature routes and model prices; credit RPCs read them (welcome grant, per-action cost, pack prices, promo codes).

Each is tested with `pnpm test:db` on a scratch Postgres 17 and listed for the owner to approve.

## Build order

calc + permissions → migration 1 + Revenue/Commissions/Users → migration 2 + partner pages → migration 3 + AI Health/Credits Economy → nav, tests, `pnpm check`, dev-server walkthrough, status doc, PR.
