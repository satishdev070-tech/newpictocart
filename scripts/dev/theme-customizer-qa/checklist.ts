/**
 * Theme customizer master-scope QA checklist catalog (Phase F).
 * Source of truth for checklist IDs — kept in sync with docs/THEME_CUSTOMIZER_QA.md.
 * Smoke: `pnpm exec tsx scripts/dev/theme-customizer-qa/smoke.mts`
 */

export type QaPhase = "A1" | "A2" | "B" | "C" | "D" | "E" | "M0" | "M1" | "M2" | "M3" | "M4";

export type QaItem = {
  id: string;
  phase: QaPhase;
  title: string;
  /** How this is verified on current main (manual until C–E / Master land). */
  coverage: "unit" | "manual" | "unit+manual";
  /** Optional unit files that already exercise the acceptance on main. */
  unitFiles?: readonly string[];
};

export const THEME_CUSTOMIZER_QA: readonly QaItem[] = [
  // ----- A1 Hero Off/On preserves content -----
  {
    id: "A1-01",
    phase: "A1",
    title: "Item editor Off for Title keeps heading / headingAccent strings on the slide",
    coverage: "unit",
    unitFiles: ["tests/unit/hero-slide-visibility.test.ts", "tests/unit/site-builder-sections.test.ts"],
  },
  {
    id: "A1-02",
    phase: "A1",
    title: "Item editor Off for Description keeps subheading / body text on the slide",
    coverage: "unit",
    unitFiles: ["tests/unit/hero-slide-visibility.test.ts", "tests/unit/site-builder-sections.test.ts"],
  },
  {
    id: "A1-03",
    phase: "A1",
    title: "Item editor Off for Media keeps imagePath / alt (and mobile image) on the slide",
    coverage: "unit",
    unitFiles: ["tests/unit/hero-slide-visibility.test.ts", "tests/unit/site-builder-sections.test.ts"],
  },
  {
    id: "A1-04",
    phase: "A1",
    title: "Item editor Off for Actions keeps ctaLabel / ctaHref on the slide",
    coverage: "unit",
    unitFiles: ["tests/unit/hero-slide-visibility.test.ts", "tests/unit/site-builder-sections.test.ts"],
  },
  {
    id: "A1-05",
    phase: "A1",
    title: "Off→On restores the same strings/media (show* flags true; values unchanged)",
    coverage: "unit",
    unitFiles: ["tests/unit/hero-slide-visibility.test.ts", "tests/unit/site-builder-sections.test.ts"],
  },
  {
    id: "A1-06",
    phase: "A1",
    title: "Slideshow / split Hero renderers hide Off groups without dropping parsed slide content",
    coverage: "unit+manual",
    unitFiles: ["tests/unit/hero-slide-visibility.test.ts"],
  },
  {
    id: "A1-07",
    phase: "A1",
    title: "Subtitle Off/On uses showSubtitle and does not clear eyebrow / subtitle fields",
    coverage: "unit",
    unitFiles: ["tests/unit/hero-slide-visibility.test.ts"],
  },
  {
    id: "A1-08",
    phase: "A1",
    title: "Legacy themes without show* flags still show all groups (defaults true)",
    coverage: "unit",
    unitFiles: ["tests/unit/site-builder-sections.test.ts", "tests/unit/hero-slide-visibility.test.ts"],
  },

  // ----- A2 Variant generate/save/SKU/stock -----
  {
    id: "A2-01",
    phase: "A2",
    title: "Add/Edit Product surfaces field-level errors for SKU collisions and MRP ≥ price",
    coverage: "manual",
  },
  {
    id: "A2-02",
    phase: "A2",
    title: "Option / value mismatches, empty option names, MAX_VARIANTS, STALE_PRODUCT, NO_ACTIVE_VARIANT map to actionable fieldErrors",
    coverage: "manual",
  },
  {
    id: "A2-03",
    phase: "A2",
    title: "Generate Variants keeps matching combos by comboKey (prices/SKU/id preserved)",
    coverage: "manual",
  },
  {
    id: "A2-04",
    phase: "A2",
    title: "Generate Variants warns before dropping unmatched combos or stock-backed rows",
    coverage: "manual",
  },
  {
    id: "A2-05",
    phase: "A2",
    title: "Opening stock applies only to new variants; existing ids point sellers to Inventory",
    coverage: "manual",
  },
  {
    id: "A2-06",
    phase: "A2",
    title: "Double-submit while save is pending is ignored; Saving… state visible",
    coverage: "manual",
  },

  // ----- B Gym themes + distinct imagery + onboarding thumbs -----
  {
    id: "B-01",
    phase: "B",
    title: "Industry Gym & Fitness Studio (gym) appears in marketplace filters and onboarding ranking",
    coverage: "manual",
  },
  {
    id: "B-02",
    phase: "B",
    title: "Two gym marketplace themes (iron-floor, class-pulse) are distinct compositions — not a rename of Studio Fit",
    coverage: "manual",
  },
  {
    id: "B-03",
    phase: "B",
    title: "Themes in the same category show different Unsplash/stock thumbs (per-theme imagery seed)",
    coverage: "manual",
  },
  {
    id: "B-04",
    phase: "B",
    title: "Onboarding Theme step cards show filled thumbs (not blank) for gym + peer themes",
    coverage: "manual",
  },
  {
    id: "B-05",
    phase: "B",
    title: "Empty storefront slots / mockups rotate by theme key within the layout-family pool",
    coverage: "manual",
  },

  // ----- C Autosave draft / publish while dirty blocked / canvas local -----
  {
    id: "C-01",
    phase: "C",
    title: "Canvas / local apply updates the iframe preview without waiting on Save draft",
    coverage: "manual",
  },
  {
    id: "C-02",
    phase: "C",
    title: "Autosave (or equivalent local-first draft persistence) keeps unsaved edits across soft reloads of the builder",
    coverage: "manual",
  },
  {
    id: "C-03",
    phase: "C",
    title: "Publish control stays disabled while the draft is dirty; tooltip explains Save first",
    coverage: "manual",
  },
  {
    id: "C-04",
    phase: "C",
    title: "Publish dialog cannot complete while dirty (server/client guard)",
    coverage: "manual",
  },
  {
    id: "C-05",
    phase: "C",
    title: "After Save draft, dirty clears and Publish is enabled for theme.publish roles",
    coverage: "manual",
  },

  // ----- D Text style + resize on Hero / RichText -----
  {
    id: "D-01",
    phase: "D",
    title: "Hero heading / subheading expose per-text style controls (size / weight / color as shipped)",
    coverage: "manual",
  },
  {
    id: "D-02",
    phase: "D",
    title: "RichText section body / heading expose the same text style controls",
    coverage: "manual",
  },
  {
    id: "D-03",
    phase: "D",
    title: "Resize / style changes preview on the canvas without wiping neighboring slide or section content",
    coverage: "manual",
  },
  {
    id: "D-04",
    phase: "D",
    title: "Persisted styles survive Save draft → reload → Publish → storefront view",
    coverage: "manual",
  },

  // ----- E Page templates (4×) + popup newsletter|form -----
  {
    id: "E-01",
    phase: "E",
    title: "Add page offers About starter template with valid page-allowed sections",
    coverage: "manual",
  },
  {
    id: "E-02",
    phase: "E",
    title: "Add page offers Contact starter template with valid page-allowed sections",
    coverage: "manual",
  },
  {
    id: "E-03",
    phase: "E",
    title: "Add page offers FAQ starter template with valid page-allowed sections",
    coverage: "manual",
  },
  {
    id: "E-04",
    phase: "E",
    title: "Add page offers Blog(s) starter template with valid page-allowed sections",
    coverage: "manual",
  },
  {
    id: "E-05",
    phase: "E",
    title: "Popup can enable newsletter (email sign-up) and renders NewsletterForm on storefront",
    coverage: "manual",
  },
  {
    id: "E-06",
    phase: "E",
    title: "Popup can use form mode (contact / lead form) distinct from newsletter when Phase E ships",
    coverage: "manual",
  },

  // ----- M0 Master Phase 0 — stability + local-first -----
  {
    id: "M0-01",
    phase: "M0",
    title: "Members Login / Signup / Reset canvas has no EmptySlot white band after marketplace apply",
    coverage: "manual",
  },
  {
    id: "M0-02",
    phase: "M0",
    title: "Pages panel lists each eCommerce / Members surface once (no product-list dup)",
    coverage: "unit",
    unitFiles: ["tests/unit/site-builder-pages.test.ts"],
  },
  {
    id: "M0-03",
    phase: "M0",
    title: "Token / section / text edit paints canvas via local apply without awaiting draft save",
    coverage: "manual",
  },
  {
    id: "M0-04",
    phase: "M0",
    title: "Publish invalidates public storefront tags / Redis only (ADR-010; no draft Redis)",
    coverage: "manual",
  },

  // ----- M1 Master Phase 1 — per-text styling -----
  {
    id: "M1-01",
    phase: "M1",
    title: "Canvas textSelect focuses matching TextStyleField role in the section panel",
    coverage: "unit+manual",
    unitFiles: ["tests/unit/site-builder-schema.test.ts", "tests/unit/text-style.test.ts"],
  },
  {
    id: "M1-02",
    phase: "M1",
    title: "Hero eyebrowLook is independent of headingLook / subheadingLook",
    coverage: "unit",
    unitFiles: ["tests/unit/text-style.test.ts", "tests/unit/site-builder-sections.test.ts"],
  },
  {
    id: "M1-03",
    phase: "M1",
    title: "ProductGrid / BrandStory / FAQ / CTA expose title/body TextStyleField",
    coverage: "manual",
  },
  {
    id: "M1-04",
    phase: "M1",
    title: "textLook fontKey accepts concrete FONT_KEYS with safe fallback",
    coverage: "unit",
    unitFiles: ["tests/unit/text-style.test.ts"],
  },

  // ----- M2 Master Phase 2 — custom page layout packs -----
  {
    id: "M2-01",
    phase: "M2",
    title: "applyPageTemplate replaces sections but preserves page title / handle",
    coverage: "unit",
    unitFiles: ["tests/unit/site-builder-apply-page-template.test.ts"],
  },
  {
    id: "M2-02",
    phase: "M2",
    title: "Custom pages keep Home-parity section allow-list (groupAllows)",
    coverage: "unit+manual",
    unitFiles: ["tests/unit/site-builder-pages.test.ts"],
  },
  {
    id: "M2-03",
    phase: "M2",
    title: "Selected custom page shows Change layout wireframes matching Add page families",
    coverage: "manual",
  },

  // ----- M3 Master Phase 3 — shop/Members chrome + popups -----
  {
    id: "M3-01",
    phase: "M3",
    title: "Shop PageContent offers five chrome layouts (classic sidebar minimal editorial dense)",
    coverage: "unit",
    unitFiles: ["tests/unit/theme-page-chrome.test.ts"],
  },
  {
    id: "M3-02",
    phase: "M3",
    title: "Members account packs cover image-left/right, stacked, minimal, brand-panel",
    coverage: "unit+manual",
    unitFiles: ["tests/unit/theme-page-chrome.test.ts"],
  },
  {
    id: "M3-03",
    phase: "M3",
    title: "Popups support four layouts including corner",
    coverage: "unit",
    unitFiles: ["tests/unit/theme-page-chrome.test.ts", "tests/unit/theme-pages-popups-phase-e.test.ts"],
  },

  // ----- M4 Master Phase 4 — fonts / space / colour search -----
  {
    id: "M4-01",
    phase: "M4",
    title: "FONT_STACKS groups English + Hindi (Noto Sans Devanagari, Hind); self-hosted",
    coverage: "unit",
    unitFiles: ["tests/unit/site-builder-logo-fonts.test.ts"],
  },
  {
    id: "M4-02",
    phase: "M4",
    title: "Section margin clamp allows negative (−80); padding min stays 0",
    coverage: "unit",
    unitFiles: ["tests/unit/section-box.test.ts"],
  },
  {
    id: "M4-03",
    phase: "M4",
    title: "filterPalettes matches preset name and swatch hex / near-match",
    coverage: "unit",
    unitFiles: ["tests/unit/site-builder-theme.test.ts"],
  },
  {
    id: "M4-04",
    phase: "M4",
    title: "Manual Lifestyle Sarees–style check: Hindi heading, negative margin, colour search",
    coverage: "manual",
  },
] as const;

export const QA_PHASES: readonly QaPhase[] = ["A1", "A2", "B", "C", "D", "E", "M0", "M1", "M2", "M3", "M4"];

export function checklistIds(): string[] {
  return THEME_CUSTOMIZER_QA.map((i) => i.id);
}

export function checklistByPhase(phase: QaPhase): QaItem[] {
  return THEME_CUSTOMIZER_QA.filter((i) => i.phase === phase);
}
