import type { ThemeConfig } from "../types";

/** Ascent Peak — Gyms and fitness studios. Palette and fonts from docs/informative/PLAN.md. */
export const ascentPeak: ThemeConfig = {
  id: "ascent-peak",
  name: "Ascent Peak",
  tagline: "Uphill energy, built to climb",
  bestFor: "Gyms and fitness studios",
  recommendedCategories: [
    "gym_fitness"
  ],
  demoCategory: "gym_fitness",
  tokens: {
    colors: {
      primary: "#FF6B00",
      secondary: "#1C1F24",
      accent: "#FF6B00",
      background: "#F4F5F6",
      surface: "#FFFFFF",
      text: "#1C1F24",
      mutedText: "#4F555E"
    },
    fonts: {
      heading: "oswald",
      body: "roboto"
    },
    radius: "sm",
    shadow: "medium",
    spacing: "comfortable",
    dark: false,
    headingCase: "uppercase"
  },
  layout: {
    header: "classic",
    hero: "split",
    servicesStyle: "cards",
    gallery: "grid",
    testimonials: "cards",
    footer: "dark",
    motif: "mountain"
  },
  defaultSections: [
    "hero",
    "services_grid",
    "team",
    "pricing",
    "testimonials",
    "faq",
    "cta",
    "contact"
  ],
  motion: "subtle"
};
