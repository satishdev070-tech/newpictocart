import type { IndustrySlug } from "@/features/stores/industries";
import type { ThemePreset } from "@/features/theme/marketplace/types";

/**
 * Sample store content for the on-site theme preview when no live demo store is available (pure,
 * unit tested). Names and prices are illustrative, prices in paise (src/lib/money.ts).
 */

export type SampleProduct = { name: string; price: number; compareAt: number | null };

const NAMES: Partial<Record<IndustrySlug, string[]>> = {
  fashion: ["Block-print cotton kurta", "Handloom linen saree", "Chikankari dupatta", "Indigo wrap dress", "Embroidered Nehru jacket", "Silk-blend lehenga"],
  gourmet: ["Sourdough country loaf", "Dark chocolate brownies", "Masala chai cookies", "Almond biscotti", "Mango cheesecake", "Saffron rusk"],
  jewellery: ["Kundan drop earrings", "Temple gold necklace", "Pearl jhumkas", "Silver oxidised bangles", "Polki statement ring", "Meenakari pendant"],
  beauty: ["Kumkumadi face oil", "Rose water toner", "Vitamin C serum", "Matte lip crayon", "Ubtan face pack", "Saffron night cream"],
  furniture: ["Sheesham coffee table", "Cane armchair", "Mango wood sideboard", "Linen 3-seater sofa", "Rattan pendant lamp", "Teak bookshelf"],
  electronics: ["Wireless earbuds", "65W GaN charger", "Smart fitness band", "Bluetooth speaker", "Mechanical keyboard", "USB-C hub"],
  handicrafts: ["Terracotta planter", "Blue pottery vase", "Dhokra brass figurine", "Madhubani wall art", "Hand-woven basket", "Block-printed cushion"],
  general: ["Steel water bottle", "Cotton bath towel set", "Ceramic dinner set", "Desk organiser", "Scented candle", "Canvas tote bag"],
  grocery: ["Cold-pressed groundnut oil", "Organic toor dal", "Kashmiri saffron", "Raw forest honey", "Basmati rice 5 kg", "Masala chai blend"],
  footwear: ["Leather kolhapuris", "Canvas sneakers", "Embroidered juttis", "Running shoes", "Suede loafers", "Block-heel sandals"],
  kids: ["Organic cotton onesie", "Wooden stacking toy", "Muslin swaddle set", "Kids rain jacket", "Story book set", "Plush elephant"],
  watches: ["Automatic steel watch", "Leather strap chronograph", "Minimal mesh watch", "Smart hybrid watch", "Gold-tone dress watch", "Diver's watch"],
};
const GENERIC = ["Signature product", "Bestseller", "New arrival", "Everyday essential", "Limited edition", "Gift pick"];

/** Six sample products for an industry, with a deterministic price and a sale on every third. */
export function sampleProducts(industry: string): SampleProduct[] {
  const names = NAMES[industry as IndustrySlug] ?? GENERIC;
  return names.map((name, i) => {
    const price = (499 + ((name.length * 137 + i * 211) % 40) * 100) * 100;
    return { name, price, compareAt: i % 3 === 1 ? Math.round((price * 1.25) / 10000) * 10000 : null };
  });
}

const RADIUS: Record<string, string> = { none: "0px", sm: "4px", md: "8px", lg: "14px" };
const BUTTON: Record<string, string> = { square: "0px", rounded: "6px", pill: "999px" };
const RATIO: Record<string, string> = { portrait: "3 / 4", tall: "3 / 4.4", square: "1 / 1", landscape: "4 / 3" };
const SPACING: Record<string, number> = { compact: 40, default: 56, airy: 80 };

/** Display settings read from a preset's tokens, with safe defaults for anything missing. PURE. */
export function sampleStyle(preset: ThemePreset) {
  const t = preset.tokens as Record<string, unknown> & { colors: Record<string, string> };
  const c = t.colors;
  const card = preset.productCard as Record<string, unknown>;
  return {
    colors: { primary: c.primary ?? "#111111", secondary: c.secondary ?? c.primary ?? "#444444", accent: c.accent ?? c.primary ?? "#c2410c", background: c.background ?? "#ffffff", text: c.text ?? "#111111", border: c.border ?? "#e5e5e5", sale: c.sale ?? "#b91c1c" },
    headingFont: String(t.headingFont ?? "editorial-serif"),
    bodyFont: String(t.bodyFont ?? "modern-sans"),
    uppercase: t.headingCase === "uppercase",
    cardRadius: RADIUS[String(t.cardRadius)] ?? "0px",
    buttonRadius: BUTTON[String(t.buttonShape)] ?? "0px",
    outlineButtons: t.buttonVariant === "outline",
    sectionGap: SPACING[String(t.spacing)] ?? SPACING.default!,
    centerHeadings: t.sectionHeadingAlign === "center",
    logoCenter: preset.headerLayout === "logo-center",
    drawerMenu: preset.menuStyle === "drawer",
    heroCenter: preset.hero.align === "center",
    heroLight: preset.hero.textTone === "light",
    imageRatio: RATIO[String(card.imageRatio)] ?? "3 / 4",
    cardCenter: card.textAlign === "center",
    showRating: card.showRating === true,
    filledBadge: card.badgeStyle !== "minimal",
    footer: preset.footerTone,
    announcement: preset.announcementTone,
  };
}
