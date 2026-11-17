import type { ThemeConfig } from "../types";

/** Clearwater Care — Clinics, family doctors, diagnostic labs, physiotherapy. Calm teal on white, a split hero with the clinic photo, and a stats strip of trust signals. */
export const clearwaterCare: ThemeConfig = {
  id: "clearwater-care",
  name: "Clearwater Care",
  tagline: "Calm, clean and reassuring",
  bestFor: "Clinics, family doctors, diagnostic labs, physiotherapy",
  recommendedCategories: [
    "clinic_healthcare"
  ],
  demoCategory: "clinic_healthcare",
  tokens: {
    colors: {
      primary: "#0F766E",
      secondary: "#E3F2EF",
      accent: "#14B8A6",
      background: "#FFFFFF",
      surface: "#F0F7F6",
      text: "#0B2A2A",
      mutedText: "#4A6362"
    },
    fonts: {
      heading: "sora",
      body: "inter"
    },
    radius: "lg",
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
    "highlights",
    "services_grid",
    "about",
    "team",
    "stats",
    "testimonials",
    "faq",
    "enquiry_form",
    "contact"
  ],
  motion: "subtle"
};
