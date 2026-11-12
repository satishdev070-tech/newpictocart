import type { ThemeConfig } from "../types";

/** Neon Slate — Personal brands, fitness coaches, events. Palette and fonts from docs/informative/PLAN.md. */
export const neonSlate: ThemeConfig = {
  id: "neon-slate",
  name: "Neon Slate",
  tagline: "Dark, electric and glassy",
  bestFor: "Personal brands, fitness coaches, events",
  recommendedCategories: [
    "personal_brand",
    "gym_fitness",
    "events_community"
  ],
  demoCategory: "personal_brand",
  tokens: {
    colors: {
      primary: "#39FF14",
      secondary: "#00E5FF",
      accent: "#00E5FF",
      background: "#0B0F14",
      surface: "#121A23",
      text: "#E6F1FF",
      mutedText: "#9FB0C3"
    },
    fonts: {
      heading: "sora",
      body: "inter"
    },
    radius: "lg",
    shadow: "glow",
    spacing: "comfortable",
    dark: true,
    headingCase: "normal"
  },
  layout: {
    header: "minimal",
    hero: "typographic",
    servicesStyle: "glass",
    gallery: "grid",
    testimonials: "cards",
    footer: "simple",
    motif: "neon-glow"
  },
  defaultSections: [
    "hero",
    "services_grid",
    "stats",
    "testimonials",
    "gallery",
    "faq",
    "cta"
  ],
  motion: "lively"
};
