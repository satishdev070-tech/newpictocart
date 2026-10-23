import { INDUSTRIES } from "@/features/stores/industries";
import { getSarvamLocale, type SarvamLocaleCode } from "@/lib/sarvam/locales";
import { missingFactLabels, type VoiceFacts } from "./facts";

const INDUSTRY_LIST = INDUSTRIES.map((i) => `${i.slug} (${i.name})`).join(", ");

/**
 * Tara system prompt. Speaks in the seller's language when Chat supports it;
 * otherwise reasons in English (client translates the reply).
 */
export function taraSystemPrompt(locale: SarvamLocaleCode): string {
  const loc = getSarvamLocale(locale);
  const lang = loc?.englishName ?? locale;
  const nativeOk = Boolean(loc?.chat);
  return [
    "You are Tara, a warm onboarding guide for Pictocart (an Indian store builder).",
    "Your job is to collect store setup facts in a short conversation (2–6 turns).",
    "Facts to collect: business name, category (industry), siteMode (ecommerce or informative), optional tagline and city.",
    `Known industry slugs: ${INDUSTRY_LIST}.`,
    "siteMode: ecommerce = online store that sells products; informative = brochure / services website without checkout.",
    "Ask one clear question at a time. Be concise (1–3 short sentences).",
    "Never re-ask a fact that is already set in Known facts. Only ask for fields listed under Still need.",
    "If the seller already gave category (or name / siteMode), acknowledge it and move on — do not ask again.",
    nativeOk
      ? `Reply to the seller in ${lang} (${locale}).`
      : `The seller speaks ${lang}. Write your "reply" field in clear English; it will be translated.`,
    'Always respond with a single JSON object only (no markdown): {"reply":"...","facts":{"name":null|"...","category":null|"fashion","siteMode":null|"ecommerce"|"informative","tagline":null|"...","city":null|"..."},"done":false}',
    "Only fill facts you are confident about from the conversation. Leave unknown fields null. Keep already-known facts as they are (repeat them in facts when you are sure).",
    'Set "done": true only when name, category, and siteMode are all known.',
  ].join("\n");
}

export function taraUserPrompt(args: {
  transcript: string;
  facts: VoiceFacts;
  locale: SarvamLocaleCode;
  history?: { role: "seller" | "tara"; text: string }[];
}): string {
  const missing = missingFactLabels(args.facts);
  const history = (args.history ?? [])
    .slice(-12)
    .map((turn) => `${turn.role === "tara" ? "Tara" : "Seller"}: ${turn.text.slice(0, 400)}`)
    .join("\n");
  return [
    `Locale: ${args.locale}`,
    `Known facts (do not re-ask these): ${JSON.stringify(args.facts)}`,
    missing.length
      ? `Still need (ask only about these): ${missing.join(", ")}.`
      : "All required facts collected — confirm briefly and set done true. Do not ask for more required facts.",
    history ? `Conversation so far:\n${history}` : "",
    `Seller said: ${args.transcript}`,
  ]
    .filter(Boolean)
    .join("\n");
}
