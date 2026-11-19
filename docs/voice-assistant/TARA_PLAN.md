# Tara everywhere — plan (2026-11-18)

Owner ask: one assistant named **Tara** everywhere, with a **female Indian voice**. When the merchant stops talking, the words appear in an **editable** box, and only **Enter / Send** passes them to Tara. Tara should be **smart and human-like**: hear, react, ask the right next question and gather the store/website facts. The online-store and informative journeys both matter.

## Findings (why Tara felt robotic)
1. **Her brain was only Sarvam chat.** Sarvam is out of credits, so every onboarding turn fell to `offline-replies.ts`, a fixed list of scripted questions. That is the main reason she "asked the same thing" and didn't sound like she understood.
2. **Hands-free sending:** the words went to the AI as soon as the merchant paused, with no chance to fix a misheard word.
3. **Three names:** Tara (onboarding), "Pictocart AI" (copilot) and "Pica2" (older assistant and marketing pages).
4. **The voice picker preferred region over gender**, so an Indian male voice beat a female voice.

## What this change does (phase 1, shipped in this PR)
| Area | Change | Files |
|---|---|---|
| Brain | Sarvam chat → **platform AI fallback** (Admin → AI health route `tara_onboarding`; Groq → Gemini first for speed; replies natively in the seller's language) → scripted questions only if every AI fails | `onboarding/voice/brain.ts`, `turn.ts`, `ai-health/registry.ts` |
| Persona & craft | Tara is a warm, sharp Indian woman: reacts specifically, asks exactly one question with 2–3 examples, narrows vague answers, captures several facts at once, accepts corrections, answers side questions briefly, suggests store names, mirrors Hindi/Hinglish/English, recaps at the end; few-shot examples | `onboarding/voice/prompt.ts` |
| Review before send | New call phase `reviewing`: recognition stops, the words show in an editable box. **Enter / Send to Tara** sends them; **Say it again** re-listens; typing also works | `call-machine.ts`, `use-tara-call.ts`, `call-panel.tsx`, `voice-copy.ts`, `voice-screen.tsx` |
| Name | "Ask Tara" copilot (store + informative panels), voice assistant drawer "Tara", old Pica2 strings, wallet label, marketing feature page; prompts say "You are Tara" with the same persona | copilot copy/prompts, voice-assistant, i18n messages, marketing |
| Voice | Female first everywhere: Indian female (exact locale) → any female voice of the language → Indian male. The language is never traded away. Male-only devices still speak. Sarvam's voice is the female `ritu` | `lib/speech/browser-speech.ts`, `onboarding/voice/browser-speech.ts`, `lib/speech/voice-gender.ts` |
| Dashboard voice assistant | Review-before-send is now the default (Enter sends) | `voice-assistant/components/voice-drawer.tsx` |

## On "train it like a real AI model"
We don't fine-tune a model; that needs paid infrastructure and a large consented dataset. Tara gets her "mind" from:
1. a strong general LLM (Sarvam / Llama on Groq / Gemini);
2. a detailed persona and conversation-craft prompt, with worked examples;
3. structured memory: known facts, what is still needed, the last 12 turns;
4. server-side guards: Zod-validated JSON, a local fact extractor backing the model, never re-asking known facts;
5. tests that pin the behaviour.

Next step for quality: an **eval set** of real (consented, anonymised) onboarding transcripts, scored for turns-to-complete and repeated questions, run on every prompt change.

## Phase 2 (next PRs)
- **Voice onboarding for Informative Websites** (business name, category / service type, phone, city, address, services): the same call UI and brain, with an informative fact schema.
- Hinglish UI copy for the call screen (it falls back to English for untranslated locales today).
- An eval harness (`tests/eval/tara/*.json` scenarios → model run → score) gated in CI on a schedule.
- Optional Sarvam TTS for the dashboard assistant when credits return (same female `ritu` voice), with the browser voice as fallback.

## Tests
`tests/unit/onboarding/tara-smart.test.ts` covers the review flow, the brain fallback order (Sarvam → Groq/Gemini → scripted), native-language replies, the persona contract and male-only devices. `tests/unit/speech/voice-gender.test.ts` covers female-first ranking.
