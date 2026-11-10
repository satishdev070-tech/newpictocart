# Theme Editor E2E Test Plan — Playwright

_Date: 2026-11-10 · **Plan only** — do not implement tests, create accounts, or hit production until staging is approved and live per [`STAGING_ENVIRONMENT_SETUP_PLAN.md`](./STAGING_ENVIRONMENT_SETUP_PLAN.md)._

Depends on: [`ENVIRONMENT_ISOLATION_REPORT.md`](./ENVIRONMENT_ISOLATION_REPORT.md), staging stack ready.  
Related app evidence: `src/features/theme/site-builder/*`, `src/app/api/theme/preview-token/route.ts`, `src/app/store/[host]/preview/route.ts`, `src/features/theme/actions.ts`.

---

## 1. Objective

Automate the Theme Customizer critical path on **staging only**:

Seller auth → membership → Theme Editor → preview mint/iframe → customize → autosave → publish → storefront visibility → rollback → cross-tenant deny.

---

## 2. Dependencies

| Dependency | Requirement |
|---|---|
| Staging platform URL | e.g. `https://staging.…` |
| Staging store host | e.g. `https://e2e-theme.staging.…` |
| Staging seller credentials | CI secret — not in git |
| Permissions | `theme.edit`, `theme.publish` |
| Staging `mintVerify: ok` | Preflight before suite |
| `@playwright/test` | Already in `package.json` (no config yet) |
| Node 22 / pnpm | Repo standard |

**Hard rule:** `E2E_BASE_URL` host must **not** be `www.pictocart.in`, `*.pictocart.in` customer stores, or Supabase ref `ugbjlpdhktrlkyuijkfc`. Fail fast in global setup if production hosts detected.

---

## 3. Configuration requirements

Proposed env (names only):

| Variable | Purpose |
|---|---|
| `E2E_BASE_URL` | Staging platform origin |
| `E2E_STORE_ORIGIN` | Staging storefront origin |
| `E2E_SELLER_EMAIL` | Test seller |
| `E2E_SELLER_PASSWORD` | CI secret |
| `E2E_STORE_SLUG` | e.g. `e2e-theme` |
| `E2E_FOREIGN_STORE_ORIGIN` | Second staging store for isolation (optional but required for test 16) |

Proposed layout (future implementation — not created now):

```
playwright.config.ts          # baseURL = E2E_BASE_URL; forbid prod hosts
e2e/theme-editor/
  auth.setup.ts
  preview.spec.ts
  customize-autosave.spec.ts
  publish-rollback.spec.ts
  tenant-isolation.spec.ts
```

---

## 4. Timing constants (from product code)

| Constant | Value | Use in tests |
|---|---|---|
| `AUTOSAVE_IDLE_MS` | **2500** | Wait ≥ idle + buffer after edit before asserting “saved” |
| `AUTOSAVE_MAX_WAIT_MS` | **10000** | Upper bound for forced autosave |
| Preview token TTL | **2 hours** | Session length; remint tested via canvas refresh |
| Storefront cache | ≤ **120s** (L1; Redis optional) | After publish, assert visibility with refresh; allow bounded retry |

Evidence: `src/features/theme/site-builder/autosave.ts`, `src/features/theme/preview.ts`, `src/lib/cache/storefront.ts`.

---

## 5. Test cases

Each case: objective · steps · assertions · evidence hooks · risk if skipped.

### 1. Seller authentication

| Field | Content |
|---|---|
| **Objective** | Seller reaches authenticated dashboard on staging |
| **Steps** | Open `/seller/login` (or `/login`) → submit email/password (or OTP path if staging configured) |
| **Assertions** | Redirect into `/dashboard`; session cookie present (name only in traces); no auth error toast |
| **Evidence** | Playwright trace + screenshot of dashboard shell |
| **Risk if skipped** | All later tests blocked |

### 2. Store membership verification

| Field | Content |
|---|---|
| **Objective** | Session is bound to expected staging tenant |
| **Steps** | After login, open store switcher / dashboard home; read store name/slug |
| **Assertions** | Active store slug = `E2E_STORE_SLUG`; user can access `/dashboard/theme` (not permission denied) |
| **Evidence** | URL + visible store label |
| **Risk if skipped** | Wrong-tenant edits |

### 3. Opening Theme Customizer

| Field | Content |
|---|---|
| **Objective** | Site Builder mounts (not blank shell) |
| **Steps** | Navigate `/dashboard/theme` |
| **Assertions** | Top bar / canvas chrome visible; no fatal error boundary; network idle for main chunk |
| **Evidence** | Screenshot; console error filter (allow benign) |
| **Risk if skipped** | False confidence after Worker SSR regressions |

