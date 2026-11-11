import localFont from "next/font/local";

/**
 * Informative Website theme fonts (docs/informative/PLAN.md), self-hosted from @fontsource like the
 * store fonts (ADR-019). Imported ONLY by informative routes (never by the root layout, proxy or
 * marketing), with preload off, so a browser downloads a family only when the active theme uses it.
 * The variables are mapped to theme font pairs in features/informative/themes/fonts.ts.
 */

const inter = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", weight: "100 900" }], variable: "--if-font-inter", display: "swap", preload: false });
const nunito = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2", weight: "200 1000" }], variable: "--if-font-nunito", display: "swap", preload: false });
const manrope = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2", weight: "200 800" }], variable: "--if-font-manrope", display: "swap", preload: false });
const sourceSans3 = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2", weight: "200 900" }], variable: "--if-font-source-sans-3", display: "swap", preload: false });
const spaceGrotesk = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2", weight: "300 700" }], variable: "--if-font-space-grotesk", display: "swap", preload: false });
const oswald = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/oswald/files/oswald-latin-wght-normal.woff2", weight: "200 700" }], variable: "--if-font-oswald", display: "swap", preload: false });
const roboto = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/roboto/files/roboto-latin-wght-normal.woff2", weight: "100 900" }], variable: "--if-font-roboto", display: "swap", preload: false });
const playfair = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2", weight: "400 900" }], variable: "--if-font-playfair", display: "swap", preload: false });
const sora = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/sora/files/sora-latin-wght-normal.woff2", weight: "100 800" }], variable: "--if-font-sora", display: "swap", preload: false });
const dmSans = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2", weight: "100 1000" }], variable: "--if-font-dm-sans", display: "swap", preload: false });
const cormorant = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2", weight: "300 700" }], variable: "--if-font-cormorant", display: "swap", preload: false });
const montserrat = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2", weight: "100 900" }], variable: "--if-font-montserrat", display: "swap", preload: false });
const jost = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/jost/files/jost-latin-wght-normal.woff2", weight: "100 900" }], variable: "--if-font-jost", display: "swap", preload: false });
const quicksand = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/quicksand/files/quicksand-latin-wght-normal.woff2", weight: "300 700" }], variable: "--if-font-quicksand", display: "swap", preload: false });
const nunitoSans = localFont({ src: [{ path: "../../node_modules/@fontsource-variable/nunito-sans/files/nunito-sans-latin-wght-normal.woff2", weight: "200 1000" }], variable: "--if-font-nunito-sans", display: "swap", preload: false });
const poppins = localFont({ src: [{ path: "../../node_modules/@fontsource/poppins/files/poppins-latin-400-normal.woff2", weight: "400" }, { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-500-normal.woff2", weight: "500" }, { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2", weight: "600" }, { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff2", weight: "700" }], variable: "--if-font-poppins", display: "swap", preload: false });
const lato = localFont({ src: [{ path: "../../node_modules/@fontsource/lato/files/lato-latin-400-normal.woff2", weight: "400" }, { path: "../../node_modules/@fontsource/lato/files/lato-latin-700-normal.woff2", weight: "700" }], variable: "--if-font-lato", display: "swap", preload: false });
const dmSerifDisplay = localFont({ src: [{ path: "../../node_modules/@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2", weight: "400" }], variable: "--if-font-dm-serif-display", display: "swap", preload: false });
const marcellus = localFont({ src: [{ path: "../../node_modules/@fontsource/marcellus/files/marcellus-latin-400-normal.woff2", weight: "400" }], variable: "--if-font-marcellus", display: "swap", preload: false });

/** Space-separated font variable classes for the informative site root. */
export const informativeFontVariables = [inter, nunito, manrope, sourceSans3, spaceGrotesk, oswald, roboto, playfair, sora, dmSans, cormorant, montserrat, jost, quicksand, nunitoSans, poppins, lato, dmSerifDisplay, marcellus].map((f) => f.variable).join(" ");
