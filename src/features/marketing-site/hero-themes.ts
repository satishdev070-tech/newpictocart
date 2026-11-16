import type { IndustrySlug } from "@/features/stores/industries";
import type { MarketplaceTheme } from "@/features/theme/marketplace/types";

/**
 * Hero headline ↔ theme pairing. The hero types out one business per slide ("Launch your store for
 * Home Bakers", "… Jewellers"); the screenshot next to it must show a theme for that business.
 * Each rotating word is matched to an industry by keyword, then to a theme of that industry
 * (a preferred one first, never the same theme twice). PURE (unit tested).
 */
type Rule = { match: RegExp; industry: IndustrySlug; prefer?: readonly string[] };

/** First match wins, so more specific words come first ("jewellery" before "store"). */
export const HERO_WORD_RULES: readonly Rule[] = [
  { match: /bak(er|ery|e)|cake|patisser|dessert|cafe|café/i, industry: "gourmet", prefer: ["hearth-and-crust", "patisserie-noir"] },
  { match: /mithai|sweet|halwai|namkeen|snack/i, industry: "sweets" },
  { match: /jewel|gold|silver/i, industry: "jewellery", prefer: ["gilded-luxe", "temple-heritage"] },
  { match: /boutique/i, industry: "fashion", prefer: ["sutra-atelier", "heritage-kashmir"] },
  { match: /fashion|apparel|cloth|garment|ethnic|saree|kurt|wear/i, industry: "fashion", prefer: ["runway-editorial", "fashion-marketplace"] },
  { match: /artisan|craft|handmade|potter/i, industry: "handicrafts", prefer: ["earth-artisan"] },
  { match: /gift|hamper/i, industry: "gifts", prefer: ["keepsake-studio", "gift-burst"] },
  { match: /beauty|cosmetic|skin|salon|makeup/i, industry: "beauty", prefer: ["luxury-beauty"] },
  { match: /perfume|fragrance|attar|oud/i, industry: "fragrances" },
  { match: /electronic|gadget|tech/i, industry: "electronics", prefer: ["premium-tech"] },
  { match: /mobile|phone/i, industry: "mobile-accessories" },
  { match: /furniture|interior/i, industry: "furniture", prefer: ["scandinavian-home"] },
  { match: /d[eé]cor|home/i, industry: "home-decor" },
  { match: /grocer|kirana|supermarket/i, industry: "grocery", prefer: ["fresh-market"] },
  { match: /organic|farm/i, industry: "organic" },
  { match: /shoe|footwear|sneaker/i, industry: "footwear", prefer: ["street-drop"] },
  { match: /toy/i, industry: "toys" },
  { match: /kid|baby/i, industry: "kids", prefer: ["toybox-pop"] },
  { match: /watch/i, industry: "watches", prefer: ["chrono-noir"] },
  { match: /book|stationer/i, industry: "books" },
  { match: /pet/i, industry: "pets" },
  { match: /plant|garden|nurser/i, industry: "plants" },
  { match: /pooja|puja|spiritual/i, industry: "pooja" },
  { match: /art|painter|gallery/i, industry: "art" },
  { match: /tea|coffee|chai|beverage/i, industry: "beverages" },
  { match: /ayurved|wellness|health/i, industry: "ayurveda" },
  { match: /bag|luggage/i, industry: "bags" },
];

export function heroIndustryFor(word: string): IndustrySlug | null {
  return HERO_WORD_RULES.find((r) => r.match.test(word))?.industry ?? null;
}

/**
 * One theme per rotating word, in order. A word with no matching rule (or no theme left for its
 * industry) gets the next unused theme from `fallback`; `null` only when nothing is left.
 * `usable` narrows the choice (e.g. to themes that have screenshots).
 */
export function heroThemesForWords(
  words: readonly string[],
  themes: readonly MarketplaceTheme[],
  fallback: readonly MarketplaceTheme[] = [],
  usable: (t: MarketplaceTheme) => boolean = () => true,
): (MarketplaceTheme | null)[] {
  const used = new Set<string>();
  const take = (t: MarketplaceTheme | undefined) => {
    if (t) used.add(t.key);
    return t ?? null;
  };
  const free = (t: MarketplaceTheme) => !used.has(t.key) && usable(t);
  return words.map((word) => {
    const rule = HERO_WORD_RULES.find((r) => r.match.test(word));
    if (rule) {
      const preferred = (rule.prefer ?? []).map((k) => themes.find((t) => t.key === k)).find((t): t is MarketplaceTheme => !!t && free(t));
      const hit = preferred ?? themes.find((t) => t.industry === rule.industry && free(t));
      if (hit) return take(hit);
    }
    return take(fallback.find(free));
  });
}

/** Every theme the hero could pick for the given words (capture script: screenshot these). */
export function heroThemeCandidates(words: readonly string[], themes: readonly MarketplaceTheme[]): MarketplaceTheme[] {
  return heroThemesForWords(words, themes).filter((t): t is MarketplaceTheme => !!t);
}
