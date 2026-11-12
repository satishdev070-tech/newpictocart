# Informative Website — Rollout runbook

Plan: [PLAN.md](./PLAN.md) · Progress: [PROGRESS.md](./PROGRESS.md)

The feature ships **dark**: with `FEATURE_INFORMATIVE_WEBSITE` unset or `off`, the app behaves as before
(Step 0 hidden, `/start` → `/start/lang`, all informative routes 404; verified by unit tests and the
`E2E_FLAG=off` pass).

## 1. Merge (flag off)

1. Merge the PR into `main` (squash; "CI passed" required).
2. Deploy through the manual `deploy-production.yml` as usual. **The code is safe before the
   migrations run**: membership and tenant-directory reads retry without `website_type` when the column
   is missing, so every tenant resolves as ONLINE_STORE.

## 2. Apply the migrations (production Supabase)

Apply in order, through your normal migration process (`supabase db push` against the linked
project, or the SQL editor):

| Migration | What it does | Notes |
|---|---|---|
| `20261111008000_informative_website_type.sql` | `tenants.website_type` (default `ONLINE_STORE`, backfilled by the `ALTER`), immutability trigger, `create_tenant(…, p_website_type default 'ONLINE_STORE')` | **Replaces `create_tenant`** (drop 3-argument version + create 4-argument version in one file). Run it in a quiet window: a store signup that calls `create_tenant` *during* the migration can fail once and succeed on retry. Existing callers keep passing 3 arguments. |
| `20261111008100_informative_content.sql` | 9 `info_*` tables, RLS, grants, helpers | New tables only |
| `20261111008200_informative_onboarding.sql` | `store_slug_available()`, `complete_informative_onboarding()` | New functions only |
| `20261111008300_informative_enquiries.sql` | `submit_info_enquiry()`, `record_info_whatsapp_click()` | New functions only |

Down paths are written in each migration's header. **Verified** on a fresh local Supabase stack
(all 74 migrations + seed), in the RLS suite (all informative RLS files pass; see PROGRESS M8 for 8 pre-existing environment-only failures) and the E2E suite.

**Post-migration DB check** (plan regression item): every pre-existing tenant must still be
ONLINE_STORE.

```sql
select website_type, count(*) from public.tenants group by 1;
-- expect only ONLINE_STORE until the first Informative signup
```

## 3. Enable for internal accounts

Add the GitHub repository secret `FEATURE_INFORMATIVE_WEBSITE` = `internal` (Settings → Secrets and
variables → Actions; staging reads `STAGING_FEATURE_INFORMATIVE_WEBSITE`), then run **Deploy production**.
The deploy writes it into the Worker's secrets file. **Don't set it only in the Cloudflare dashboard**:
`cf deploy --secrets-file` replaces the Worker's bindings, so the next deploy would wipe it. Only
signed-in platform staff see Step 0 and can create Informative Websites; everyone else sees today's
flow.

Then run the E2E suite against staging if available (see "Running the E2E suite" below), and do one
real journey by hand on production with a staff account: onboard → add a service → publish → visit
`<slug>.pictocart.in` → send an enquiry → see it in the inbox and the email.

## 4. Enable for all new signups

Change the secret to `all` and run **Deploy production** again. Watch:

- errors: `informative.*` log events (`informative.enquiry_email_failed`, `informative.public_load_failed`, `informative.logo_upload_failed`);
- onboarding completion by type (GA4 events `onboarding_type_selected`, `informative_onboarding_completed`, plus the server log `informative_onboarding_completed`);
- enquiry submissions (`info_enquiries` per day).

## Rollback

Change the secret to `off` (or delete it) and run **Deploy production**. Step 0 disappears and creation stops. Informative accounts that
already exist see a maintenance page in the panel and on their public site instead of breaking. Nothing
is deleted, and the `website_type` column stays (harmless default). Turning the flag back on restores
them as they were.

## Running the E2E suite

The suite (`tests/e2e`, Playwright) is **not** part of `pnpm check` / CI: it needs a Supabase stack with
every migration and `supabase/seed.sql`. Locally:

```bash
# a throwaway stack on spare ports (copy supabase/ and move [api]/[db]/… ports), then:
E2E_SUPABASE_URL=http://127.0.0.1:<api port> E2E_SUPABASE_PUBLISHABLE_KEY=… E2E_SUPABASE_SECRET_KEY=… pnpm test:e2e
E2E_FLAG=off E2E_SUPABASE_URL=… E2E_SUPABASE_PUBLISHABLE_KEY=… E2E_SUPABASE_SECRET_KEY=… pnpm test:e2e
```

Set `CHROMIUM_PATH` to an installed Chrome if Playwright's browsers are not downloaded. Each run uses
fresh slugs; the seed user `shopper@example.test` can own at most 5 sites, so `supabase db reset` the
stack between many runs.
