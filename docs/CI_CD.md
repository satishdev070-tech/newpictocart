# CI/CD pipeline

```
feature/x pushed ──► Auto PR (opens PR to main, once) ──► CI (8 parallel checks → "CI passed")
                                                              │ required by branch protection
                                         squash-merge to main ▼
                                  Deploy staging (exact merge commit → Worker pictocart-staging
                                  → verify www.pictocartdev.in serves that commit → else roll back)
                                                              │ manual, approved
                                                              ▼
                                  Deploy production (commit on main that passed staging
                                  → Worker pictocart → verify www.pictocart.in → else roll back)
```

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | PR to main; dispatched by Auto PR | typecheck, lint, unit tests, auth/tenant regression, Next build, vinext Worker build, env-name contract, gitleaks on the branch's commits → `CI passed` |
| `auto-pr.yml` | push to `feature/**`, `feat/**`, `fix/**`, `hotfix/**`, `chore/**`, `refactor/**`, `perf/**`, `docs/**`, `test/**` | opens one PR to main (skips if one is open or the branch has nothing new), never merges |
| `deploy-staging.yml` | push to main (= merged PR); manual | deploys that commit to staging via `deploy-worker.yml` |
| `deploy-production.yml` | manual only | promotes a commit on main to production via `deploy-worker.yml` |
| `deploy-worker.yml` | reusable | build → complete secrets file → validate → `cf deploy` → verify → roll back on failure |
| `capture-theme-previews.yml` | manual | unchanged |
| `cron.yml` | schedule (every 5 / 30 min, daily); manual | calls production `/api/cron/*` with `CRON_SECRET`; off until `PRODUCTION_CRON_ENABLED=true` |

Database migrations are never run by any workflow. Apply them by hand: staging project first, then
production (`supabase db push --linked` after `supabase link --project-ref <ref>`), and only additive
changes without a reviewed plan.

## Daily workflow

```bash
git checkout main
git pull origin main
git checkout -b feature/my-feature
# …code, `pnpm dev`, `pnpm check`…
git add .
git commit -m "feat: my feature"
git push -u origin feature/my-feature
```

The push opens the PR and starts CI. Fix failures by pushing more commits to the same branch. When
`CI passed` is green, squash-merge on GitHub. The merge deploys staging automatically.

| Task | Command |
|---|---|
| PR status and checks | `gh pr status` · `gh pr checks` |
| Why CI failed | `gh run list --branch feature/my-feature` then `gh run view <id> --log-failed` |
| Re-run failed jobs | `gh run rerun <id> --failed` |
| Staging deploys | `gh run list --workflow deploy-staging.yml` |
| Commit live on a domain | `curl -s https://www.pictocartdev.in/api/health` (`commit`, `environment`) |
| Cloudflare logs / versions | `npx cf auth login`, then the dashboard → Workers → `pictocart-staging` / `pictocart` → Deployments, Logs |
| Promote staging → production | Actions → Deploy production → Run workflow (sha blank = main, type `deploy production`), or `gh workflow run deploy-production.yml -f confirm="deploy production" -f sha=<sha>` |
| Revert a bad merge | `git checkout main && git pull && git checkout -b fix/revert-x && git revert -m 1 <merge-sha>` (or `git revert <squash-sha>`), push, merge the PR; staging redeploys |
| Roll back a Worker now | Cloudflare dashboard → Workers → the Worker → Deployments → previous version → Deploy (or `npx wrangler rollback --name pictocart` with an API token). Code + its bindings revert; the database does not. |

## Several Workers per environment (ADR-042)

Set the repo variable `STAGING_STOREFRONT_WORKER` (e.g. `pictocart-storefront-staging`) or
`PRODUCTION_STOREFRONT_WORKER` (must be `pictocart-storefront`) and the next deploy also uploads the
same build as that Worker with `DEPLOY_WORKER_ROLE=storefront`. It is verified through its
`workers.dev` host (health + role, ready, self-test). If any check fails, or its upload fails, both
Workers return to the versions that served before the run. Leave the variable empty for the
single-Worker flow. Pointing `*.<root>/*` and custom hostnames at it is a separate, manual step
(docs/CLOUDFLARE_DISTRIBUTION_PLAN.md, phase 5).

## Verification and rollback

After `cf deploy --message gha:<target>:<sha>`, `deploy-worker.yml` checks, each with up to 6 tries
10 s apart:

1. Cloudflare's active deployment carries the message for this exact commit.
2. `<domain>/api/health` returns `commit = <sha>`. This proves the domain routes to the new version.
3. `<domain>/api/health/ready` is `ok` (env schema valid and Supabase reachable).
4. `/api/cron/preview-token-self-test` gives `mintVerify: ok` (APP_SECRET mint and verify).
5. `/` and `/seller/login` return 200.

If any check fails, it redeploys the versions that were serving before the run (recorded from the
Cloudflare Deployments API). Those versions carry their own bindings and secrets. Then it marks the
run failed. It never touches secrets or the database. The first deploy of a new Worker has nothing
to roll back to.

