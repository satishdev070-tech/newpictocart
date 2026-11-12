import type { ThemeConfig } from "../types";

/** Radiant Alpha — Salons and beauty parlours. Palette and fonts from docs/informative/PLAN.md. */
export const radiantAlpha: ThemeConfig = {
  id: "radiant-alpha",
  name: "Radiant Alpha",
  tagline: "Soft blush and rose gold",
  bestFor: "Salons and beauty parlours",
  recommendedCategories: [
    "salon_beauty"
  ],
  demoCategory: "salon_beauty",
  tokens: {
    colors: {
      primary: "#B76E79",
      secondary: "#F8C8D0",
      accent: "#B76E79",
      background: "#FFFAFA",
      surface: "#FDEEF1",
      text: "#3B2328",
      mutedText: "#6E5157"
    },
    fonts: {
      heading: "marcellus",
      body: "jost"
    },
    radius: "xl",
    shadow: "soft",
    spacing: "comfortable",
    dark: false,
    headingCase: "normal"
  },
  layout: {
    header: "centered",
    hero: "fullBleedImage",
    servicesStyle: "menu",
    gallery: "beforeAfter",
    testimonials: "carousel",
    footer: "columns",
    motif: "none"
  },
  defaultSections: [
    "hero",
    "services_list",
    "gallery",
    "team",
    "testimonials",
    "faq",
    "cta",
    "contact"
  ],
  motion: "subtle"
};
