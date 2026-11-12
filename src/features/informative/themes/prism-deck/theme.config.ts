import type { ThemeConfig } from "../types";

/** Prism Deck — Creators, young brands, events. Palette and fonts from docs/informative/PLAN.md. */
export const prismDeck: ThemeConfig = {
  id: "prism-deck",
  name: "Prism Deck",
  tagline: "Bold gradients for a young audience",
  bestFor: "Creators, young brands, events",
  recommendedCategories: [
    "personal_brand",
    "events_community",
    "other"
  ],
  demoCategory: "events_community",
  tokens: {
    colors: {
      primary: "#4F46E5",
      secondary: "#EC4899",
      accent: "#EC4899",
      background: "#0B0B14",
      surface: "#16162B",
      text: "#F5F5FF",
      mutedText: "#B4B4D0"
    },
    fonts: {
      heading: "space-grotesk",
      body: "inter"
    },
    radius: "xl",
    shadow: "glow",
    spacing: "comfortable",
    dark: true,
    headingCase: "normal"
  },
  layout: {
    header: "minimal",
    hero: "typographic",
    servicesStyle: "deck",
    gallery: "grid",
    testimonials: "cards",
    footer: "simple",
    motif: "gradient"
  },
  defaultSections: [
    "hero",
    "services_grid",
    "stats",
    "gallery",
    "testimonials",
    "faq",
    "cta"
  ],
  motion: "lively"
};
