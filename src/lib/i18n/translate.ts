import type { Locale } from "./config";
import { en, type Messages } from "./messages/en";
import { hi } from "./messages/hi";

/** Pure lookup helpers (no cookies here: see ./server for the request's locale). */

export const MESSAGES: Record<Locale, Messages> = { en, hi };

type Paths<T, P extends string = ""> = { [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`> }[keyof T & string];
/** Every dotted key with a string value, e.g. "nav.groups.Catalog" or "pages.orders.title". */
export type MessageKey = Paths<Messages>;
export type Vars = Record<string, string | number>;
export type T = (key: MessageKey, vars?: Vars) => string;

/** Fills `{name}` placeholders; unknown placeholders are left as written. */
export function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

function lookup(messages: Messages, key: string): string | undefined {
  // Keys like "nav.items./dashboard/products" hold a "/" but never a ".", so split on dots.
  let node: unknown = messages;
  for (const part of key.split(".")) node = node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined;
  return typeof node === "string" ? node : undefined;
}

/** t(key, vars) for a locale. Falls back to English, then to the key itself. */
export function createT(locale: Locale): T {
  const messages = MESSAGES[locale];
  return (key, vars) => format(lookup(messages, key) ?? lookup(en, key) ?? key, vars);
}
