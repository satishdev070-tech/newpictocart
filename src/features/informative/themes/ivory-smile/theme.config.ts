import type { ThemeConfig } from "../types";

/** Ivory Smile — Dental clinics, orthodontists, skin and cosmetic clinics. Deep navy with champagne accents, a full-bleed hero and before/after gallery for smile makeovers. */
export const ivorySmile: ThemeConfig = {
  id: "ivory-smile",
  name: "Ivory Smile",
  tagline: "Premium care with a gentle touch",
  bestFor: "Dental clinics, orthodontists, skin and cosmetic clinics",
  recommendedCategories: [
    "clinic_healthcare",
    "personal_brand"
  ],
  demoCategory: "clinic_healthcare",
  tokens: {
    colors: {
      primary: "#1D3557",
      secondary: "#CDE8E5",
      accent: "#B08D57",
      background: "#FBFBF8",
      surface: "#FFFFFF",
      text: "#14213D",
      mutedText: "#525C6B"
    },
    fonts: {
      heading: "manrope",
      body: "source-sans-3"
    },
    radius: "xl",
    shadow: "soft",
    spacing: "airy",
    dark: false,
    headingCase: "normal"
  },
  layout: {
    header: "centered",
    hero: "fullBleedImage",
    servicesStyle: "cards",
    gallery: "beforeAfter",
    testimonials: "carousel",
    footer: "columns",
    motif: "none"
  },
  defaultSections: [
    "hero",
    "about",
    "services_grid",
    "gallery",
    "pricing",
    "testimonials",
    "team",
    "faq",
    "enquiry_form",
    "contact"
  ],
  motion: "subtle"
};
