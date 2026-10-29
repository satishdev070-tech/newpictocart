import type { StartDraft, StartScreen } from "./draft/schema";
import { draftCategory, draftStoreName, draftSubcategory } from "./draft/schema";

export type ProgressInfo = {
  overall: string | null;
  manual: string | null;
  percent: number;
};

function isHi(locale: string): boolean {
  return locale === "hi-IN";
}

/** Five-screen progress: lang → path → business → theme → account. */
export function progressFor(screen: StartScreen, _path: StartDraft["path"], locale: string): ProgressInfo {
  const hi = isHi(locale);
  const step = (n: number, total: number) => (hi ? `चरण ${n} / ${total}` : `Step ${n} of ${total}`);
  const none: ProgressInfo = { overall: null, manual: null, percent: 0 };

  switch (screen) {
    case "welcome":
    case "building":
    case "done":
      return none;
    case "lang":
      return { overall: step(1, 5), manual: null, percent: 20 };
    case "intent":
    case "path":
      return { overall: step(2, 5), manual: null, percent: 40 };
    case "voice":
    case "quiz":
    case "business":
      return { overall: step(3, 5), manual: null, percent: 60 };
    case "products":
    case "mood":
    case "payment":
    case "theme":
      return { overall: step(4, 5), manual: null, percent: 80 };
    case "account":
      return { overall: step(5, 5), manual: null, percent: 100 };
    default:
      return none;
  }
}

export function canAdvanceFromIntent(intent: StartDraft["intent"]): boolean {
  return intent !== null;
}

export function canAdvanceFromPath(path: StartDraft["path"]): boolean {
  return path === "ai" || path === "manual";
}

/** Business step complete: name + category + subcategory (business or voice facts). */
export function businessComplete(draft: StartDraft): boolean {
  const name = draftStoreName(draft);
  return name.length >= 2 && draftCategory(draft) !== null && draftSubcategory(draft) !== null;
}

/** @deprecated Prefer businessComplete — same rules for the five-screen flow. */
export function manualBusinessComplete(draft: StartDraft): boolean {
  return businessComplete(draft);
}

/** Voice facts enough to leave the AI step. siteMode defaults at finalize. */
export function voiceFactsComplete(draft: StartDraft): boolean {
  const f = draft.voice.facts;
  return Boolean(f.name?.trim() && f.category && f.subcategory?.trim());
}

/**
 * Ready to finalize once business is complete.
 * Theme is preferred but can fall back at finalize.
 */
export function draftReadyToFinalize(draft: StartDraft): boolean {
  if (draft.path === "ai") return voiceFactsComplete(draft) || businessComplete(draft);
  if (draft.path === "manual") return businessComplete(draft);
  return businessComplete(draft);
}

/**
 * True when the user has entered real journey data — not merely landed on a deep-link
 * `/start/[step]` with an empty draft (screen alone must not count as progress).
 */
export function draftHasProgress(draft: StartDraft): boolean {
  if (draft.result) return true;
  if (draft.intent || draft.path) return true;
  if (draft.business.name.trim() || draft.voice.facts.name?.trim()) return true;
  if (draft.business.category || draft.voice.facts.category) return true;
  if (draft.business.subcategory || draft.voice.facts.subcategory) return true;
  if (draft.business.productsServices.trim() || draft.voice.facts.productsServices?.trim()) return true;
  if (draft.theme || draft.mood || draft.products.length) return true;
  if (draft.voice.turns.length || draft.voice.done) return true;
  return false;
}

/**
 * After path: Voice (ai + talk) → voice; Quiz (ai + quiz) → quiz; manual → business.
 * Voice and quiz both count as numbered step 3 (business stage).
 */
export function nextScreenAfterPath(
  path: "ai" | "manual",
  mode: StartDraft["voice"]["mode"] = "talk",
): StartScreen {
  if (path === "manual") return "business";
  return mode === "quiz" ? "quiz" : "voice";
}

function themeBackTarget(path: StartDraft["path"], voiceMode?: StartDraft["voice"]["mode"]): StartScreen {
  if (path === "ai") return voiceMode === "quiz" ? "quiz" : "voice";
  return "business";
}

export function backTarget(screen: StartScreen, path: StartDraft["path"], voiceMode?: StartDraft["voice"]["mode"]): StartScreen | null {
  const order: Record<StartScreen, StartScreen | null> = {
    welcome: null,
    lang: null,
    intent: "lang",
    path: "lang",
    voice: "path",
    quiz: "path",
    business: "path",
    products: "business",
    mood: "theme",
    payment: "theme",
    theme: themeBackTarget(path, voiceMode),
    building: "account",
    account: "theme",
    done: null,
  };
  return order[screen] ?? null;
}
