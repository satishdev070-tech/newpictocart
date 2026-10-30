# Theme customizer QA (Phase F)

Cross-phase acceptance harness for the Pictocart theme customizer master scope.
Phases **A–B** ship on their feature branches (A1 merged on main as Hero toggle preserve).
Phases **C–E** land in parallel — use these checklists when verifying each PR and the final merge train.

This is **not** a Playwright suite. Automated coverage today is focused unit tests (especially A1) plus a smoke script that lists checklist IDs.

| Tool | Command |
|---|---|
| List checklist IDs | `pnpm exec tsx scripts/dev/theme-customizer-qa/smoke.mts` |
| Filter by phase | `pnpm exec tsx scripts/dev/theme-customizer-qa/smoke.mts --phase A1` |
| JSON | `pnpm exec tsx scripts/dev/theme-customizer-qa/smoke.mts --json` |
| Catalog source | `scripts/dev/theme-customizer-qa/checklist.ts` |
| Harness unit test | `tests/unit/theme-customizer-qa-checklist.test.ts` |

Mark each item `[ ]` → `[x]` during manual QA. IDs are stable (`A1-01` … `E-06`, then Master `M0-01` … `M4-04`).

---

## M0 — Stability + local-first (Master Phase 0)

**Branch / PR:** `cursor/theme-customizer-master-c73e`  
**Surfaces:** Theme editor Pages (Members / eCommerce), Login/Signup/Reset canvas, Save draft / Publish  
**Code:** `marketplace/apply.ts` account seed, `pages.ts` / `pages-panel.tsx`, `canvas-bridge` busy filter, `publishThemeAction` → `revalidateStorefront` (public Redis only)

| ID | Pass when | Auto |
|---|---|---|
| **M0-01** | Members Login / Signup / Reset canvas has no white EmptySlot band or duplicate chrome blocks after marketplace apply. | manual |
| **M0-02** | Pages panel lists each eCommerce / Members surface once (no product-list ↔ collections dup). | unit |
| **M0-03** | Token / section / text edit paints canvas via local `apply()` without awaiting draft save. | manual |
| **M0-04** | Publish invalidates public storefront tags / Redis only — never caches private drafts (ADR-010). | manual |

---

## M1 — Per-content text styling (Master Phase 1)

**Branch / PR:** `cursor/theme-customizer-master-c73e`  
**Surfaces:** Hero slide + RichText + ProductGrid / BrandStory / FAQ / CTA headings  
**Code:** `text-style.ts`, `text-style-field.tsx`, canvas `textSelect` → section panel `textRole`, `eyebrowLook`

| ID | Pass when | Auto |
|---|---|---|
| **M1-01** | Click Heading / Sub-heading in preview focuses the matching TextStyleField group in the left panel. | unit+manual |
| **M1-02** | Hero eyebrow has independent `eyebrowLook`; heading / subheading looks stay separate. | unit |
| **M1-03** | High-traffic Home sections expose title/body TextStyleField (ProductGrid, BrandStory, FAQ, CTA). | manual |
| **M1-04** | `fontKey` accepts concrete FONT_KEYS; unknown keys fall back safely. | unit |

---

## M2 — Custom page layout packs (Master Phase 2)

**Branch / PR:** `cursor/theme-customizer-master-c73e`  
**Surfaces:** Pages → open About/Contact/FAQ/Blog → Change layout  
**Code:** `applyPageTemplate` in `ops.ts`, `page-templates.ts`, `pages-panel.tsx`

| ID | Pass when | Auto |
|---|---|---|
| **M2-01** | Applying an Add-page family pack replaces sections but preserves page title / handle. | unit |
| **M2-02** | Custom pages keep Home-parity section allow-list (`groupAllows`). | unit+manual |
| **M2-03** | When a custom page is selected (no section focused), Layout / design wireframes match Add page. | manual |

---

## M3 — Shop + Members chrome + Popups (Master Phase 3)

**Branch / PR:** `cursor/theme-customizer-master-c73e`  
**Surfaces:** Product list / PDP / Search / Collections / Cart; account auth; Popups panel  
**Code:** `PAGE_CHROME_VARIANTS`, `ACCOUNT_PACK_VARIANTS`, `page-content.ts`, `store-auth-split`, `POPUP_LAYOUTS` + `corner`

| ID | Pass when | Auto |
|---|---|---|
| **M3-01** | Shop PageContent offers 5 chrome layouts: classic, sidebar, minimal, editorial, dense. | unit |
| **M3-02** | Members Login / Signup / Reset offer image/layout packs + lifestyle media fields. | unit+manual |
| **M3-03** | Popups support 4 layouts including `corner`; Change-design cards work in popup panel. | unit |