### 4. Preview token minting

| Field | Content |
|---|---|
| **Objective** | Dashboard mint path works (`POST /api/theme/preview-token`) |
| **Steps** | With Theme Editor open, listen for `POST **/api/theme/preview-token` |
| **Assertions** | Response **200**; JSON `ok: true`; `url` contains store origin `/preview?token=`; `expiresAt` number. **Do not log token value** |
| **Evidence** | Status + redacted URL path in report |
| **Risk if skipped** | Leaves Phase 2b dashboard mint **BLOCKED** |

### 5. iframe preview rendering

| Field | Content |
|---|---|
| **Objective** | Canvas iframe loads store preview |
| **Steps** | Wait for iframe `src` containing `/preview` or store origin; wait for frame content / “preview ready” signal |
| **Assertions** | Iframe not stuck on loading forever; no persistent “didn't connect”; frame URL on store host |
| **Evidence** | Screenshot of canvas; optional frame title/text |
| **Risk if skipped** | Bot Fight / cookie / CSP regressions |

### 6. Color customization

| Field | Content |
|---|---|
| **Objective** | Theme color token change updates draft + preview |
| **Steps** | Open colors/branding controls → change primary (or equivalent) to a distinctive value |
| **Assertions** | Control shows new value; canvas reflects change (CSS variable or computed style) without publish |
| **Evidence** | Before/after canvas crop |
| **Risk if skipped** | Settings panel regressions |

### 7. Font customization

| Field | Content |
|---|---|
| **Objective** | Font family change applies in draft preview |
| **Steps** | Select an alternate heading/body font from editor |
| **Assertions** | UI selection persisted in panel; canvas typography class/family updates |
| **Evidence** | Screenshot |
| **Risk if skipped** | Token schema / renderer drift |

### 8. Section visibility changes

| Field | Content |
|---|---|
| **Objective** | Hide/show section updates canvas |
| **Steps** | Toggle visibility on a known section (e.g. hide a non-critical section) |
| **Assertions** | Section absent/present in iframe DOM accordingly |
| **Evidence** | Locator counts in frame |
| **Risk if skipped** | Visibility matrix bugs (desktop/mobile) |

### 9. Section reordering

| Field | Content |
|---|---|
| **Objective** | Reorder sections changes draft order |
| **Steps** | Drag or move section up/down in navigator |
| **Assertions** | Order in navigator matches order of section roots in iframe |
| **Evidence** | Ordered list of section ids/labels |
| **Risk if skipped** | History/undo interaction bugs |

### 10. Debounced autosave

| Field | Content |
|---|---|
| **Objective** | Edits autosave after idle debounce |
| **Steps** | Make a text edit; wait ≥ `AUTOSAVE_IDLE_MS` + 1s buffer; watch save status / network to draft save action |
| **Assertions** | Status reaches “All changes saved” (or equivalent); no continuous save storm; `shouldScheduleAutosave` behavior respected (no save while conflict) |
| **Evidence** | Timing log; network HAR redacted |
| **Risk if skipped** | Data loss / CONFLICT loops |

### 11. Refresh and draft restoration

| Field | Content |
|---|---|
| **Objective** | Reload restores last saved draft |
| **Steps** | Edit → wait autosave → hard reload `/dashboard/theme` |
| **Assertions** | Distinctive edit text still present in editor and canvas |
| **Evidence** | Screenshot post-reload |
| **Risk if skipped** | Autosave false positive |

### 12. Publish

| Field | Content |
|---|---|
| **Objective** | Publish creates new published version on **staging** |
| **Steps** | Publish with label `e2e-<timestamp>` |
| **Assertions** | Success UI; no `AppError`; optional history shows new published + prior archived |
| **Evidence** | Label string in UI |
| **Risk if skipped** | Cannot validate cache/storefront path |
| **Safety** | Staging store only — assert `E2E_STORE_ORIGIN` |

### 13. Storefront cache invalidation

| Field | Content |
|---|---|
| **Objective** | Publish triggers invalidation path (behavioral) |
| **Steps** | Immediately after publish, request storefront (Playwright page or `request` fixture) with cache-busting reload |
| **Assertions** | Published change visible within seconds (retry up to 120s worst case if L1-only); document observed latency |
| **Evidence** | Latency ms + final HTML snippet hash (not full PII) |
| **Risk if skipped** | Stale storefront after publish |

### 14. Published changes visibility