A commit made before this pipeline has no `commit` in `/api/health`, so it cannot pass check 2.
Roll back to it in the Cloudflare dashboard instead.

## Environments and secrets

Staging and production use different secret names, so staging can never fall back to production
values. The production names are the existing repo secrets, unchanged.

| Purpose | Production (existing) | Staging |
|---|---|---|
| Cloudflare auth (same account) | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | same |
| App HMAC / encryption | `APP_SECRET` | `STAGING_APP_SECRET` (different value) |
| Cron bearer | `CRON_SECRET` | `STAGING_CRON_SECRET` |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | `STAGING_NEXT_PUBLIC_SUPABASE_URL`, `STAGING_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `STAGING_SUPABASE_SECRET_KEY` |
| Optional | `PLATFORM_HOST_ALIASES`, `EMAIL_FROM`, `RESEND_API_KEY`, `GOOGLE_IDENTITY_SIGNIN` | `STAGING_` + same names |
| Variables (not secret) | `PRODUCTION_KV_NAMESPACE_ID` (default `2a8074bf…`), `PRODUCTION_WORKERS_DEV_HOST` | `STAGING_KV_NAMESPACE_ID` (required), `STAGING_WORKER_NAME` (default `pictocart-staging`), `STAGING_WORKERS_DEV_HOST`, `STAGING_SHARES_PRODUCTION_DATABASE` |

The domains and Worker names are fixed in the workflows: staging is `pictocartdev.in` on
`pictocart-staging`, production is `pictocart.in` on `pictocart`. `deploy-worker.yml` refuses to
deploy staging onto the production Worker or domain. It also refuses a staging Supabase URL equal to
production's, unless `STAGING_SHARES_PRODUCTION_DATABASE=true`.

Each `cf deploy --secrets-file` replaces the Worker's secrets, so every optional secret you rely on
(for example `GOOGLE_IDENTITY_SIGNIN`) must exist in GitHub.

Cloudflare API token permissions: Account → Workers Scripts: Edit, Workers KV Storage: Edit,
Account Settings: Read. Add Zone → Workers Routes: Edit on `pictocart.in` and `pictocartdev.in` if
routes are managed through deploys.

## Set up staging (one time)

Today `pictocartdev.in` is a Custom Domain of the **production** Worker, using the production
database. Until the steps below are done, `Deploy staging` fails at preflight and deploys nothing.

1. **Database.** Create a staging Supabase project (recommended) and apply `supabase/migrations`
   to it. To knowingly share production's database instead, set the repo variable
   `STAGING_SHARES_PRODUCTION_DATABASE=true` (not isolated: staging writes production data).
2. **KV.** Create a KV namespace for staging's cache (`npx cf auth login`, then the dashboard →
   Storage → KV → Create `pictocart-staging-cache`). Set its id as the repo variable
   `STAGING_KV_NAMESPACE_ID`.
3. **Secrets.** Add the `STAGING_*` secrets from the table, with new values:
   `openssl rand -hex 32` for `STAGING_APP_SECRET`, `openssl rand -hex 24` for
   `STAGING_CRON_SECRET`.
4. **First deploy.** Actions → Deploy staging → Run workflow. This creates Worker
   `pictocart-staging`. The domain checks fail, because `pictocartdev.in` still points at
   production. That's expected for this one run.
5. **Move the domain.** Cloudflare → Workers → `pictocart` → Settings → Domains & Routes: remove
   `pictocartdev.in` and `www.pictocartdev.in`. Add both to `pictocart-staging`. For store
   subdomains, also add the route `*.pictocartdev.in/*` and a proxied DNS record `AAAA * → 100::`.
6. **Drop the production alias.** Set the production secret `PLATFORM_HOST_ALIASES` to an empty
   value or remove it. Production then stops treating `pictocartdev.in` as its own host.
7. Run **Deploy staging** again. It must pass every check.

## Branch protection (repo admin)

Settings → Rules → Rulesets → New branch ruleset, targeting `main`. Or use the CLI:

```bash
gh api -X POST repos/satishdev070-tech/newpictocart/rulesets --input - <<'JSON'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false, "require_last_push_approval": false,
        "required_review_thread_resolution": false, "allowed_merge_methods": ["squash"] } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [ { "context": "CI passed" } ] } }
  ]
}
JSON
```

- **Rules this sets:** PRs are required, which blocks direct pushes. Merges are squash-only.
  `CI passed` is required, and the branch must be up to date with main. Force pushes and deletion
  are blocked. Set `required_approving_review_count` to `1` to also require a reviewer.
- **No merge queue:** it isn't available for user-owned repositories, which is why the
  "up to date" rule is used instead.

Also:

1. Settings → Actions → General → Workflow permissions: enable
   "Allow GitHub Actions to create and approve pull requests". Auto PR needs it.
2. Settings → Environments → `production`: add yourself under Required reviewers. Allow only
   branch `main`.
3. Settings → General → Pull Requests: turn on "Automatically delete head branches" (optional).
4. Cloudflare → Workers → `newpictocart` (wrong account) → Builds: disconnect GitHub, as
   `DEPLOY_CLOUDFLARE_WORKERS.md` already notes.
