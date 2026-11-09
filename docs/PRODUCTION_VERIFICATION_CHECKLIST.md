# Production Verification Checklist — Theme Customizer & Cache

_Companion to [`IMPLEMENTATION_EXECUTION_PLAN.md`](./IMPLEMENTATION_EXECUTION_PLAN.md) and [`TECHNICAL_ARCHITECTURE_AUDIT.md`](./TECHNICAL_ARCHITECTURE_AUDIT.md) · 2026-11-09 · **Ops verification only** — do not change production settings from the agent without explicit approval._

Use this after (or before) approving implementation waves. Mark each item **Pass / Fail / N/A / Not Verified**. Never paste secret values into tickets or chat.

---

## How to use

1. Run against **production** Worker `pictocart` + live Supabase project used by `www.pictocart.in`.  
2. Prefer dashboard / existing self-test endpoints over ad-hoc secret dumps.  
3. Record timestamp (Asia/Kolkata) and who ran the check.  
4. Failures block Wave B/C; Wave A may proceed for docs-only items.

---

## 1. Redis production configuration and hit/miss metrics

| # | Check | How | Pass criteria | Result |
|---|---|---|---|---|
| 1.1 | Upstash env present on Worker | CF Worker → Variables/Secrets: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` **names** present (or consciously absent) | Both set **or** documented “L1-only” decision | |
| 1.2 | Schema allows optional Redis | Code: `src/lib/env/schema.ts` optional pair | Matches deploy | |
| 1.3 | Fail-open behavior understood | Code: `public-cache.ts` 300ms timeout | Ops accepts fail-open | |
| 1.4 | Hit/miss metrics | Upstash console request metrics **or** app logs if instrumented | Baseline number recorded; else **Not Verified** | |
| 1.5 | Prefixes in use | Docs/code: `sf:v1`, `pub:v1` | No unexpected private-data keys | |
| 1.6 | TTL awareness | Storefront 120s; marketplace demos ~300s if no revalidate | Ops knows stale window | |

**Notes / evidence links:** _(fill in)_

---

## 2. Theme preview token health

| # | Check | How | Pass criteria | Result |
|---|---|---|---|---|
| 2.1 | Self-test | `GET /api/cron/preview-token-self-test` with Bearer `CRON_SECRET` | JSON includes `"mintVerify":"ok"` | |
| 2.2 | `APP_SECRET` stable | Confirm Worker secret not rotated since last known-good; matches mint+verify | No `sig_fail` on fresh mint | |
| 2.3 | Seller mint | Dashboard Theme Editor opens; network `POST /api/theme/preview-token` succeeds | 200 + token shape | |
| 2.4 | Preflight | Canvas does not hang; deny HTML shows reason if blocked | Loads preview or clear error | |
| 2.5 | Host binding | Preview only on that store’s host | Wrong host → deny / mismatch | |
| 2.6 | Bot Fight Mode | Zone bot management | Fight Mode off for iframe preview (known CF constraint) | |
| 2.7 | Cookie | `sf_preview` httpOnly set after `/preview?token=` | Present on store host briefly | |

Evidence: `src/features/theme/preview.ts`, `server/preview.ts`, `api/cron/preview-token-self-test`.

---

## 3. Publish and cache invalidation verification

| # | Check | How | Pass criteria | Result |
|---|---|---|---|---|
| 3.1 | Draft save | Edit heading → wait autosave / Save | Status “All changes saved”; DB draft `updated_at` moves (**staff only**) | |
| 3.2 | Publish | Publish with label | New published version; previous archived | |
| 3.3 | Storefront reflects publish | Hard-refresh storefront home (and one inner page) | Change visible within seconds (L1 drop); if Redis down, ≤120s | |
| 3.4 | Rollback | Rollback to prior version from history UI | Live matches rollback; draft reset | |
| 3.5 | Draft never public | Incognito storefront while only draft changed | Shoppers still see old published | |
| 3.6 | Marketplace demos | If demo origins change in admin | Either revalidate called **or** accept ≤300s stale (`revalidateMarketplaceDemos` currently unused) | |

Evidence: `theme/actions.ts` → `revalidateStorefront`; `lib/cache/storefront.ts`.

---

## 4. Supabase RLS verification

| # | Check | How | Pass criteria | Result |
|---|---|---|---|---|
| 4.1 | Anon published only | Anon key SELECT `theme_versions` where draft | No draft rows returned | |
| 4.2 | Staff draft read | Seller with `theme.edit` | Can read own draft | |
| 4.3 | Cross-tenant draft | User of store A cannot update store B draft via API | Denied / zero rows | |
| 4.4 | Publish RPC permission | User without `theme.publish` | RPC fails | |
| 4.5 | Open tenant gate | Suspended/cancelled store | Published not served publicly (`tenant_is_open`) | |

Prefer existing `pnpm test:db` / RLS tests in CI plus one manual staff check. Do not disable RLS.

Evidence: migration `20260924000500_content_theme_analytics.sql`.

---

## 5. Theme draft conflict handling

| # | Check | How | Pass criteria | Result |
|---|---|---|---|---|
| 5.1 | Two tabs same store | Tab A and Tab B open `/dashboard/theme` | Both load | |
| 5.2 | Stale save | Tab A saves; Tab B edits then Save | CONFLICT / “Someone else saved…” | |
| 5.3 | Reload path | Choose Reload | Tab B matches Tab A draft | |
| 5.4 | Force path | Choose Save anyway | Tab B wins; autosave stays off while conflict | |
| 5.5 | Autosave gate | During conflict, idle autosave | Does not keep overwriting (`shouldScheduleAutosave`) | |

Evidence: `saveThemeDraftAction` `baseUpdatedAt`; `top-bar.tsx` Reload / Save anyway.

---

## 6. XSS and HTML embed security

| # | Check | How | Pass criteria | Result |
|---|---|---|---|---|
| 6.1 | Theme embeds model | Inspect `embedsSchema` | Only WhatsApp + backToTop — **not** free HTML | |
| 6.2 | RichText | Enter `<script>alert(1)</script>` in body | Renders as **text**, not script (`Paragraphs`) | |
| 6.3 | Contact map | Paste full malicious iframe HTML | Only allowlisted Maps embed URL accepted (`parseMapsEmbedUrl`) | |
| 6.4 | Safe hrefs | `javascript:` link in CTA | Rejected / unlinked (`isSafeHref`) | |
| 6.5 | CSP posture | Response headers on storefront | `frame-ancestors` present; note **no** full `script-src` policy today | |
| 6.6 | CMS blocks | Content page image path from another tenant | Save rejected (`blocksBelongToTenant`) | |

**Audit correction:** “Unconstrained HTML embeds” in the architecture audit is **overstated** for theme `embeds`. Residual risk is map URL parsing + future third-party scripts — verify, don’t rewrite embeds to a sanitizer for HTML that does not exist.

---

## 7. Production performance measurements

_Do not invent metrics. Record tools used (WebPageTest, CrUX, CF analytics, browser Performance)._

| # | Check | How | Pass criteria | Result |
|---|---|---|---|---|
| 7.1 | Storefront LCP (home) | Field or lab on a real store host | Number recorded; compare to prior if any | |
| 7.2 | Theme editor TTI / canvas ready | Performance panel while opening editor | Time-to-ready recorded | |
| 7.3 | Publish → visible latency | Stopwatch publish → incognito view | Seconds recorded | |
| 7.4 | Heavy template TTFB | Store with many product sections | TTFB recorded; waterfall noted | |
| 7.5 | Redis vs L1-only | Compare with Redis on/off if possible | Difference **Not Verified** if cannot toggle | |
| 7.6 | Logo path cache | Replace logo (new storage path) | New logo aspect OK; note 7d cache is path-keyed | |

Wave B batching is **blocked** until 7.4 shows a real problem.

---

## 8. Multi-tab synchronization tests

| # | Check | How | Pass criteria | Result |
|---|---|---|---|---|
| 8.1 | Local preview sync same tab | Edit → canvas updates without publish | Updates via postMessage (~150ms debounce) | |
| 8.2 | Second tab does **not** live-merge | Edit in A, watch B | B does not auto-update (Realtime **absent** by design) | |
| 8.3 | After A saves, B save | | CONFLICT UX (see §5) | |
| 8.4 | Device sync | Phone vs desktop editor | Same as CONFLICT model — no Broadcast | |
| 8.5 | Product decision | Stakeholder sign-off | Accept single-active-editor **or** open Wave C Realtime ADR | |

Do **not** implement Supabase Realtime for themes based solely on this checklist failing “live merge” — that failure is expected today.

---

## 9. Sign-off

| Role | Name | Date (Asia/Kolkata) | Notes |
|---|---|---|---|
| Ops / deploy | | | |
| Engineering | | | |
| Product (Realtime / CMS unify) | | | N/A if Wave C deferred |

**Overall:** Pass with notes · Fail · Not Verified  

**Blockers before implementation Wave A code:** _(list)_  

**Blockers before Wave B:** missing §7 measurements ·  

---

## Appendix — Quick commands (secrets redacted)

```bash
# Preview self-test (CRON_SECRET from secure store — do not echo)
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.pictocart.in/api/cron/preview-token-self-test"
# Expect: mintVerify ok

# Ready probe (no secrets)
curl -fsS "https://www.pictocart.in/api/health/ready"
```

Worker secrets inventory (names only): confirm `APP_SECRET`, `CRON_SECRET`, Supabase URL/keys, `EMAIL_FROM`, optional `UPSTASH_REDIS_REST_*`, optional `RESEND_API_KEY` / GIS — incomplete `--secrets-file` **replaces** bindings (see `DEPLOY_CLOUDFLARE_WORKERS.md`).
