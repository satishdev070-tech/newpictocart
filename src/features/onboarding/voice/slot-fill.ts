import type { IndustrySlug } from "@/features/stores/industries";
import {
  extractCityPhrase,
  extractFactsFromText,
  mapCategoryInput,
  suggestSubcategory,
  type VoiceFacts,
  type VoiceFactsInput,
} from "./facts";
import type { OfflineStep } from "./offline-replies";

/**
 * Slot filling for Tara's no-AI mode: the seller's answer fills the slot Tara just asked for,
 * even when it is a bare phrase ("विनोद जनरल स्टोर", "Vinod") with no "my store is called…".
 * Without this, a bare answer filled nothing and Tara repeated the same question forever.
 * Pure; no I/O.
 */

/** "I already told you", "what?", "again?" — reactions, not answers. Never stored as a value. */
const NOT_AN_ANSWER =
  /(बताया|bataya|bata\s*diya|told|already|pehle|पहले|abhi\s+to|अभी\s+तो|kya\s+bola|क्या\s+बोला|samjh|समझ|again|phir\s+se|फिर\s+से|\?|repeat|sorry|sunai|सुनाई)/iu;

/** Leading/trailing filler around a name or city ("मेरी दुकान का नाम … है", "it's called …", "… ji"). */
const NAME_PREFIX =
  /^(?:(?:mera|meri|hamara|hamari|humara|humari|my|our|मेरा|मेरी|हमारा|हमारी)\s+)?(?:(?:dukaan|dukan|store|shop|business|दुकान|स्टोर|शॉप|बिज़नेस|बिजनेस)\s+)?(?:(?:ka|ki|का|की)\s+)?(?:naam|name|नाम)\s*(?:hai|है|is|:)?\s*|^(?:it'?s|it\s+is)\s+(?:called|named)\s+|^(?:called|named)\s+|^(?:the\s+)?name\s+is\s+/iu;
const TRAILING_FILLER = /\s+(?:hai|है|hain|हैं|ji|जी|h|hoon|हूँ|हूं|please|thanks|thank\s+you)$/iu;

const SKIP_CITY = /^(?:skip|no|nahi|nahin|नहीं|नही|na|छोड़(?:ो|ें|िए)?|chhodo|chodo|baad\s+mein|later|pass)$/iu;

/** Common shop phrasings the category aliases miss (English, Hinglish, Devanagari). */
const SHOP_WORDS: readonly (readonly [RegExp, IndustrySlug])[] = [
  [/(general\s*store|kirana|kiryana|जनरल\s*स्टोर|किराना|किराने|provision|ration|राशन)/iu, "grocery"],
  [/(gehne|gahne|zevar|jewel|गहने|ज़ेवर|जेवर|ज्वेलरी)/iu, "jewellery"],
  [/(kapde|kapda|clothes|garment|saree|sari|kurti|कपड़े|कपड़ा|साड़ी|कुर्ती)/iu, "fashion"],
  [/(mithai|sweets|namkeen|bakery|मिठाई|नमकीन|बेकरी)/iu, "grocery"],
];

export function cleanAnswer(raw: string): string {
  let s = raw.replace(/[।.!,;:"“”'‘’]+$/gu, "").replace(/\s+/g, " ").trim();
  s = s.replace(NAME_PREFIX, "").trim();
  for (let i = 0; i < 2; i++) s = s.replace(TRAILING_FILLER, "").trim();
  return s;
}

export function isNonAnswer(raw: string): boolean {
  return NOT_AN_ANSWER.test(raw.trim());
}

function words(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/** Split "fashion jewellery aur bridal sets, gold" into product-type tokens. */
function splitTypes(s: string): string[] {
  return s
    .split(/\s*(?:,|&|\+|\band\b|\baur\b|\bor\b|और|तथा|एवं|या)\s*/iu)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 8);
}

function shopCategory(text: string): IndustrySlug | null {
  for (const [re, slug] of SHOP_WORDS) if (re.test(text)) return slug;
  return null;
}

/**
 * Facts to merge for an answer to `expecting`. Anything the general extractor already finds
 * (a full sentence with several facts) is kept; the expected slot is then filled from the
 * whole answer if it is still empty. Returns `{}` for a non-answer.
 */
export function fillExpectedSlot(expecting: OfflineStep, answer: string, facts: VoiceFactsInput): Partial<VoiceFacts> {
  const extracted = extractFactsFromText(answer);
  if (isNonAnswer(answer)) return {};
  const patch: Partial<VoiceFacts> = { ...extracted };
  const cleaned = cleanAnswer(answer);
  if (!cleaned) return patch;

  if (expecting === "name" && !extracted.name) {
    if (cleaned.length >= 2 && cleaned.length <= 60 && words(cleaned) <= 6) patch.name = cleaned;
  } else if (expecting === "category" && !extracted.categories?.length && !extracted.category) {
    const mapped = mapCategoryInput(cleaned);
    const known = mapped.category ?? shopCategory(cleaned);
    const category = known ?? "general";
    patch.categories = [category];
    patch.category = category;
    // A specific type in the answer ("bridal sets") fills products too. A plain shop type
    // ("किराना") leaves products for the next question. Unmappable words ("handmade candles")
    // become the seller's own product type under General, so Tara never loops on this step.
    const sub = mapped.subcategory ?? (known ? null : suggestSubcategory(category, cleaned) ?? cleaned.slice(0, 40));
    if (sub && !facts.subcategories?.length) {
      patch.subcategories = [sub];
      patch.subcategory = sub;
    }
  } else if (expecting === "products") {
    // Every item the seller named counts: known types map to slugs, the rest stay as said.
    const primary = (facts.categories?.[0] ?? facts.category ?? null) as IndustrySlug | null;
    const types = splitTypes(cleaned).map((t) => (primary ? suggestSubcategory(primary, t) : null) ?? mapCategoryInput(t).subcategory ?? t.slice(0, 40));
    const all = [...new Set([...(extracted.subcategories ?? []), ...types])].slice(0, 8);
    if (all.length) {
      patch.subcategories = all;
      patch.subcategory = all[0] ?? null;
    }
  } else if (expecting === "city" && !extracted.city) {
    if (!SKIP_CITY.test(cleaned)) {
      const city = extractCityPhrase(answer)?.city ?? (words(cleaned) <= 3 ? cleaned.replace(/\s+(?:mein|me|mai|se|में|से)$/iu, "") : null);
      if (city && city.length >= 2) patch.city = city.slice(0, 60);
    }
  }
  return patch;
}
