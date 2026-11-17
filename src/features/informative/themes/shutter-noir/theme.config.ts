import type { ThemeConfig } from "../types";

/** Shutter Noir — Photographers, filmmakers, studios, creative freelancers. Deep black with a warm amber accent, a full-bleed hero and a masonry gallery that lets the work lead. */
export const shutterNoir: ThemeConfig = {
  id: "shutter-noir",
  name: "Shutter Noir",
  tagline: "Dark, cinematic and image-first",
  bestFor: "Photographers, filmmakers, studios, creative freelancers",
  recommendedCategories: [
    "events_community",
    "personal_brand"
  ],
  demoCategory: "events_community",
  tokens: {
    colors: {
      primary: "#D4A373",
      secondary: "#EDEDED",
      accent: "#D4A373",
      background: "#0C0C0C",
      surface: "#161616",
      text: "#EDEDED",
      mutedText: "#A3A3A3"
    },
    fonts: {
      heading: "inter",
      body: "inter"
    },
    radius: "none",
    shadow: "glow",
    spacing: "airy",
    dark: true,
    headingCase: "normal"
  },
  layout: {
    header: "transparent",
    hero: "fullBleedImage",
    servicesStyle: "list",
    gallery: "masonry",
    testimonials: "quote",
    footer: "dark",
    motif: "none"
  },
  defaultSections: [
    "hero",
    "gallery",
    "about",
    "services_list",
    "pricing",
    "testimonials",
    "cta",
    "enquiry_form",
    "contact"
  ],
  motion: "subtle"
};
