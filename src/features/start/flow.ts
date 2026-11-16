import type { StartDraft, StartScreen } from "./draft/schema";
import { draftCategories, draftStoreName, draftSubcategories } from "./draft/schema";

export type ProgressInfo = { step: number; total: number };

/**
 * Online-store journey progress: lang → build → path → quiz|voice → theme → account (6 steps).
 * When the build step (Online Store | Informative Website) is off, it is skipped (5 steps).
 * Null on screens without a step number (building, done).
 */
export function progressFor(screen: StartScreen, opts: { buildStep: boolean }): ProgressInfo | null {
  const order = opts.buildStep
    ? (["lang", "build", "path", "business", "theme", "account"] as const)
    : (["lang", "path", "business", "theme", "account"] as const);
  const stage: StartScreen | null = (() => {
    switch (screen) {
      case "welcome":
      case "lang":
        return "lang";
      case "build":
        return opts.buildStep ? "build" : "path";
      case "intent":
      case "path":
        return "path";
      case "voice":
      case "quiz":
      case "business":
      case "products":
        return "business";
      case "mood":
      case "payment":
      case "theme":
        return "theme";
      case "account":
        return "account";
      default:
        return null;
    }
  })();
  if (!stage) return null;
  const idx = (order as readonly StartScreen[]).indexOf(stage);
  return idx < 0 ? null : { step: idx + 1, total: order.length };
}

/** Lang → build (Online Store | Informative) when that step exists, else straight to path. */
export function nextScreenAfterLang(buildStep: boolean): StartScreen {
  return buildStep ? "build" : "path";
}

export function canAdvanceFromIntent(intent: StartDraft["intent"]): boolean {
  return intent !== null;
}

export function canAdvanceFromPath(path: StartDraft["path"]): boolean {
  return path === "ai" || path === "manual";
}

/** Business step complete: name + ≥1 category + ≥1 product type (business or voice facts). */
export function businessComplete(draft: StartDraft): boolean {
  const name = draftStoreName(draft);
  return name.length >= 2 && draftCategories(draft).length > 0 && draftSubcategories(draft).length > 0;
}

/** @deprecated Prefer businessComplete — same rules for the five-screen flow. */
export function manualBusinessComplete(draft: StartDraft): boolean {
  return businessComplete(draft);
}

/** Voice facts enough to leave the AI step. siteMode defaults at finalize. */
export function voiceFactsComplete(draft: StartDraft): boolean {
  const f = draft.voice.facts;
  const hasCategory = Boolean(f.category) || (f.categories ?? []).length > 0;
  const hasSub = Boolean(f.subcategory?.trim()) || (f.subcategories ?? []).length > 0;
  return Boolean(f.name?.trim()) && hasCategory && hasSub;
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
  if (draft.business.categories?.length || draft.voice.facts.categories?.length) return true;
  if (draft.business.subcategory || draft.voice.facts.subcategory) return true;
  if (draft.business.productsServices.trim() || draft.voice.facts.productsServices?.trim()) return true;
  if (draft.theme || draft.mood || draft.products.length) return true;
  if (draft.voice.turns.length || draft.voice.done) return true;
  return false;
}

/**
 * After path: Voice (ai + talk) → voice; Quiz (ai + quiz) → quiz; legacy manual → quiz.
 */
export function nextScreenAfterPath(
  path: "ai" | "manual",
  mode: StartDraft["voice"]["mode"] = "talk",
): StartScreen {
  if (path === "manual") return "quiz";
  return mode === "quiz" ? "quiz" : "voice";
}

function themeBackTarget(path: StartDraft["path"], voiceMode?: StartDraft["voice"]["mode"]): StartScreen {
  if (path === "ai") return voiceMode === "quiz" ? "quiz" : "voice";
  return "quiz";
}

export function backTarget(
  screen: StartScreen,
  path: StartDraft["path"],
  voiceMode?: StartDraft["voice"]["mode"],
  buildStep = false,
): StartScreen | null {
  const order: Record<StartScreen, StartScreen | null> = {
    welcome: null,
    lang: null,
    build: "lang",
    intent: "lang",
    path: buildStep ? "build" : "lang",
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
