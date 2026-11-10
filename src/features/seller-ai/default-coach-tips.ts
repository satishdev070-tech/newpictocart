import { en } from "@/lib/i18n/messages/en";
import { hi } from "@/lib/i18n/messages/hi";

/** Exactly five free starter tips shipped in i18n (EN/HI). AI refresh replaces them and spends credits. */
export const DEFAULT_BUSINESS_COACH_TIP_COUNT = 5;

/** Free starter tips for the Business Coach card (0 credits). AI refresh replaces these. */
export function defaultBusinessCoachTips(locale: "en" | "hi" = "en") {
  return (locale === "hi" ? hi : en).ai.coach.defaults;
}

export function assertDefaultBusinessCoachTipCount(locale: "en" | "hi" = "en"): number {
  const n = defaultBusinessCoachTips(locale).tips.length;
  if (n !== DEFAULT_BUSINESS_COACH_TIP_COUNT) {
    throw new Error(`Expected ${DEFAULT_BUSINESS_COACH_TIP_COUNT} default coach tips, got ${n}`);
  }
  return n;
}
