import type { ThemeConfig } from "../types";

/** Saffron Table — Restaurants, cafés, caterers, home bakers and cloud kitchens. Terracotta and cream with a classic serif, a full-bleed food hero and a menu-style services list. */
export const saffronTable: ThemeConfig = {
  id: "saffron-table",
  name: "Saffron Table",
  tagline: "Warm, inviting and full of flavour",
  bestFor: "Restaurants, cafés, caterers, home bakers and cloud kitchens",
  recommendedCategories: [
    "events_community",
    "other"
  ],
  demoCategory: "events_community",
  tokens: {
    colors: {
      primary: "#9A3412",
      secondary: "#F2E3C6",
      accent: "#D97706",
      background: "#FFF8EE",
      surface: "#FBEFDC",
      text: "#2E1A12",
      mutedText: "#6A4E3F"
    },
    fonts: {
      heading: "playfair",
      body: "lato"
    },
    radius: "md",
    shadow: "soft",
    spacing: "comfortable",
    dark: false,
    headingCase: "normal"
  },
  layout: {
    header: "centered",
    hero: "fullBleedImage",
    servicesStyle: "menu",
    gallery: "grid",
    testimonials: "cards",
    footer: "dark",
    motif: "none"
  },
  defaultSections: [
    "hero",
    "about",
    "services_list",
    "gallery",
    "highlights",
    "testimonials",
    "cta",
    "contact",
    "enquiry_form"
  ],
  motion: "subtle"
};