| Field | Content |
|---|---|
| **Objective** | Incognito/anonymous storefront shows published theme |
| **Steps** | New browser context (no seller cookies) → open `E2E_STORE_ORIGIN` |
| **Assertions** | Distinctive published content visible; draft-only later edits (if any) **not** visible |
| **Evidence** | Anonymous screenshot |
| **Risk if skipped** | Draft leak |

### 15. Rollback

| Field | Content |
|---|---|
| **Objective** | Rollback restores previous published theme on staging |
| **Steps** | From Theme Editor history, rollback to version before `e2e-<timestamp>` publish |
| **Assertions** | Success; anonymous storefront matches pre-publish distinctive content; draft consistent with rollback rules |
| **Evidence** | Before/after anonymous screenshots |
| **Risk if skipped** | No proven content backup path in E2E |
| **Safety** | Staging only |

### 16. Cross-tenant access rejection

| Field | Content |
|---|---|
| **Objective** | Seller of store A cannot mint/edit store B |
| **Steps** | While authenticated as `e2e-theme` owner: attempt open foreign staging store dashboard theme URL / mint preview for foreign host if UI allows; or use second context with foreign membership missing |
| **Assertions** | Permission denied / redirect / mint **401/403**; foreign draft unchanged |
| **Evidence** | HTTP status; no foreign draft `updated_at` move (optional API assert with staging service role in **setup only**, never in prod) |
| **Risk if skipped** | Tenancy regressions |

---

## 6. Suggested suite mapping

| Spec file | Cases |
|---|---|
| `auth.setup.ts` + membership | 1–2 |
| `preview.spec.ts` | 3–5 |
| `customize-autosave.spec.ts` | 6–11 |
| `publish-rollback.spec.ts` | 12–15 |
| `tenant-isolation.spec.ts` | 16 |

Run order: setup project → preview → customize → publish/rollback → isolation.  
Publish/rollback serial (shared store mutation).

---

## 7. Production safety (mandatory)

| Rule | Enforcement |
|---|---|
| No production DB writes | Staging Supabase only; globalSetup host allowlist |
| No production publish/rollback | Assert store origin suffix is staging root |
| No production secret rotation | Tests never call CF APIs |
| No migrations in E2E job | Separate ops pipeline |
| No customer data | Synthetic seed only |
| No live customer storefront mutation | Block `*.pictocart.in` except documented staging subdomain if ever under that zone |
| Secrets in CI | GitHub Environment `staging`; traces scrub tokens (`token=` query redaction) |

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Flaky autosave timing | Use status text + network idle; avoid fixed short sleeps only |
| iframe cross-origin | Prefer frame locators; rely on postMessage deny path already unit-tested |
| Bot Fight on staging | Keep Fight Mode off for staging zone (same ops lesson as prod) |
| Shared staging store parallel CI | Shard=1 for publish suite or unique store per job |
| Token leakage in artifacts | Redact `token` query params in Playwright config |

---

## 9. Manual actions before automation

1. Staging live + `mintVerify: ok`.  
2. Seed seller/store; store credentials in CI.  
3. Approve implementation of `playwright.config.ts` + `e2e/theme-editor/**` (separate PR after this plan).  
4. Optional: second staging store for test 16.

---

## 10. What can be automated safely vs not

| Safe to automate (on staging) | Do not automate against production |
|---|---|
| All 16 cases above | Customer store publish/rollback |
| Preview mint status assertions (redacted) | Using prod `CRON_SECRET` in Playwright |
| Anonymous storefront checks on staging | Copying prod themes into staging |

---

## 11. Permissions required

- CI secret access for seller password.  
- Staging deploy green.  
- Engineer time to implement Playwright after approval.  
- QA review of selectors against Site Builder DOM (prefer `data-testid` additions only if approved in a later code PR — **out of scope for this docs phase**).

---

## 12. Acceptance criteria (plan + future suite)

**This document**
- [x] All 16 scenarios specified with assertions and safety gates.  
- [x] Timing constants grounded in source.  
- [x] Production hosts explicitly forbidden.

**Future implementation PR (after staging + approval)**
- [ ] Playwright config exists; prod host guard in globalSetup.  
- [ ] Cases 1–16 green on staging CI.  
- [ ] Artifacts retain no raw preview tokens.  
- [ ] Phase 2b “dashboard mint UI” blocker can be marked **PASS** using staging evidence.

---

## 13. Exact next steps

1. Approve staging setup plan → provision staging.  
2. Approve **implementation** of this E2E plan (code PR).  
3. Land Playwright suite; gate on staging URL.  
4. Use green staging E2E as evidence to close remaining Theme Editor verification gaps — **without** production customer writes.
