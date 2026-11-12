/**
 * Theme font keys → CSS (pure). Variables are defined by src/app/informative-fonts.ts (self-hosted,
 * preload off). A font pair is "<heading>/<body>"; sellers can switch pairs in Appearance.
 */
export const FONT_KEYS = [
  "inter", "poppins", "nunito", "manrope", "source-sans-3", "space-grotesk", "oswald", "roboto", "playfair",
  "lato", "sora", "dm-serif-display", "dm-sans", "cormorant", "montserrat", "marcellus", "jost", "quicksand", "nunito-sans",
] as const;
export type FontKey = (typeof FONT_KEYS)[number];

const SERIF = new Set<FontKey>(["playfair", "dm-serif-display", "cormorant", "marcellus"]);

export function fontStack(key: FontKey): string {
  return `var(--if-font-${key}), ${SERIF.has(key) ? 'Georgia, "Times New Roman", serif' : 'system-ui, -apple-system, "Segoe UI", sans-serif'}`;
}

/** The pairs used by the 11 themes; the Appearance picker offers exactly these. */
export const FONT_PAIRS = [
  { id: "inter-inter", label: "Inter", heading: "inter", body: "inter" },
  { id: "poppins-nunito", label: "Poppins + Nunito", heading: "poppins", body: "nunito" },
  { id: "manrope-source-sans-3", label: "Manrope + Source Sans 3", heading: "manrope", body: "source-sans-3" },
  { id: "space-grotesk-inter", label: "Space Grotesk + Inter", heading: "space-grotesk", body: "inter" },
  { id: "oswald-roboto", label: "Oswald + Roboto", heading: "oswald", body: "roboto" },
  { id: "playfair-lato", label: "Playfair Display + Lato", heading: "playfair", body: "lato" },
  { id: "sora-inter", label: "Sora + Inter", heading: "sora", body: "inter" },
  { id: "dm-serif-display-dm-sans", label: "DM Serif Display + DM Sans", heading: "dm-serif-display", body: "dm-sans" },
  { id: "cormorant-montserrat", label: "Cormorant + Montserrat", heading: "cormorant", body: "montserrat" },
  { id: "marcellus-jost", label: "Marcellus + Jost", heading: "marcellus", body: "jost" },
  { id: "quicksand-nunito-sans", label: "Quicksand + Nunito Sans", heading: "quicksand", body: "nunito-sans" },
] as const satisfies readonly { id: string; label: string; heading: FontKey; body: FontKey }[];
export type FontPairId = (typeof FONT_PAIRS)[number]["id"];

export function findFontPair(id: string | null | undefined) {
  return FONT_PAIRS.find((p) => p.id === id) ?? null;
}
