import type { ThemeConfig } from "../types";

/** Sunny Scholar — Coaching centres, tuition classes, music and art schools. Cobalt blue with sunshine yellow, rounded cards, a split hero and a results strip parents trust. */
export const sunnyScholar: ThemeConfig = {
  id: "sunny-scholar",
  name: "Sunny Scholar",
  tagline: "Bright, friendly and encouraging",
  bestFor: "Coaching centres, tuition classes, music and art schools",
  recommendedCategories: [
    "dance_academy_coaching",
    "personal_brand"
  ],
  demoCategory: "dance_academy_coaching",
  tokens: {
    colors: {
      primary: "#2563EB",
      secondary: "#FBBF24",
      accent: "#F97316",
      background: "#FFFDF7",
      surface: "#FFFFFF",
      text: "#1E293B",
      mutedText: "#475569"
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
    header: "classic",
    hero: "split",
    servicesStyle: "cards",
    gallery: "grid",
    testimonials: "carousel",
    footer: "columns",
    motif: "stats-strip"
  },
  defaultSections: [
    "hero",
    "highlights",
    "services_grid",
    "stats",
    "team",
    "pricing",
    "testimonials",
    "faq",
    "enquiry_form",
    "contact"
  ],
  motion: "lively"
};
