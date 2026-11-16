# Onboarding + auth redesign plan (2026-11-16)

Branch: `feature/onboarding-redesign`. Owner asks (screenshots of pictocart.in `/start/*`, `/login`, informative basic-info, a reference voice-agent UI): one visual system matching the new marketing site, language-first flow, multi-category online store, informative site ready with relevant images, Tara voice enabled with a live transcript, and the production store-creation bug fixed.

## 1. Visual system (all auth + onboarding screens)

- Tokens: reuse `.theme-marketing` (globals.css) — `--bg #0b0b0b`, elevated `#141414/#1c1c1c`, text `#f5f5f5`/muted `#a3a3a3`, one accent `#ea580c` (hover `#c2410c`), radii 10/16/24/pill. Manrope display (`font-brand`), JetBrains Mono eyebrows (`font-mk-mono`), Inter body.
- Shared kit: `src/components/onboarding-ui/index.tsx` — `OnboardingTheme` (wrapper: tokens + fonts + soft orange glow), `OnbHeading`, `OnbEyebrow`, `OnbSub`, `OnbCard`, `OnbProgress`, `OnbTopBar`, class helpers `onbButton.{primary,secondary,ghost,link}`, `onbField`, `onbLabel`, `onbHint`, `onbError`, `onbChoice(selected)`, `onbChip(selected)`.
- Storefront previews/theme screenshots inside onboarding sit in a `.mk-light` island (they depict the seller's light store).
- No new client JS libraries; CSS transitions only; `prefers-reduced-motion` respected.

## 2. Flow order

```
/start → /start/lang (English | हिन्दी)
       → /start/build (Online Store | Informative Website)
           ├─ Online store:  /start/path (Tara voice | Quick quiz) → /start/quiz or /start/voice → /start/theme → /start/account → building → /dashboard
           └─ Informative:   /start/informative/basic-info → services → theme → account → finish
```

- Language is chosen once and carried into both journeys (`draft.locale`; informative reads it via `?lang=`/its own draft field).
- Each journey has its own step count in `OnbProgress` (`label="Online store"` / `"Website"`).
- The quiz no longer asks "What should we build?" (answered at /start/build).

## 3. Online store: multiple categories + subcategories

Draft contract (`src/features/start/draft/schema.ts`, backward compatible — old drafts parse):
- `business.categories: IndustrySlug[]` (1–3; first mirrored into `business.category`).
- `business.subcategories: string[]` (0–8; known slugs for any selected category or custom labels; first mirrored into `business.subcategory`, the rest also encoded in `productsServices` as `sub:a,b` so existing seed code keeps working).
- Voice facts gain `categories?: string[]`, `subcategories?: string[]` with the same meaning.
- Theme ranking uses the primary category (+ others as tie-break); seed fallback/brief use every label (`collectSelectionLabels`).

## 4. Informative website: relevant images

At finish, hero/gallery/service images come from the chosen category + service (curated per-category stock set in `src/features/informative/…`; Unsplash when `UNSPLASH_ACCESS_KEY` is set, deterministic curated URLs otherwise), not generic placeholders. Suggested services/prices/FAQs unchanged.

## 5. Tara voice (enabled)

- Path card "AI Voice Assistant" enabled when Sarvam is configured (`voiceReady`), otherwise shows the quiz only.
- Layout like the reference: left — agent card, big tap-to-speak mic with Listening / Thinking / Speaking states, call timer, End call, tips; right — "Conversation transcript" with the seller's recognised text (STT transcript returned by `runTaraTurn`) and Tara's replies, Clear.
- Tara asks the same questions as the quiz (name, categories, subcategories, city), extracts facts, shows a confirmation card (editable chips), and on confirm writes the same draft fields as the quiz and continues to /start/theme. Quiz and voice produce identical drafts.

## 6. Production bug: "sample products couldn't be saved" → "store could not be finished"

Findings (local repro with Jewellery + Fashion jewellery + Bridal sets, noida):
- Sarvam's seed JSON is cut off (~7.5–9k chars, 4/4 runs) → always falls back to the deterministic plan; the fallback products pass `productInputSchema` and save locally on a single finalize.
- After email OTP the server redirects to `/start` → `/start/lang` → client `replace` to `/start/account`. Each URL change remounts `StartJourney`; the `finalizing` ref resets and the signed-in effect calls `finalizeStartDraftAction` again while the first call is still seeding. Two seeds race on the same tenant (same product slugs/SKUs, inventory rows), one fails inside `save_product` → `seed_save_product` toast; the retry hits the half-seeded store.
- Fix: module-level single-flight for finalize on the client; server-side per-user finalize lock + idempotent seed (re-read existing slugs, treat unique-violation on a seed product as "already there"); normalise every seed product field to the catalog schema (`seed/product-input.ts`); give the AI seed call enough output tokens. Regression tests: pure product builder across all industries/multi-select, single-flight helper, finalize-error mapping.

## 7. Slices (parallel, disjoint files)

| Slice | Owner | Files |
|---|---|---|
| Bug fix + shared kit + integration | lead | `src/features/onboarding/seed/*`, `src/features/start/actions.ts`, `finalize-error.ts`, `src/components/onboarding-ui/*` |
| Auth restyle | agent A | `src/app/(auth)/**`, `src/components/auth/**` |
| Online-store journey | agent B | `src/features/start/**` (except voice-screen + actions.ts), `src/app/start/[step]`, `src/app/start/build`, `src/app/start/page.tsx`, `src/app/start/layout.tsx`, `src/app/onboarding` |
| Informative journey | agent C | `src/app/start/informative/**`, `src/features/informative/onboarding/**`, informative image helpers |
| Tara voice | agent D | `src/features/start/screens/voice-screen.tsx`, `src/features/start/components/voice/**` (new), `src/features/onboarding/voice/**`, `src/lib/sarvam/**` |

Verification: `pnpm check`; browser E2E at 1280px and 375px for quiz, voice, informative; status doc updated.
