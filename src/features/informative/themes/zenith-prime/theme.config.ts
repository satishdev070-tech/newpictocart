import type { ThemeConfig } from "../types";

/** Zenith Prime — Clinics and healthcare practices. Palette and fonts from docs/informative/PLAN.md. */
export const zenithPrime: ThemeConfig = {
  id: "zenith-prime",
  name: "Zenith Prime",
  tagline: "Calm, clinical and reassuring",
  bestFor: "Clinics and healthcare practices",
  recommendedCategories: [
    "clinic_healthcare"
  ],
  demoCategory: "clinic_healthcare",
  tokens: {
    colors: {
      primary: "#0E9F8E",
      secondary: "#3B82F6",
      accent: "#3B82F6",
      background: "#FFFFFF",
      surface: "#EEF9F6",
      text: "#12312D",
      mutedText: "#4B635F"
    },
    fonts: {
      heading: "manrope",
      body: "source-sans-3"
    },
    radius: "lg",
    shadow: "soft",
    spacing: "airy",
    dark: false,
    headingCase: "normal"
  },
  layout: {
    header: "classic",
    hero: "split",
    servicesStyle: "list",
    gallery: "grid",
    testimonials: "cards",
    footer: "columns",
    motif: "none"
  },
  defaultSections: [
    "hero",
    "services_list",
    "team",
    "highlights",
    "testimonials",
    "contact",
    "faq",
    "cta"
  ],
  motion: "subtle"
};
