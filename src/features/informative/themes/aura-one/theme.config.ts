import type { ThemeConfig } from "../types";

/** Aura One — Dance academies, public speaking, community events. Palette and fonts from docs/informative/PLAN.md. */
export const auraOne: ThemeConfig = {
  id: "aura-one",
  name: "Aura One",
  tagline: "Warm, aspirational and energetic",
  bestFor: "Dance academies, public speaking, community events",
  recommendedCategories: [
    "dance_academy_coaching",
    "events_community"
  ],
  demoCategory: "dance_academy_coaching",
  tokens: {
    colors: {
      primary: "#6C3FC5",
      secondary: "#FF7A59",
      accent: "#FF7A59",
      background: "#FFF8F0",
      surface: "#FFFFFF",
      text: "#2A1B4A",
      mutedText: "#5B4E70"
    },
    fonts: {
      heading: "poppins",
      body: "nunito"
    },
    radius: "xl",
    shadow: "medium",
    spacing: "comfortable",
    dark: false,
    headingCase: "normal"
  },
  layout: {
    header: "transparent",
    hero: "fullBleedImage",
    servicesStyle: "cards",
    gallery: "grid",
    testimonials: "carousel",
    footer: "dark",
    motif: "none"
  },
  defaultSections: [
    "hero",
    "services_grid",
    "highlights",
    "gallery",
    "testimonials",
    "team",
    "faq",
    "cta"
  ],
  motion: "lively"
};
