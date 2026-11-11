import type { ThemeConfig } from "../types";

/** Pure Gold — Luxury salons, premium consultants, interiors. Palette and fonts from docs/informative/PLAN.md. */
export const pureGold: ThemeConfig = {
  id: "pure-gold",
  name: "Pure Gold",
  tagline: "Black and gold, quietly luxurious",
  bestFor: "Luxury salons, premium consultants, interiors",
  recommendedCategories: [
    "salon_beauty",
    "consultancy",
    "interior_design"
  ],
  demoCategory: "salon_beauty",
  tokens: {
    colors: {
      primary: "#C9A227",
      secondary: "#F5EFE0",
      accent: "#C9A227",
      background: "#0A0A0A",
      surface: "#151515",
      text: "#F5EFE0",
      mutedText: "#BFB6A0"
    },
    fonts: {
      heading: "cormorant",
      body: "montserrat"
    },
    radius: "none",
    shadow: "none",
    spacing: "airy",
    dark: true,
    headingCase: "normal"
  },
  layout: {
    header: "centered",
    hero: "fullBleedImage",
    servicesStyle: "menu",
    gallery: "grid",
    testimonials: "quote",
    footer: "simple",
    motif: "gold-rules"
  },
  defaultSections: [
    "hero",
    "about",
    "services_list",
    "gallery",
    "testimonials",
    "cta",
    "contact"
  ],
  motion: "subtle"
};
