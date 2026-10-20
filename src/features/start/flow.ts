import type { StartDraft, StartScreen } from "./draft/schema";

export type ProgressInfo = {
  overall: string | null;
  manual: string | null;
  percent: number;
};

function isHi(locale: string): boolean {
  return locale === "hi-IN";
}

export function progressFor(screen: StartScreen, path: StartDraft["path"], locale: string): ProgressInfo {
  const hi = isHi(locale);
  const step = (n: number, total: number) => (hi ? `चरण ${n} / ${total}` : `Step ${n} of ${total}`);
  const manualStep = (n: number, total: number) => (hi ? `मैनुअल • चरण ${n} / ${total}` : `Manual • Step ${n} of ${total}`);

  const none: ProgressInfo = { overall: null, manual: null, percent: 0 };

  switch (screen) {
    case "welcome":
    case "building":
    case "done":
      return none;
    case "lang":
      return { overall: step(1, 6), manual: null, percent: 16 };
    case "intent":
      return { overall: step(2, 6), manual: null, percent: 33 };
    case "path":
      return { overall: step(3, 6), manual: null, percent: 50 };
    case "voice":
    case "quiz":
      return { overall: step(5, 6), manual: null, percent: 83 };
    case "business":
      return { overall: step(4, 8), manual: manualStep(1, 4), percent: 50 };
    case "products":
      return { overall: step(5, 8), manual: manualStep(2, 4), percent: 62 };
    case "mood":
      return { overall: step(6, 8), manual: manualStep(3, 4), percent: 75 };
    case "payment":
      return { overall: step(7, 8), manual: manualStep(4, 4), percent: 87 };
    case "account":
      if (path === "manual") return { overall: step(8, 8), manual: null, percent: 100 };
      return { overall: step(6, 6), manual: null, percent: 100 };
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

export function manualBusinessComplete(draft: StartDraft): boolean {
  return draft.business.name.trim().length >= 2 && draft.business.category !== null;
}

export function voiceFactsComplete(draft: StartDraft): boolean {
  const f = draft.voice.facts;
  return Boolean(f.name?.trim() && f.category && f.siteMode);
}

export function draftReadyToFinalize(draft: StartDraft): boolean {
  if (draft.path === "ai") return voiceFactsComplete(draft) || manualBusinessComplete(draft);
  if (draft.path === "manual") return manualBusinessComplete(draft);
  return false;
}

export function draftHasProgress(draft: StartDraft): boolean {
  if (draft.screen !== "welcome") return true;
  if (draft.intent || draft.path) return true;
  if (draft.business.name.trim() || draft.voice.facts.name?.trim()) return true;
  return false;
}

export function nextScreenAfterPath(path: "ai" | "manual"): StartScreen {
  return path === "ai" ? "voice" : "business";
}

export function backTarget(screen: StartScreen, path: StartDraft["path"], voiceMode?: StartDraft["voice"]["mode"]): StartScreen | null {
  const order: Record<StartScreen, StartScreen | null> = {
    welcome: null,
    lang: "welcome",
    intent: "lang",
    path: "intent",
    voice: "path",
    quiz: "voice",
    business: "path",
    products: "business",
    mood: "products",
    payment: "mood",
    building: path === "manual" ? "payment" : voiceMode === "quiz" ? "quiz" : "voice",
    account: "building",
    done: null,
  };
  return order[screen] ?? null;
}
