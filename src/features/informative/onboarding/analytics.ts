/**
 * Onboarding analytics events (plan §Onboarding). The app has no generic event store; events go to
 * the platform's GA4 / Google Tag (loaded by PlatformTrackingTags on /start when configured) and are
 * a no-op otherwise (Q5). Never send personal data: only type / theme ids.
 */
export type InformativeOnboardingEvent =
  | { name: "onboarding_type_selected"; params: { type: "ONLINE_STORE" | "INFORMATIVE" } }
  | { name: "informative_theme_previewed"; params: { themeId: string } }
  | { name: "informative_theme_selected"; params: { themeId: string } }
  | { name: "informative_onboarding_completed"; params: { themeId: string } };

type TagWindow = Window & { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] };

export function trackInformativeEvent(e: InformativeOnboardingEvent): void {
  if (typeof window === "undefined") return;
  const w = window as TagWindow;
  try {
    if (typeof w.gtag === "function") w.gtag("event", e.name, e.params);
    else if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event: e.name, ...e.params });
  } catch {
    // Analytics must never break onboarding.
  }
}
