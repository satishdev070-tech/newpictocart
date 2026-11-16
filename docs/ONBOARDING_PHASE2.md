# Onboarding phase 2 — hands-free Tara, 10 languages, informative customizer, seller copilot (2026-11-16)

Branch: `feature/onboarding-phase2`. Builds on `docs/ONBOARDING_REDESIGN.md` (phase 1, live on 60988a8).

## Owner asks
1. Voice assistant "doesn't understand"; should ask for the microphone, greet the merchant ("Namaste / Hi sir"), and work like Claude's voice mode.
2. Language step: English, Hindi + 8 regional languages.
3. Smooth onboarding for both journeys ending in a complete site (account → content + images loaded).
4. A customizer for the Informative Website.
5. A smart AI assistant in the seller panel for both Online Store and Informative Website.

## Findings (audit)
- **STT is fine.** A synthesised sentence sent through `transcribeAudio` (webm and wav) came back as "My store is called Kia Javels. I sell fashion jewelry and bridal sets in Noida." The failure is the conversation loop: push-to-talk per turn, silence cut-off at ~1 s (people get cut mid-sentence), no spoken welcome, no auto-listen after Tara speaks, no barge-in, no level meter, permission asked only on first tap.
- **Languages:** Sarvam chat + TTS + STT cover 11 codes; the 10 we ship are `en-IN, hi-IN, bn-IN, ta-IN, te-IN, mr-IN, gu-IN, kn-IN, ml-IN, pa-IN` (Odia can follow). Onboarding UI copy exists only in en/hi.
- **AI seed plan:** Sarvam's seed JSON is truncated (no `max_tokens`) → every store uses the fallback plan; credit still debited.
- **Informative:** `info_sites` has `theme_id, primary_color, secondary_color, font_pair, hero_image_path, options`; the panel has only a design switcher ("Appearance"). No live customizer.
- **Seller AI:** online store has `store-agent-panel` (Q&A + FAQ proposals); informative has `assistant-panel` (proposals + site build). Neither has voice, both are separate implementations.

## Phases

### Phase 1 — Tara hands-free voice (Claude-style)
- Start screen: one "Start conversation" button → asks mic permission with an explainer (fallback to typing if denied).
- Tara greets aloud in the chosen language ("Namaste! Welcome to Pictocart, I'm Tara…", respectful sir/ma'am-neutral tone) via Bulbul TTS; text shows in transcript.
- Continuous loop: after Tara finishes speaking → auto-listen; VAD end-of-turn after ~1.6 s silence (min 0.8 s speech), max 30 s; tap-to-interrupt (barge-in) stops TTS and listens; live input level meter; states Listening / Thinking / Speaking; mute + end call.
- Understanding: send recent history; merge LLM facts with deterministic `extractFactsFromText` (fuzzy category/subcategory match, e.g. "jewelry"/"jewellery", Hindi words); confirmation card stays the source of truth.
- Works in all 10 languages (STT language = chosen locale, codemix).

### Phase 2 — 10-language onboarding
- Language step shows 10 cards (native script + English name), grid on desktop, 2-col on mobile.
- All `/start` online-store copy and the informative onboarding copy in 10 languages (static dictionaries generated once with Sarvam Translate by a committed script, reviewed for brand terms; English fallback per key).
- Locale flows into Tara, AI seed, informative AI build, and the seller panel default language.

### Phase 3 — Complete site creation (both types) + informative customizer
- Seed: `max_tokens` on the seed chat call so the AI plan completes; per-product normalisation already in place; images for categories/products/hero (online) and hero/gallery/services (informative) imported at finish.
- Informative customizer (`/informative/appearance` → "Customize"): live preview iframe + controls for design, colours (primary/secondary with contrast check), font pair, hero (image, heading, subheading, CTA), section visibility/order, and logo/favicon. Saves to existing columns + `options.sections` (no migration unless needed; any migration additive with RLS tests).

### Phase 4 — Seller copilot (both site types)
- One "Ask Pictocart AI" drawer in both panels: chat with context (store/site snapshot), quick actions (write product/service description, SEO, FAQs, pages, offers), proposals the seller approves before applying, AI-credit cost shown, voice input (Sarvam STT) and spoken replies, 10 languages.
- Reuses existing actions/permissions (`runAction`, permission matrix, AI credits).

## Ownership (parallel, disjoint files)
| Phase | Files |
|---|---|
| 1 Voice | `src/features/start/screens/voice-screen.tsx`, `src/features/start/components/voice/**`, `src/features/onboarding/voice/**`, `src/lib/sarvam/**` |
| 2 Languages | `src/features/start/copy*.ts`, `supported-locales.ts`, `screens/lang-screen.tsx`, `components/start-shell.tsx`, `src/features/informative/onboarding/**` (copy only), `scripts/i18n/**` |
| 3 Informative customizer | `src/features/informative/panel/**`, `src/app/informative/(panel)/appearance/**`, `src/features/informative/site/**`, `src/features/informative/server/**` |
| 3 Seed completeness | lead: `src/features/onboarding/seed/**`, `src/features/start/actions.ts` |
| 4 Copilot | `src/features/seller-ai/**`, `src/features/informative/ai/**`, panel layout mount points |

## Done when
`pnpm check` green; local E2E for quiz, voice (synthesised speech), informative with customizer, copilot in both panels at 1280/375; PR; staging deploy verified; production deploy on owner's go-ahead.
