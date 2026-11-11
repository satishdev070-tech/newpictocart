import type { ThemeConfig } from "../types";

/** Nexus Core — Consultancies, CA / legal firms, agencies. Palette and fonts from docs/informative/PLAN.md. */
export const nexusCore: ThemeConfig = {
  id: "nexus-core",
  name: "Nexus Core",
  tagline: "Modern, formal and trustworthy",
  bestFor: "Consultancies, CA / legal firms, agencies",
  recommendedCategories: [
    "consultancy",
    "other"
  ],
  demoCategory: "consultancy",
  tokens: {
    colors: {
      primary: "#0F2A44",
      secondary: "#4A5B6C",
      accent: "#1FA2A6",
      background: "#FFFFFF",
      surface: "#F3F6F9",
      text: "#0F2A44",
      mutedText: "#4A5B6C"
    },
    fonts: {
      heading: "inter",
      body: "inter"
    },
    radius: "md",
    shadow: "soft",
    spacing: "comfortable",
    dark: false,
    headingCase: "normal"
  },
  layout: {
    header: "classic",
    hero: "split",
    servicesStyle: "grid",
    gallery: "grid",
    testimonials: "cards",
    footer: "columns",
    motif: "stats-strip"
  },
  defaultSections: [
    "hero",
    "stats",
    "services_grid",
    "about",
    "highlights",
    "testimonials",
    "faq",
    "cta",
    "contact"
  ],
  motion: "subtle"
};
