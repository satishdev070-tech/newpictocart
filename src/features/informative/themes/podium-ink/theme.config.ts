import type { ThemeConfig } from "../types";

/** Podium Ink — Speakers, coaches, authors, independent consultants. Ink black on white with cobalt and a yellow highlight, a typographic hero and a signature motif. */
export const podiumInk: ThemeConfig = {
  id: "podium-ink",
  name: "Podium Ink",
  tagline: "Big type, bold ideas, your signature",
  bestFor: "Speakers, coaches, authors, independent consultants",
  recommendedCategories: [
    "personal_brand",
    "consultancy"
  ],
  demoCategory: "personal_brand",
  tokens: {
    colors: {
      primary: "#1E40AF",
      secondary: "#FACC15",
      accent: "#FACC15",
      background: "#FFFFFF",
      surface: "#F4F4F5",
      text: "#0A0A0A",
      mutedText: "#52525B"
    },
    fonts: {
      heading: "space-grotesk",
      body: "inter"
    },
    radius: "sm",
    shadow: "none",
    spacing: "comfortable",
    dark: false,
    headingCase: "normal"
  },
  layout: {
    header: "minimal",
    hero: "typographic",
    servicesStyle: "list",
    gallery: "grid",
    testimonials: "quote",
    footer: "simple",
    motif: "signature"
  },
  defaultSections: [
    "hero",
    "about",
    "stats",
    "services_list",
    "testimonials",
    "gallery",
    "faq",
    "cta",
    "enquiry_form"
  ],
  motion: "subtle"
};
