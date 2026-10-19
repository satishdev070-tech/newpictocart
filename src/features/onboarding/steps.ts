/**
 * Seller onboarding steps (pure, unit tested). Account creation happens before /onboarding, so
 * it is always shown as done. Progress is derived from the database (an owned draft store means
 * onboarding is in progress), so it survives sign-out, other devices and email verification.
 *
 * Default path (no store): language → method → voice|business → building → ready.
 * Theme and plan are optional (skipped by default); sellers can change theme from Ready.
 */

export const ONBOARDING_STEPS = [
  { key: "account", label: "Account" },
  { key: "language", label: "Language" },
  { key: "setup", label: "Business" },
  { key: "building", label: "Building" },
  { key: "ready", label: "Ready" },
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]["key"];

/** Actual wizard screens (finer than the progress rail). */
export type WizardStep = "language" | "method" | "voice" | "business" | "building" | "theme" | "plan" | "ready";

const WIZARD: readonly WizardStep[] = ["language", "method", "voice", "business", "building", "theme", "plan", "ready"];

const PRE_STORE: readonly WizardStep[] = ["language", "method", "voice", "business"];

export function isWizardStep(v: unknown): v is WizardStep {
  return typeof v === "string" && (WIZARD as readonly string[]).includes(v);
}

/** Map a wizard screen onto the 5-step progress rail. */
export function progressStep(step: WizardStep): OnboardingStepKey {
  if (step === "language") return "language";
  if (step === "method" || step === "voice" || step === "business") return "setup";
  if (step === "building") return "building";
  return "ready";
}

/**
 * The step to show.
 * Without a store: language until a locale is chosen, then method / voice / business.
 * With a store: default Ready (theme/plan optional via explicit ?step=).
 */
export function resolveStep(
  requested: unknown,
  hasStore: boolean,
  prefs: { locale?: string | null } = {},
): WizardStep {
  if (!hasStore) {
    if (!prefs.locale) return "language";
    if (requested === "language") return "language";
    if (requested === "voice") return "voice";
    if (requested === "business") return "business";
    if (requested === "method") return "method";
    // Ignore post-store steps until a store exists.
    if (isWizardStep(requested) && (PRE_STORE as readonly string[]).includes(requested)) return requested;
    return "method";
  }
  if (isWizardStep(requested)) {
    if ((PRE_STORE as readonly string[]).includes(requested) && requested !== "business") return "ready";
    return requested;
  }
  return "ready";
}

export function stepIndex(step: OnboardingStepKey): number {
  return ONBOARDING_STEPS.findIndex((s) => s.key === step);
}

export function previousStep(step: WizardStep, prefs: { locale?: string | null; method?: string | null } = {}): WizardStep | null {
  switch (step) {
    case "language":
      return null;
    case "method":
      return "language";
    case "voice":
    case "business":
      return "method";
    case "building":
      return prefs.method === "voice" ? "voice" : "business";
    case "theme":
      return "ready";
    case "plan":
      return "theme";
    case "ready":
      return null;
    default:
      return null;
  }
}

/** URL of an onboarding step for a store, carrying the sign-up choices along. */
export function onboardingHref(
  step: WizardStep,
  store?: string | null,
  choice: { plan?: string | null; theme?: string | null; locale?: string | null; method?: string | null } = {},
): string {
  const qs = new URLSearchParams();
  if (step !== "language" || store) qs.set("step", step);
  if (store) qs.set("store", store);
  if (choice.plan) qs.set("plan", choice.plan);
  if (choice.theme) qs.set("theme", choice.theme);
  if (choice.locale) qs.set("lang", choice.locale);
  if (choice.method) qs.set("method", choice.method);
  return qs.size ? `/onboarding?${qs}` : "/onboarding";
}

export const PLAN_CODE_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A plan code shape check only; the code must still be found among active plans. */
export function cleanPlanCode(v: unknown): string | null {
  return typeof v === "string" && PLAN_CODE_RE.test(v) ? v : null;
}
