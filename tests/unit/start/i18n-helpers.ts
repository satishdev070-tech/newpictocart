import { expect } from "vitest";
import { at, leaves, placeholdersOf } from "@/features/start/i18n/templates";

/** Terms that must stay in Latin script in every language (Tara may be transliterated: it is a name). */
const BRANDS = ["Pictocart", "UPI", "OTP", "Google", "WhatsApp"];

/** Assert a template tree covers every English leaf with the same placeholders and kept brand terms. */
export function expectComplete(english: unknown, translation: unknown, label: string) {
  const missing: string[] = [];
  const broken: string[] = [];
  for (const [path, en] of leaves(english)) {
    const tr = at(translation, path);
    if (typeof tr !== "string" || !tr.trim()) {
      missing.push(path);
      continue;
    }
    if (placeholdersOf(tr).join() !== placeholdersOf(en).join()) broken.push(`${path}: placeholders ${JSON.stringify(tr)}`);
    if (/[{}]/.test(tr.replace(/\{[a-zA-Z][a-zA-Z0-9]*\}/g, ""))) broken.push(`${path}: stray brace ${JSON.stringify(tr)}`);
    for (const b of BRANDS) if (en.includes(b) && !tr.includes(b)) broken.push(`${path}: lost ${b}`);
  }
  const extra = leaves(translation)
    .map(([p]) => p)
    .filter((p) => typeof at(english, p) !== "string");
  expect({ label, missing, broken, extra }).toEqual({ label, missing: [], broken: [], extra: [] });
}