---

## M4 — Fonts, negative spacing, colour search (Master Phase 4)

**Branch / PR:** `cursor/theme-customizer-master-c73e`  
**Surfaces:** Theme settings fonts; section margin; Preset + Colours search  
**Code:** `FONT_STACKS` / `storefront-fonts.ts`, `SECTION_BOX_LIMITS`, `filterPalettes`

| ID | Pass when | Auto |
|---|---|---|
| **M4-01** | Font pickers list English + Hindi (Noto Sans Devanagari, Hind); self-hosted only (ADR-019). | unit |
| **M4-02** | Section margin can go negative (clamp −80); padding min stays 0. | unit |
| **M4-03** | Theme Preset / Colours search matches palette name and swatch hex / near-match. | unit |
| **M4-04** | Manual: Hindi heading + negative margin + colour search on Lifestyle Sarees–style store. | manual |

---

## A1 — Hero Off/On preserves content

**Branch / PR:** `cursor/hero-toggle-preserve-c73e` (PR #62, merged)  
**Surfaces:** Dashboard → Theme editor → Hero / slideshow → edit slide → Title / Description / Media / Actions (and Subtitle) toggles  
**Code:** `field-groups.setGroupVisible`, `slide-visibility.slideGroups`, Hero renderers in `designs-a` / `variants` / `sections`

| ID | Pass when | Auto |
|---|---|---|
| **A1-01** | Turn **Title** Off. Heading / headingAccent remain in the slide JSON / item editor when toggled back On. | unit |
| **A1-02** | Turn **Description** Off. Subheading (and related description fields) remain. | unit |
| **A1-03** | Turn **Media** Off. `imagePath` / alt / mobile image remain. | unit |
| **A1-04** | Turn **Actions** Off. CTA label + href remain. | unit |
| **A1-05** | Full Off→On round-trip restores the **same** strings and media (no blanking via `clearGroup`). | unit |
| **A1-06** | With groups Off, canvas / storefront slideshow or split Hero **hides** those groups but schema still holds the content. | unit + manual |
| **A1-07** | **Subtitle** Off sets `showSubtitle: false` and does not clear eyebrow / subtitle text. | unit |
| **A1-08** | Themes saved before show* flags still show every group (omitted flag ≡ shown). | unit |

**Manual spot-check (seeded store `aangan.localhost:3000`):** edit Hero slide → Off Title → Save draft → reload editor → On Title → strings still present → Publish → storefront matches.

---

## A2 — Variant generate / save / SKU / stock

**Branch / PR:** `cursor/product-variants-harden-c73e` (PR #63)  
**Surfaces:** Dashboard → Products → Add/Edit → Options & Variants  
**Code:** `product-editor`, `variants.ts`, `catalogDbError`, `previewVariantMatrixRegen`

| ID | Pass when | Auto |
|---|---|---|
| **A2-01** | Duplicate SKU and MRP &lt; price show **field-level** errors (not a vague form message). | manual* |
| **A2-02** | Option/value mismatches, empty option names, MAX_VARIANTS, STALE_PRODUCT, NO_ACTIVE_VARIANT map to Options / Variants / `_form` errors sellers can act on. | manual* |
| **A2-03** | Generate Variants keeps rows that still match by `comboKey` (id, price, SKU preserved). | manual* |
| **A2-04** | Regen that would drop unmatched / stock-backed rows asks for confirm before proceeding. | manual* |
| **A2-05** | Opening stock copy applies to **new** variants only; existing variant ids link to Inventory. | manual* |
| **A2-06** | While save is pending, a second submit is ignored and the button shows Saving…. | manual* |

\*Unit coverage lands with the A2 branch (`tests/unit/catalog/variants.test.ts`); treat as manual until that PR is merged.

---

## B — Gym themes + distinct imagery + onboarding thumbs

**Branch / PR:** `cursor/gym-themes-imagery-c73e` (PR #64)  
**Surfaces:** `/dashboard/themes`, marketing `/themes`, `/start` Theme step  
**Code:** industry `gym`, themes `iron-floor` / `class-pulse`, `themeImagerySeed` / `themeStockSet`

| ID | Pass when | Auto |
|---|---|---|
| **B-01** | Marketplace filter / onboarding ranking includes **Gym & Fitness Studio**. | manual* |
| **B-02** | `iron-floor` and `class-pulse` look like distinct gym packs (not a rename of Studio Fit). | manual* |
| **B-03** | Two themes in the same category show **different** card / stock thumbs. | manual* |
| **B-04** | Onboarding Theme cards show filled thumbs (not blank placeholders). | manual* |
| **B-05** | Empty storefront slots / mockups rotate imagery by theme key within the family pool. | manual* |

\*Automated helpers ship on the B branch; re-check after merge.

---

## C — Autosave draft / publish while dirty blocked / canvas local

**Branch:** `cursor/theme-local-first-save-c73e` (Phase C, parallel)  
**Surfaces:** `/dashboard/theme` top bar + canvas iframe  
**Baseline on main today:** local `apply()` → canvas postMessage preview; Publish already `disabled` while `dirty` (`top-bar.tsx`). Autosave / local-first persistence is the Phase C increment.

| ID | Pass when | Auto |
|---|---|---|
| **C-01** | Typing / toggling in the panel updates the canvas without clicking Save draft. | manual |
| **C-02** | Unsaved (or autosaved local) edits survive a soft reload of the builder as designed by Phase C. | manual |
| **C-03** | Publish button stays disabled while dirty; title/tooltip says to save first. | manual |
| **C-04** | Publish dialog cannot complete while dirty (client disabled + server expects saved draft). | manual |
| **C-05** | After Save draft, dirty clears and Publish enables for roles with `theme.publish`. | manual |

---

## D — Text style + resize on Hero / RichText

**Branch:** Phase D text controls (parallel)  
**Surfaces:** Site builder → Hero slide text + RichText section  
**Baseline on main today:** global token typography (H1–H6 / p / small) in Theme settings — **not** per-string instance styling.

| ID | Pass when | Auto |
|---|---|---|
| **D-01** | Hero heading / subheading expose per-text style controls (size / weight / color as shipped). | manual |
| **D-02** | RichText heading / body expose the same controls. | manual |
| **D-03** | Resize / style preview on canvas does not wipe neighboring slide or section content. | manual |
| **D-04** | Styles survive Save draft → reload → Publish → live storefront. | manual |

---

## E — Page templates (4×) + popup newsletter \| form

**Branch:** `cursor/theme-pages-popups-c73e` (Phase E, parallel)  
**Surfaces:** Theme editor → Pages → Add page; Pages → Popups  
**Baseline on main today:** starter templates include About / Blogs / Contact / FAQ (and more) in `page-templates.ts`; popups support `newsletter: boolean` only (form mode is Phase E).

| ID | Pass when | Auto |
|---|---|---|
| **E-01** | **About** template adds a page with only page-allowed section types; validates through strict parser. | manual† |
| **E-02** | **Contact** template same. | manual† |
| **E-03** | **FAQ** template same. | manual† |
| **E-04** | **Blog(s)** template same. | manual† |
| **E-05** | Popup with newsletter on shows email sign-up (`NewsletterForm`) on storefront / canvas. | manual |
| **E-06** | Popup **form** mode (contact / lead) is distinct from newsletter when Phase E ships. | manual |

†Partial unit coverage already exists for all page templates on main (`tests/unit/site-builder-pages.test.ts`); Phase E may extend templates or popup form — re-run those tests after merge.

---

## UX — Eyebrow colour + Pages ⋮ + start theme (branch `cursor/customizer-ux-fixes-c73e`)

| Check | Pass when |
|---|---|
| Eyebrow colour | Hero eyebrow Colour in panel paints canvas immediately (no stuck white/muted). |
| Pages Customize | ⋮ → Customize opens that page in the canvas/editor (same as clicking the row). |
| Pages Change layout | Home / Contact / FAQ / Blog / custom pages offer Change layout packs with confirm. |
| Section text styles | Non-Hero sections with heading fields expose Font/Colour/Size and paint via TextBox. |
| Start theme | `/start/theme`: themes left vertical, preview right, Click to Preview new tab. |
| Speed | Edit → instant canvas; Save draft non-blocking; Publish public invalidate only. |

## Suggested merge / verify order

1. **A1** (done on main) — run smoke + A1 unit files.  
2. **A2** + **B** — feature PRs; run their unit suites, then mark A2 / B rows.  
3. **C** — local-first / autosave; verify C-01…C-05 against dirty Publish guards.  
4. **D** — text controls on Hero + RichText.  
5. **E** — confirm 4× templates + popup newsletter\|form.  
6. **M0 → M4** — Theme Customizer Master (`cursor/theme-customizer-master-c73e`); run smoke `--phase M0`…`M4` + `pnpm check`.  
7. **UX fixes** — `cursor/customizer-ux-fixes-c73e` (eyebrow, Pages ⋮, start theme, A2 text).  
8. Full `pnpm check` on the integration branch.

## Out of scope for Phase F / Master

- Full Playwright / visual regression suite  
- Putting private theme **drafts** in Redis  
- Free-form CSS / arbitrary `@import` fonts  
- Rebuilding the entire customizer UI chrome  
- Marketplace theme content rewrites unrelated to B imagery
