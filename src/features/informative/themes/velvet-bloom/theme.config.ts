import type { ThemeConfig } from "../types";

/** Velvet Bloom — Salons, spas, bridal makeup artists, nail studios. Blush and deep rose with gold rules, an elegant serif, a menu-style price list and a masonry gallery. */
export const velvetBloom: ThemeConfig = {
  id: "velvet-bloom",
  name: "Velvet Bloom",
  tagline: "Blush, gold and quiet elegance",
  bestFor: "Salons, spas, bridal makeup artists, nail studios",
  recommendedCategories: [
    "salon_beauty"
  ],
  demoCategory: "salon_beauty",
  tokens: {
    colors: {
      primary: "#9E4A5E",
      secondary: "#F3D9DC",
      accent: "#B8924A",
      background: "#FFF7F5",
      surface: "#FBEDEB",
      text: "#3A1F26",
      mutedText: "#6B4D54"
    },
    fonts: {
      heading: "cormorant",
      body: "montserrat"
    },
    radius: "sm",
    shadow: "none",
    spacing: "airy",
    dark: false,
    headingCase: "normal"
  },
  layout: {
    header: "centered",
    hero: "carousel",
    servicesStyle: "menu",
    gallery: "masonry",
    testimonials: "quote",
    footer: "simple",
    motif: "gold-rules"
  },
  defaultSections: [
    "hero",
    "about",
    "services_list",
    "pricing",
    "gallery",
    "testimonials",
    "team",
    "enquiry_form",
    "contact"
  ],
  motion: "subtle"
};
