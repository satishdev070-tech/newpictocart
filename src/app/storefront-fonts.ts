import localFont from "next/font/local";

/**
 * Storefront theme fonts, self-hosted from @fontsource (ADR-019). CSS variables are applied on the
 * storefront layout only (not the root layout) so marketing pages do not download them. Browsers
 * only fetch a font when a theme actually uses it (preload off). Mapped to theme font keys in
 * features/theme/schema/tokens.ts (FONT_STACKS).
 */
export const cormorant = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2", weight: "300 700" }, { path: "../../node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-italic.woff2", weight: "300 700", style: "italic" }], variable: "--font-cormorant", display: "swap", preload: false });
export const playfair = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2", weight: "400 900" }, { path: "../../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-italic.woff2", weight: "400 900", style: "italic" }], variable: "--font-playfair", display: "swap", preload: false });
export const bodoni = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/bodoni-moda/files/bodoni-moda-latin-wght-normal.woff2", weight: "400 900" }, { path: "../../node_modules/@fontsource-variable/bodoni-moda/files/bodoni-moda-latin-wght-italic.woff2", weight: "400 900", style: "italic" }], variable: "--font-bodoni", display: "swap", preload: false });
export const marcellus = localFont({ src: [{ path: "../../node_modules/@fontsource/marcellus/files/marcellus-latin-400-normal.woff2", weight: "400" }], variable: "--font-marcellus", display: "swap", preload: false });
export const manrope = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2", weight: "200 800" }], variable: "--font-manrope", display: "swap", preload: false });
export const jost = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/jost/files/jost-latin-wght-normal.woff2", weight: "100 900" }, { path: "../../node_modules/@fontsource-variable/jost/files/jost-latin-wght-italic.woff2", weight: "100 900", style: "italic" }], variable: "--font-jost", display: "swap", preload: false });
export const spaceGrotesk = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2", weight: "300 700" }], variable: "--font-space-grotesk", display: "swap", preload: false });
export const dmSans = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2", weight: "100 1000" }, { path: "../../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-italic.woff2", weight: "100 1000", style: "italic" }], variable: "--font-dm-sans", display: "swap", preload: false });
export const barlowCondensed = localFont({ src: [{ path: "../../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2", weight: "600" }, { path: "../../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2", weight: "700" }], variable: "--font-barlow-condensed", display: "swap", preload: false });

// Latin Extended companions (ā, ī, ś… in names like "Nayā Paramparā"). They contain only the
// extended glyphs and are listed FIRST in the theme stacks (without a generated fallback), so the
// browser takes ā from them and every basic Latin glyph from the main family. (No unicode-range:
// these files also carry space, "A" and nbsp, which pages render from them today; a range that
// excluded those would change text metrics, and one that included them would load them anyway.)
export const bodoniExt = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/bodoni-moda/files/bodoni-moda-latin-ext-wght-normal.woff2", weight: "400 900" }], variable: "--font-bodoni-ext", display: "swap", preload: false, adjustFontFallback: false });
export const jostExt = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/jost/files/jost-latin-ext-wght-normal.woff2", weight: "100 900" }], variable: "--font-jost-ext", display: "swap", preload: false, adjustFontFallback: false });

// Site-builder font picker additions. Upright files only (italic is synthesised; theme copy rarely
// sets it) and only the weights the typography scale uses for static families. Like the fonts
// above, nothing downloads unless the store's theme references the variable.
export const asapSharp = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/asap-sharp/files/asap-sharp-latin-wght-normal.woff2", weight: "100 900" }], variable: "--font-asap-sharp", display: "swap", preload: false });
export const openSans = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/open-sans/files/open-sans-latin-wght-normal.woff2", weight: "300 800" }], variable: "--font-open-sans", display: "swap", preload: false });
export const arimo = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/arimo/files/arimo-latin-wght-normal.woff2", weight: "400 700" }], variable: "--font-arimo", display: "swap", preload: false });
export const robotoCondensed = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/roboto-condensed/files/roboto-condensed-latin-wght-normal.woff2", weight: "100 900" }], variable: "--font-roboto-condensed", display: "swap", preload: false });
export const roboto = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/roboto/files/roboto-latin-wght-normal.woff2", weight: "100 900" }], variable: "--font-roboto", display: "swap", preload: false });
export const isometra = localFont({ src: [{ path: "../../node_modules/@fontsource/isometra/files/isometra-latin-400-normal.woff2", weight: "400" }], variable: "--font-isometra", display: "swap", preload: false });
export const rubik = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/rubik/files/rubik-latin-wght-normal.woff2", weight: "300 900" }], variable: "--font-rubik", display: "swap", preload: false });
export const outfit = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2", weight: "100 900" }], variable: "--font-outfit", display: "swap", preload: false });
export const poppins = localFont({ src: [{ path: "../../node_modules/@fontsource/poppins/files/poppins-latin-400-normal.woff2", weight: "400" }, { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-500-normal.woff2", weight: "500" }, { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2", weight: "600" }, { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff2", weight: "700" }], variable: "--font-poppins", display: "swap", preload: false });
export const montserrat = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2", weight: "100 900" }], variable: "--font-montserrat", display: "swap", preload: false });

// Hindi / Devanagari (ADR-019: self-hosted @fontsource, no Google CDN). Devanagari + Latin so
// mixed Hindi/English storefront copy uses one family; nothing downloads unless the theme picks it.
export const notoSansDevanagari = localFont({
  src: [
    { path: "../../node_modules/@fontsource-variable/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-wght-normal.woff2", weight: "100 900" },
    { path: "../../node_modules/@fontsource-variable/noto-sans-devanagari/files/noto-sans-devanagari-latin-wght-normal.woff2", weight: "100 900" },
  ],
  variable: "--font-noto-sans-devanagari",
  display: "swap",
  preload: false,
});
export const hind = localFont({
  src: [
    { path: "../../node_modules/@fontsource/hind/files/hind-devanagari-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/hind/files/hind-devanagari-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/hind/files/hind-devanagari-600-normal.woff2", weight: "600" },
    { path: "../../node_modules/@fontsource/hind/files/hind-devanagari-700-normal.woff2", weight: "700" },
    { path: "../../node_modules/@fontsource/hind/files/hind-latin-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/hind/files/hind-latin-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/hind/files/hind-latin-600-normal.woff2", weight: "600" },
    { path: "../../node_modules/@fontsource/hind/files/hind-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-hind",
  display: "swap",
  preload: false,
});

export const storefrontFontVariables = [
  cormorant, playfair, bodoni, bodoniExt, marcellus, manrope, jost, jostExt, spaceGrotesk, dmSans, barlowCondensed,
  asapSharp, openSans, arimo, robotoCondensed, roboto, isometra, rubik, outfit, poppins, montserrat,
  notoSansDevanagari, hind,
].map((f) => f.variable).join(" ");
