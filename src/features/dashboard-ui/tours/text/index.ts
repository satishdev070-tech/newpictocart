import type { Locale } from "@/lib/i18n/config";
import type { TourText } from "./en";

/** One chunk per language, fetched only when a tour runs. */
export const TOUR_TEXT: Record<Locale, () => Promise<TourText>> = {
  en: () => import("./en").then((m) => m.en),
  hi: () => import("./hi").then((m) => m.hi),
};
