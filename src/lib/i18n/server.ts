import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocale, type Locale } from "./config";
import { MESSAGES, createT, type T } from "./translate";
import type { Messages } from "./messages/en";

/** The seller's panel language for this request (cookie; English when unset). Once per request. */
export const getLocale = cache(async (): Promise<Locale> => parseLocale((await cookies()).get(LOCALE_COOKIE)?.value));

/** Locale, its message object and `t()` for server components. */
export const getI18n = cache(async (): Promise<{ locale: Locale; m: Messages; t: T }> => {
  const locale = await getLocale();
  return { locale, m: MESSAGES[locale], t: createT(locale) };
});
