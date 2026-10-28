/**
 * Seller panel languages (pure, unit tested; safe on client and server).
 *
 * The choice is a UI preference kept in a cookie: no database column, nothing trusts it.
 * Adding a language = add its code to LOCALES and LOCALE_NAMES, then a messages file
 * (`messages/<code>.ts`) and a tour text file (`features/dashboard-ui/tours/text/<code>.ts`);
 * the `Record<Locale, …>` maps make typecheck fail until both exist.
 * Planned next: Marathi (mr), Gujarati (gu), Tamil (ta), Telugu (te), Bengali (bn).
 */
export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Each language in its own script (what a seller looks for in the switcher). */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", hi: "हिन्दी" };

export const LOCALE_COOKIE = "pc_lang";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Cookie value -> locale. Missing, unknown or junk = English. Accepts "hi-IN" / "HI" as Hindi. */
export function parseLocale(raw: string | null | undefined): Locale {
  const code = raw?.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(code) ? code : DEFAULT_LOCALE;
}

/** document.cookie assignment for the preference (client side). */
export function localeCookie(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}
