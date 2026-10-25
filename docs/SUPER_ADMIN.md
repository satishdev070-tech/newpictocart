# Super admin console

Console at `/admin` for platform staff (`platform_memberships`: super_admin, support, finance).
Every page calls `requirePlatform(permission)`, and RLS / SQL functions enforce the same keys.

| Area | Route | Permission |
|---|---|---|
| Dashboard (KPIs, GMV trend, plans, activity) | `/admin` | platform.tenants.read |
| Stores: search, filters, sort, pagination | `/admin/stores` | platform.tenants.read |
| Store detail, actions, configuration | `/admin/tenants/{id}` | read; actions need platform.tenants.manage |
| Read-only support session | `/admin/tenants/{id}/support` | platform.support.impersonate |
| Domains, plans, feature flags | `/admin/domains`, `/admin/plans`, `/admin/flags` | tenants.read / plans.manage / flags.manage |
| Store integrations (status only) | `/admin/integrations` | platform.settings.manage |
| Platform health (env presence, booleans only) | `/admin/health` | platform.settings.manage |
| Themes: marketplace catalogue, AI "create from URL + screenshot", editor, publish | `/admin/themes` | platform.settings.manage |
| Usage, audit log, platform staff, settings | `/admin/usage`, `/admin/audit`, `/admin/platform-users`, `/admin/settings` | respective permissions |
| Users: every account (staff / seller / customer), stats, search, filters, list/grid, details with stores, sign-ins and audit trail, Add user, reset link, disable | `/admin/users`, `/admin/users/{id}` | platform.users.manage |
| Revenue P&L, Commissions (GMV invoices) | `/admin/revenue`, `/admin/commissions` | platform.finance.read (writes: platform.finance.manage) |
| Partner analytics (leaderboard, CSV), Partner payouts (batches, UTR) | `/admin/partner-analytics`, `/admin/partner-payouts` | platform.finance.read (writes: platform.finance.manage) |
| All partners (partners, licence requests, licences, demo shops, one-time codes), Agencies | `/admin/partners`, `/admin/agencies` | platform.partners.manage |
| AI health (feature → model registry, tests, model prices), Credits economy | `/admin/ai-health`, `/admin/credits-economy` | platform.settings.manage |

The nine modules ported from the old Pictocart admin are described in [SUPER_ADMIN_PORT.md](SUPER_ADMIN_PORT.md); they need migrations 3700–3900.

Bootstrap and the store directory are covered in [SUPER_ADMIN_SETUP.md](SUPER_ADMIN_SETUP.md).

Feature flags added in phase 3 (per plan, overridable per store): `payments_cashfree`,
`payments_payu`, `delhivery`, `theme_marketplace`, `google_analytics`, `google_ads`, `meta_pixel`,
`social_media`, `creative_studio`. All are checked server-side in the action or service, not only
in the UI.

## Store administration (2026-10-11)

| Feature | Where | Who |
|---|---|---|
| **Create store** with full control: existing or **new** owner account (name, optional password, or emailed set-password link), plan, trial or active, trial length, industry, store type (real/demo/test), contact email/phone, marketplace theme (draft or published), coming-soon or live, welcome email via Resend | `/admin/tenants/new` | `platform.tenants.manage` (new accounts: super admin) |
| **Reset password**: one-time reset link emailed via Resend and shown once to copy | Store → Team → Reset password | `platform.tenants.manage` |
| **Set password** directly (optional "password changed" email; the password is never emailed or logged) | Store → Team → Set password | super admin |
| **Log in as store** (owner) or as any member: opens the seller dashboard with their access; banner + "End support sign-in" | Store header → Log in as store; Team → Sign in as | super admin |

All of them need a reason where they touch an account, are rate limited and audited in the store's log. Platform staff
accounts can't be targeted. See ADR-033.
