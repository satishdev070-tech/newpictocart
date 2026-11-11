import type { ThemeConfig } from "../types";

/** Smooth Wave — Wellness, clinics, therapists. Palette and fonts from docs/informative/PLAN.md. */
export const smoothWave: ThemeConfig = {
  id: "smooth-wave",
  name: "Smooth Wave",
  tagline: "Ultra-soothing, light and airy",
  bestFor: "Wellness, clinics, therapists",
  recommendedCategories: [
    "clinic_healthcare",
    "other"
  ],
  demoCategory: "clinic_healthcare",
  tokens: {
    colors: {
      primary: "#A8DADC",
      secondary: "#CDE7F0",
      accent: "#F1E9DA",
      background: "#F7FBFC",
      surface: "#FFFFFF",
      text: "#1F3A40",
      mutedText: "#4D666B"
    },
    fonts: {
      heading: "quicksand",
      body: "nunito-sans"
    },
    radius: "xl",
    shadow: "soft",
    spacing: "airy",
    dark: false,
    headingCase: "normal"
  },
  layout: {
    header: "classic",
    hero: "split",
    servicesStyle: "cards",
    gallery: "grid",
    testimonials: "carousel",
    footer: "columns",
    motif: "wave"
  },
  defaultSections: [
    "hero",
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
